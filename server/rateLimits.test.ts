/**
 * Sprint 3: the strict auth limiter matched only exact paths such as
 * /api/trpc/auth.login, so a tRPC batch (/api/trpc/auth.me,auth.login?batch=1)
 * or an encoded path bypassed it and got the 200/min general budget.
 */
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STRICT_RATE_LIMITED_PROCEDURES, registerTrpcRateLimits, strictProcedureCalls, trpcProcedurePaths,
} from "./_core/rateLimits";

vi.mock("./db");
import { appRouter } from "./routers";

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
    ["/%E0%A4%A", 1], // undecodable: limited, never let through
    ["/auth.me", 0],
    ["/auth.me,coach.list", 0],
    ["/AUTH.LOGIN", 0], // tRPC procedure lookup is case-sensitive: no such procedure
  ])("counts strictly limited calls in %s as %i", (path, expected) => {
    expect(strictProcedureCalls(path)).toBe(expected);
  });
});

describe("strictly limited procedure list", () => {
  const procedures = Object.keys((appRouter as any)._def.procedures);

  it("names only procedures that exist, so a rename cannot silently drop protection", () => {
    for (const path of STRICT_RATE_LIMITED_PROCEDURES) expect(procedures).toContain(path);
  });

  it("covers every auth procedure that checks a credential, consumes a token or sends email", () => {
    const exempt = new Set(["auth.me", "auth.logout"]);
    const authProcedures = procedures.filter(path => path.startsWith("auth.") && !exempt.has(path));
    expect(authProcedures.length).toBeGreaterThan(0);
    for (const path of authProcedures) expect(STRICT_RATE_LIMITED_PROCEDURES.has(path)).toBe(true);
    for (const path of ["user.changePassword", "user.deleteAccount", "waitlist.join", "coachApplication.submit"]) {
      expect(STRICT_RATE_LIMITED_PROCEDURES.has(path)).toBe(true);
    }
  });
});

describe("strict limiter over HTTP", () => {
  const servers: { close: () => void }[] = [];
  afterEach(() => { while (servers.length) servers.pop()!.close(); });

  async function start(strictLimit = 3) {
    const app = express();
    app.set("trust proxy", 1);
    registerTrpcRateLimits(app, { strictLimit, generalLimit: 1000 });
    app.use("/api/trpc", (_req, res) => { res.json({ reached: true }); });
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
    return (path: string, init: RequestInit & { client?: string } = {}) => fetch(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-forwarded-for": init.client ?? "203.0.113.10" },
    });
  }

  it("limits plain POST logins", async () => {
    const call = await start();
    for (let i = 0; i < 3; i++) expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(200);
    const limited = await call("/auth.login", { method: "POST", body: "{}" });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "Too many requests, please try again later" });
  });

  it.each([
    ["GET batch", "/auth.me,auth.login?batch=1&input=%7B%7D", "GET"],
    ["POST batch", "/auth.me,auth.login?batch=1", "POST"],
    ["encoded comma", "/auth.me%2Cauth.login?batch=1", "POST"],
    ["encoded dot", "/auth%2Elogin", "POST"],
    ["prefixed path", "/anything/auth.login", "GET"],
    ["batched email procedure", "/auth.me,auth.requestPasswordReset?batch=1", "POST"],
  ])("counts a %s against the same per-IP budget as a direct login", async (_label, path, method) => {
    const call = await start();
    const body = method === "POST" ? "{}" : undefined;
    for (let i = 0; i < 3; i++) expect((await call(path, { method, body })).status).toBe(200);
    expect((await call(path, { method, body })).status).toBe(429);
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(429);
  });

  it("counts a request once however many ordinary calls it batches", async () => {
    const call = await start(2);
    const first = await call("/auth.me,auth.login,coach.list,puzzle.getDaily?batch=1", { method: "POST", body: "{}" });
    expect(first.status).toBe(200);
    // One of the two allowed requests is left.
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(200);
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(429);
  });

  it("refuses several credential or email calls in one batch, and still counts it", async () => {
    const call = await start(2);
    const batch = await call("/auth.login,auth.login,auth.login?batch=1", { method: "POST", body: "{}" });
    expect(batch.status).toBe(400);
    expect(await batch.json()).toEqual({ error: "Send one sign-in or account request at a time" });
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(200);
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(429);
  });

  it("leaves ordinary procedures on the general budget", async () => {
    const call = await start(1);
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(200);
    expect((await call("/auth.login", { method: "POST", body: "{}" })).status).toBe(429);
    for (let i = 0; i < 5; i++) expect((await call("/auth.me,coach.list?batch=1")).status).toBe(200);
  });

  it("keys the budget by the client address behind the trusted proxy hop", async () => {
    const call = await start(1);
    expect((await call("/auth.login", { method: "POST", body: "{}", client: "203.0.113.10" })).status).toBe(200);
    expect((await call("/auth.login", { method: "POST", body: "{}", client: "203.0.113.10" })).status).toBe(429);
    expect((await call("/auth.login", { method: "POST", body: "{}", client: "198.51.100.7" })).status).toBe(200);
  });
});
