import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const mocks = vi.hoisted(() => ({
  env: {
    preview: undefined as unknown,
    appId: "synthetic-runtime-project" as string | undefined,
    oAuthPortalUrl: "https://portal.example.invalid",
    frontendUrl: "https://app.example.invalid",
    allowOAuthLoopback: false,
  },
  sdk: {
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
    createSessionToken: vi.fn(),
  },
  upsertUser: vi.fn(),
  getSessionCookieOptions: vi.fn(),
}));

vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./_core/sdk", () => ({ sdk: mocks.sdk }));
vi.mock("./db", () => ({ upsertUser: mocks.upsertUser }));
vi.mock("./_core/cookies", () => ({ getSessionCookieOptions: mocks.getSessionCookieOptions }));

import { registerOAuthRoutes } from "./_core/oauth";
import { getOAuthSignInTarget } from "./_core/oauthStart";

type Handler = (req: Request, res: Response) => unknown;

function registeredRoutes() {
  const handlers = new Map<string, Handler>();
  const app = { get: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)) };
  registerOAuthRoutes(app as unknown as Express);
  return (path: string) => {
    const handler = handlers.get(path);
    if (!handler) throw new Error(`Unregistered route: ${path}`);
    return handler;
  };
}

function request(query: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return {
    query, headers, protocol: "http", secure: false, hostname: "untrusted.example.invalid",
    get: vi.fn((name: string) => headers[name.toLowerCase()]),
  } as unknown as Request;
}

function response() {
  const raw = {
    setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), redirect: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(),
  };
  raw.status.mockReturnValue(raw);
  return { raw, res: raw as unknown as Response };
}

function expectNoProviderOrDatabaseEffects() {
  expect(mocks.sdk.exchangeCodeForToken).not.toHaveBeenCalled();
  expect(mocks.sdk.getUserInfo).not.toHaveBeenCalled();
  expect(mocks.sdk.createSessionToken).not.toHaveBeenCalled();
  expect(mocks.upsertUser).not.toHaveBeenCalled();
  expect(mocks.getSessionCookieOptions).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.env, {
    preview: undefined,
    appId: "synthetic-runtime-project",
    oAuthPortalUrl: "https://portal.example.invalid",
    frontendUrl: "https://app.example.invalid",
    allowOAuthLoopback: false,
  });
  mocks.sdk.exchangeCodeForToken.mockResolvedValue({ accessToken: "synthetic-access-token" });
  mocks.sdk.getUserInfo.mockResolvedValue({
    openId: "synthetic-open-id", name: "Synthetic User", email: "synthetic@example.invalid", loginMethod: "google",
  });
  mocks.sdk.createSessionToken.mockResolvedValue("synthetic-session-token");
  mocks.upsertUser.mockResolvedValue(undefined);
  mocks.getSessionCookieOptions.mockReturnValue({ httpOnly: true, path: "/", secure: true, sameSite: "none" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const hostileQuery = {
  appId: "boogme", redirectUri: "https://evil.example.invalid/callback",
  state: "attacker-state", returnTo: "//evil.example.invalid", portal: "https://evil.example.invalid",
  nonce: "attacker-nonce",
};
const hostileHeaders = {
  host: "evil.example.invalid", origin: "https://evil.example.invalid",
  "x-forwarded-host": "evil.example.invalid", "x-forwarded-proto": "http",
  forwarded: "host=evil.example.invalid;proto=http",
};
const CALLBACK = "https://app.example.invalid/api/oauth/callback";
const NONCE_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const startRoutes = ["/api/oauth/start", "/api/oauth/authorize"];

/** Run the binding hop the way a browser would and return what it keeps and sends on. */
async function beginFlow(routes: ReturnType<typeof registeredRoutes>) {
  const { raw, res } = response();
  await routes("/api/oauth/authorize")(request(), res);
  const [cookieName, nonce] = raw.cookie.mock.calls[0];
  expect(cookieName).toBe("app_oauth_flow");
  const state = new URL(raw.redirect.mock.calls[0][1]).searchParams.get("state")!;
  return { nonce: nonce as string, state, cookie: `other=1; app_oauth_flow=${nonce}` };
}

async function callback(routes: ReturnType<typeof registeredRoutes>, query: Record<string, unknown>, cookie?: string) {
  const result = response();
  const req = request(query, cookie === undefined ? {} : { cookie });
  await routes("/api/oauth/callback")(req, result.res);
  return { ...result, req };
}

function expectFlowCookieCleared(raw: ReturnType<typeof response>["raw"]) {
  expect(raw.clearCookie).toHaveBeenCalledTimes(1);
  expect(raw.clearCookie).toHaveBeenCalledWith("app_oauth_flow", {
    httpOnly: true, path: "/api/oauth/callback", sameSite: "lax", secure: true,
  });
}

function expectPoliteRetry(raw: ReturnType<typeof response>["raw"]) {
  expect(raw.redirect).toHaveBeenCalledTimes(1);
  expect(raw.redirect).toHaveBeenCalledWith(302, "/sign-in?oauthError=expired");
  expect(raw.status).not.toHaveBeenCalled();
  expect(raw.json).not.toHaveBeenCalled();
  expect(raw.cookie).not.toHaveBeenCalled();
  expectFlowCookieCleared(raw);
  expectNoProviderOrDatabaseEffects();
}

describe("runtime OAuth start route", () => {
  it("moves the browser to the configured origin's binding hop despite a client placeholder and hostile request", async () => {
    vi.stubEnv("VITE_APP_ID", "boogme");
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/start")(request(hostileQuery, hostileHeaders), res);

    expect(raw.redirect).toHaveBeenCalledTimes(1);
    expect(raw.redirect).toHaveBeenCalledWith(302, "https://app.example.invalid/api/oauth/authorize");
    expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(raw.cookie).not.toHaveBeenCalled();
    expectNoProviderOrDatabaseEffects();
  });

  it("uses the initialized runtime identity and configured callback despite a client placeholder and hostile request", async () => {
    vi.stubEnv("VITE_APP_ID", "boogme");
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/authorize")(request(hostileQuery, hostileHeaders), res);

    expect(raw.redirect).toHaveBeenCalledTimes(1);
    const [status, location] = raw.redirect.mock.calls[0];
    expect(status).toBe(302);
    const url = new URL(location);
    expect(url.origin).toBe("https://portal.example.invalid");
    expect(url.pathname).toBe("/app-auth");
    expect(raw.cookie).toHaveBeenCalledTimes(1);
    const [cookieName, nonce, cookieOptions] = raw.cookie.mock.calls[0];
    expect(cookieName).toBe("app_oauth_flow");
    expect(nonce).toMatch(NONCE_SHAPE);
    expect(cookieOptions).toEqual({
      httpOnly: true, path: "/api/oauth/callback", sameSite: "lax", secure: true, maxAge: 10 * 60 * 1000,
    });
    // The broker-validated redirect URI is byte-identical; only state now carries the binding.
    expect(Object.fromEntries(url.searchParams)).toEqual({
      appId: "synthetic-runtime-project",
      redirectUri: CALLBACK,
      state: Buffer.from(`${CALLBACK}?nonce=${nonce}`).toString("base64"),
      type: "signIn",
    });
    expect(atob(url.searchParams.get("state")!)).toBe(`${url.searchParams.get("redirectUri")}?nonce=${nonce}`);
    expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(raw.cookie.mock.invocationCallOrder[0]).toBeLessThan(raw.redirect.mock.invocationCallOrder[0]);
    expectNoProviderOrDatabaseEffects();
  });

  it("mints an unpredictable nonce for every flow", async () => {
    const routes = registeredRoutes();
    const flows = await Promise.all([beginFlow(routes), beginFlow(routes), beginFlow(routes)]);
    expect(new Set(flows.map(flow => flow.nonce)).size).toBe(3);
    expect(new Set(flows.map(flow => flow.state)).size).toBe(3);
    for (const flow of flows) expect(flow.nonce).toMatch(NONCE_SHAPE);
  });

  it.each(startRoutes.flatMap(path =>
    [undefined, "", " ", "boogme", "BOOGME", " synthetic-project", "synthetic-project ", "synthetic\nproject"]
      .map(appId => [path, appId] as const)))(
    "%s fails closed with a generic response for invalid runtime app ID %j",
    async (path, appId) => {
      mocks.env.appId = appId;
      const { raw, res } = response();
      await registeredRoutes()(path)(request(), res);
      expect(raw.status).toHaveBeenCalledWith(503);
      expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
      expect(raw.redirect).not.toHaveBeenCalled();
      expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );

  it.each(startRoutes.flatMap(path => [
    "", "not-a-url", "http://remote.example.invalid", "javascript:alert(1)",
    "https://user:password@example.invalid", "https://example.invalid/path",
    "https://example.invalid?query=1", "https://example.invalid#fragment",
    " https://example.invalid", "https://example.invalid\\evil",
  ].map(frontendUrl => [path, frontendUrl] as const)))(
    "%s rejects invalid configured callback origin %j without disclosing configuration",
    async (path, frontendUrl) => {
      mocks.env.frontendUrl = frontendUrl;
      const { raw, res } = response();
      await registeredRoutes()(path)(request(), res);
      expect(raw.status).toHaveBeenCalledWith(503);
      expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
      expect(raw.redirect).not.toHaveBeenCalled();
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );

  it.each(startRoutes.flatMap(path => [
    "not-a-url", "http://remote.example.invalid", "https://user:password@example.invalid",
    "https://example.invalid/path", "https://example.invalid?query=1", "https://example.invalid#fragment",
  ].map(oAuthPortalUrl => [path, oAuthPortalUrl] as const)))(
    "%s rejects invalid configured portal origin %j",
    async (path, oAuthPortalUrl) => {
      mocks.env.oAuthPortalUrl = oAuthPortalUrl;
      const { raw, res } = response();
      await registeredRoutes()(path)(request(), res);
      expect(raw.status).toHaveBeenCalledWith(503);
      expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
      expect(raw.redirect).not.toHaveBeenCalled();
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );

  it.each(startRoutes.flatMap(path => ["preview", "no portal"].map(mode => [path, mode] as const)))(
    "%s preserves native sign-in for %s without provider work",
    async (path, mode) => {
      if (mode === "preview") mocks.env.preview = { instanceId: "synthetic-preview" };
      else mocks.env.oAuthPortalUrl = "";
      const { raw, res } = response();
      await registeredRoutes()(path)(request({ returnTo: "https://evil.example.invalid" }), res);
      expect(raw.redirect).toHaveBeenCalledWith(302, "/sign-in");
      expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );

  it("keeps the flow cookie off Secure only for the explicitly allowed loopback HTTP callback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.assign(mocks.env, { allowOAuthLoopback: true, frontendUrl: "http://localhost:3000" });
    const routes = registeredRoutes();
    const start = response();
    await routes("/api/oauth/start")(request(), start.res);
    expect(start.raw.redirect).toHaveBeenCalledWith(302, "http://localhost:3000/api/oauth/authorize");

    const { raw, res } = response();
    await routes("/api/oauth/authorize")(request(), res);
    expect(raw.cookie.mock.calls[0][2]).toEqual({
      httpOnly: true, path: "/api/oauth/callback", sameSite: "lax", secure: false, maxAge: 10 * 60 * 1000,
    });
    expect(new URL(raw.redirect.mock.calls[0][1]).searchParams.get("redirectUri"))
      .toBe("http://localhost:3000/api/oauth/callback");

    const flow = await callback(routes, { code: "synthetic-code", state: "not-bound" });
    expect(flow.raw.clearCookie).toHaveBeenCalledWith("app_oauth_flow", {
      httpOnly: true, path: "/api/oauth/callback", sameSite: "lax", secure: false,
    });
  });
});

describe("OAuth availability route", () => {
  it.each(["enabled", "preview", "no portal", "placeholder", "invalid origin"])(
    "exposes only a non-cacheable Boolean when %s",
    async mode => {
      if (mode === "preview") mocks.env.preview = { instanceId: "synthetic-preview" };
      if (mode === "no portal") mocks.env.oAuthPortalUrl = "";
      if (mode === "placeholder") mocks.env.appId = "boogme";
      if (mode === "invalid origin") mocks.env.frontendUrl = "https://user:password@example.invalid";
      const { raw, res } = response();
      await registeredRoutes()("/api/oauth/availability")(request({ appId: "attacker-input" }), res);
      expect(raw.json).toHaveBeenCalledWith({ enabled: mode === "enabled" });
      expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(raw.redirect).not.toHaveBeenCalled();
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );
});

describe("existing OAuth callback compatibility", () => {
  it("passes the bound flow's standard-base64 state through the existing exchange and cookie flow", async () => {
    const routes = registeredRoutes();
    const { state, cookie } = await beginFlow(routes);
    expectNoProviderOrDatabaseEffects();

    const callback = response();
    const callbackRequest = request({ code: "synthetic-code", state }, { cookie });
    await routes("/api/oauth/callback")(callbackRequest, callback.res);
    expectFlowCookieCleared(callback.raw);
    expect(callback.raw.clearCookie.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.sdk.exchangeCodeForToken.mock.invocationCallOrder[0]);
    expect(callback.raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(mocks.sdk.exchangeCodeForToken).toHaveBeenCalledWith("synthetic-code", state);
    expect(mocks.sdk.getUserInfo).toHaveBeenCalledWith("synthetic-access-token");
    expect(mocks.upsertUser).toHaveBeenCalledWith({
      openId: "synthetic-open-id", name: "Synthetic User", email: "synthetic@example.invalid",
      loginMethod: "google", lastSignedIn: expect.any(Date),
    });
    expect(mocks.sdk.createSessionToken).toHaveBeenCalledWith("synthetic-open-id", {
      name: "Synthetic User", expiresInMs: ONE_YEAR_MS,
    });
    expect(mocks.getSessionCookieOptions).toHaveBeenCalledWith(callbackRequest);
    expect(callback.raw.cookie).toHaveBeenCalledWith(COOKIE_NAME, "synthetic-session-token", {
      httpOnly: true, path: "/", secure: true, sameSite: "none", maxAge: ONE_YEAR_MS,
    });
    expect(callback.raw.redirect).toHaveBeenCalledWith(302, "/");
  });

  it.each([
    {}, { code: "synthetic-code" }, { state: "synthetic-state" },
    { code: ["synthetic-code"], state: "synthetic-state" },
    { code: "synthetic-code", state: { unsafe: "shape" } },
  ])("still rejects missing or non-scalar callback inputs %j", async query => {
    const routes = registeredRoutes();
    const { cookie } = await beginFlow(routes);
    const { raw, res } = response();
    await routes("/api/oauth/callback")(request(query, { cookie }), res);
    expect(raw.status).toHaveBeenCalledWith(400);
    expect(raw.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(raw.cookie).not.toHaveBeenCalled();
    expectFlowCookieCleared(raw);
    expectNoProviderOrDatabaseEffects();
  });

  it("keeps the existing generic failure when the bound exchange fails, with the flow already cleared", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sdk.exchangeCodeForToken.mockRejectedValueOnce(new Error("synthetic provider failure"));
    const routes = registeredRoutes();
    const { state, cookie } = await beginFlow(routes);
    const { raw } = await callback(routes, { code: "synthetic-code", state }, cookie);
    expect(raw.status).toHaveBeenCalledWith(500);
    expect(raw.json).toHaveBeenCalledWith({ error: "OAuth callback failed" });
    expect(raw.cookie).not.toHaveBeenCalled();
    expectFlowCookieCleared(raw);
  });
});

describe("OAuth callback login-CSRF binding", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("refuses a valid-looking state when this browser never started a flow, before any token exchange", async () => {
    const routes = registeredRoutes();
    const { state } = await beginFlow(routes);
    const { raw } = await callback(routes, { code: "synthetic-code", state });
    expectPoliteRetry(raw);
  });

  it("refuses an attacker's own code and state in a victim browser that has its own flow", async () => {
    const routes = registeredRoutes();
    const attacker = await beginFlow(routes);
    const victim = await beginFlow(routes);
    const { raw } = await callback(routes, { code: "attacker-code", state: attacker.state }, victim.cookie);
    expectPoliteRetry(raw);
  });

  it.each([
    ["the legacy unbound state", Buffer.from(CALLBACK).toString("base64")],
    ["a state without the flow's nonce", Buffer.from(`${CALLBACK}?nonce=`).toString("base64")],
    ["a state carrying the nonce elsewhere", Buffer.from(`${CALLBACK}?x=1&nonce=NONCE`).toString("base64")],
    ["a state that is not base64", "%%%not-base64%%%"],
  ])("refuses %s even alongside a live flow cookie", async (_label, rawState) => {
    const routes = registeredRoutes();
    const { nonce, cookie } = await beginFlow(routes);
    const { raw } = await callback(routes, { code: "synthetic-code", state: rawState.replace("NONCE", nonce) }, cookie);
    expectPoliteRetry(raw);
  });

  it.each([
    ["an empty flow cookie", "app_oauth_flow="],
    ["a truncated flow cookie", (nonce: string) => `app_oauth_flow=${nonce.slice(0, -1)}`],
    ["a tampered flow cookie", (nonce: string) => `app_oauth_flow=${nonce.slice(0, -1)}${nonce.endsWith("A") ? "B" : "A"}`],
    ["a lookalike cookie name", (nonce: string) => `app_oauth_flow_x=${nonce}`],
  ])("refuses %s", async (_label, cookieFor) => {
    const routes = registeredRoutes();
    const { nonce, state } = await beginFlow(routes);
    const cookie = typeof cookieFor === "string" ? cookieFor : cookieFor(nonce);
    const { raw } = await callback(routes, { code: "synthetic-code", state }, cookie);
    expectPoliteRetry(raw);
  });

  it("is single use: replaying the callback after the browser dropped the cleared cookie is refused", async () => {
    const routes = registeredRoutes();
    const { state, cookie } = await beginFlow(routes);
    const first = await callback(routes, { code: "synthetic-code", state }, cookie);
    expect(first.raw.redirect).toHaveBeenCalledWith(302, "/");
    expectFlowCookieCleared(first.raw);
    expect(mocks.sdk.exchangeCodeForToken).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    // The browser honored the clearing Set-Cookie, so the replay carries no flow cookie.
    const replay = await callback(routes, { code: "synthetic-code", state });
    expectPoliteRetry(replay.raw);
  });

  it("clears the flow even when a mismatched callback is refused, so a later legitimate attempt starts fresh", async () => {
    const routes = registeredRoutes();
    const victim = await beginFlow(routes);
    const attacker = await beginFlow(routes);
    const refused = await callback(routes, { code: "attacker-code", state: attacker.state }, victim.cookie);
    expectPoliteRetry(refused.raw);

    // Starting again mints a new binding, which completes normally.
    const retry = await beginFlow(routes);
    const { raw } = await callback(routes, { code: "synthetic-code", state: retry.state }, retry.cookie);
    expect(mocks.sdk.exchangeCodeForToken).toHaveBeenCalledWith("synthetic-code", retry.state);
    expect(raw.redirect).toHaveBeenCalledWith(302, "/");
  });
});

describe("runtime environment controls loopback OAuth", () => {
  async function initializedEnv(APP_ENV: string | undefined, NODE_ENV: string | undefined) {
    vi.resetModules();
    vi.stubEnv("APP_ENV", APP_ENV);
    vi.stubEnv("NODE_ENV", NODE_ENV);
    vi.stubEnv("VITE_APP_ID", "synthetic-runtime-project");
    vi.stubEnv("JWT_SECRET", "synthetic-jwt-not-a-real-secret");
    vi.stubEnv("DATABASE_URL", "mysql://unit:unit@127.0.0.1:9/synthetic_unit");
    vi.stubEnv("VITE_FRONTEND_URL", "http://127.0.0.1:3000");
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.example.invalid");
    return (await vi.importActual<typeof import("./_core/env")>("./_core/env")).ENV;
  }

  it("does not implicitly allow HTTP loopback when both environment flags are missing", async () => {
    const env = await initializedEnv(undefined, undefined);
    expect(env.allowOAuthLoopback).toBe(false);
    expect(() => getOAuthSignInTarget(env)).toThrow("Invalid OAuth configuration");
  });

  it.each(["prod", "PROD", "pRoD", "production"])(
    "does not allow HTTP loopback for APP_ENV=%s even when NODE_ENV=development",
    async APP_ENV => {
      const env = await initializedEnv(APP_ENV, "development");
      expect(env.allowOAuthLoopback).toBe(false);
      expect(() => getOAuthSignInTarget(env)).toThrow("Invalid OAuth configuration");
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])("permits an explicit development callback on %s", async hostname => {
    const env = await initializedEnv("development", "development");
    expect(env.allowOAuthLoopback).toBe(true);
    const target = getOAuthSignInTarget({ ...env, frontendUrl: `http://${hostname}:3000` })!;
    expect(target.redirectUri).toBe(`http://${hostname}:3000/api/oauth/callback`);
    expect(target.secureCookies).toBe(false);
    expect(() => getOAuthSignInTarget({ ...env, frontendUrl: "http://remote.example.invalid" }))
      .toThrow("Invalid OAuth configuration");
  });
});
