/**
 * Sprint 44 patch — email diagnostics
 *
 * RESEND_API_KEY is blanked (only that field) so we exercise the missing-key
 * paths deterministically without network:
 *   - sendEmail warns and returns { success: false } when the key is absent.
 *   - admin.system.testEmail returns { success: false } (does NOT throw) on a
 *     send failure, and is admin-gated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ENV: { ...actual.ENV, resendApiKey: "" } };
});

import { sendEmail } from "./emailService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctx(user: any): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

describe("Sprint 44 patch — sendEmail missing-key behavior", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("S44P-1: warns and returns success:false when RESEND_API_KEY is empty", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });

    expect(result.success).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    const warned = warnSpy.mock.calls.some((c) =>
      String(c[0]).includes("RESEND_API_KEY")
    );
    expect(warned).toBe(true);
  });
});

describe("Sprint 44 patch — admin.system.testEmail", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("S44P-2: returns { success: false } (does not throw) when the send fails", async () => {
    const caller = appRouter.createCaller(
      ctx({ id: 1, role: "admin", openId: "a", name: "Admin", email: "admin@example.com" })
    );
    const res = await caller.admin.system.testEmail({ to: "admin@example.com" });
    expect(res.success).toBe(false);
  });

  it("S44P-3: rejects a non-admin caller", async () => {
    const caller = appRouter.createCaller(
      ctx({ id: 2, role: "user", openId: "u", name: "User", email: "user@example.com" })
    );
    await expect(caller.admin.system.testEmail({ to: "user@example.com" })).rejects.toThrow();
  });
});
