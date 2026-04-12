import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db, email, and nurture modules so no real MySQL or Resend calls happen
vi.mock("./db", () => ({
  addToWaitlist: vi.fn(),
  getWaitlistCount: vi.fn(),
  updateWaitlistEmailStatus: vi.fn(),
}));
vi.mock("./emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  getWaitlistConfirmationEmail: vi.fn().mockReturnValue("<html>mock</html>"),
}));
vi.mock("./nurtureEmailScheduler", () => ({
  sendNurtureEmails: vi.fn().mockResolvedValue(undefined),
  sendNurtureEmailsManual: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { setHeader: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("waitlist.join", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("successfully adds email to waitlist", async () => {
    vi.mocked(db.addToWaitlist).mockResolvedValue({ success: true });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.waitlist.join({
      email: "test@example.com",
      name: "Test User",
      userType: "student",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully joined the waitlist!");
    expect(db.addToWaitlist).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test User",
      userType: "student",
      referralSource: undefined,
    });
  });

  it("handles duplicate email error", async () => {
    vi.mocked(db.addToWaitlist).mockResolvedValue({
      success: false,
      error: "Email already registered",
    });

    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.waitlist.join({ email: "dup@example.com", userType: "coach" })
    ).rejects.toThrow("Email already registered");
  });

  it("validates email format", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.waitlist.join({ email: "invalid-email", userType: "student" })
    ).rejects.toThrow();
  });
});

describe("waitlist.count", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns waitlist count", async () => {
    vi.mocked(db.getWaitlistCount).mockResolvedValue(1234);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.waitlist.count();

    expect(result.count).toBe(1234);
    expect(db.getWaitlistCount).toHaveBeenCalled();
  });
});
