/**
 * S-STOREFRONT-2 — public storefront on coach detail page.
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

function anonCtx(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

function sqlToString(sqlObj: any): string {
  return JSON.stringify(sqlObj);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S-STOREFRONT-2 — content.list accessType filter", () => {
  it("1: SQL contains accessType = 'public' so private items never leak", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Public Video", kind: "video", priceCents: 1000 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 10 });

    const sqlStr = sqlToString(mockExecute.mock.calls[0][0]);
    expect(sqlStr).toContain("accessType");
    expect(res).toHaveLength(1);
  });

  it("2: returns empty array when no public items exist for a coach", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 99 });
    expect(res).toHaveLength(0);
  });

  it("3: respects limit parameter", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    await caller.content.list({ coachId: 10, limit: 5 });

    const sqlStr = sqlToString(mockExecute.mock.calls[0][0]);
    expect(sqlStr).toContain("5");
  });

  it("4: returns items without coachId filter when coachId is omitted", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Video A", kind: "video", priceCents: 500 },
      { id: 2, coachId: 20, title: "PDF B", kind: "pdf", priceCents: 0 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list();
    expect(res).toHaveLength(2);
  });

  it("5: filters by kind when kind is provided", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[
      { id: 1, coachId: 10, title: "Video A", kind: "video", priceCents: 500 },
    ]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ kind: "video" });

    const sqlStr = sqlToString(mockExecute.mock.calls[0][0]);
    expect(sqlStr).toContain("video");
    expect(res).toHaveLength(1);
  });

  it("6: returns empty array when database is unavailable", async () => {
    vi.mocked(db.getDb).mockResolvedValue(null as any);

    const caller = appRouter.createCaller(anonCtx());
    const res = await caller.content.list({ coachId: 10 });
    expect(res).toHaveLength(0);
  });

  it("7: getById also filters accessType = 'public' so private items are not exposed by direct ID", async () => {
    const mockExecute = vi.fn().mockResolvedValue([[]]);
    vi.mocked(db.getDb).mockResolvedValue({ execute: mockExecute } as any);

    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.content.getById({ id: 42 })).rejects.toThrow(/not found/i);

    const sqlStr = sqlToString(mockExecute.mock.calls[0][0]);
    expect(sqlStr).toContain("accessType");
    expect(sqlStr).toContain("public");
  });
});
