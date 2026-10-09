/**
 * Sprint 3: the strict auth limiter matched only exact paths such as
 * /api/trpc/auth.login, so a tRPC batch (/api/trpc/auth.me,auth.login?batch=1)
 * or an encoded path bypassed it and got the 200/min general budget. Its
 * refusals were also plain express bodies, which the tRPC client reports as
 * "Unable to transform response from server".
 */
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import superjson from "superjson";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ONE_STRICT_CALL_MESSAGE, RATE_LIMITED_MESSAGE, STRICT_RATE_LIMITED_PROCEDURES,
  strictBudgetsFor, strictProcedureCalls, trpcProcedurePaths,
} from "./_core/rateLimits";
import { registerTrpcApi } from "./_core/trpcApi";

const { loginUser, requestPasswordReset } = vi.hoisted(() => ({
  loginUser: vi.fn(async () => ({ success: false, error: "Invalid email or password" })),
  requestPasswordReset: vi.fn(async () => ({ success: true })),
}));
vi.mock("./db");
vi.mock("./auth", async importOriginal => ({
  ...(await importOriginal<typeof import("./auth")>()), loginUser, requestPasswordReset,
}));
import { appRouter, type AppRouter } from "./routers";

describe("procedure path parsing", () => {
  it.each([
    ["/auth.login", ["auth.login"]],
    ["/auth.me,auth.login", ["auth.me", "auth.login"]],
    ["/auth.me%2Cauth.login", ["auth.me", "auth.login"]],
    ["/auth%2Elogin", ["auth.login"]],
    ["/ignored/prefix/auth.login", ["auth.login"]],
    ["/", [""]],
  ])("parses %s like tRPC's express adapter", (path, expected) => {
    expect(trpcProcedurePaths(path)).toEqual(expected);
  });

  it.each([
    ["/auth.login", 1],
    ["/auth.me,auth.login", 1],
    ["/auth.me,auth.register,coach.list", 1],
    ["/auth.me%2Cauth.requestPasswordReset", 1],
    ["/auth%2EresetPassword", 1],
    ["/x/auth.resendVerification", 1],
    ["/auth.login,auth.login,auth.login", 3],
    ["/auth.login,auth.register", 2],
    ["/%E0%A4%A", 1], // undecodable: limited, never let through
    ["/auth.me", 0],
    ["/auth.me,coach.list", 0],
    ["/auth.verifyEmail", 0], // a 256-bit single-use token: general budget
    ["/AUTH.LOGIN", 0], // tRPC procedure lookup is case-sensitive: no such procedure
  ])("counts strictly limited calls in %s as %i", (path, expected) => {
    expect(strictProcedureCalls(path)).toBe(expected);
  });

  it.each([
    ["/auth.login", ["credential"]],
    ["/auth.me,user.changePassword", ["credential"]],
    ["/auth.register", ["email"]],
    ["/auth.me%2Cwaitlist.join", ["email"]],
    ["/auth.login,auth.register,auth.login", ["credential", "email"]],
    ["/%E0%A4%A", ["credential", "email"]], // undecodable: every budget
    ["/auth.me,auth.verifyEmail", []],
  ])("draws %s on the %j budgets", (path, expected) => {
    expect([...strictBudgetsFor(path)].sort()).toEqual(expected);
  });
});

describe("strictly limited procedure list", () => {
  const procedures = Object.keys((appRouter as any)._def.procedures);

  it("names only procedures that exist, so a rename cannot silently drop protection", () => {
    for (const path of STRICT_RATE_LIMITED_PROCEDURES.keys()) expect(procedures).toContain(path);
  });

  it("covers every auth procedure that checks a credential or sends email", () => {
    // verifyEmail (intended change): its token is 256 random bits and its one
    // email goes to the verified account, so a strict budget only locked new
    // members out on a shared network.
    const exempt = new Set(["auth.me", "auth.logout", "auth.verifyEmail"]);
    const authProcedures = procedures.filter(path => path.startsWith("auth.") && !exempt.has(path));
    expect(authProcedures.length).toBeGreaterThan(0);
    for (const path of authProcedures) expect(STRICT_RATE_LIMITED_PROCEDURES.has(path)).toBe(true);
    expect(Object.fromEntries(STRICT_RATE_LIMITED_PROCEDURES)).toEqual({
      "auth.login": "credential",
      "auth.resetPassword": "credential",
      "user.changePassword": "credential",
      "user.deleteAccount": "credential",
      "auth.register": "email",
      "auth.requestPasswordReset": "email",
      "auth.resendVerification": "email",
      "waitlist.join": "email",
      "coachApplication.submit": "email",
    });
  });
});

describe("rate limits on the real tRPC API", () => {
  const servers: { close: () => void }[] = [];
  afterEach(() => {
    while (servers.length) servers.pop()!.close();
    loginUser.mockClear();
    requestPasswordReset.mockClear();
  });

  async function start({ strictLimit = 3, generalLimit = 1000 } = {}) {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    registerTrpcApi(app, { rateLimits: { strictLimit, generalLimit } });
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
    const call = (path: string, init: RequestInit & { client?: string } = {}) => fetch(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-forwarded-for": init.client ?? "203.0.113.10" },
    });
    const client = (ip = "203.0.113.10") => createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: base, transformer: superjson, headers: () => ({ "x-forwarded-for": ip }) })],
    });
    return { call, client };
  }

  const post = { method: "POST", body: "{}" };
  const login = { email: "player@example.com", password: "Secret123" };
  // Wire bodies (superjson): a single call, and a batch whose second call is login.
  const loginBody = JSON.stringify({ json: login });
  const batchedLoginBody = JSON.stringify({ 1: { json: login } });
  const batchedResetBody = JSON.stringify({ 1: { json: { email: login.email } } });

  async function refusal(promise: Promise<unknown>) {
    const error = await promise.then(() => null, (cause: unknown) => cause);
    expect(error).toBeInstanceOf(TRPCClientError);
    const { message, data } = error as TRPCClientError<AppRouter>;
    return { message, code: data?.code, httpStatus: data?.httpStatus };
  }

  it("limits plain POST logins, and runs none once the budget is spent", async () => {
    const { call } = await start();
    for (let i = 0; i < 3; i++) expect((await call("/auth.login", { method: "POST", body: loginBody })).status).toBe(401);
    const refused = await call("/auth.login", { method: "POST", body: loginBody });
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(loginUser).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["POST batch", "/auth.logout,auth.login?batch=1", batchedLoginBody, loginUser, "/auth.login"],
    ["encoded comma", "/auth.logout%2Cauth.login?batch=1", batchedLoginBody, loginUser, "/auth.login"],
    ["encoded dot", "/auth%2Elogin", loginBody, loginUser, "/auth.login"],
    ["prefixed path", "/anything/auth.login", loginBody, loginUser, "/auth.login"],
    ["batched email procedure", "/auth.logout,auth.requestPasswordReset?batch=1", batchedResetBody, requestPasswordReset, "/auth.register"],
  ])("counts a %s against the same per-IP budget as a direct call", async (_label, path, body, procedure, direct) => {
    const { call } = await start();
    for (let i = 0; i < 3; i++) expect((await call(path, { method: "POST", body })).status).not.toBe(429);
    expect(procedure).toHaveBeenCalledTimes(3);
    expect((await call(path, { method: "POST", body })).status).toBe(429);
    expect((await call(direct, post)).status).toBe(429);
    expect(procedure).toHaveBeenCalledTimes(3);
  });

  it("counts GET requests too (tRPC itself refuses a mutation over GET)", async () => {
    const { call } = await start();
    for (let i = 0; i < 3; i++) await call("/auth.logout,auth.login?batch=1&input=%7B%7D");
    expect((await call("/auth.login", { method: "POST", body: loginBody })).status).toBe(429);
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("counts a request once however many ordinary calls it batches", async () => {
    const { call } = await start({ strictLimit: 2 });
    expect((await call("/auth.logout,auth.login,auth.logout?batch=1", post)).status).not.toBe(429);
    // One of the two allowed requests is left.
    expect((await call("/auth.login", post)).status).not.toBe(429);
    expect((await call("/auth.login", post)).status).toBe(429);
  });

  it("keeps the sign-in budget separate from the email budget", async () => {
    // A class signing up on one network must not lock its members out of sign-in.
    const { call } = await start({ strictLimit: 2 });
    for (let i = 0; i < 2; i++) expect((await call("/auth.register", post)).status).not.toBe(429);
    expect((await call("/waitlist.join", post)).status).toBe(429);
    for (let i = 0; i < 2; i++) expect((await call("/auth.login", post)).status).not.toBe(429);
    expect((await call("/user.changePassword", post)).status).toBe(429);
  });

  it("leaves email verification and ordinary procedures on the general budget", async () => {
    const { call } = await start({ strictLimit: 1 });
    expect((await call("/auth.login", post)).status).not.toBe(429);
    expect((await call("/auth.register", post)).status).not.toBe(429);
    expect((await call("/auth.login", post)).status).toBe(429);
    expect((await call("/auth.register", post)).status).toBe(429);
    for (let i = 0; i < 5; i++) {
      expect((await call("/auth.verifyEmail", post)).status).not.toBe(429);
      expect((await call("/auth.me?batch=1&input=%7B%7D")).status).not.toBe(429);
    }
  });

  it("keys the budget by the client address behind the trusted proxy hop", async () => {
    const { call } = await start({ strictLimit: 1 });
    expect((await call("/auth.login", { ...post, client: "203.0.113.10" })).status).not.toBe(429);
    expect((await call("/auth.login", { ...post, client: "203.0.113.10" })).status).toBe(429);
    expect((await call("/auth.login", { ...post, client: "198.51.100.7" })).status).not.toBe(429);
  });

  it("answers an exhausted budget as a tRPC error the client can show", async () => {
    const { client } = await start({ strictLimit: 1 });
    // Allowed through to the procedure (the mocked database refuses the login).
    expect((await refusal(client().auth.login.mutate(login))).code).toBe("UNAUTHORIZED");
    expect(await refusal(client().auth.login.mutate(login)))
      .toEqual({ message: RATE_LIMITED_MESSAGE, code: "TOO_MANY_REQUESTS", httpStatus: 429 });
  });

  it("answers the general budget the same way", async () => {
    const { client } = await start({ generalLimit: 2 });
    expect(await client().auth.me.query()).toBeNull();
    expect(await client().auth.me.query()).toBeNull();
    expect(await refusal(client().auth.me.query()))
      .toEqual({ message: RATE_LIMITED_MESSAGE, code: "TOO_MANY_REQUESTS", httpStatus: 429 });
  });

  it("refuses several credential or email calls in one batch, readably, and still counts it", async () => {
    const { client } = await start({ strictLimit: 2 });
    const trpc = client();
    // Issued in the same tick, so httpBatchLink sends them as one request.
    const [first, second] = await Promise.all([
      refusal(trpc.auth.login.mutate(login)),
      refusal(trpc.auth.login.mutate(login)),
    ]);
    for (const result of [first, second]) {
      expect(result).toEqual({ message: ONE_STRICT_CALL_MESSAGE, code: "BAD_REQUEST", httpStatus: 400 });
    }
    expect((await refusal(trpc.auth.login.mutate(login))).code).toBe("UNAUTHORIZED");
    expect((await refusal(trpc.auth.login.mutate(login))).code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("the server's tRPC mount", () => {
  // Order is what makes the limits work: tRPC's handler ends every response, so
  // a limiter mounted after it never runs. registerTrpcApi mounts both together.
  const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("async function startServer()"));

  it("mounts tRPC only through registerTrpcApi, never directly", () => {
    expect(body.match(/registerTrpcApi\(app\);/g)).toHaveLength(1);
    expect(source).not.toContain("createExpressMiddleware");
    expect(source).not.toContain("/api/trpc\"");
  });

  it("trusts the proxy hop before the limits and mounts the API before the static fallback", () => {
    const trustProxy = body.indexOf('app.set("trust proxy", 1);');
    const api = body.indexOf("registerTrpcApi(app);");
    const fallback = body.indexOf("serveStatic(app);");
    expect(trustProxy).toBeGreaterThan(-1);
    expect(trustProxy).toBeLessThan(api);
    expect(api).toBeLessThan(fallback);
    expect(api).toBeLessThan(body.indexOf("await setupVite(app, server);"));
  });
});
