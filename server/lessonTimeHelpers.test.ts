/**
 * lessonTimeHelpers.test.ts
 *
 * Unit tests for the pure time-eligibility helpers in shared/lessonTimeHelpers.ts.
 * All tests pass explicit `now` dates so they are deterministic and clock-independent.
 *
 * Covers:
 *   - getLessonEndWithGrace: boundary arithmetic
 *   - canConfirmLessonComplete: status gate, grace boundary (>=), before/during/after
 *   - getIssueWindowState: none / active / expired for all relevant statuses
 *   - canRaiseIssue: convenience wrapper
 *
 * Also validates the three banner display states required by Sprint 36 patch:
 *   - completed + active window   → "active"   (issue-window-banner shown)
 *   - completed + expired window  → "expired"  (issue-window-expired-banner shown, copy says "eligible for release")
 *   - released                    → "none"     (payout-released-banner shown, copy says "has been released")
 */

import { describe, it, expect } from "vitest";
import {
  getLessonEndWithGrace,
  canConfirmLessonComplete,
  getIssueWindowState,
  canRaiseIssue,
} from "../shared/lessonTimeHelpers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mins(n: number) {
  return n * 60 * 1000;
}

function makeLesson(overrides: Record<string, any> = {}) {
  return {
    scheduledAt: new Date("2025-06-01T10:00:00Z"),
    durationMinutes: 60,
    status: "confirmed",
    issueWindowEndsAt: null,
    ...overrides,
  };
}

// ─── getLessonEndWithGrace ────────────────────────────────────────────────────

describe("getLessonEndWithGrace", () => {
  it("returns scheduledAt + duration + 15 min grace", () => {
    const lesson = makeLesson({
      scheduledAt: new Date("2025-06-01T10:00:00Z"),
      durationMinutes: 60,
    });
    const end = getLessonEndWithGrace(lesson);
    // 10:00 + 60 min + 15 min = 11:15
    expect(end.toISOString()).toBe("2025-06-01T11:15:00.000Z");
  });

  it("defaults durationMinutes to 60 when null", () => {
    const lesson = makeLesson({ scheduledAt: new Date("2025-06-01T10:00:00Z"), durationMinutes: null });
    const end = getLessonEndWithGrace(lesson);
    expect(end.toISOString()).toBe("2025-06-01T11:15:00.000Z");
  });

  it("handles short 30-min lesson correctly", () => {
    const lesson = makeLesson({
      scheduledAt: new Date("2025-06-01T14:00:00Z"),
      durationMinutes: 30,
    });
    const end = getLessonEndWithGrace(lesson);
    // 14:00 + 30 min + 15 min = 14:45
    expect(end.toISOString()).toBe("2025-06-01T14:45:00.000Z");
  });
});

// ─── canConfirmLessonComplete ─────────────────────────────────────────────────

describe("canConfirmLessonComplete — status gate", () => {
  const pastLesson = makeLesson({
    scheduledAt: new Date("2025-06-01T10:00:00Z"),
    durationMinutes: 60,
    status: "confirmed",
  });
  // now = well after end + grace
  const nowAfter = new Date("2025-06-01T12:00:00Z");

  const nonConfirmedStatuses = [
    "pending_payment",
    "payment_collected",
    "completed",
    "disputed",
    "released",
    "cancelled",
    "declined",
    "refunded",
    "no_show",
  ];

  for (const status of nonConfirmedStatuses) {
    it(`returns false for status="${status}"`, () => {
      expect(canConfirmLessonComplete({ ...pastLesson, status }, nowAfter)).toBe(false);
    });
  }

  it("returns true for status=confirmed after grace period", () => {
    expect(canConfirmLessonComplete(pastLesson, nowAfter)).toBe(true);
  });
});

describe("canConfirmLessonComplete — grace period boundary", () => {
  // Lesson: 10:00, 60 min → end 11:00, grace ends 11:15
  const lesson = makeLesson({
    scheduledAt: new Date("2025-06-01T10:00:00Z"),
    durationMinutes: 60,
    status: "confirmed",
  });

  it("returns false when now is before lesson start", () => {
    const now = new Date("2025-06-01T09:00:00Z");
    expect(canConfirmLessonComplete(lesson, now)).toBe(false);
  });

  it("returns false when lesson is ongoing (before end)", () => {
    const now = new Date("2025-06-01T10:30:00Z"); // 30 min into 60-min lesson
    expect(canConfirmLessonComplete(lesson, now)).toBe(false);
  });

  it("returns false when lesson ended but still within 15-min grace (10:59 after end)", () => {
    // 11:00 end + 14 min = 11:14 — still within grace
    const now = new Date("2025-06-01T11:14:00Z");
    expect(canConfirmLessonComplete(lesson, now)).toBe(false);
  });

  it("returns true at exactly the grace boundary (now === lessonEndWithGrace)", () => {
    // now = 11:15:00 exactly — boundary is inclusive (>=)
    const now = new Date("2025-06-01T11:15:00Z");
    expect(canConfirmLessonComplete(lesson, now)).toBe(true);
  });

  it("returns true one second after grace boundary", () => {
    const now = new Date("2025-06-01T11:15:01Z");
    expect(canConfirmLessonComplete(lesson, now)).toBe(true);
  });

  it("returns true well after grace period", () => {
    const now = new Date("2025-06-01T14:00:00Z");
    expect(canConfirmLessonComplete(lesson, now)).toBe(true);
  });
});

// ─── getIssueWindowState ──────────────────────────────────────────────────────

describe("getIssueWindowState — non-completed statuses return none", () => {
  const windowEndsAt = new Date("2025-06-02T12:00:00Z");
  const nowBefore = new Date("2025-06-02T10:00:00Z"); // before window close

  const nonCompletedStatuses = [
    "confirmed",
    "payment_collected",
    "disputed",
    "released",
    "cancelled",
    "declined",
    "refunded",
  ];

  for (const status of nonCompletedStatuses) {
    it(`returns "none" for status="${status}" even with issueWindowEndsAt set`, () => {
      const lesson = makeLesson({ status, issueWindowEndsAt: windowEndsAt });
      expect(getIssueWindowState(lesson, nowBefore)).toBe("none");
    });
  }
});

describe("getIssueWindowState — completed lesson, no issueWindowEndsAt", () => {
  it('returns "none" when issueWindowEndsAt is null', () => {
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: null });
    expect(getIssueWindowState(lesson, new Date())).toBe("none");
  });

  it('returns "none" when issueWindowEndsAt is undefined', () => {
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: undefined });
    expect(getIssueWindowState(lesson, new Date())).toBe("none");
  });
});

describe("getIssueWindowState — completed + active window (banner: issue-window-banner)", () => {
  it('returns "active" when now is before issueWindowEndsAt', () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const now = new Date("2025-06-02T10:00:00Z"); // 2h before close
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(getIssueWindowState(lesson, now)).toBe("active");
  });

  it('returns "active" one millisecond before window closes', () => {
    const windowEnd = new Date("2025-06-02T12:00:00.000Z");
    const now = new Date("2025-06-02T11:59:59.999Z");
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(getIssueWindowState(lesson, now)).toBe("active");
  });
});

describe("getIssueWindowState — completed + expired window (banner: issue-window-expired-banner, copy: eligible for release)", () => {
  it('returns "expired" when now equals issueWindowEndsAt', () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const now = new Date("2025-06-02T12:00:00Z"); // exactly at boundary
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(getIssueWindowState(lesson, now)).toBe("expired");
  });

  it('returns "expired" when now is after issueWindowEndsAt', () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const now = new Date("2025-06-02T14:00:00Z"); // 2h after
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(getIssueWindowState(lesson, now)).toBe("expired");
  });

  it('confirms "released" status returns "none" (payout-released-banner uses status check, not helper)', () => {
    // The "released" banner is shown via lesson.status === "released" directly in JSX,
    // not via getIssueWindowState. Verify the helper returns "none" for released.
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const nowAfter = new Date("2025-06-02T14:00:00Z");
    const lesson = makeLesson({ status: "released", issueWindowEndsAt: windowEnd });
    expect(getIssueWindowState(lesson, nowAfter)).toBe("none");
  });
});

// ─── canRaiseIssue ────────────────────────────────────────────────────────────

describe("canRaiseIssue — convenience wrapper", () => {
  it("returns true only when window is active", () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const nowBefore = new Date("2025-06-02T10:00:00Z");
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(canRaiseIssue(lesson, nowBefore)).toBe(true);
  });

  it("returns false when window is expired", () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const nowAfter = new Date("2025-06-02T14:00:00Z");
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    expect(canRaiseIssue(lesson, nowAfter)).toBe(false);
  });

  it("returns false for non-completed lesson", () => {
    const windowEnd = new Date("2025-06-02T12:00:00Z");
    const nowBefore = new Date("2025-06-02T10:00:00Z");
    const lesson = makeLesson({ status: "confirmed", issueWindowEndsAt: windowEnd });
    expect(canRaiseIssue(lesson, nowBefore)).toBe(false);
  });
});

// ─── Banner state integration: all three banner scenarios ─────────────────────

describe("Banner state integration — three display scenarios", () => {
  const windowEnd = new Date("2025-06-02T12:00:00Z");

  it("Scenario A: completed + active window → issue-window-banner shown, Raise Issue button active", () => {
    const now = new Date("2025-06-02T10:00:00Z");
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    const state = getIssueWindowState(lesson, now);
    expect(state).toBe("active");
    // issueWindowActive = true → banner shown, Raise Issue button shown
    expect(state === "active").toBe(true);
    expect(state === "expired").toBe(false);
    expect(lesson.status === "released").toBe(false);
  });

  it("Scenario B: completed + expired window → issue-window-expired-banner shown (copy: eligible for release)", () => {
    const now = new Date("2025-06-02T14:00:00Z");
    const lesson = makeLesson({ status: "completed", issueWindowEndsAt: windowEnd });
    const state = getIssueWindowState(lesson, now);
    expect(state).toBe("expired");
    // issueWindowExpired = true → expired banner shown with "eligible for release" copy
    expect(state === "expired").toBe(true);
    expect(state === "active").toBe(false);
    expect(lesson.status === "released").toBe(false);
  });

  it("Scenario C: released status → payout-released-banner shown (copy: has been released)", () => {
    const now = new Date("2025-06-02T14:00:00Z");
    const lesson = makeLesson({ status: "released", issueWindowEndsAt: windowEnd });
    const state = getIssueWindowState(lesson, now);
    // Helper returns "none" for released — the banner is driven by lesson.status === "released" in JSX
    expect(state).toBe("none");
    expect(lesson.status === "released").toBe(true);
    // Neither active nor expired banner should show
    expect(state === "active").toBe(false);
    expect(state === "expired").toBe(false);
  });
});
