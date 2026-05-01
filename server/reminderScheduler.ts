/**
 * BoogMe Lesson Reminder Scheduler
 *
 * Runs every hour and sends 24-hour reminder emails to both students and coaches
 * for lessons scheduled in the 20–28 hour window ahead.
 *
 * Window is intentionally wider than exactly 24h to handle scheduler drift
 * and ensure no lesson slips through without a reminder.
 */

import { sql } from "drizzle-orm";
import { getDb, cancelLesson } from "./db";
import {
  sendEmail,
  getStudentLessonReminderEmail,
  getCoachLessonReminderEmail,
  getStudentCancellationEmail,
  getCoachCancellationEmail,
} from "./emailService";

interface LessonReminderRow {
  lessonId: number;
  scheduledAt: Date;
  durationMinutes: number;
  cancellationToken: string | null;
  studentId: number;
  studentName: string | null;
  studentEmail: string;
  coachId: number;
  coachName: string | null;
  coachEmail: string;
}

/**
 * Format a UTC Date into a human-readable date string.
 * e.g. "Wednesday, March 19, 2026"
 */
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format a UTC Date into a human-readable time string.
 * e.g. "2:00 PM UTC"
 */
function formatTime(d: Date): string {
  return (
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " UTC"
  );
}

/**
 * Core reminder job — called by the scheduler every hour.
 */
export async function sendPendingReminders(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20h from now
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);   // 28h from now

  console.log(
    `[Reminder Scheduler] Checking for lessons between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`
  );

  // Fetch all confirmed/paid lessons in the reminder window that haven't been reminded yet
  const dbInstance = await getDb();
  if (!dbInstance) {
    console.warn("[Reminder Scheduler] Database not available, skipping.");
    return;
  }

  const rows = await dbInstance.execute(sql`
    SELECT
      l.id           AS lessonId,
      l.scheduledAt,
      l.durationMinutes,
      l.cancellationToken,
      l.studentId,
      su.name        AS studentName,
      su.email       AS studentEmail,
      l.coachId,
      cu.name        AS coachName,
      cu.email       AS coachEmail
    FROM lessons l
    JOIN users su ON su.id = l.studentId
    JOIN users cu ON cu.id = l.coachId
    WHERE l.status IN ('confirmed', 'paid', 'pending_confirmation')
      AND l.scheduledAt >= ${windowStart}
      AND l.scheduledAt <= ${windowEnd}
      AND l.reminderSentAt IS NULL
      AND l.cancelledAt IS NULL
  `);

  const lessons = (rows as any[])[0] as LessonReminderRow[];

  if (!lessons || lessons.length === 0) {
    console.log("[Reminder Scheduler] No lessons due for reminders.");
    return;
  }

  console.log(`[Reminder Scheduler] Found ${lessons.length} lesson(s) to remind.`);

  for (const lesson of lessons) {
    const lessonDate = formatDate(new Date(lesson.scheduledAt));
    const lessonTime = formatTime(new Date(lesson.scheduledAt));
    const studentName = lesson.studentName || "Student";
    const coachName = lesson.coachName || "Coach";
    const cancelToken = lesson.cancellationToken || "";

    let studentSent = false;
    let coachSent = false;

    // Send to student
    try {
      const html = getStudentLessonReminderEmail(
        studentName,
        coachName,
        lessonDate,
        lessonTime,
        lesson.durationMinutes,
        lesson.lessonId,
        cancelToken
      );
      const result = await sendEmail({
        to: lesson.studentEmail,
        subject: `⏰ Reminder: Your chess lesson with ${coachName} is tomorrow`,
        html,
      });
      studentSent = result.success;
    } catch (err) {
      console.error(`[Reminder Scheduler] Failed to send student reminder for lesson ${lesson.lessonId}:`, err);
    }

    // Send to coach
    try {
      const html = getCoachLessonReminderEmail(
        coachName,
        studentName,
        lessonDate,
        lessonTime,
        lesson.durationMinutes,
        lesson.lessonId
      );
      const result = await sendEmail({
        to: lesson.coachEmail,
        subject: `⏰ Reminder: Your lesson with ${studentName} is tomorrow`,
        html,
      });
      coachSent = result.success;
    } catch (err) {
      console.error(`[Reminder Scheduler] Failed to send coach reminder for lesson ${lesson.lessonId}:`, err);
    }

    // Only mark as fully sent if BOTH emails succeeded
    if (studentSent && coachSent) {
      await dbInstance.execute(sql`
        UPDATE lessons
        SET reminderSentAt = NOW()
        WHERE id = ${lesson.lessonId}
      `);
      console.log(
        `[Reminder Scheduler] Both reminders sent for lesson ${lesson.lessonId}`
      );
    } else if (studentSent || coachSent) {
      // Partial success — log but don't mark as sent so it retries next hour
      console.warn(
        `[Reminder Scheduler] Partial reminder for lesson ${lesson.lessonId} (student: ${studentSent}, coach: ${coachSent}) — will retry next hour`
      );
    }
  }
}

/**
 * Auto-decline stale booking requests whose confirmationDeadline has passed.
 *
 * Handles two cases:
 * 1. payment_collected — student has already paid; must issue a full Stripe
 *    refund BEFORE marking as declined. Only emails the student about the
 *    refund if Stripe refund creation actually succeeded. On Stripe failure,
 *    the lesson is left in a `refund_failed` state for admin retry.
 * 2. pending_confirmation (legacy) — no payment was taken; cancel directly.
 */
export async function autoDeclineStaleBookings(): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) {
    console.warn("[Auto-Decline] Database not available, skipping.");
    return;
  }

  // Find both payment_collected (new) and pending_confirmation (legacy) lessons
  // whose confirmation deadline has expired.
  const result: any = await dbInstance.execute(sql`
    SELECT id, status, stripePaymentIntentId, amountCents
    FROM lessons
    WHERE status IN ('payment_collected', 'pending_confirmation')
      AND confirmationDeadline IS NOT NULL
      AND confirmationDeadline <= NOW()
  `);

  const rows = result[0] as {
    id: number;
    status: string;
    stripePaymentIntentId: string | null;
    amountCents: number;
  }[];

  if (!rows || rows.length === 0) {
    console.log("[Auto-Decline] No stale pending_confirmation or payment_collected lessons.");
    return;
  }

  console.log(`[Auto-Decline] Found ${rows.length} lesson(s) past confirmation deadline.`);

  const { getLessonById, getUserById } = await import("./db");
  const stripeService = await import("./stripe");

  for (const row of rows) {
    try {
      if (row.status === 'payment_collected') {
        // Payment-first model: student has already paid.
        // Must issue a full Stripe refund before marking declined.
        if (!row.stripePaymentIntentId) {
          // No payment intent recorded — mark declined without refund (data issue)
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'declined',
                cancelledAt = NOW(),
                cancelledBy = 'system',
                cancellationReason = 'Coach did not respond within 24 hours (no payment intent)'
            WHERE id = ${row.id}
              AND status = 'payment_collected'
          `);
          console.warn(`[Auto-Decline] Lesson ${row.id} declined without refund — no stripePaymentIntentId`);
          continue;
        }

        // Attempt full Stripe refund first
        let refundSucceeded = false;
        try {
          await stripeService.createRefund(
            row.stripePaymentIntentId,
            undefined, // full refund
            "requested_by_customer"
          );
          refundSucceeded = true;
        } catch (stripeErr) {
          console.error(`[Auto-Decline] Stripe refund failed for lesson ${row.id}:`, stripeErr);
        }

        if (refundSucceeded) {
          // Refund succeeded — mark as declined with refund recorded
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'declined',
                cancelledAt = NOW(),
                cancelledBy = 'system',
                cancellationReason = 'Coach did not respond within 24 hours',
                refundAmountCents = ${row.amountCents},
                refundProcessedAt = NOW()
            WHERE id = ${row.id}
              AND status = 'payment_collected'
          `);
          console.log(`[Auto-Decline] Lesson ${row.id} auto-declined with full refund`);
        } else {
          // Refund failed — leave in a visible state for admin retry.
          // Do NOT mark as declined; keep status as 'payment_collected' but
          // flag it so admin can see it needs attention.
          await dbInstance.execute(sql`
            UPDATE lessons
            SET cancellationReason = 'REFUND_FAILED: Coach did not respond within 24 hours — Stripe refund creation failed, admin retry required',
                cancelledBy = 'system'
            WHERE id = ${row.id}
              AND status = 'payment_collected'
          `);
          console.error(`[Auto-Decline] Lesson ${row.id} needs admin attention — refund failed, kept in payment_collected`);
          // Do NOT send any email to the student — refund has not happened yet
          continue;
        }

        // Only send emails if refund actually succeeded
        const lesson = await getLessonById(row.id);
        if (!lesson) continue;
        const [student, coach] = await Promise.all([
          getUserById(lesson.studentId),
          getUserById(lesson.coachId),
        ]);
        if (!student?.email || !coach?.email) continue;

        const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const lessonTime = new Date(lesson.scheduledAt).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
        });

        await sendEmail({
          to: student.email,
          subject: `Booking request declined — full refund issued — ${lessonDate}`,
          html: getStudentCancellationEmail({
            studentName: student.name || "Student",
            coachName: coach.name || "Coach",
            lessonDate,
            lessonTime,
            durationMinutes: lesson.durationMinutes ?? 60,
            amountPaid: `$${(lesson.amountCents / 100).toFixed(2)}`,
            refundAmount: `$${(lesson.amountCents / 100).toFixed(2)}`,
            refundPercentage: 100,
            cancelledBy: "system",
            cancellationReason: "The coach did not respond within 24 hours. A full refund has been issued.",
          }),
        });

        await sendEmail({
          to: coach.email,
          subject: `Booking request auto-declined — ${lessonDate}`,
          html: getCoachCancellationEmail({
            coachName: coach.name || "Coach",
            studentName: student.name || "Student",
            lessonDate,
            lessonTime,
            durationMinutes: lesson.durationMinutes ?? 60,
            cancelledBy: "system",
            cancellationReason: "You didn't respond within 24 hours. The student has been refunded.",
          }),
        });

      } else {
        // Legacy pending_confirmation — no payment was taken; use normal cancel
        const cancelResult = await cancelLesson(
          row.id,
          "system",
          "Coach did not respond within 24 hours"
        );
        console.log(`[Auto-Decline] Legacy lesson ${row.id} auto-declined (no payment)`);

        const lesson = await getLessonById(row.id);
        if (!lesson) continue;
        const [student, coach] = await Promise.all([
          getUserById(lesson.studentId),
          getUserById(lesson.coachId),
        ]);
        if (!student?.email || !coach?.email) continue;

        const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const lessonTime = new Date(lesson.scheduledAt).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
        });

        await sendEmail({
          to: student.email,
          subject: `Lesson request not confirmed — ${lessonDate}`,
          html: getStudentCancellationEmail({
            studentName: student.name || "Student",
            coachName: coach.name || "Coach",
            lessonDate,
            lessonTime,
            durationMinutes: lesson.durationMinutes ?? 60,
            amountPaid: `$${(lesson.amountCents / 100).toFixed(2)}`,
            refundAmount: `$${(cancelResult.refundAmountCents / 100).toFixed(2)}`,
            refundPercentage: 100,
            cancelledBy: "system",
            cancellationReason: "Coach did not respond within 24 hours",
          }),
        });

        await sendEmail({
          to: coach.email,
          subject: `Lesson request auto-declined — ${lessonDate}`,
          html: getCoachCancellationEmail({
            coachName: coach.name || "Coach",
            studentName: student.name || "Student",
            lessonDate,
            lessonTime,
            durationMinutes: lesson.durationMinutes ?? 60,
            cancelledBy: "system",
            cancellationReason: "You didn't respond within 24 hours. The student will be offered other coaches.",
          }),
        });
      }
    } catch (err) {
      console.error(`[Auto-Decline] Failed for lesson ${row.id}:`, err);
    }
  }
}

/**
 * Auto-complete lessons whose scheduled time + duration has passed.
 *
 * Targets:
 * - 'confirmed' (payment-first model) — always sets issueWindowEndsAt = now + 24h
 * - 'paid' (legacy) — also sets issueWindowEndsAt so the payout path is consistent
 *
 * Grace period: 1 hour after lesson end time to account for late starts.
 *
 * IMPORTANT: issueWindowEndsAt MUST always be set. A completed lesson without
 * issueWindowEndsAt cannot safely be auto-released to the coach payout.
 */
export async function autoCompletePastLessons(): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) {
    console.warn("[Auto-Complete] Database not available, skipping.");
    return;
  }

  // Find lessons whose scheduled end time + 1h grace is in the past
  const result: any = await dbInstance.execute(sql`
    SELECT id, studentId, coachId, durationMinutes, scheduledAt, status
    FROM lessons
    WHERE status IN ('paid', 'confirmed')
      AND DATE_ADD(scheduledAt, INTERVAL (COALESCE(durationMinutes, 60) + 60) MINUTE) <= NOW()
  `);

  const rows = result[0] as any[];
  if (!rows || rows.length === 0) {
    console.log("[Auto-Complete] No past lessons to complete.");
    return;
  }

  console.log(`[Auto-Complete] Found ${rows.length} lesson(s) past their end time.`);

  for (const row of rows) {
    try {
      // Always set issueWindowEndsAt = now + 24h.
      // Without this, the auto-release cron cannot safely release the payout.
      const affectedRows: any = await dbInstance.execute(sql`
        UPDATE lessons
        SET status = 'completed',
            completedAt = NOW(),
            issueWindowEndsAt = DATE_ADD(NOW(), INTERVAL 24 HOUR)
        WHERE id = ${row.id}
          AND status IN ('paid', 'confirmed')
      `);
      if (affectedRows[0]?.affectedRows > 0) {
        console.log(`[Auto-Complete] Lesson ${row.id} (was ${row.status}) marked completed with 24h issue window`);
      } else {
        console.log(`[Auto-Complete] Lesson ${row.id} skipped (status changed before update)`);
      }
    } catch (err) {
      console.error(`[Auto-Complete] Failed for lesson ${row.id}:`, err);
    }
  }
}

/**
 * Start the hourly reminder scheduler.
 * Call once at server startup.
 */
export function startReminderScheduler(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  const runAll = async () => {
    await sendPendingReminders().catch((err) =>
      console.error("[Reminder Scheduler] Reminder run failed:", err)
    );
    await autoDeclineStaleBookings().catch((err) =>
      console.error("[Reminder Scheduler] Auto-decline run failed:", err)
    );
    await autoCompletePastLessons().catch((err) =>
      console.error("[Reminder Scheduler] Auto-complete run failed:", err)
    );
  };

  // Run immediately on startup to catch any missed reminders / stale bookings
  runAll();

  // Then run every hour
  setInterval(runAll, INTERVAL_MS);

  console.log("[Reminder Scheduler] Started — running every hour (reminders + auto-decline + auto-complete).");
}
