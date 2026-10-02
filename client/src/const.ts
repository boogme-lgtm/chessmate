export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// The server uses its current OAuth settings rather than compiled client values.
export const getLoginUrl = () => "/api/oauth/start";

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
