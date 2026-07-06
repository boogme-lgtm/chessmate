import { getDb, createLesson } from "./db";
import { lessons, coachProfiles, users } from "../drizzle/schema";
import { eq, and, ne, notInArray } from "drizzle-orm";
import { calculateLessonBreakdown, getTierFeePercent } from "@shared/pricing";

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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

  // Tier-based platform commission (Free=12%, Pro=8%, Elite=5%).
  const breakdown = calculateLessonBreakdown({
    lessonPriceCents: totalCents,
    tier: coach.pricingTier,
  });

  return {
    totalCents,
    commissionCents: breakdown.platformFeeCents,
    coachPayoutCents: breakdown.coachPayoutCents,
    currency: coach.currency || "USD",
    hourlyRateCents: hourlyRate,
    commissionRate: getTierFeePercent(coach.pricingTier),
  };
}

/**
 * Check if a time slot is available for a coach
 */
// A never-started checkout hold (pending_payment with no Stripe session) is
// treated as abandoned after this short window.
export const PENDING_HOLD_MS = 15 * 60 * 1000; // 15 minutes
// A started-but-unpaid hold (has a Stripe checkout session) keeps the slot until
// the Stripe session itself would have expired — so a student who is mid-checkout
// (even slowly, minutes later) never loses their slot to another booking, which
// would otherwise let BOTH pay for the same slot.
export const STRIPE_SESSION_MAX_MS = 24 * 60 * 60 * 1000; // 24 hours

// Statuses that free the slot: terminal-refunded (cancelled/refunded/declined) and
// cancel_pending (always finalizes to cancelled). decline_pending is intentionally
// NOT here — a failed decline refund bounces the lesson back to payment_collected,
// so freeing it mid-flight could double-book the slot.
export const SLOT_FREE_STATUSES = ["cancelled", "refunded", "declined", "cancel_pending"] as const;

interface SlotLessonRow {
  status: string;
  scheduledAt: Date | string;
  durationMinutes: number | null;
  createdAt: Date | string | null;
  stripeCheckoutSessionId: string | null;
}

/**
 * Pure slot-conflict decision (no DB) — unit-testable. Returns true if the
 * proposed [scheduledAt, scheduledAt+duration) window overlaps any existing
 * lesson that still holds the slot. Abandoned pending_payment holds are ignored.
 */
export function slotHasConflict(
  existing: SlotLessonRow[],
  scheduledAt: Date,
  durationMinutes: number,
  now: number
): boolean {
  const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);
  const shortCutoff = now - PENDING_HOLD_MS;
  const sessionCutoff = now - STRIPE_SESSION_MAX_MS;

  for (const lesson of existing) {
    if ((SLOT_FREE_STATUSES as readonly string[]).includes(lesson.status)) continue;

    if (lesson.status === "pending_payment") {
      const created = lesson.createdAt ? new Date(lesson.createdAt).getTime() : 0;
      // With a live checkout session the hold survives until the session expires;
      // without one it's an abandonment after the short window.
      const abandoned = lesson.stripeCheckoutSessionId
        ? created < sessionCutoff
        : created < shortCutoff;
      if (abandoned) continue;
    }

    const lessonStart = new Date(lesson.scheduledAt);
    const lessonEnd = new Date(lessonStart.getTime() + (lesson.durationMinutes || 60) * 60000);
    if (scheduledAt < lessonEnd && endTime > lessonStart) {
      return true; // overlap with a slot-holding lesson
    }
  }
  return false;
}

export async function isTimeSlotAvailable(
  coachId: number,
  scheduledAt: Date,
  durationMinutes: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  const existing = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.coachId, coachId),
        notInArray(lessons.status, [...SLOT_FREE_STATUSES])
      )
    );

  return !slotHasConflict(existing as any, scheduledAt, durationMinutes, Date.now());
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

  // Get all booked lessons in the date range (exclude cancelled and refunded)
  const bookedLessons = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.coachId, coachId),
        notInArray(lessons.status, ["cancelled", "refunded"])
      )
    );

  return {
    schedule,
    bookedLessons,
    minAdvanceHours: coach.minAdvanceHours || 24,
    maxAdvanceDays: coach.maxAdvanceDays || 30,
    bufferMinutes: coach.bufferMinutes || 15,
    lessonDurations: safeJsonParse(coach.lessonDurations, [60]),
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

  // Delegate to db.createLesson which uses raw SQL to bypass the Drizzle
  // INSERT `id = 'default'` bug that MySQL rejects. db.createLesson also
  // returns a constructed lesson object so the caller has the insertId.
  const lesson = await createLesson({
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
    status: "pending_confirmation",
  });

  return lesson;
}
