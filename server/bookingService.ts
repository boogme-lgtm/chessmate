import { getDb } from "./db";
import { lessons, coachProfiles, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Calculate pricing for a lesson booking
 * Returns amounts in cents to avoid floating point issues
 */
export async function calculateLessonPricing(coachId: number, durationMinutes: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const coach = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, coachId))
    .limit(1)
    .then((rows: any[]) => rows[0]);

  if (!coach) {
    throw new Error("Coach not found");
  }

  // Calculate total amount based on hourly rate and duration
  const hourlyRate = coach.hourlyRateCents || 5000; // Default $50
  const totalCents = Math.round((hourlyRate / 60) * durationMinutes);

  // Calculate platform commission
  const commissionRate = coach.commissionRate || 15; // Default 15%
  const commissionCents = Math.round(totalCents * (commissionRate / 100));

  // Coach payout after commission
  const coachPayoutCents = totalCents - commissionCents;

  return {
    totalCents,
    commissionCents,
    coachPayoutCents,
    currency: coach.currency || "USD",
    hourlyRateCents: hourlyRate,
    commissionRate,
  };
}

/**
 * Check if a time slot is available for a coach
 */
export async function isTimeSlotAvailable(
  coachId: number,
  scheduledAt: Date,
  durationMinutes: number
): Promise<boolean> {
  const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);

  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  // Check for overlapping lessons
  const overlapping = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.coachId, coachId),
        // Lesson is not cancelled or refunded
        // @ts-ignore - MySQL enum comparison
        lessons.status !== "cancelled",
        // @ts-ignore
        lessons.status !== "refunded"
      )
    );

  // Check each lesson for time overlap
  for (const lesson of overlapping) {
    const lessonStart = new Date(lesson.scheduledAt);
    const lessonEnd = new Date(lessonStart.getTime() + (lesson.durationMinutes || 60) * 60000);

    // Check if times overlap
    if (scheduledAt < lessonEnd && endTime > lessonStart) {
      return false; // Slot is taken
    }
  }

  return true; // Slot is available
}

/**
 * Get coach's available time slots for a given date range
 */
export async function getCoachAvailability(
  coachId: number,
  startDate: Date,
  endDate: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const coach = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, coachId))
    .limit(1)
    .then((rows: any[]) => rows[0]);

  if (!coach) {
    throw new Error("Coach not found");
  }

  // Parse availability schedule (stored as JSON)
  let schedule: any = {};
  try {
    schedule = coach.availabilitySchedule ? JSON.parse(coach.availabilitySchedule) : {};
  } catch (e) {
    console.error("Failed to parse availability schedule:", e);
  }

  // Get all booked lessons in the date range
  const bookedLessons = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.coachId, coachId),
        // @ts-ignore
        lessons.status !== "cancelled",
        // @ts-ignore
        lessons.status !== "refunded"
      )
    );

  return {
    schedule,
    bookedLessons,
    minAdvanceHours: coach.minAdvanceHours || 24,
    maxAdvanceDays: coach.maxAdvanceDays || 30,
    bufferMinutes: coach.bufferMinutes || 15,
    lessonDurations: coach.lessonDurations ? JSON.parse(coach.lessonDurations) : [60],
  };
}

/**
 * Create a new lesson booking
 */
export async function createBooking(data: {
  studentId: number;
  coachId: number;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  topic?: string;
  notes?: string;
}) {
  // Check if time slot is available
  const available = await isTimeSlotAvailable(
    data.coachId,
    data.scheduledAt,
    data.durationMinutes
  );

  if (!available) {
    throw new Error("Time slot is not available");
  }

  // Calculate pricing
  const pricing = await calculateLessonPricing(data.coachId, data.durationMinutes);

  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  // Create lesson record
  const [lesson] = await db.insert(lessons).values({
    studentId: data.studentId,
    coachId: data.coachId,
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes,
    timezone: data.timezone,
    topic: data.topic,
    notes: data.notes,
    amountCents: pricing.totalCents,
    commissionCents: pricing.commissionCents,
    coachPayoutCents: pricing.coachPayoutCents,
    currency: pricing.currency,
    status: "pending",
  });

  return lesson;
}
