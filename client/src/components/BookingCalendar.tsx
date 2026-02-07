import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Calendar as CalendarIcon,
  Zap
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isAfter, isBefore, addMinutes, startOfDay } from "date-fns";
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

/**
 * Booking Calendar Component
 * Shows available time slots for a coach and allows students to select a time
 * Simple, clean design focusing on ease of use
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

  // Generate week days for calendar
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // TODO: Fetch actual availability from backend
  // For now, generate mock availability (9am-5pm, every hour)
  const generateMockSlots = (date: Date): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const dayStart = startOfDay(date);
    
    // Generate slots from 9am to 5pm
    for (let hour = 9; hour < 17; hour++) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = addMinutes(slotStart, selectedDuration);
      
      // Check if slot is in valid booking window
      const isInFuture = isAfter(slotStart, earliestBookable);
      const isBeforeMax = isBefore(slotStart, latestBookable);
      
      slots.push({
        start: slotStart,
        end: slotEnd,
        available: isInFuture && isBeforeMax,
      });
    }
    
    return slots;
  };

  const availableSlots = useMemo(() => {
    return generateMockSlots(selectedDate);
  }, [selectedDate, selectedDuration, earliestBookable, latestBookable]);

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

  // Find next available slot across all future days
  const findNextAvailableSlot = () => {
    const maxDaysToCheck = maxAdvanceDays || 30;
    
    for (let dayOffset = 0; dayOffset <= maxDaysToCheck; dayOffset++) {
      const checkDate = addDays(new Date(), dayOffset);
      const slots = generateMockSlots(checkDate);
      
      const availableSlot = slots.find(slot => slot.available);
      if (availableSlot) {
        // Set the week and date to show this slot
        setCurrentWeekStart(startOfWeek(checkDate, { weekStartsOn: 1 }));
        setSelectedDate(checkDate);
        return;
      }
    }
    
    // No available slots found
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
              {availableSlots.length === 0 ? (
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
                        : "opacity-40 cursor-not-allowed"
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
