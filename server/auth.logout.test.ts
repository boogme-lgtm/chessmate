import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db so module-level imports in routers.ts don't trigger real connections
vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext() {
  const setHeaderCalls: { name: string; value: string }[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      setHeader: (name: string, value: string) => {
        setHeaderCalls.push({ name, value });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setHeaderCalls };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, setHeaderCalls } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true, message: "Logged out successfully" });
    // The logout handler uses stringifySetCookie → res.setHeader("Set-Cookie", ...)
    const setCookieCall = setHeaderCalls.find(c => c.name === "Set-Cookie");
    expect(setCookieCall).toBeDefined();
    expect(setCookieCall!.value).toContain("Max-Age=0");
  });
});
