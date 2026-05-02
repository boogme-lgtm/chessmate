/**
 * lessonTimeHelpers.ts
 *
 * Pure, side-effect-free helpers for computing time-gated lesson UI states.
 * All functions accept an explicit `now: Date` so they are trivially unit-testable
 * with fixed dates and do not depend on the system clock at call time.
 *
 * These helpers are used by:
 *   - client/src/pages/StudentDashboard.tsx (LessonCard)
 *   - server/sprint36.test.ts (unit tests)
 */

export interface LessonTimingInput {
  scheduledAt: Date | string;
  durationMinutes: number | null | undefined;
  status: string;
  issueWindowEndsAt: Date | string | null | undefined;
}

/** Returns the Date at which the lesson ends plus the 15-minute grace period. */
export function getLessonEndWithGrace(lesson: Pick<LessonTimingInput, "scheduledAt" | "durationMinutes">): Date {
  const scheduledMs = new Date(lesson.scheduledAt).getTime();
  const durationMs = (lesson.durationMinutes ?? 60) * 60 * 1000;
  const graceMs = 15 * 60 * 1000;
  return new Date(scheduledMs + durationMs + graceMs);
}

/**
 * Returns true when the "Confirm Lesson Complete" button should be shown.
 * Conditions: status === "confirmed" AND now >= lessonEndWithGrace.
 * Uses >= (not strictly >) to match the server's `Date.now() < lessonEndTime` check.
 */
export function canConfirmLessonComplete(lesson: LessonTimingInput, now: Date): boolean {
  if (lesson.status !== "confirmed") return false;
  const endWithGrace = getLessonEndWithGrace(lesson);
  return now.getTime() >= endWithGrace.getTime();
}

export type IssueWindowState =
  | "none"          // lesson is not in "completed" status, or no issueWindowEndsAt
  | "active"        // completed + issueWindowEndsAt is in the future
  | "expired";      // completed + issueWindowEndsAt has passed

/**
 * Returns the issue-window display state for a lesson.
 * Only "completed" lessons can have an active or expired window.
 * "released", "disputed", and other statuses return "none".
 */
export function getIssueWindowState(lesson: LessonTimingInput, now: Date): IssueWindowState {
  if (lesson.status !== "completed") return "none";
  if (!lesson.issueWindowEndsAt) return "none";
  const windowEnd = new Date(lesson.issueWindowEndsAt).getTime();
  return now.getTime() < windowEnd ? "active" : "expired";
}

/**
 * Returns true when the "Raise Issue" button should be shown.
 * Equivalent to getIssueWindowState === "active".
 */
export function canRaiseIssue(lesson: LessonTimingInput, now: Date): boolean {
  return getIssueWindowState(lesson, now) === "active";
}
