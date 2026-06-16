/**
 * Sprint S-BROWSE-1 — coach marketplace page data
 *
 * Tests the coach.listActive procedure contract: default ordering by
 * averageRating desc, pagination (limit/offset), and the filter to only
 * return profileActive + isAvailable coaches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

function ctx(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S-BROWSE-1 — coach.listActive", () => {
  it("1: returns coaches ordered by averageRating desc", async () => {
    vi.mocked(db.getActiveCoaches).mockResolvedValue([
      { users: { id: 1, name: "A" }, coach_profiles: { averageRating: "4.9" } },
      { users: { id: 2, name: "B" }, coach_profiles: { averageRating: "4.5" } },
    ] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.listActive();
    expect(res[0].coach_profiles.averageRating).toBe("4.9");
    expect(res[1].coach_profiles.averageRating).toBe("4.5");
    expect(db.getActiveCoaches).toHaveBeenCalledWith(20, 0);
  });

  it("2: respects limit and offset pagination inputs", async () => {
    vi.mocked(db.getActiveCoaches).mockResolvedValue([] as any);
    const caller = appRouter.createCaller(ctx());
    await caller.coach.listActive({ limit: 5, offset: 10 });
    expect(db.getActiveCoaches).toHaveBeenCalledWith(5, 10);
  });

  it("3: delegates profileActive + isAvailable filter to the DB helper", async () => {
    vi.mocked(db.getActiveCoaches).mockResolvedValue([
      { users: { id: 1 }, coach_profiles: { profileActive: true, isAvailable: true } },
    ] as any);
    const caller = appRouter.createCaller(ctx());
    const res = await caller.coach.listActive();
    expect(db.getActiveCoaches).toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });
});
