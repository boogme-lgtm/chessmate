import { OAUTH_SIGN_IN_ERROR_PARAM, OAUTH_SIGN_IN_EXPIRED } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// The server uses its current OAuth settings rather than compiled client values.
export const getLoginUrl = () => "/api/oauth/start";

/** Polite copy for the flag the OAuth callback adds to /sign-in; empty when there is none. */
export function getOAuthSignInErrorMessage(search: string): string {
  const code = new URLSearchParams(search).get(OAUTH_SIGN_IN_ERROR_PARAM);
  if (code === null) return "";
  if (code === OAUTH_SIGN_IN_EXPIRED) {
    return "Your Google sign-in expired or was started in another tab or browser. Please try again.";
  }
  return "We couldn't finish signing you in with Google. Please try again.";
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
