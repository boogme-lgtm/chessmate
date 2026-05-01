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
        // S29-2: Atomically claim the row to decline_pending BEFORE calling Stripe.
        // If the coach accepted between the SELECT scan and now, the CAS will affect 0 rows
        // and we skip this lesson entirely (no Stripe call, no double-action).
        const claimResult: any = await dbInstance.execute(sql`
          UPDATE lessons
          SET status = 'decline_pending',
              cancelledAt = NOW(),
              cancelledBy = 'system',
              cancellationReason = 'Coach did not respond within 24 hours (auto-decline pending refund)'
          WHERE id = ${row.id}
            AND status = 'payment_collected'
            AND confirmationDeadline IS NOT NULL
            AND confirmationDeadline <= NOW()
        `);

        if (claimResult[0]?.affectedRows !== 1) {
          // Row was already acted on (coach accepted, or another scheduler instance won)
          console.log(`[Auto-Decline] Lesson ${row.id} skipped — row no longer in payment_collected (coach may have accepted)`);
          continue;
        }

        if (!row.stripePaymentIntentId) {
          // No payment intent recorded — finalize decline without refund (data issue)
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'declined',
                cancellationReason = 'Coach did not respond within 24 hours (no payment intent — manual refund required)'
            WHERE id = ${row.id}
              AND status = 'decline_pending'
          `);
          console.warn(`[Auto-Decline] Lesson ${row.id} declined without refund — no stripePaymentIntentId`);
          continue;
        }

        // Attempt full Stripe refund (CAS already claimed the row)
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
          // Refund succeeded — finalize to declined
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'declined',
                cancellationReason = 'Coach did not respond within 24 hours',
                refundAmountCents = ${row.amountCents},
                refundProcessedAt = NOW()
            WHERE id = ${row.id}
              AND status = 'decline_pending'
          `);
          console.log(`[Auto-Decline] Lesson ${row.id} auto-declined with full refund`);
        } else {
          // Refund failed — release the CAS claim back to payment_collected for admin retry.
          // Do NOT mark as declined; the student's money is still held.
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'payment_collected',
                cancelledAt = NULL,
                cancelledBy = NULL,
                cancellationReason = 'REFUND_FAILED: Coach did not respond within 24 hours — Stripe refund creation failed, admin retry required'
            WHERE id = ${row.id}
              AND status = 'decline_pending'
          `);
          console.error(`[Auto-Decline] Lesson ${row.id} needs admin attention — refund failed, returned to payment_collected`);
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
 * S29-5: Recovery scan for stuck pending states.
 *
 * After a process crash or DB failure, lessons may be stuck in:
 * - decline_pending: coach declined, Stripe refund was in-flight, process died.
 * - cancel_pending: student cancelled, Stripe refund was in-flight, process died.
 * - __pending_payout__: payout transfer was in-flight, process died.
 *
 * Recovery strategy:
 * - For decline_pending / cancel_pending: if the lesson has been stuck for > 10 minutes,
 *   the Stripe operation likely completed or failed. We use Stripe's idempotency:
 *   attempt the refund again (Stripe deduplicates) and finalize or flag accordingly.
 * - For __pending_payout__: if stuck > 10 minutes, attempt the transfer again using the
 *   same deterministic idempotency key (Stripe deduplicates) and finalize or clear.
 *
 * This function is called on every scheduler run (hourly) and on startup.
 * It logs all recoveries for admin visibility.
 */
export async function recoverStuckPendingStates(): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000);

  // Find lessons stuck in decline_pending or cancel_pending for > 10 minutes
  const stuckResult: any = await dbInstance.execute(sql`
    SELECT id, status, stripePaymentIntentId, amountCents, stripeTransferId,
           coachId, cancelledAt, coachDeclinedAt
    FROM lessons
    WHERE status IN ('decline_pending', 'cancel_pending')
      AND updatedAt < ${TEN_MINUTES_AGO}
  `);

  const stuckRows = stuckResult[0] as any[];
  if (stuckRows?.length > 0) {
    console.warn(`[Recovery] Found ${stuckRows.length} lesson(s) stuck in pending state for > 10 minutes.`);
    const stripeService = await import("./stripe");

    for (const row of stuckRows) {
      try {
        if (!row.stripePaymentIntentId) {
          // No payment intent — finalize directly to the terminal state
          const terminalStatus = row.status === 'decline_pending' ? 'declined' : 'cancelled';
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = ${terminalStatus},
                cancellationReason = CONCAT(COALESCE(cancellationReason, ''), ' [RECOVERED: no payment intent]')
            WHERE id = ${row.id} AND status = ${row.status}
          `);
          console.warn(`[Recovery] Lesson ${row.id} (${row.status}) finalized to ${terminalStatus} — no payment intent`);
          continue;
        }

        // Re-attempt the Stripe refund using idempotency (Stripe deduplicates if already done)
        // Idempotency key: deterministic per lesson + attempt type
        let refundSucceeded = false;
        try {
          await stripeService.createRefund(
            row.stripePaymentIntentId,
            undefined, // full refund
            "requested_by_customer"
          );
          refundSucceeded = true;
        } catch (stripeErr: any) {
          // charge_already_refunded means Stripe already processed it — treat as success
          if (stripeErr?.raw?.code === 'charge_already_refunded') {
            refundSucceeded = true;
          } else {
            console.error(`[Recovery] Stripe refund re-attempt failed for lesson ${row.id}:`, stripeErr);
          }
        }

        if (refundSucceeded) {
          const terminalStatus = row.status === 'decline_pending' ? 'declined' : 'cancelled';
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = ${terminalStatus},
                refundAmountCents = ${row.amountCents},
                refundProcessedAt = NOW(),
                cancellationReason = CONCAT(COALESCE(cancellationReason, ''), ' [RECOVERED]')
            WHERE id = ${row.id} AND status = ${row.status}
          `);
          console.log(`[Recovery] Lesson ${row.id} (${row.status}) recovered to ${terminalStatus} with refund`);
        } else {
          // Refund still failing — release back to payment_collected for admin
          await dbInstance.execute(sql`
            UPDATE lessons
            SET status = 'payment_collected',
                cancelledAt = NULL,
                cancelledBy = NULL,
                cancellationReason = CONCAT(COALESCE(cancellationReason, ''), ' [RECOVERY_FAILED: manual admin action required]')
            WHERE id = ${row.id} AND status = ${row.status}
          `);
          console.error(`[Recovery] Lesson ${row.id} (${row.status}) recovery failed — returned to payment_collected for admin`);
        }
      } catch (err) {
        console.error(`[Recovery] Error recovering lesson ${row.id}:`, err);
      }
    }
  }

  // Find lessons with __pending_payout__ stuck for > 10 minutes
  const stuckPayoutResult: any = await dbInstance.execute(sql`
    SELECT id, coachId, coachPayoutCents, currency, stripeTransferId
    FROM lessons
    WHERE stripeTransferId = '__pending_payout__'
      AND updatedAt < ${TEN_MINUTES_AGO}
  `);

  const stuckPayouts = stuckPayoutResult[0] as any[];
  if (stuckPayouts?.length > 0) {
    console.warn(`[Recovery] Found ${stuckPayouts.length} lesson(s) with stuck __pending_payout__ for > 10 minutes.`);
    const { getUserById, finalizeLessonPayout, releaseLessonPayoutSlot } = await import("./db");
    const { transferToCoach } = await import("./stripeConnect");

    for (const row of stuckPayouts) {
      try {
        const coach = await getUserById(row.coachId);
        if (!coach?.stripeConnectAccountId) {
          console.error(`[Recovery] Lesson ${row.id} stuck payout — coach has no Stripe account`);
          continue;
        }

        // Re-attempt with the same deterministic idempotency key (Stripe deduplicates)
        const idempotencyKey = `lesson_payout_${row.id}`;
        const result = await transferToCoach({
          accountId: coach.stripeConnectAccountId,
          amountCents: row.coachPayoutCents,
          currency: row.currency || 'usd',
          description: `Payout for lesson #${row.id} (recovered)`,
          idempotencyKey,
          metadata: { lessonId: row.id.toString(), coachId: row.coachId.toString(), recovered: 'true' },
        });

        if (result.success && result.transferId) {
          await finalizeLessonPayout(row.id, result.transferId);
          console.log(`[Recovery] Lesson ${row.id} payout recovered with transfer ${result.transferId}`);
        } else {
          // Transfer still failing — release the slot so admin can retry manually
          await releaseLessonPayoutSlot(row.id);
          console.error(`[Recovery] Lesson ${row.id} payout recovery failed — slot released for admin retry`);
        }
      } catch (err) {
        console.error(`[Recovery] Error recovering payout for lesson ${row.id}:`, err);
      }
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
    // S29-5: Run recovery first to clear any stuck pending states from previous crashes
    await recoverStuckPendingStates().catch((err) =>
      console.error("[Reminder Scheduler] Recovery scan failed:", err)
    );
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

  console.log("[Reminder Scheduler] Started — running every hour (recovery + reminders + auto-decline + auto-complete).");
}
