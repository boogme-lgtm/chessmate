import { describe, expect, it } from "vitest";
import { groupMessageLessons, messageClassTitle } from "../shared/messageOrganization";

const lessons = [
  { id: 5, coachId: 42, coachName: "Coach A", studentId: 1, scheduledAt: "2026-10-01", topic: " Endgames ", status: "completed" },
  { id: 4, coachId: 99, coachName: "Coach B", studentId: 1, scheduledAt: "2026-09-30", topic: null, status: "cancelled" },
  { id: 3, coachId: 42, coachName: "Coach A", studentId: 1, scheduledAt: "2026-09-29", topic: " ", status: "confirmed" },
  { id: 2, coachId: 42, coachName: "Coach A", studentId: 1, scheduledAt: "2026-09-28", topic: "Subscription", status: "subscription_dm" },
];

describe("coach-first message organization", () => {
  it("groups by identity, preserves all classes and input order, and sums unread counts", () => {
    const groups = groupMessageLessons(lessons, "student", { 5: 2, 3: 1, 4: 7, 2: 4 });
    expect(groups.map(g => [g.id, g.unread, g.lessons.map(l => l.id)])).toEqual([[42, 7, [5, 3, 2]], [99, 7, [4]]]);
    expect(lessons.map(l => l.id)).toEqual([5, 4, 3, 2]);
  });
  it("does not merge different coaches with identical names", () => {
    expect(groupMessageLessons(lessons.map(l => ({ ...l, coachName: "Same" })), "student")).toHaveLength(2);
  });
  it("uses topic, class ID fallback and distinct direct-chat labels", () => {
    expect(lessons.map(messageClassTitle)).toEqual(["Endgames", "Class #4", "Class #3", "Direct chat"]);
  });
  it("groups a coach's classes by students with identity fallbacks", () => {
    const groups = groupMessageLessons([{ ...lessons[0], studentId: 7 }, lessons[2]], "coach");
    expect(groups.map(g => g.name)).toEqual(["Student #7", "Student #1"]);
  });
  it("handles an empty inbox", () => expect(groupMessageLessons([], "student")).toEqual([]));
});
