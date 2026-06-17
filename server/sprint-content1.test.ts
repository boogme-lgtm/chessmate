/**
 * S-CONTENT-1 — coach content-request actions: quote + decline
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";

const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
const otherCoach = { id: 99, role: "user", userType: "coach", openId: "o", name: "Other", email: "o@e.com" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

const queued = { id: 5, coachId: 42, studentId: 1, title: "Caro-Kann series", status: "queued" };
const inProgress = { ...queued, status: "in_progress" };
const delivered = { ...queued, status: "delivered" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.updateContentRequestQuote).mockResolvedValue(undefined as any);
  vi.mocked(db.quoteContentRequest).mockResolvedValue(undefined as any);
  vi.mocked(db.updateContentRequestStatus).mockResolvedValue(undefined as any);
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.getUserById).mockResolvedValue(coach as any);
});

describe("contentRequest.quote", () => {
  it("coach can set price + due date + note on a queued request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(queued as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.quote({
      requestId: 5,
      amountCents: 4900,
      dueDate: "2026-06-30T00:00:00.000Z",
      coachNote: "I'll cover the main lines and key traps.",
    });
    expect(res.success).toBe(true);
    expect(db.quoteContentRequest).toHaveBeenCalledWith(5, expect.objectContaining({
      amountCents: 4900,
      dueDate: expect.any(Date),
      coachNote: "I'll cover the main lines and key traps.",
    }));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_request_quoted",
      recipientRole: "student",
    }));
  });

  it("coach cannot quote a non-queued (in-progress) request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(inProgress as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.contentRequest.quote({ requestId: 5, amountCents: 4900 }))
      .rejects.toThrow(/Can only quote a queued or quoted request/);
    expect(db.quoteContentRequest).not.toHaveBeenCalled();
  });

  it("outsider cannot quote someone else's request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(queued as any);
    const caller = appRouter.createCaller(ctx(otherCoach));
    await expect(caller.contentRequest.quote({ requestId: 5, amountCents: 4900 }))
      .rejects.toThrow(/Not your content request/);
  });

  it("rejects a missing request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(null);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.contentRequest.quote({ requestId: 999, amountCents: 100 }))
      .rejects.toThrow(/not found/);
  });
});

describe("contentRequest.decline", () => {
  it("coach can decline a queued request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(queued as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.decline({ requestId: 5, coachNote: "Out of scope" });
    expect(res.success).toBe(true);
    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(5, "cancelled", expect.objectContaining({
      coachNote: "Out of scope",
    }));
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "content_request_declined",
      recipientRole: "student",
    }));
  });

  it("coach can decline an in-progress request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(inProgress as any);
    const caller = appRouter.createCaller(ctx(coach));
    const res = await caller.contentRequest.decline({ requestId: 5 });
    expect(res.success).toBe(true);
    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(5, "cancelled", expect.any(Object));
  });

  it("coach cannot decline a delivered request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(delivered as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(caller.contentRequest.decline({ requestId: 5 }))
      .rejects.toThrow(/Cannot decline a delivered request/);
    expect(db.updateContentRequestStatus).not.toHaveBeenCalled();
  });

  it("outsider cannot decline someone else's request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(queued as any);
    const caller = appRouter.createCaller(ctx(otherCoach));
    await expect(caller.contentRequest.decline({ requestId: 5 }))
      .rejects.toThrow(/Not your content request/);
  });
});
