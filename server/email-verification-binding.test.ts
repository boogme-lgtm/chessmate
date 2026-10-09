import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real Express 5 + tRPC routing, cookie parsing and Set-Cookie serialization on an ephemeral
// loopback port; the account store and email stay synthetic.
const mocks = vi.hoisted(() => ({
  registerUser: vi.fn(),
  verifyEmail: vi.fn(),
  getUserById: vi.fn(),
  getWaitlistEntryByEmail: vi.fn(),
  contextUser: null as unknown,
}));

vi.mock("./auth", () => ({
  registerUser: mocks.registerUser, verifyEmail: mocks.verifyEmail, loginUser: vi.fn(),
  requestPasswordReset: vi.fn(), resetPassword: vi.fn(), resendVerificationEmail: vi.fn(),
}));
vi.mock("./db", () => ({
  getUserById: mocks.getUserById,
  getWaitlistEntryByEmail: mocks.getWaitlistEntryByEmail,
  getStudentProfileByUserId: vi.fn(),
  updateStudentProfile: vi.fn(),
  createStudentProfile: vi.fn(),
}));

import { authRouter } from "./authRouter";
import { router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { bindingDigest } from "./_core/browserBinding";

const ATTACKER = { id: 666, openId: null, name: "Attacker", email: "attacker@example.invalid" };
const VICTIM = { id: 42, openId: null, name: "Victim", email: "victim@example.invalid" };
const ATTACKER_TOKEN = "a".repeat(64);
const OTHER_TOKEN = "b".repeat(64);
const EXPIRES_AT = new Date("2030-01-02T03:04:05.000Z");
const CLEARED_BINDING =
  "app_email_verification=; Path=/api/trpc; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/api/trpc", createExpressMiddleware({
    router: router({ auth: authRouter }),
    createContext: ({ req, res }) => ({ req, res, user: mocks.contextUser as never }),
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contextUser = null;
  mocks.registerUser.mockResolvedValue({
    success: true, userId: ATTACKER.id, verification: { token: ATTACKER_TOKEN, expiresAt: EXPIRES_AT },
  });
  mocks.verifyEmail.mockResolvedValue({ success: true, userId: ATTACKER.id });
  mocks.getUserById.mockResolvedValue(ATTACKER);
  mocks.getWaitlistEntryByEmail.mockResolvedValue(undefined);
});

async function call(procedure: string, input: unknown, cookie?: string) {
  const response = await fetch(`${base}/api/trpc/auth.${procedure}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ json: input }),
  });
  const text = await response.text();
  return { response, text, setCookie: response.headers.getSetCookie(), body: JSON.parse(text) };
}

const register = () => call("register", { email: ATTACKER.email, password: "UnitPass123", name: ATTACKER.name });
const verify = (token: string, cookie?: string) => call("verifyEmail", { token }, cookie);

describe("email verification links are bound to the registering browser", () => {
  it("registration leaves a digest of the link in a Lax, httpOnly, Secure cookie until the link expires", async () => {
    const { response, text, setCookie } = await register();
    expect(response.status).toBe(200);
    expect(setCookie).toHaveLength(1);
    const attributes = setCookie[0].split("; ");
    expect(attributes[0]).toBe(`app_email_verification=${bindingDigest(ATTACKER_TOKEN)}`);
    expect(attributes).toEqual(expect.arrayContaining([
      "Path=/api/trpc", `Expires=${EXPIRES_AT.toUTCString()}`, "HttpOnly", "Secure", "SameSite=Lax",
    ]));
    expect(attributes.some(attribute => attribute.startsWith("Domain="))).toBe(false);
    // Neither the cookie nor the response ever carries the emailed secret itself.
    expect(setCookie[0]).not.toContain(ATTACKER_TOKEN);
    expect(text).not.toContain(ATTACKER_TOKEN);
  });

  it("signs in the browser that registered and spends its binding", async () => {
    const { setCookie: [binding] } = await register();
    const { response, setCookie, body } = await verify(ATTACKER_TOKEN, binding.split(";")[0]);

    expect(response.status).toBe(200);
    expect(mocks.verifyEmail).toHaveBeenCalledWith(ATTACKER_TOKEN);
    expect(body.result.data.json).toEqual({ success: true, signedIn: true, message: "Email verified successfully!" });
    expect(setCookie).toHaveLength(2);
    const session = /^app_session_id=([^;]+);/.exec(setCookie[0])![1];
    const { payload } = await jwtVerify(session, new TextEncoder().encode(ENV.cookieSecret));
    expect(payload.openId).toBe(`local_${ATTACKER.id}`);
    expect(setCookie[1]).toBe(CLEARED_BINDING);
  });

  it("verifies an attacker's link loaded in a signed-in victim's browser without touching the victim's session", async () => {
    mocks.contextUser = VICTIM;
    mocks.getWaitlistEntryByEmail.mockResolvedValue({ assessmentData: null });
    const { response, setCookie, body } = await verify(ATTACKER_TOKEN, "app_session_id=victim-session");

    expect(response.status).toBe(200);
    expect(setCookie).toEqual([]);
    expect(body.result.data.json).toEqual({
      success: true, signedIn: false, message: "Email verified successfully! Please sign in to continue.",
    });
    // The address is still verified, and account data still follows the account.
    expect(mocks.verifyEmail).toHaveBeenCalledWith(ATTACKER_TOKEN);
    expect(mocks.getWaitlistEntryByEmail).toHaveBeenCalledWith(ATTACKER.email);
  });

  it.each([
    ["another link's binding", `app_email_verification=${bindingDigest(OTHER_TOKEN)}`],
    ["the raw token instead of its digest", `app_email_verification=${ATTACKER_TOKEN}`],
    ["an empty binding", "app_email_verification="],
    ["a lookalike cookie name", `app_email_verification_x=${bindingDigest(ATTACKER_TOKEN)}`],
  ])("does not sign in with %s and leaves any pending binding alone", async (_label, cookie) => {
    const { setCookie, body } = await verify(ATTACKER_TOKEN, cookie);
    expect(setCookie).toEqual([]);
    expect(body.result.data.json.signedIn).toBe(false);
    expect(mocks.verifyEmail).toHaveBeenCalledWith(ATTACKER_TOKEN);
  });

  it("never signs in when verification itself fails, even from the registering browser", async () => {
    mocks.verifyEmail.mockResolvedValue({ success: false, error: "Verification token expired" });
    const { setCookie: [binding] } = await register();
    const { response, setCookie, body } = await verify(ATTACKER_TOKEN, binding.split(";")[0]);
    expect(response.status).toBe(400);
    expect(body.error.json.message).toBe("Verification token expired");
    expect(setCookie).toEqual([]);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("sets no binding when registration fails", async () => {
    mocks.registerUser.mockResolvedValue({ success: false, error: "Email already registered" });
    const { response, setCookie } = await register();
    expect(response.status).toBe(400);
    expect(setCookie).toEqual([]);
  });
});
