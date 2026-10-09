import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real Express 5 routing and Set-Cookie serialization on an ephemeral loopback port; the
// provider, database and configuration stay synthetic.
const mocks = vi.hoisted(() => ({
  env: {
    preview: undefined,
    appId: "synthetic-runtime-project",
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
}));

vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./_core/sdk", () => ({ sdk: mocks.sdk }));
vi.mock("./db", () => ({ upsertUser: mocks.upsertUser }));

import { registerOAuthRoutes } from "./_core/oauth";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  registerOAuthRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.sdk.exchangeCodeForToken.mockResolvedValue({ accessToken: "synthetic-access-token" });
  mocks.sdk.getUserInfo.mockResolvedValue({ openId: "synthetic-open-id", name: "Synthetic User", email: "", loginMethod: "google" });
  mocks.sdk.createSessionToken.mockResolvedValue("synthetic-session-token");
  mocks.upsertUser.mockResolvedValue(undefined);
});

const get = (path: string, cookie?: string) =>
  fetch(`${base}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });

async function authorize() {
  const response = await get("/api/oauth/authorize");
  const setCookie = response.headers.getSetCookie();
  const location = new URL(response.headers.get("location")!);
  const nonce = /^app_oauth_flow=([^;]+);/.exec(setCookie[0])![1];
  return { response, setCookie, location, nonce, state: location.searchParams.get("state")! };
}

const callbackPath = (code: string, state: string) =>
  `/api/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

describe("OAuth flow over real HTTP", () => {
  it("hops to the configured origin, then sets one Lax, httpOnly, Secure, callback-scoped, 10-minute cookie", async () => {
    const start = await get("/api/oauth/start");
    expect(start.status).toBe(302);
    expect(start.headers.get("location")).toBe("https://app.example.invalid/api/oauth/authorize");
    expect(start.headers.getSetCookie()).toEqual([]);

    const { response, setCookie, location, nonce } = await authorize();
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(location.origin + location.pathname).toBe("https://portal.example.invalid/app-auth");
    expect(setCookie).toHaveLength(1);
    const attributes = setCookie[0].split("; ");
    expect(attributes[0]).toBe(`app_oauth_flow=${nonce}`);
    expect(attributes).toEqual(expect.arrayContaining([
      "Max-Age=600", "Path=/api/oauth/callback", "HttpOnly", "Secure", "SameSite=Lax",
    ]));
    expect(attributes.some(attribute => attribute.startsWith("Domain="))).toBe(false);
  });

  it("completes a bound flow and expires the flow cookie alongside the session cookie", async () => {
    const { state, nonce } = await authorize();
    const response = await get(callbackPath("synthetic-code", state), `app_oauth_flow=${nonce}`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const setCookie = response.headers.getSetCookie();
    expect(setCookie).toHaveLength(2);
    expect(setCookie[0]).toBe(
      "app_oauth_flow=; Path=/api/oauth/callback; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
    );
    expect(setCookie[1]).toMatch(/^app_session_id=synthetic-session-token;/);
    expect(mocks.sdk.exchangeCodeForToken).toHaveBeenCalledWith("synthetic-code", state);
  });

  it("refuses an attacker's code and state in another browser, expiring its flow without any exchange", async () => {
    const attacker = await authorize();
    const victim = await authorize();
    const response = await get(callbackPath("attacker-code", attacker.state), `app_oauth_flow=${victim.nonce}`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sign-in?oauthError=expired");
    expect(response.headers.getSetCookie()).toEqual([
      "app_oauth_flow=; Path=/api/oauth/callback; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
    ]);
    expect(await response.text()).toBe("Found. Redirecting to /sign-in?oauthError=expired");
    expect(mocks.sdk.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(mocks.upsertUser).not.toHaveBeenCalled();
  });

  it("refuses the image-tag replay of a fixed state from a browser that never started a flow", async () => {
    const legacyState = Buffer.from("https://app.example.invalid/api/oauth/callback").toString("base64");
    const response = await get(callbackPath("attacker-code", legacyState));
    expect(response.headers.get("location")).toBe("/sign-in?oauthError=expired");
    expect(mocks.sdk.exchangeCodeForToken).not.toHaveBeenCalled();
  });
});
