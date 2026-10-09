import type { CookieOptions, Request } from "express";
import { toSafeReturnPath } from "@shared/returnPath";
import { bindingMatches, createBindingNonce, readCookie } from "./browserBinding";

/*
 * Login-CSRF binding for the OAuth sign-in redirect flow (see browserBinding.ts).
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
 *
 * The cookie also remembers where the person was going (`returnTo`, a validated same-origin
 * path), so the callback can land them there, or keep it when it asks them to retry. It never
 * travels through the broker.
 *
 * The cookie is SameSite=Lax, so browsers neither store nor send it in a cross-site frame (such
 * as an editor preview): framed pages start OAuth in a top-level tab instead (client/src/const.ts).
 */

export const OAUTH_CALLBACK_PATH = "/api/oauth/callback";
export const OAUTH_FLOW_COOKIE = "app_oauth_flow";
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

// The nonce from createBindingNonce: 32 random bytes as unpadded base64url.
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BOUND_STATE_PATTERN = /^([^?#]+)\?nonce=([A-Za-z0-9_-]{43})$/;
// `nonce` alone, or `nonce.base64url(returnTo)`; neither part can contain a dot.
const FLOW_COOKIE_PATTERN = /^([A-Za-z0-9_-]{43})(?:\.([A-Za-z0-9_-]+))?$/;

export function createOAuthFlowNonce(): string {
  return createBindingNonce();
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

/** What the flow cookie remembers for the browser that started the flow. */
export type OAuthFlow = Readonly<{ nonce: string; returnTo: string | null }>;

export function encodeOAuthFlowCookie(nonce: string, returnTo: string | null): string {
  if (!NONCE_PATTERN.test(nonce)) throw new Error("Invalid OAuth flow");
  const path = toSafeReturnPath(returnTo);
  // "/" is where a sign-in lands anyway; leaving it out keeps the plain nonce shape.
  return path && path !== "/" ? `${nonce}.${Buffer.from(path, "utf8").toString("base64url")}` : nonce;
}

/** Null for anything this server did not mint; an unusable return path is simply dropped. */
export function decodeOAuthFlowCookie(value: string | undefined): OAuthFlow | null {
  const match = value ? FLOW_COOKIE_PATTERN.exec(value) : null;
  if (!match) return null;
  const returnTo = match[2] ? toSafeReturnPath(Buffer.from(match[2], "base64url").toString("utf8")) : null;
  return { nonce: match[1], returnTo };
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
  return readCookie(req, OAUTH_FLOW_COOKIE);
}

/** True only when state carries exactly the nonce of this browser's flow (constant time). */
export function isOAuthStateBound(state: string, flowNonce: string | undefined): boolean {
  return bindingMatches(decodeOAuthState(state)?.nonce, flowNonce);
}
