/**
 * S-PROGRESS-1 — student chess-platform profiles + live ratings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.updateStudentChessProfiles).mockResolvedValue(undefined as any);
  vi.mocked(db.createStudentProfile).mockResolvedValue({} as any);
});

describe("student.updateChessProfiles", () => {
  it("saves chess.com and lichess usernames on an existing profile", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({ id: 9, userId: 1 } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateChessProfiles({
      chesscomUsername: "magnus",
      lichessUsername: "DrNykterstein",
    });
    expect(res.success).toBe(true);
    expect(db.updateStudentChessProfiles).toHaveBeenCalledWith(1, expect.objectContaining({
      chesscomUsername: "magnus",
      lichessUsername: "DrNykterstein",
    }));
    expect(db.createStudentProfile).not.toHaveBeenCalled();
  });

  it("creates a minimal profile when none exists", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateChessProfiles({ fideId: "2016192" });
    expect(res.success).toBe(true);
    expect(db.createStudentProfile).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      fideId: "2016192",
    }));
    expect(db.updateStudentChessProfiles).not.toHaveBeenCalled();
  });
});

describe("student.fetchLiveRatings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for both platforms when no usernames are set", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({ id: 9, userId: 1 } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.fetchLiveRatings();
    expect(res).toEqual({ chesscom: null, lichess: null });
  });

  it("returns null when there is no profile at all", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.fetchLiveRatings();
    expect(res).toEqual({ chesscom: null, lichess: null });
  });

  it("parses a successful Chess.com stats response", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({
      id: 9, userId: 1, chesscomUsername: "magnus",
    } as any);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chess_rapid: { last: { rating: 2800 } },
        chess_blitz: { last: { rating: 2850 } },
        chess_bullet: { last: { rating: 2900 } },
      }),
    }));
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.fetchLiveRatings();
    expect(res.chesscom).toEqual({ rapid: 2800, blitz: 2850, bullet: 2900 });
  });

  it("handles a failed Chess.com fetch gracefully (no throw, null)", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({
      id: 9, userId: 1, chesscomUsername: "magnus",
    } as any);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.fetchLiveRatings();
    expect(res.chesscom).toBeNull();
  });
});
