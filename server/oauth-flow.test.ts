import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  createOAuthFlowNonce,
  decodeOAuthFlowCookie,
  decodeOAuthState,
  encodeOAuthFlowCookie,
  encodeOAuthState,
  getOAuthFlowCookieOptions,
  isOAuthStateBound,
  readOAuthFlowCookie,
} from "./_core/oauthFlow";

const CALLBACK = "https://app.example.invalid/api/oauth/callback";

describe("OAuth flow nonce", () => {
  it("is 32 random bytes in cookie-safe base64url and never repeats", () => {
    const nonces = Array.from({ length: 200 }, createOAuthFlowNonce);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(nonce, "base64url")).toHaveLength(32);
    }
    expect(new Set(nonces).size).toBe(nonces.length);
  });
});

describe("OAuth state codec", () => {
  it("round-trips the exact callback URI and nonce in standard base64", () => {
    const nonce = createOAuthFlowNonce();
    const state = encodeOAuthState(CALLBACK, nonce);
    expect(state).toBe(Buffer.from(`${CALLBACK}?nonce=${nonce}`, "utf8").toString("base64"));
    expect(decodeOAuthState(state)).toEqual({ redirectUri: CALLBACK, nonce });
  });

  it("decodes a legacy base64(redirectUri) state with no binding", () => {
    expect(decodeOAuthState(Buffer.from(CALLBACK).toString("base64"))).toEqual({ redirectUri: CALLBACK, nonce: null });
  });

  it.each(["%%%", "not base64!", "a"])("returns null rather than throwing for undecodable state %j", state => {
    expect(decodeOAuthState(state)).toBeNull();
  });

  it.each([
    `${CALLBACK}?nonce=`,
    `${CALLBACK}?nonce=${"a".repeat(42)}`,
    `${CALLBACK}?nonce=${"a".repeat(44)}`,
    `${CALLBACK}?nonce=${"a".repeat(42)}=`,
    `${CALLBACK}?other=1&nonce=${"a".repeat(43)}`,
    `${CALLBACK}?nonce=${"a".repeat(43)}&other=1`,
    `${CALLBACK}?nonce=${"a".repeat(43)}#fragment`,
    `?nonce=${"a".repeat(43)}`,
  ])("binds nothing unless the state has exactly the minted shape: %j", decoded => {
    expect(decodeOAuthState(Buffer.from(decoded).toString("base64"))?.nonce).toBeNull();
  });

  it.each([
    [CALLBACK, ""],
    [CALLBACK, "short"],
    [CALLBACK, `${"a".repeat(42)}+`],
    [`${CALLBACK}?x=1`, createOAuthFlowNonce()],
    [`${CALLBACK}#x`, createOAuthFlowNonce()],
    ["", createOAuthFlowNonce()],
  ])("refuses to mint a state from redirect URI %j and nonce %j", (redirectUri, nonce) => {
    expect(() => encodeOAuthState(redirectUri, nonce)).toThrow("Invalid OAuth flow");
  });
});

describe("OAuth flow binding check", () => {
  const nonce = createOAuthFlowNonce();
  const state = encodeOAuthState(CALLBACK, nonce);

  it("accepts only the cookie holding the state's own nonce", () => {
    expect(isOAuthStateBound(state, nonce)).toBe(true);
    expect(isOAuthStateBound(state, createOAuthFlowNonce())).toBe(false);
    expect(isOAuthStateBound(state, nonce.slice(1))).toBe(false);
    expect(isOAuthStateBound(state, `${nonce}x`)).toBe(false);
    expect(isOAuthStateBound(state, "")).toBe(false);
    expect(isOAuthStateBound(state, undefined)).toBe(false);
  });

  it("never treats an unbound or undecodable state as bound", () => {
    expect(isOAuthStateBound(Buffer.from(CALLBACK).toString("base64"), nonce)).toBe(false);
    expect(isOAuthStateBound("%%%", nonce)).toBe(false);
    expect(isOAuthStateBound("", "")).toBe(false);
  });
});

describe("OAuth flow cookie", () => {
  it("is httpOnly, Lax and scoped to the callback path", () => {
    expect(getOAuthFlowCookieOptions(true)).toEqual({
      httpOnly: true, path: "/api/oauth/callback", sameSite: "lax", secure: true,
    });
    expect(getOAuthFlowCookieOptions(false).secure).toBe(false);
  });

  it("reads the first flow cookie the browser sends (the most specific path) and nothing else", () => {
    const read = (cookie?: string) => readOAuthFlowCookie({ headers: cookie === undefined ? {} : { cookie } } as Request);
    expect(read()).toBeUndefined();
    expect(read("app_session_id=session")).toBeUndefined();
    expect(read("a=1; app_oauth_flow=first; app_oauth_flow=second")).toBe("first");
    expect(read("app_oauth_flow_other=x")).toBeUndefined();
  });
});

describe("OAuth flow cookie value", () => {
  const nonce = createOAuthFlowNonce();
  const encodedPath = (path: string) => Buffer.from(path, "utf8").toString("base64url");

  it("is the bare nonce when there is nowhere special to return to", () => {
    for (const returnTo of [null, "/"]) {
      const value = encodeOAuthFlowCookie(nonce, returnTo);
      expect(value).toBe(nonce);
      expect(decodeOAuthFlowCookie(value)).toEqual({ nonce, returnTo: null });
    }
  });

  it("round-trips a return path in cookie-safe characters", () => {
    const returnTo = "/coach/42?tab=book&slot=2026-10-09T10:00#times";
    const value = encodeOAuthFlowCookie(nonce, returnTo);
    expect(value).toBe(`${nonce}.${encodedPath(returnTo)}`);
    expect(value).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(decodeOAuthFlowCookie(value)).toEqual({ nonce, returnTo });
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example", "/api/force-logout"])(
    "never stores the unsafe return path %j",
    returnTo => {
      expect(encodeOAuthFlowCookie(nonce, returnTo)).toBe(nonce);
    },
  );

  it("drops an unsafe return path from a tampered cookie but keeps the binding check to the nonce", () => {
    expect(decodeOAuthFlowCookie(`${nonce}.${encodedPath("//evil.example")}`)).toEqual({ nonce, returnTo: null });
  });

  it.each([undefined, "", "short", `${nonce}.`, `${nonce}.a.b`, `${nonce}x.${encodedPath("/coach/42")}`, `.${nonce}`])(
    "reads nothing from a value this server did not mint: %j",
    value => {
      expect(decodeOAuthFlowCookie(value)).toBeNull();
    },
  );

  it("refuses to mint a cookie without a well-formed nonce", () => {
    expect(() => encodeOAuthFlowCookie("short", "/coach/42")).toThrow("Invalid OAuth flow");
  });
});
