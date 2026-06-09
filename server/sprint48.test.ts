/**
 * Sprint 48 — message copy button (S48-1)
 *
 * The copy button is a pure frontend feature in MessageThread.tsx (no server
 * logic). This smoke test confirms the contract the UI depends on: messages.send
 * preserves contentType ("text" | "pgn") through to createMessage and the
 * returned message, so the client can branch its copy UI on it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

function studentCtx(): TrpcContext {
  return {
    user: { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@example.com" } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue({ id: 7, studentId: 1, coachId: 2 } as any);
  vi.mocked(db.createMessage).mockImplementation(async (m: any) => ({ id: 1, ...m }) as any);
});

describe("Sprint 48 — messages.send preserves contentType", () => {
  it("S48-1a: a PGN message round-trips contentType 'pgn'", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const res: any = await caller.messages.send({
      lessonId: 7,
      content: "1. e4 e5",
      contentType: "pgn",
    });
    expect(vi.mocked(db.createMessage).mock.calls[0][0].contentType).toBe("pgn");
    expect(res.contentType).toBe("pgn");
  });

  it("S48-1b: contentType defaults to 'text' when omitted", async () => {
    const caller = appRouter.createCaller(studentCtx());
    const res: any = await caller.messages.send({ lessonId: 7, content: "hello" });
    expect(res.contentType).toBe("text");
  });
});
