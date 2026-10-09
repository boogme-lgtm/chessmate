import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoginUrl, getOAuthAvailability, getOAuthSignInErrorMessage } from "./const";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runtime OAuth entrypoint", () => {
  it("uses the server route even when compiled OAuth settings are stale", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://stale-oauth.example");
    vi.stubEnv("VITE_APP_ID", "stale-compiled-app");
    vi.stubGlobal("window", { location: { origin: "https://current-app.example" } });
    expect(getLoginUrl()).toBe("/api/oauth/start");
  });

  it("uses the server route when OAuth settings were absent at build time", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "");
    expect(getLoginUrl()).toBe("/api/oauth/start");
  });
});

describe("runtime OAuth availability", () => {
  it("reads fresh same-origin availability and forwards cancellation", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) });
    vi.stubGlobal("fetch", fetch);

    await expect(getOAuthAvailability(controller.signal)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/oauth/availability", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
  });

  it.each([null, [], {}, { enabled: false }, { enabled: "true" }, { enabled: 1 }].map(availability => ({ availability })))(
    "keeps OAuth hidden unless the runtime explicitly enables it: %j",
    async ({ availability }) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => availability }));
      await expect(getOAuthAvailability()).resolves.toBe(false);
    },
  );

  it("does not enable OAuth from an unsuccessful HTTP response", async () => {
    const json = vi.fn().mockResolvedValue({ enabled: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json }));
    await expect(getOAuthAvailability()).resolves.toBe(false);
    expect(json).not.toHaveBeenCalled();
  });

  it("keeps native sign-in available when the response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError("Invalid JSON"); },
    }));
    await expect(getOAuthAvailability()).resolves.toBe(false);
  });

  it.each([new Error("Network unavailable"), new DOMException("Request aborted", "AbortError")])(
    "settles disabled after a failed or cancelled runtime read: %s",
    async error => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
      await expect(getOAuthAvailability()).resolves.toBe(false);
    },
  );
});

describe("refused OAuth callback message", () => {
  it("explains an expired or foreign sign-in flow politely and asks for a retry", () => {
    const message = getOAuthSignInErrorMessage("?oauthError=expired");
    expect(message).toBe("Your Google sign-in expired or was started in another tab or browser. Please try again.");
  });

  it.each(["?oauthError=", "?oauthError=unknown", "?oauthError=%3Cscript%3E"])(
    "falls back to a generic retry without echoing the flag %j",
    search => {
      const message = getOAuthSignInErrorMessage(search);
      expect(message).toBe("We couldn't finish signing you in with Google. Please try again.");
    },
  );

  it.each(["", "?redirect=%2Fdashboard", "?error=expired"])("shows nothing without the OAuth flag %j", search => {
    expect(getOAuthSignInErrorMessage(search)).toBe("");
  });
});
