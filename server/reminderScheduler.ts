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
import { getDb } from "./db";
import {
  sendEmail,
  getStudentLessonReminderEmail,
  getCoachLessonReminderEmail,
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

    // Mark reminder as sent if at least one email went through
    if (studentSent || coachSent) {
      await dbInstance.execute(sql`
        UPDATE lessons
        SET reminderSentAt = NOW()
        WHERE id = ${lesson.lessonId}
      `);
      console.log(
        `[Reminder Scheduler] Reminder sent for lesson ${lesson.lessonId} (student: ${studentSent}, coach: ${coachSent})`
      );
    }
  }
}

/**
 * Start the hourly reminder scheduler.
 * Call once at server startup.
 */
export function startReminderScheduler(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Run immediately on startup to catch any missed reminders
  sendPendingReminders().catch((err) =>
    console.error("[Reminder Scheduler] Startup run failed:", err)
  );

  // Then run every hour
  setInterval(() => {
    sendPendingReminders().catch((err) =>
      console.error("[Reminder Scheduler] Scheduled run failed:", err)
    );
  }, INTERVAL_MS);

  console.log("[Reminder Scheduler] Started — running every hour.");
}
