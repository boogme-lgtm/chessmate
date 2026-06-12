/**
 * Sprint REV-1 — reviews schema fix (studentId/coachId + reviewerType)
 *
 * The live `reviews` table has NOT NULL studentId/coachId columns the old
 * drizzle schema didn't know about, so every INSERT failed. The schema now
 * matches the live shape and reviewerType says which side wrote the review.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
const lesson = { id: 7, studentId: 1, coachId: 42, status: "completed" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
  vi.mocked(db.getReviewByLessonAndReviewer).mockResolvedValue(null);
  vi.mocked(db.getCounterpartReview).mockResolvedValue(null);
  vi.mocked(db.createReview).mockResolvedValue({} as any);
});

describe("S-REV-1 — review.submit payload shape", () => {
  it("student submit: studentId/coachId from the LESSON + reviewerType student", async () => {
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.review.submit({
      lessonId: 7,
      rating: 5,
      comment: "test",
      knowledgeRating: 5,
      communicationRating: 5,
      preparednessRating: 5,
    });
    expect(res.success).toBe(true);
    const arg = vi.mocked(db.createReview).mock.calls[0][0];
    expect(arg).toMatchObject({
      lessonId: 7,
      studentId: 1,
      coachId: 42,
      reviewerType: "student",
      rating: 5,
    });
    // The old broken fields must be gone.
    expect(arg).not.toHaveProperty("reviewerId");
    expect(arg).not.toHaveProperty("revieweeId");
  });

  it("coach submit: same studentId/coachId pair + reviewerType coach", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.review.submit({ lessonId: 7, rating: 4, comment: "good effort" });
    expect(res.success).toBe(true);
    const arg = vi.mocked(db.createReview).mock.calls[0][0];
    expect(arg).toMatchObject({
      lessonId: 7,
      studentId: 1, // the lesson's student — NOT the reviewer
      coachId: 42,
      reviewerType: "coach",
    });
  });

  it("duplicate submission rejected via the caller-scoped lookup", async () => {
    vi.mocked(db.getReviewByLessonAndReviewer).mockResolvedValue({ id: 1 } as any);
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.review.submit({ lessonId: 7, rating: 5 })).rejects.toThrow(
      /already reviewed/
    );
    expect(db.getReviewByLessonAndReviewer).toHaveBeenCalledWith(7, 1);
    expect(db.createReview).not.toHaveBeenCalled();
  });

  it("both submitted → reviews flipped visible", async () => {
    vi.mocked(db.getCounterpartReview).mockResolvedValue({ id: 2 } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.review.submit({ lessonId: 7, rating: 5 });
    expect(res.bothSubmitted).toBe(true);
    expect(db.setReviewsVisibleForLesson).toHaveBeenCalledWith(7);
  });

  it("third party rejected", async () => {
    const outsider = { id: 99, role: "user", userType: "student", openId: "x", name: "X", email: "x@e.com" };
    const caller = appRouter.createCaller(ctx(outsider));
    await expect(caller.review.submit({ lessonId: 7, rating: 5 })).rejects.toThrow(/Not your lesson/);
  });
});
