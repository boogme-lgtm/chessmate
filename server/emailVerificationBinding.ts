import type { CookieOptions, Request, Response } from "express";
import { bindingDigest, bindingMatches, readCookie } from "./_core/browserBinding";

/*
 * Email verification links sign the browser in, so they get the same login-CSRF binding as
 * OAuth (see _core/browserBinding.ts). Registration leaves a digest of the emailed token in an
 * httpOnly cookie. Verification always marks the address verified, but starts a session only
 * for a request carrying that cookie: an attacker's unused link loaded in a victim's browser
 * verifies the attacker's address and leaves the victim's session alone. Opening the link in
 * another browser or device just asks the person to sign in, as does a resent link: resending
 * sets no cookie, because a cookie only for real unverified accounts would reveal which exist.
 */

export const EMAIL_VERIFICATION_BINDING_COOKIE = "app_email_verification";
// Every tRPC request path starts here; a batched call may list several procedures after it.
const BINDING_COOKIE_PATH = "/api/trpc";

export type EmailVerificationLink = Readonly<{ token: string; expiresAt: Date }>;

function bindingCookieOptions(secure: boolean): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  // Verification is a same-origin call from the /verify-email page, so Lax always carries it.
  return { httpOnly: true, path: BINDING_COOKIE_PATH, sameSite: "lax", secure };
}

/** Lets only this browser turn the emailed link into a session, until the link expires. */
export function bindEmailVerificationToBrowser(res: Response, link: EmailVerificationLink, secure: boolean): void {
  res.cookie(EMAIL_VERIFICATION_BINDING_COOKIE, bindingDigest(link.token), {
    ...bindingCookieOptions(secure),
    expires: link.expiresAt,
  });
}

export function isEmailVerificationBoundToBrowser(req: Pick<Request, "headers">, token: string): boolean {
  return bindingMatches(bindingDigest(token), readCookie(req, EMAIL_VERIFICATION_BINDING_COOKIE));
}

/** Appends to Set-Cookie, so call it after anything that replaces that header. */
export function clearEmailVerificationBinding(res: Response, secure: boolean): void {
  res.clearCookie(EMAIL_VERIFICATION_BINDING_COOKIE, bindingCookieOptions(secure));
}
