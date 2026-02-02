import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  addToWaitlist: vi.fn(),
  getWaitlistCount: vi.fn(),
}));

import * as db from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("waitlist.join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully adds email to waitlist", async () => {
    const mockAddToWaitlist = vi.mocked(db.addToWaitlist);
    mockAddToWaitlist.mockResolvedValue({ success: true });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.join({
      email: "test@example.com",
      name: "Test User",
      userType: "student",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Successfully joined the waitlist!");
    expect(mockAddToWaitlist).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test User",
      userType: "student",
      referralSource: undefined,
    });
  });

  it("handles duplicate email error", async () => {
    const mockAddToWaitlist = vi.mocked(db.addToWaitlist);
    mockAddToWaitlist.mockResolvedValue({ 
      success: false, 
      error: "Email already registered" 
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.waitlist.join({
        email: "duplicate@example.com",
        userType: "coach",
      })
    ).rejects.toThrow("Email already registered");
  });

  it("validates email format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.waitlist.join({
        email: "invalid-email",
        userType: "student",
      })
    ).rejects.toThrow();
  });
});

describe("waitlist.count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns waitlist count", async () => {
    const mockGetWaitlistCount = vi.mocked(db.getWaitlistCount);
    mockGetWaitlistCount.mockResolvedValue(1234);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.waitlist.count();

    expect(result.count).toBe(1234);
    expect(mockGetWaitlistCount).toHaveBeenCalled();
  });
});
