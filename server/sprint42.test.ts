/**
 * Sprint 42 — Admin name resolution
 *
 * Tests the `admin.users.getByIds` tRPC procedure used by AdminDisputesPanel
 * to resolve raw student/coach IDs to display names + emails.
 *
 * Covered:
 *   - admin caller receives mapped user rows
 *   - non-admin caller is rejected with FORBIDDEN
 *   - empty id list short-circuits without calling the db
 *   - the procedure delegates to db.getUsersByIds with the provided ids
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const adminUser = {
  id: 1,
  role: "admin" as const,
  openId: "admin-openid",
  name: "Admin",
  email: "admin@example.com",
};

const normalUser = {
  id: 2,
  role: "user" as const,
  openId: "user-openid",
  name: "Normal",
  email: "user@example.com",
};

function createContext(user: any): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

describe("Sprint 42 — admin.users.getByIds", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("S42-1: returns resolved user rows for an admin caller", async () => {
    vi.mocked(db.getUsersByIds).mockResolvedValue([
      { id: 10, name: "Alice", email: "alice@example.com" },
      { id: 20, name: null, email: "bob@example.com" },
    ]);

    const caller = appRouter.createCaller(createContext(adminUser));
    const result = await caller.admin.users.getByIds({ ids: [10, 20] });

    expect(db.getUsersByIds).toHaveBeenCalledWith([10, 20]);
    expect(result).toEqual([
      { id: 10, name: "Alice", email: "alice@example.com" },
      { id: 20, name: null, email: "bob@example.com" },
    ]);
  });

  it("S42-2: rejects a non-admin caller with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createContext(normalUser));
    await expect(caller.admin.users.getByIds({ ids: [10] })).rejects.toThrow(
      /Admin access required/
    );
    expect(db.getUsersByIds).not.toHaveBeenCalled();
  });

  it("S42-3: short-circuits empty id list without hitting the db", async () => {
    const caller = appRouter.createCaller(createContext(adminUser));
    const result = await caller.admin.users.getByIds({ ids: [] });

    expect(result).toEqual([]);
    expect(db.getUsersByIds).not.toHaveBeenCalled();
  });

  it("S42-4: returns only rows the db finds (missing ids omitted)", async () => {
    vi.mocked(db.getUsersByIds).mockResolvedValue([
      { id: 10, name: "Alice", email: "alice@example.com" },
    ]);

    const caller = appRouter.createCaller(createContext(adminUser));
    const result = await caller.admin.users.getByIds({ ids: [10, 999] });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });
});
