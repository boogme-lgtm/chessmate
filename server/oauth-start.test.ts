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
import { getOAuthStartUrl } from "./_core/oauthStart";

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
    setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), redirect: vi.fn(), cookie: vi.fn(),
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

describe("runtime OAuth start route", () => {
  it("uses the initialized runtime identity and configured callback despite a client placeholder and hostile request", async () => {
    vi.stubEnv("VITE_APP_ID", "boogme");
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/start")(request({
      appId: "boogme", redirectUri: "https://evil.example.invalid/callback",
      state: "attacker-state", returnTo: "//evil.example.invalid", portal: "https://evil.example.invalid",
    }, {
      host: "evil.example.invalid", origin: "https://evil.example.invalid",
      "x-forwarded-host": "evil.example.invalid", "x-forwarded-proto": "http",
      forwarded: "host=evil.example.invalid;proto=http",
    }), res);

    expect(raw.redirect).toHaveBeenCalledTimes(1);
    const [status, location] = raw.redirect.mock.calls[0];
    expect(status).toBe(302);
    const url = new URL(location);
    expect(url.origin).toBe("https://portal.example.invalid");
    expect(url.pathname).toBe("/app-auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      appId: "synthetic-runtime-project",
      redirectUri: "https://app.example.invalid/api/oauth/callback",
      state: Buffer.from("https://app.example.invalid/api/oauth/callback").toString("base64"),
      type: "signIn",
    });
    expect(atob(url.searchParams.get("state")!)).toBe(url.searchParams.get("redirectUri"));
    expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(raw.cookie).not.toHaveBeenCalled();
    expectNoProviderOrDatabaseEffects();
  });

  it.each([undefined, "", " ", "boogme", "BOOGME", " synthetic-project", "synthetic-project ", "synthetic\nproject"])(
    "fails closed with a generic response for invalid runtime app ID %j",
    async appId => {
      mocks.env.appId = appId;
      const { raw, res } = response();
      await registeredRoutes()("/api/oauth/start")(request(), res);
      expect(raw.status).toHaveBeenCalledWith(503);
      expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
      expect(raw.redirect).not.toHaveBeenCalled();
      expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(raw.cookie).not.toHaveBeenCalled();
      expectNoProviderOrDatabaseEffects();
    },
  );

  it.each([
    "", "not-a-url", "http://remote.example.invalid", "javascript:alert(1)",
    "https://user:password@example.invalid", "https://example.invalid/path",
    "https://example.invalid?query=1", "https://example.invalid#fragment",
    " https://example.invalid", "https://example.invalid\\evil",
  ])("rejects invalid configured callback origin %j without disclosing configuration", async frontendUrl => {
    mocks.env.frontendUrl = frontendUrl;
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/start")(request(), res);
    expect(raw.status).toHaveBeenCalledWith(503);
    expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
    expect(raw.redirect).not.toHaveBeenCalled();
    expectNoProviderOrDatabaseEffects();
  });

  it.each([
    "not-a-url", "http://remote.example.invalid", "https://user:password@example.invalid",
    "https://example.invalid/path", "https://example.invalid?query=1", "https://example.invalid#fragment",
  ])("rejects invalid configured portal origin %j", async oAuthPortalUrl => {
    mocks.env.oAuthPortalUrl = oAuthPortalUrl;
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/start")(request(), res);
    expect(raw.status).toHaveBeenCalledWith(503);
    expect(raw.json).toHaveBeenCalledWith({ error: "OAuth sign-in is unavailable" });
    expect(raw.redirect).not.toHaveBeenCalled();
    expectNoProviderOrDatabaseEffects();
  });

  it.each(["preview", "no portal"])("preserves native sign-in for %s without provider work", async mode => {
    if (mode === "preview") mocks.env.preview = { instanceId: "synthetic-preview" };
    else mocks.env.oAuthPortalUrl = "";
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/start")(request({ returnTo: "https://evil.example.invalid" }), res);
    expect(raw.redirect).toHaveBeenCalledWith(302, "/sign-in");
    expect(raw.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expectNoProviderOrDatabaseEffects();
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
  it("passes the start route's standard-base64 state through the existing exchange and cookie flow", async () => {
    const routes = registeredRoutes();
    const start = response();
    await routes("/api/oauth/start")(request(), start.res);
    const state = new URL(start.raw.redirect.mock.calls[0][1]).searchParams.get("state")!;
    expectNoProviderOrDatabaseEffects();

    const callback = response();
    const callbackRequest = request({ code: "synthetic-code", state });
    await routes("/api/oauth/callback")(callbackRequest, callback.res);
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
    const { raw, res } = response();
    await registeredRoutes()("/api/oauth/callback")(request(query), res);
    expect(raw.status).toHaveBeenCalledWith(400);
    expect(raw.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(raw.cookie).not.toHaveBeenCalled();
    expectNoProviderOrDatabaseEffects();
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
    expect(() => getOAuthStartUrl(env)).toThrow("Invalid OAuth configuration");
  });

  it.each(["prod", "PROD", "pRoD", "production"])(
    "does not allow HTTP loopback for APP_ENV=%s even when NODE_ENV=development",
    async APP_ENV => {
      const env = await initializedEnv(APP_ENV, "development");
      expect(env.allowOAuthLoopback).toBe(false);
      expect(() => getOAuthStartUrl(env)).toThrow("Invalid OAuth configuration");
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])("permits an explicit development callback on %s", async hostname => {
    const env = await initializedEnv("development", "development");
    expect(env.allowOAuthLoopback).toBe(true);
    const url = new URL(getOAuthStartUrl({ ...env, frontendUrl: `http://${hostname}:3000` })!);
    expect(url.searchParams.get("redirectUri")).toBe(`http://${hostname}:3000/api/oauth/callback`);
    expect(() => getOAuthStartUrl({ ...env, frontendUrl: "http://remote.example.invalid" }))
      .toThrow("Invalid OAuth configuration");
  });
});
