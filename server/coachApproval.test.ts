/**
 * S-VETTING-ACTIVATION-1 — coach approval wires an account + profile + email.
 * Previously both approval paths had TODO stubs and an approved coach was
 * stranded (no account, no onboarding link, no email).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db");
vi.mock("./auth");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";
import * as emailService from "./emailService";
import { appRouter, approveCoachApplication } from "./routers";
import type { TrpcContext } from "./_core/context";

const APP = {
  id: 1, email: "coach@example.com", fullName: "Coach Cris",
  country: "US", timezone: "America/New_York",
  chessTitle: "FM", currentRating: 2300, hourlyRateCents: 8000,
  specializations: JSON.stringify(["Openings"]), languages: JSON.stringify(["en"]),
  lessonFormats: JSON.stringify(["online"]), availability: JSON.stringify({}),
  yearsExperience: "10", profilePhotoUrl: null, videoIntroUrl: null,
  coachProfileId: null, status: "under_review",
};

function adminCtx(): TrpcContext {
  return {
    user: { id: 5, role: "admin", userType: "both", email: "admin@boogme.com", name: "Admin" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.updateCoachApplicationStatus).mockResolvedValue(undefined as any);
  vi.mocked(db.provisionCoachFromApplication).mockResolvedValue({ userId: 10, coachProfileId: 20, isNewUser: true } as any);
  vi.mocked(emailService.sendEmail).mockResolvedValue(undefined as any);
});

describe("approveCoachApplication", () => {
  it("provisions the account, marks approved, and emails the coach (new application)", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({ ...APP, coachProfileId: null } as any);
    const res = await approveCoachApplication(1);
    expect(res).toEqual({ success: true, alreadyProvisioned: false });
    expect(db.provisionCoachFromApplication).toHaveBeenCalledTimes(1);
    expect(db.updateCoachApplicationStatus).toHaveBeenCalledWith(1, "approved", undefined, undefined);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emailService.sendEmail).mock.calls[0][0].to).toBe("coach@example.com");
  });

  it("is idempotent — an already-provisioned application creates no second account or email", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({ ...APP, coachProfileId: 99 } as any);
    const res = await approveCoachApplication(1, 5, "looks good");
    expect(res).toEqual({ success: true, alreadyProvisioned: true });
    expect(db.provisionCoachFromApplication).not.toHaveBeenCalled();
    expect(db.updateCoachApplicationStatus).toHaveBeenCalledWith(1, "approved", 5, "looks good");
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND for a missing application", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue(undefined as any);
    await expect(approveCoachApplication(999)).rejects.toThrow(/not found/i);
    expect(db.provisionCoachFromApplication).not.toHaveBeenCalled();
  });

  it("still succeeds when the welcome email throws — the account is already created", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({ ...APP, coachProfileId: null } as any);
    vi.mocked(emailService.sendEmail).mockRejectedValueOnce(new Error("Resend down"));
    const res = await approveCoachApplication(1);
    expect(res.success).toBe(true);
    expect(db.provisionCoachFromApplication).toHaveBeenCalledTimes(1);
  });
});

describe("admin.applications.approve", () => {
  it("provisions via approveCoachApplication and updates status exactly once (no double-update)", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({ ...APP, status: "under_review", coachProfileId: null } as any);
    const caller = appRouter.createCaller(adminCtx());
    const res = await caller.admin.applications.approve({ id: 1, reviewNotes: "great fit" });
    expect(res).toEqual({ success: true });
    expect(db.provisionCoachFromApplication).toHaveBeenCalledTimes(1);
    expect(db.updateCoachApplicationStatus).toHaveBeenCalledTimes(1);
    expect(db.updateCoachApplicationStatus).toHaveBeenCalledWith(1, "approved", 5, "great fit");
  });

  it("rejects re-approving an already-approved application", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({ ...APP, status: "approved", coachProfileId: 42 } as any);
    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.admin.applications.approve({ id: 1, reviewNotes: "again" })).rejects.toThrow(/already approved/i);
    expect(db.provisionCoachFromApplication).not.toHaveBeenCalled();
  });
});
