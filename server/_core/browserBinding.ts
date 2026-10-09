import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";

/*
 * Browser binding against login CSRF.
 *
 * Any URL that ends in a session (the OAuth callback, an email verification link, and later
 * magic links or invitations) is a bearer credential: whoever loads it is signed in. An
 * attacker who keeps such a URL for their own account and gets a victim's browser to load it
 * makes the victim work inside the attacker's account. Binding keeps a value in an httpOnly
 * cookie of the browser that started the flow, and the flow may only create a session for a
 * request presenting it. Other sites cannot read or set that cookie.
 */

/** 32 random bytes as unpadded base64url: cookie-safe and never confused with an empty value. */
export function createBindingNonce(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way, cookie-safe fingerprint of a secret link token, so the cookie never holds the token. */
export function bindingDigest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("base64url");
}

export function readCookie(req: Pick<Request, "headers">, name: string): string | undefined {
  const header = req.headers?.cookie;
  return header ? parseCookieHeader(header)[name] : undefined;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant time: equal-length digests are compared, so timing reveals nothing about either value. */
export function bindingMatches(expected: string | null | undefined, presented: string | null | undefined): boolean {
  if (!expected || !presented) return false;
  return timingSafeEqual(digest(expected), digest(presented));
}
