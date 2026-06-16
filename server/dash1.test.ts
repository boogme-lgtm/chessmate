/**
 * Sprint S-DASH-1 — content requests + coach student roster
 *
 * Tests:
 *   1. contentRequest.create — creates a record, returns success + id
 *   2. contentRequest.listForStudent — calls getContentRequestsByStudent with user id
 *   3. contentRequest.listForCoach — calls getContentRequestsByCoach with user id (coach only)
 *   4. contentRequest.updateStatus — coach can update; rejects non-owner
 *   5. contentRequest.updateStatus — rejects if request not found
 *   6. coach.getStudentRoster — calls getStudentRoster with user id
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

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- contentRequest.create ----
describe("S-DASH-1 — contentRequest.create", () => {
  it("creates a record, returns success + id", async () => {
    vi.mocked(db.createContentRequest).mockResolvedValue(101);
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.contentRequest.create({
      coachId: 42,
      title: "Opening repertoire",
      description: "Please create a Sicilian repertoire for me",
      amountCents: 2500,
    });
    expect(result).toEqual({ success: true, id: 101 });
    expect(db.createContentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 1,
        coachId: 42,
        title: "Opening repertoire",
        description: "Please create a Sicilian repertoire for me",
        amountCents: 2500,
      }),
    );
  });
});

// ---- contentRequest.listForStudent ----
describe("S-DASH-1 — contentRequest.listForStudent", () => {
  it("calls getContentRequestsByStudent with user id", async () => {
    const mockData = [{ id: 1, title: "Test", coachName: "Coach" }];
    vi.mocked(db.getContentRequestsByStudent).mockResolvedValue(mockData as any);
    const caller = appRouter.createCaller(ctx(student));
    const result = await caller.contentRequest.listForStudent();
    expect(result).toEqual(mockData);
    expect(db.getContentRequestsByStudent).toHaveBeenCalledWith(1);
  });
});

// ---- contentRequest.listForCoach ----
describe("S-DASH-1 — contentRequest.listForCoach", () => {
  it("calls getContentRequestsByCoach with user id (requires coach userType)", async () => {
    const mockData = [{ id: 2, title: "Endgame guide", studentName: "Stu" }];
    vi.mocked(db.getContentRequestsByCoach).mockResolvedValue(mockData as any);
    const caller = appRouter.createCaller(ctx(coach));
    const result = await caller.contentRequest.listForCoach();
    expect(result).toEqual(mockData);
    expect(db.getContentRequestsByCoach).toHaveBeenCalledWith(42);
  });

  it("rejects non-coach users", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.contentRequest.listForCoach()).rejects.toThrow();
  });
});

// ---- contentRequest.updateStatus ----
describe("S-DASH-1 — contentRequest.updateStatus", () => {
  it("coach can update status of their own request", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10,
      coachId: 42,
      studentId: 1,
      status: "queued",
    } as any);
    vi.mocked(db.updateContentRequestStatus).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(coach));
    const result = await caller.contentRequest.updateStatus({
      requestId: 10,
      status: "in_progress",
    });
    expect(result).toEqual({ success: true });
    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(10, "in_progress", expect.any(Object));
  });

  it("rejects non-owner coach", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10,
      coachId: 999, // different coach
      studentId: 1,
      status: "queued",
    } as any);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(
      caller.contentRequest.updateStatus({ requestId: 10, status: "in_progress" }),
    ).rejects.toThrow(/Not your content request/);
  });

  it("rejects if request not found", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue(null);
    const caller = appRouter.createCaller(ctx(coach));
    await expect(
      caller.contentRequest.updateStatus({ requestId: 999, status: "cancelled" }),
    ).rejects.toThrow(/Content request not found/);
  });

  it("sets deliveredAt when status is delivered", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10,
      coachId: 42,
      studentId: 1,
      status: "in_progress",
    } as any);
    vi.mocked(db.updateContentRequestStatus).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(coach));
    await caller.contentRequest.updateStatus({
      requestId: 10,
      status: "delivered",
      contentItemId: 5,
    });
    expect(db.updateContentRequestStatus).toHaveBeenCalledWith(
      10,
      "delivered",
      expect.objectContaining({
        deliveredAt: expect.any(Date),
        contentItemId: 5,
      }),
    );
  });
});

// ---- coach.getStudentRoster ----
describe("S-DASH-1 — coach.getStudentRoster", () => {
  it("calls getStudentRoster with user id", async () => {
    const mockRoster = [
      { id: 1, name: "Stu", avatarUrl: null, currentRating: 1200, lastLessonAt: "2024-01-01", totalLessons: 5 },
    ];
    vi.mocked(db.getStudentRoster).mockResolvedValue(mockRoster as any);
    const caller = appRouter.createCaller(ctx(coach));
    const result = await caller.coach.getStudentRoster();
    expect(result).toEqual(mockRoster);
    expect(db.getStudentRoster).toHaveBeenCalledWith(42);
  });

  it("rejects non-coach users", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await expect(caller.coach.getStudentRoster()).rejects.toThrow();
  });
});
