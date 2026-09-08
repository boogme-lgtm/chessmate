import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_core/env", async () => {
  const { previewEnvironment } = await import("../test/preview-fixture");
  const { loadPreviewConfig } = await import("./_core/previewPolicy");
  const env = previewEnvironment();
  return { ENV: { preview: loadPreviewConfig(env), appId: env.VITE_APP_ID, cookieSecret: env.JWT_SECRET } };
});
vi.mock("./db");
vi.mock("./auth", () => ({
  registerUser: vi.fn(), verifyEmail: vi.fn(), requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(), resendVerificationEmail: vi.fn(),
  loginUser: vi.fn().mockResolvedValue({ success: true, user: { id: 11, openId: null, name: "Preview Student" } }),
}));
import { authRouter } from "./authRouter";
import { ENV } from "./_core/env";
import { jwtVerify } from "jose";

const original = ENV.preview!;
afterEach(() => { ENV.preview = original; });

describe("native preview login without a shared OAuth provider", () => {
  it.each([true, false])("uses the preview identity and correct cookie policy (local HTTP: %s)", async allowLocalHttp => {
    ENV.preview = { ...original, allowLocalHttp };
    const setHeader = vi.fn();
    const caller = authRouter.createCaller({ user: null, req: {} as any, res: { setHeader } as any });
    await caller.login({ email: "student@example.com", password: "UnitPass123" });
    const cookie = setHeader.mock.calls[0][1] as string;
    expect(cookie.includes("Secure")).toBe(!allowLocalHttp);
    expect(cookie).toContain("HttpOnly");
    const token = cookie.split(";")[0].split("=")[1];
    expect((await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret))).payload)
      .toMatchObject({ appId: "boogme-preview-qa1", openId: "local_11" });
    await caller.logout();
    expect(setHeader.mock.calls[1][1].includes("Secure")).toBe(!allowLocalHttp);
    expect(setHeader.mock.calls[1][1]).toContain("Max-Age=0");
  });
});
