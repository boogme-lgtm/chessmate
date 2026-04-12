import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Zap,
} from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  isAfter,
  isBefore,
  addMinutes,
  startOfDay,
  endOfDay,
} from "date-fns";
import { toast } from "sonner";

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

interface BookingCalendarProps {
  coachId: number;
  hourlyRateCents: number;
  minAdvanceHours?: number | null;
  maxAdvanceDays?: number | null;
  bufferMinutes?: number | null;
  lessonDurations?: number[];
  onSelectSlot: (slot: TimeSlot, duration: number) => void;
}

// Schedule format: map of weekday name (lowercase) to list of time windows.
// Each window is `{ start: "HH:MM", end: "HH:MM" }` in the coach's local time.
// Empty or missing schedule falls back to Mon-Fri 09:00-17:00.
type DayName = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
type TimeWindow = { start: string; end: string };
type WeeklySchedule = Partial<Record<DayName, TimeWindow[]>>;

const WEEKDAY_NAMES: DayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
};

/**
 * Parse the schedule from the DB into the flat WeeklySchedule format.
 * Handles two shapes:
 *   - Flat (Sprint 2): { monday: [{start, end}], ... }
 *   - Nested (onboarding wizard): { monday: { enabled: true, slots: [{start, end}] }, ... }
 * Falls back to DEFAULT_SCHEDULE if nothing usable is found.
 */
function parseSchedule(raw: unknown): WeeklySchedule {
  if (!raw || typeof raw !== "object") return DEFAULT_SCHEDULE;
  const schedule = raw as Record<string, unknown>;
  const result: WeeklySchedule = {};
  let foundAny = false;

  for (const day of WEEKDAY_NAMES) {
    const val = schedule[day];
    if (Array.isArray(val) && val.length > 0) {
      // Flat format: already TimeWindow[]
      result[day] = val as TimeWindow[];
      foundAny = true;
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      // Nested format from onboarding wizard: { enabled: bool, slots: [{start, end}] }
      const nested = val as { enabled?: boolean; slots?: TimeWindow[] };
      if (nested.enabled && Array.isArray(nested.slots) && nested.slots.length > 0) {
        result[day] = nested.slots;
        foundAny = true;
      }
      // If enabled === false, omit the day (coach marked it as unavailable)
    }
  }

  return foundAny ? result : DEFAULT_SCHEDULE;
}

function parseHHMM(hhmm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Build all candidate slots for a given day from the schedule.
 * Respects coach's schedule windows and the requested slot duration.
 */
function buildSlotsForDay(
  date: Date,
  schedule: WeeklySchedule,
  durationMinutes: number,
  stepMinutes: number
): { start: Date; end: Date }[] {
  const dayName = WEEKDAY_NAMES[date.getDay()];
  const windows = schedule[dayName];
  if (!windows || windows.length === 0) return [];

  const slots: { start: Date; end: Date }[] = [];

  for (const window of windows) {
    const start = parseHHMM(window.start);
    const end = parseHHMM(window.end);
    if (!start || !end) continue;

    const windowStart = new Date(date);
    windowStart.setHours(start.hour, start.minute, 0, 0);
    const windowEnd = new Date(date);
    windowEnd.setHours(end.hour, end.minute, 0, 0);

    let cursor = windowStart;
    while (addMinutes(cursor, durationMinutes) <= windowEnd) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      slots.push({ start: cursor, end: slotEnd });
      cursor = addMinutes(cursor, stepMinutes);
    }
  }

  return slots;
}

interface BookedSlot {
  start: Date;
  end: Date;
}

function slotsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Booking Calendar — fetches real coach availability and renders time slots
 * for the selected date, filtering out booked lessons + past/out-of-window
 * slots. Falls back to a Mon-Fri 9-5 default schedule if the coach hasn't
 * configured one yet.
 */
export default function BookingCalendar({
  coachId,
  hourlyRateCents,
  minAdvanceHours = 24,
  maxAdvanceDays = 30,
  bufferMinutes = 15,
  lessonDurations = [60],
  onSelectSlot,
}: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDuration, setSelectedDuration] = useState<number>(lessonDurations[0]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );

  // Calculate earliest bookable time (minAdvanceHours from now)
  const earliestBookable = useMemo(() => {
    const now = new Date();
    const hours = minAdvanceHours || 24;
    return addMinutes(now, hours * 60);
  }, [minAdvanceHours]);

  // Calculate latest bookable date
  const latestBookable = useMemo(() => {
    const days = maxAdvanceDays || 30;
    return addDays(new Date(), days);
  }, [maxAdvanceDays]);

  // Fetch real availability data covering the full bookable window
  const availabilityRange = useMemo(
    () => ({
      startDate: startOfDay(new Date()).toISOString(),
      endDate: endOfDay(latestBookable).toISOString(),
    }),
    [latestBookable]
  );

  const { data: availability, isLoading: availabilityLoading } =
    trpc.coach.getAvailability.useQuery(
      {
        coachId,
        startDate: availabilityRange.startDate,
        endDate: availabilityRange.endDate,
      },
      { enabled: !!coachId }
    );

  const schedule = useMemo(
    () => parseSchedule(availability?.schedule),
    [availability?.schedule]
  );

  const bookedSlots: BookedSlot[] = useMemo(() => {
    if (!availability?.bookedSlots) return [];
    return availability.bookedSlots.map((b: any) => {
      const start = new Date(b.start);
      const end = addMinutes(start, b.durationMinutes || 60);
      return { start, end };
    });
  }, [availability?.bookedSlots]);

  // Generate week days for calendar
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Compute slots for the selected date, filtering out booked, past, and
  // out-of-window slots. Respects coach's bufferMinutes.
  const availableSlots = useMemo<TimeSlot[]>(() => {
    const buffer = bufferMinutes ?? 15;
    const stepMinutes = Math.max(15, selectedDuration); // one slot per duration block

    const rawSlots = buildSlotsForDay(
      selectedDate,
      schedule,
      selectedDuration,
      stepMinutes
    );

    return rawSlots.map(slot => {
      const inFuture = isAfter(slot.start, earliestBookable);
      const beforeMax = isBefore(slot.start, latestBookable);

      // Check for overlap with any booked slot (including buffer padding)
      const blockedByBooking = bookedSlots.some(booked => {
        const paddedStart = addMinutes(booked.start, -buffer);
        const paddedEnd = addMinutes(booked.end, buffer);
        return slotsOverlap(slot.start, slot.end, paddedStart, paddedEnd);
      });

      return {
        start: slot.start,
        end: slot.end,
        available: inFuture && beforeMax && !blockedByBooking,
      };
    });
  }, [
    selectedDate,
    selectedDuration,
    schedule,
    bookedSlots,
    earliestBookable,
    latestBookable,
    bufferMinutes,
  ]);

  const handlePreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    if (!slot.available) return;
    onSelectSlot(slot, selectedDuration);
  };

  // Find next available slot across future days (using real schedule + bookings)
  const findNextAvailableSlot = () => {
    const maxDaysToCheck = maxAdvanceDays || 30;
    const buffer = bufferMinutes ?? 15;
    const stepMinutes = Math.max(15, selectedDuration);

    for (let dayOffset = 0; dayOffset <= maxDaysToCheck; dayOffset++) {
      const checkDate = addDays(new Date(), dayOffset);
      const rawSlots = buildSlotsForDay(
        checkDate,
        schedule,
        selectedDuration,
        stepMinutes
      );

      const availableSlot = rawSlots.find(slot => {
        const inFuture = isAfter(slot.start, earliestBookable);
        const beforeMax = isBefore(slot.start, latestBookable);
        if (!inFuture || !beforeMax) return false;

        const blockedByBooking = bookedSlots.some(booked => {
          const paddedStart = addMinutes(booked.start, -buffer);
          const paddedEnd = addMinutes(booked.end, buffer);
          return slotsOverlap(slot.start, slot.end, paddedStart, paddedEnd);
        });
        return !blockedByBooking;
      });

      if (availableSlot) {
        setCurrentWeekStart(startOfWeek(checkDate, { weekStartsOn: 1 }));
        setSelectedDate(checkDate);
        return;
      }
    }

    toast.error("No available slots found in the next " + maxDaysToCheck + " days");
  };

  const calculatePrice = (duration: number) => {
    return ((hourlyRateCents / 100) * (duration / 60)).toFixed(0);
  };

  return (
    <div className="space-y-6">
      {/* Next Available Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={findNextAvailableSlot}
          disabled={availabilityLoading}
          className="gap-2 font-light"
        >
          <Zap className="w-4 h-4" />
          Next Available
        </Button>
      </div>
      {/* Duration Selection */}
      {lessonDurations.length > 1 && (
        <div>
          <label className="text-sm font-medium mb-2 block">Lesson Duration</label>
          <div className="flex gap-2">
            {lessonDurations.map((duration) => (
              <Button
                key={duration}
                variant={selectedDuration === duration ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDuration(duration)}
              >
                {duration} min · ${calculatePrice(duration)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Week Navigator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousWeek}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day Selection */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isPast = isBefore(day, startOfDay(new Date()));
              const isTooFar = isAfter(day, latestBookable);
              const isDisabled = isPast || isTooFar;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => !isDisabled && handleSelectDate(day)}
                  disabled={isDisabled}
                  className={`
                    p-3 rounded-lg border-2 transition-all
                    ${isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                    }
                    ${isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer"
                    }
                  `}
                >
                  <div className="text-xs font-medium mb-1">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-lg font-semibold">
                    {format(day, "d")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Time Slots */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Available Times for {format(selectedDate, "EEEE, MMMM d")}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
              {availabilityLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))
              ) : availableSlots.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No available slots for this date
                </div>
              ) : (
                availableSlots.map((slot, index) => (
                  <Button
                    key={index}
                    variant={slot.available ? "outline" : "ghost"}
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => handleSelectSlot(slot)}
                    className={`
                      ${slot.available
                        ? "hover:bg-primary hover:text-primary-foreground"
                        : "opacity-40 cursor-not-allowed line-through"
                      }
                    `}
                  >
                    {format(slot.start, "h:mm a")}
                  </Button>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Info */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>Select a time slot to continue</span>
        </div>
        <Badge variant="secondary">
          ${calculatePrice(selectedDuration)} for {selectedDuration} min
        </Badge>
      </div>
    </div>
  );
}
