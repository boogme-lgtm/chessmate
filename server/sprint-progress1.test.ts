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

  const linked = {
    id: 9, userId: 1, chesscomUsername: "magnus", lichessUsername: "DrNykterstein", fideId: "1503014",
  };

  it("unlinks one account when its field is blanked, leaving the others untouched", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    // The dialog sends every field; only Chess.com was cleared.
    const res = await caller.student.updateChessProfiles({
      chesscomUsername: "",
      lichessUsername: "DrNykterstein",
      fideId: "1503014",
    });
    expect(res.success).toBe(true);
    expect(db.updateStudentChessProfiles).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.updateStudentChessProfiles).mock.calls[0]).toEqual([1, { chesscomUsername: null }]);
  });

  it("treats a whitespace-only field as blank (unlink, stored as NULL)", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateChessProfiles({ lichessUsername: "   " });
    expect(vi.mocked(db.updateStudentChessProfiles).mock.calls[0]).toEqual([1, { lichessUsername: null }]);
  });

  it("unlinks every account when all fields are blanked on a linked profile", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateChessProfiles({ chesscomUsername: "", lichessUsername: "", fideId: "" });
    expect(vi.mocked(db.updateStudentChessProfiles).mock.calls[0]).toEqual([
      1, { chesscomUsername: null, lichessUsername: null, fideId: null },
    ]);
  });

  it("all-blank save on an existing profile with nothing linked: no throw, no write", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({
      id: 9, userId: 1, chesscomUsername: null, lichessUsername: null, fideId: null,
    } as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateChessProfiles({ chesscomUsername: "", lichessUsername: "", fideId: "" });
    expect(res.success).toBe(true);
    expect(db.updateStudentChessProfiles).not.toHaveBeenCalled();
    expect(db.createStudentProfile).not.toHaveBeenCalled();
  });

  it("all fields omitted on an existing profile: no throw, no write (formerly 'No values to set')", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateChessProfiles({});
    expect(res.success).toBe(true);
    expect(db.updateStudentChessProfiles).not.toHaveBeenCalled();
    expect(db.createStudentProfile).not.toHaveBeenCalled();
  });

  it("leaves omitted and unchanged fields out of the update", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateChessProfiles({ chesscomUsername: "magnus", lichessUsername: " Hikaru " });
    expect(vi.mocked(db.updateStudentChessProfiles).mock.calls[0]).toEqual([1, { lichessUsername: "Hikaru" }]);
  });

  it("re-saving identical links does not write", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(linked as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateChessProfiles({
      chesscomUsername: "magnus",
      lichessUsername: "DrNykterstein",
      fideId: "1503014",
    });
    expect(db.updateStudentChessProfiles).not.toHaveBeenCalled();
  });

  it("create path stores only real links, never empty strings", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(student));
    await caller.student.updateChessProfiles({ chesscomUsername: " magnus ", lichessUsername: "", fideId: "  " });
    const created = vi.mocked(db.createStudentProfile).mock.calls[0][0];
    expect(created).toMatchObject({ userId: 1, chesscomUsername: "magnus" });
    expect(created).not.toHaveProperty("lichessUsername");
    expect(created).not.toHaveProperty("fideId");
    expect(Object.values(created)).not.toContain("");
  });

  it("does not create a profile when every field is blank and none exists", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.updateChessProfiles({ chesscomUsername: "", lichessUsername: "", fideId: "" });
    expect(res.success).toBe(true);
    expect(db.createStudentProfile).not.toHaveBeenCalled();
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

  it("does not look up unlinked (NULL) accounts", async () => {
    vi.mocked(db.getStudentProfileByUserId).mockResolvedValue({
      id: 9, userId: 1, chesscomUsername: null, lichessUsername: null,
    } as any);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.student.fetchLiveRatings();
    expect(res).toEqual({ chesscom: null, lichess: null });
    expect(fetchSpy).not.toHaveBeenCalled();
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
