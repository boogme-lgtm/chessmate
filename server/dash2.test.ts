/**
 * S-DASH-2 — student.updateRating + coach.updateProfile coverage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S-DASH-2 — student.updateRating", () => {
  it("creates a minimal profile if none exists", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    vi.mocked(db.createStudentProfile).mockResolvedValue({} as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateRating({ currentRating: 1200 });
    expect(res.success).toBe(true);
    expect(db.createStudentProfile).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      currentRating: 1200,
      skillLevel: "intermediate",
    }));
    expect(db.updateStudentRating).not.toHaveBeenCalled();
  });

  it("updates the existing profile's currentRating", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({ id: 5, userId: 1 } as any);
    vi.mocked(db.updateStudentRating).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateRating({ currentRating: 1850 });
    expect(res.success).toBe(true);
    expect(db.updateStudentRating).toHaveBeenCalledWith(1, 1850);
    expect(db.createStudentProfile).not.toHaveBeenCalled();
  });

  it("derives skillLevel from rating when creating", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    vi.mocked(db.createStudentProfile).mockResolvedValue({} as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateRating({ currentRating: 2100 });
    expect(db.createStudentProfile).toHaveBeenCalledWith(expect.objectContaining({ skillLevel: "expert" }));
  });

  it("rejects rating below 100", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.student.updateRating({ currentRating: 50 })).rejects.toThrow();
  });

  it("rejects rating above 3200", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.student.updateRating({ currentRating: 4000 })).rejects.toThrow();
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.student.updateRating({ currentRating: 1200 })).rejects.toThrow();
  });
});

describe("S-DASH-2 — coach.updateProfile", () => {
  beforeEach(() => {
    vi.mocked(db.updateUserProfile).mockResolvedValue(undefined as any);
    vi.mocked(db.updateCoachProfile).mockResolvedValue(undefined as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ hourlyRateCents: 5000 } as any);
    vi.mocked(db.getUserById).mockResolvedValue(coach as any);
  });

  it("updates bio (user field) and hourlyRateCents (coach field)", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.coach.updateProfile({
      bio: "Experienced endgame coach",
      hourlyRateCents: 9000,
    });
    expect(res).toBeTruthy();
    expect(db.updateUserProfile).toHaveBeenCalledWith(42, expect.objectContaining({ bio: "Experienced endgame coach" }));
    expect(db.updateCoachProfile).toHaveBeenCalled();
  });

  it("does not overwrite the account name with a blank/whitespace name (Bug 1)", async () => {
    // z.string().min(2) blocks "" at the boundary, but a whitespace-only name
    // ("  ", length 2) slips through — the handler guard must still not blank it.
    const caller = appRouter.createCaller(ctx(coach));
    await caller.coach.updateProfile({ name: "  ", bio: "hi" });
    expect(db.updateUserProfile).toHaveBeenCalledWith(42, expect.objectContaining({ name: undefined, bio: "hi" }));
  });

  it("blocks going live without a Stripe Connect account (Bug 3)", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ ...coach, stripeConnectAccountId: null } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ hourlyRateCents: 5000, lessonDurations: JSON.stringify([60]) } as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.coach.updateProfile({ onboardingCompleted: true })).rejects.toThrow(/stripe/i);
  });

  it("allows going live once Stripe Connect is set", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ ...coach, stripeConnectAccountId: "acct_x" } as any);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue({ hourlyRateCents: 5000, lessonDurations: JSON.stringify([60]) } as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.coach.updateProfile({ onboardingCompleted: true });
    expect(res).toBeTruthy();
  });
});
