/**
 * Settings page — user.updateProfile partial-update semantics.
 * undefined = leave unchanged, blank = clear (NULL); the name is never blanked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const user = {
  id: 7, role: "user", userType: "student", openId: "u", email: "a@e.com",
  name: "Ana", bio: "Club player", country: "US", timezone: "America/New_York",
};

function ctx(u: any): TrpcContext {
  return { user: u, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

// What the Settings form sends for the stored profile, before any edit.
const unchangedForm = { name: "Ana", bio: "Club player", country: "US", timezone: "America/New_York" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.updateUserProfile).mockResolvedValue(undefined as any);
});

describe("user.updateProfile", () => {
  it("clears the bio when it is blanked, leaving the other fields untouched", async () => {
    const caller = appRouter.createCaller(ctx(user));
    const res = await caller.user.updateProfile({ ...unchangedForm, bio: "" });
    expect(res.success).toBe(true);
    expect(db.updateUserProfile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.updateUserProfile).mock.calls[0]).toEqual([7, { bio: null }]);
  });

  it("clears country and timezone", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await caller.user.updateProfile({ ...unchangedForm, country: "", timezone: "" });
    expect(vi.mocked(db.updateUserProfile).mock.calls[0]).toEqual([7, { country: null, timezone: null }]);
  });

  it("all-blank save on a profile with nothing set: no throw, no write", async () => {
    const bare = { ...user, bio: null, country: null, timezone: null };
    const caller = appRouter.createCaller(ctx(bare));
    // The form sends a blank name as undefined (it can't be cleared) and the rest as "".
    const res = await caller.user.updateProfile({ bio: "", country: "", timezone: "" });
    expect(res.success).toBe(true);
    expect(db.updateUserProfile).not.toHaveBeenCalled();
  });

  it("all fields omitted: no throw, no write (formerly 'No values to set')", async () => {
    const caller = appRouter.createCaller(ctx(user));
    const res = await caller.user.updateProfile({});
    expect(res.success).toBe(true);
    expect(db.updateUserProfile).not.toHaveBeenCalled();
  });

  it("re-saving the unchanged form does not write", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await caller.user.updateProfile(unchangedForm);
    expect(db.updateUserProfile).not.toHaveBeenCalled();
  });

  it("writes only the field that changed", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await caller.user.updateProfile({ ...unchangedForm, timezone: "Europe/London" });
    expect(vi.mocked(db.updateUserProfile).mock.calls[0]).toEqual([7, { timezone: "Europe/London" }]);
  });

  it("never blanks the account name with a whitespace-only name", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await caller.user.updateProfile({ ...unchangedForm, name: "   ", bio: "Coach" });
    expect(vi.mocked(db.updateUserProfile).mock.calls[0]).toEqual([7, { bio: "Coach" }]);
  });

  it("rejects an empty-string name at the boundary", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await expect(caller.user.updateProfile({ name: "" })).rejects.toThrow();
    expect(db.updateUserProfile).not.toHaveBeenCalled();
  });

  it("stores trimmed values", async () => {
    const caller = appRouter.createCaller(ctx(user));
    await caller.user.updateProfile({ ...unchangedForm, name: "  Ana Lee ", bio: " Endgames \n" });
    expect(vi.mocked(db.updateUserProfile).mock.calls[0]).toEqual([7, { name: "Ana Lee", bio: "Endgames" }]);
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.user.updateProfile({ bio: "" })).rejects.toThrow();
    expect(db.updateUserProfile).not.toHaveBeenCalled();
  });
});
