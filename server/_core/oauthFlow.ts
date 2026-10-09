import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { CookieOptions, Request } from "express";

/*
 * Login-CSRF binding for the OAuth sign-in redirect flow.
 *
 * What the external broker sees:
 *   /app-auth?appId=<runtime app>&redirectUri=<frontend>/api/oauth/callback&state=<state>&type=signIn
 * and it returns the browser to `redirectUri?code=…&state=…` with state echoed. The token
 * exchange (sdk.exchangeCodeForToken) posts {clientId, grantType, code, redirectUri} and never
 * state; the broker matches that redirectUri to the authorize request, so it stays byte-identical.
 *
 * state used to be base64(redirectUri) only (so the server could recover redirectUri), and
 * nothing tied a callback to the browser that started the flow: an attacker's own code+state,
 * loaded in a victim's browser, signed the victim into the attacker's account.
 *
 * Now each flow gets a random nonce, kept in a short-lived httpOnly cookie scoped to the
 * callback and carried in state as base64(`${redirectUri}?nonce=${nonce}`). Decoded, state is
 * still an absolute URL on the callback origin and path, the closest shape to the legacy value
 * (this assumes the broker echoes state as an opaque value, as OAuth specifies; that cannot be
 * verified from this repository). Decoding yields the same redirectUri for the exchange, and the
 * callback accepts only a state whose nonce equals this browser's cookie.
 */

export const OAUTH_CALLBACK_PATH = "/api/oauth/callback";
export const OAUTH_FLOW_COOKIE = "app_oauth_flow";
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

// 32 random bytes as unpadded base64url: cookie-safe and never confused with an empty value.
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BOUND_STATE_PATTERN = /^([^?#]+)\?nonce=([A-Za-z0-9_-]{43})$/;

export function createOAuthFlowNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function encodeOAuthState(redirectUri: string, nonce: string): string {
  if (!NONCE_PATTERN.test(nonce) || !redirectUri || /[?#]/.test(redirectUri)) {
    throw new Error("Invalid OAuth flow");
  }
  return Buffer.from(`${redirectUri}?nonce=${nonce}`, "utf8").toString("base64");
}

export type DecodedOAuthState = { redirectUri: string; nonce: string | null };

/** Legacy base64(redirectUri) states decode with a null nonce, so callbacks reject them. */
export function decodeOAuthState(state: string): DecodedOAuthState | null {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    return null;
  }
  const bound = BOUND_STATE_PATTERN.exec(decoded);
  return bound ? { redirectUri: bound[1], nonce: bound[2] } : { redirectUri: decoded, nonce: null };
}

/**
 * Lax is sent on the broker's top-level GET redirect back to the callback but not on cross-site
 * subresource loads. Secure is off only for the explicitly allowed loopback HTTP callback.
 */
export function getOAuthFlowCookieOptions(
  secure: boolean
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return { httpOnly: true, path: OAUTH_CALLBACK_PATH, sameSite: "lax", secure };
}

export function readOAuthFlowCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  return header ? parseCookieHeader(header)[OAUTH_FLOW_COOKIE] : undefined;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant time: equal-length digests are compared, so timing reveals nothing about the nonce. */
export function isOAuthStateBound(state: string, flowCookie: string | undefined): boolean {
  const nonce = decodeOAuthState(state)?.nonce;
  if (!nonce || !flowCookie) return false;
  return timingSafeEqual(digest(nonce), digest(flowCookie));
}
