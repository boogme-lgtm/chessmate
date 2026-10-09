import { OAUTH_RETURN_TO_PARAM, OAUTH_SIGN_IN_ERROR_PARAM, OAUTH_SIGN_IN_EXPIRED } from "@shared/const";
import { toSafeReturnPath } from "@shared/returnPath";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
export { getSignInPath, toSafeReturnPath } from "@shared/returnPath";

/**
 * The server uses its current OAuth settings rather than compiled client values. It carries
 * a safe return path through the flow and lands there after sign-in.
 */
export const getLoginUrl = (returnTo?: string) => {
  const path = toSafeReturnPath(returnTo);
  if (!path || path === "/") return "/api/oauth/start";
  return `/api/oauth/start?${new URLSearchParams({ [OAUTH_RETURN_TO_PARAM]: path })}`;
};

/** True inside any frame, such as an editor or management preview. */
export function isEmbeddedInFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// This tab's destination for a sign-in it sent to OAuth, for when the server cannot say.
const PENDING_OAUTH_RETURN_KEY = "oauthReturnPath";
// Comfortably longer than the server's 10-minute flow, short enough not to resurface later.
const PENDING_OAUTH_RETURN_MAX_AGE_MS = 60 * 60 * 1000;

function rememberPendingOAuthReturnPath(returnTo: string | undefined): void {
  try {
    const path = toSafeReturnPath(returnTo);
    if (path && path !== "/") {
      sessionStorage.setItem(PENDING_OAUTH_RETURN_KEY, JSON.stringify({ path, at: Date.now() }));
    } else {
      sessionStorage.removeItem(PENDING_OAUTH_RETURN_KEY);
    }
  } catch {
    // Storage may be unavailable (privacy modes); the server still carries the path.
  }
}

/**
 * Reads and forgets the destination this tab sent to OAuth. Used when a refused sign-in lands
 * on /sign-in without one, e.g. after the server's flow cookie expired.
 */
export function takePendingOAuthReturnPath(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_OAUTH_RETURN_KEY);
    sessionStorage.removeItem(PENDING_OAUTH_RETURN_KEY);
    const pending: unknown = raw ? JSON.parse(raw) : null;
    if (typeof pending !== "object" || pending === null) return null;
    const { path, at } = pending as { path?: unknown; at?: unknown };
    if (typeof at !== "number" || !(now - at >= 0 && now - at <= PENDING_OAUTH_RETURN_MAX_AGE_MS)) return null;
    return toSafeReturnPath(path);
  } catch {
    return null;
  }
}

/**
 * Leave for OAuth sign-in. Browsers neither store nor send the flow's SameSite=Lax cookie in a
 * cross-site frame, so a framed page runs the flow in a new top-level tab. If pop-ups are
 * blocked there, the frame navigates instead, and the sign-in page it is sent back to explains
 * how to recover.
 */
export function startOAuthSignIn(returnTo?: string): void {
  rememberPendingOAuthReturnPath(returnTo);
  const url = getLoginUrl(returnTo);
  if (isEmbeddedInFrame()) {
    const tab = window.open(url, "_blank");
    if (tab) {
      tab.opener = null;
      return;
    }
  }
  window.location.href = url;
}

/** Props for a plain "Sign in" link to OAuth; when framed, the click goes through startOAuthSignIn. */
export function getLoginLinkProps(returnTo?: string): {
  href: string;
  onClick?: (event: { preventDefault(): void }) => void;
} {
  const href = getLoginUrl(returnTo);
  if (!isEmbeddedInFrame()) return { href };
  return {
    href,
    onClick: event => {
      event.preventDefault();
      startOAuthSignIn(returnTo);
    },
  };
}

/** Polite copy for the flag the OAuth callback adds to /sign-in; empty when there is none. */
export function getOAuthSignInErrorMessage(search: string, framed = false): string {
  const code = new URLSearchParams(search).get(OAUTH_SIGN_IN_ERROR_PARAM);
  if (code === null) return "";
  if (framed) {
    return "Sign-in can't finish inside an embedded preview. Open BooGMe in its own browser tab and try again.";
  }
  if (code === OAUTH_SIGN_IN_EXPIRED) {
    return "Your sign-in expired or was started in another tab or browser. Please try again.";
  }
  return "We couldn't finish signing you in. Please try again.";
}

export async function getOAuthAvailability(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/oauth/availability", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) return false;
    const availability: unknown = await response.json();
    return typeof availability === "object" && availability !== null
      && "enabled" in availability && availability.enabled === true;
  } catch {
    // Native sign-in remains available when the runtime check cannot complete.
    return false;
  }
}
