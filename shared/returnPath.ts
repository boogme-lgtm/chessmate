import { OAUTH_SIGN_IN_ERROR_PARAM } from "./const";

/**
 * Where people go back to after signing in (a coach page, a course chapter, a purchase).
 * Shared by the sign-in pages and the OAuth routes, which both navigate to the result.
 */

export const SIGN_IN_PATH = "/sign-in";
// Query parameter the sign-in and registration pages read their return path from.
export const SIGN_IN_REDIRECT_PARAM = "redirect";

const MAX_RETURN_PATH_LENGTH = 1024;

// Only used to resolve a path the way a browser would; never contacted.
const RESOLUTION_BASE = "https://return-path.invalid";

/**
 * The value as a same-origin page path, or null. Browsers read "/\evil.example" as
 * "//evil.example" and drop tabs and newlines from URLs, so backslashes and control
 * characters are refused along with absolute and protocol-relative URLs. Server endpoints
 * (/api/…, matched case-insensitively like Express routes, also after "/x/../" or "%2e%2e"
 * segments resolve) are never a page to return to.
 */
export function toSafeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_RETURN_PATH_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(value, RESOLUTION_BASE);
  } catch {
    return null;
  }
  if (resolved.origin !== RESOLUTION_BASE || /^\/api(?:\/|$)/i.test(resolved.pathname)) return null;
  return value;
}

/** The sign-in page, keeping a safe return path (other than "/") and an optional OAuth flag. */
export function getSignInPath(options: { returnTo?: string | null; oauthError?: string } = {}): string {
  const params = new URLSearchParams();
  if (options.oauthError) params.set(OAUTH_SIGN_IN_ERROR_PARAM, options.oauthError);
  const returnTo = toSafeReturnPath(options.returnTo);
  if (returnTo && returnTo !== "/") params.set(SIGN_IN_REDIRECT_PARAM, returnTo);
  const query = params.toString();
  return query ? `${SIGN_IN_PATH}?${query}` : SIGN_IN_PATH;
}
