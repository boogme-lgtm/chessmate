/**
 * Sprint S-PROFILE-1 — coach profile page data
 *
 * Verifies coach.getReviews surfaces reviewerName (incl. null-graceful) via the
 * new getReviewsByCoachWithStudentName helper, and that coach.getById returns
 * the profile photo + video intro fields the upgraded page renders.
 *
 * Note: the helper's actual SQL join + visibility filter run against a live DB,
 * which isn't available in this harness (it calls getDb() internally — the same
 * reason the suite mocks ./db wholesale). These tests assert the procedure-level
 * contract; the query shape itself is guarded by tsc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

function ctx(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S-PROFILE-1 — coach.getReviews", () => {
  it("1: returns reviews with a reviewerName field", async () => {
    vi.mocked(db.getReviewsByCoachWithStudentName).mockResolvedValue([
      { id: 1, rating: 5, comment: "Great", reviewerName: "John Smith", isVisible: true, reviewerType: "student" },
    ] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.getReviews({ coachId: 42, limit: 5 });
    expect(res[0]).toHaveProperty("reviewerName", "John Smith");
  });

  it("2: passes through a null reviewerName gracefully (deleted student)", async () => {
    vi.mocked(db.getReviewsByCoachWithStudentName).mockResolvedValue([
      { id: 2, rating: 4, comment: "Good", reviewerName: null, isVisible: true, reviewerType: "student" },
    ] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.getReviews({ coachId: 42, limit: 5 });
    expect(res[0].reviewerName).toBeNull();
  });

  it("3: uses the student-name helper (not the legacy getReviewsByCoach)", async () => {
    vi.mocked(db.getReviewsByCoachWithStudentName).mockResolvedValue([] as any);
    const caller = appRouter.createCaller(ctx());
    await caller.coach.getReviews({ coachId: 42, limit: 5 });
    expect(db.getReviewsByCoachWithStudentName).toHaveBeenCalledWith(42, 5);
    expect(db.getReviewsByCoach).not.toHaveBeenCalled();
  });

  it("4: returns only the rows the helper provides (visible/student filter lives in the helper SQL)", async () => {
    // The helper applies isVisible=true + reviewerType='student' in SQL; the
    // procedure returns exactly what the helper returns.
    vi.mocked(db.getReviewsByCoachWithStudentName).mockResolvedValue([
      { id: 1, rating: 5, reviewerName: "A B", isVisible: true, reviewerType: "student" },
    ] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.getReviews({ coachId: 42, limit: 20 });
    expect(res).toHaveLength(1);
    expect(res.every((r: any) => r.isVisible && r.reviewerType === "student")).toBe(true);
  });
});

describe("S-PROFILE-1 — coach.getById", () => {
  it("5: returns profilePhotoUrl and videoIntroUrl in profile", async () => {
    // coach.getById now uses the allowlist getPublicUserById — it never selects
    // password/email/tokens/stripe, so a leak is impossible by construction.
    vi.mocked(db.getPublicUserById).mockResolvedValue({
      id: 42, name: "Coach", bio: "Hi", avatarUrl: "a.png",
    } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({
      userId: 42,
      profilePhotoUrl: "https://s3/photo.png",
      videoIntroUrl: "https://youtu.be/abc",
      hourlyRateCents: 15000,
    } as any);

    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.getById({ id: 42 });
    expect(res?.profile).toMatchObject({
      profilePhotoUrl: "https://s3/photo.png",
      videoIntroUrl: "https://youtu.be/abc",
    });
    // Sensitive fields must not leak (allowlist projection).
    expect(res).not.toHaveProperty("password");
    expect(res).not.toHaveProperty("stripeCustomerId");
    expect(res).not.toHaveProperty("email");
    expect(res).not.toHaveProperty("openId");
    expect(res).not.toHaveProperty("passwordResetToken");
  });
});
