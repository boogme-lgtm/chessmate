import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLoginLinkProps,
  getLoginUrl,
  getOAuthAvailability,
  getOAuthSignInErrorMessage,
  isEmbeddedInFrame,
  startOAuthSignIn,
  takePendingOAuthReturnPath,
} from "./const";

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
  it("explains an expired or foreign sign-in flow politely, for any provider, and asks for a retry", () => {
    const message = getOAuthSignInErrorMessage("?oauthError=expired");
    expect(message).toBe("Your sign-in expired or was started in another tab or browser. Please try again.");
    expect(message).not.toMatch(/google/i);
  });

  it.each(["?oauthError=", "?oauthError=unknown", "?oauthError=%3Cscript%3E"])(
    "falls back to a generic retry without echoing the flag %j",
    search => {
      const message = getOAuthSignInErrorMessage(search);
      expect(message).toBe("We couldn't finish signing you in. Please try again.");
    },
  );

  it.each(["", "?redirect=%2Fdashboard", "?error=expired"])("shows nothing without the OAuth flag %j", search => {
    expect(getOAuthSignInErrorMessage(search)).toBe("");
    expect(getOAuthSignInErrorMessage(search, true)).toBe("");
  });

  it.each(["?oauthError=expired", "?oauthError=unknown"])("tells a framed page how to recover from %j", search => {
    expect(getOAuthSignInErrorMessage(search, true)).toBe(
      "Sign-in can't finish inside an embedded preview. Open BooGMe in its own browser tab and try again.",
    );
  });
});

describe("OAuth return path", () => {
  it.each([
    ["/coach/42", "/api/oauth/start?returnTo=%2Fcoach%2F42"],
    ["/coach/42?tab=book#slots", "/api/oauth/start?returnTo=%2Fcoach%2F42%3Ftab%3Dbook%23slots"],
    ["/", "/api/oauth/start"],
    ["//evil.example", "/api/oauth/start"],
    ["/\\evil.example", "/api/oauth/start"],
    ["https://evil.example", "/api/oauth/start"],
    [undefined, "/api/oauth/start"],
  ])("asks the server to return to %j via %j", (returnTo, url) => {
    expect(getLoginUrl(returnTo)).toBe(url);
  });
});

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    items,
  };
}

function stubBrowser({ framed = false, popup = true } = {}) {
  const top = {};
  const tab = { opener: {} as unknown };
  const browser = {
    location: { href: "https://app.example.invalid/sign-in" },
    open: vi.fn(() => (popup ? tab : null)),
  };
  Object.assign(browser, { self: browser, top: framed ? top : browser });
  const storage = memoryStorage();
  vi.stubGlobal("window", browser);
  vi.stubGlobal("sessionStorage", storage);
  return { browser, tab, storage };
}

describe("starting OAuth sign-in", () => {
  it("detects frames and treats an unreadable top as framed", () => {
    expect(isEmbeddedInFrame()).toBe(false);
    stubBrowser();
    expect(isEmbeddedInFrame()).toBe(false);
    stubBrowser({ framed: true });
    expect(isEmbeddedInFrame()).toBe(true);
    vi.stubGlobal("window", { get self() { throw new Error("blocked"); } });
    expect(isEmbeddedInFrame()).toBe(true);
  });

  it("navigates this tab at top level and remembers the destination for this tab only", () => {
    const { browser, storage } = stubBrowser();
    startOAuthSignIn("/coach/42");
    expect(browser.location.href).toBe("/api/oauth/start?returnTo=%2Fcoach%2F42");
    expect(browser.open).not.toHaveBeenCalled();
    expect(JSON.parse(storage.items.get("oauthReturnPath")!)).toEqual({ path: "/coach/42", at: expect.any(Number) });
  });

  it("runs the flow in a new top-level tab when framed, cutting the new tab off from this page", () => {
    const { browser, tab } = stubBrowser({ framed: true });
    startOAuthSignIn("/coach/42");
    expect(browser.open).toHaveBeenCalledWith("/api/oauth/start?returnTo=%2Fcoach%2F42", "_blank");
    expect(tab.opener).toBeNull();
    expect(browser.location.href).toBe("https://app.example.invalid/sign-in");
  });

  it("falls back to the frame itself when pop-ups are blocked there", () => {
    const { browser } = stubBrowser({ framed: true, popup: false });
    startOAuthSignIn();
    expect(browser.open).toHaveBeenCalledTimes(1);
    expect(browser.location.href).toBe("/api/oauth/start");
  });

  it("forgets an older destination when a new sign-in has none", () => {
    const { storage } = stubBrowser();
    startOAuthSignIn("/coach/42");
    startOAuthSignIn("/");
    expect(storage.items.has("oauthReturnPath")).toBe(false);
  });

  it("still signs in when storage is unavailable", () => {
    const { browser } = stubBrowser();
    vi.stubGlobal("sessionStorage", { setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } });
    startOAuthSignIn("/coach/42");
    expect(browser.location.href).toBe("/api/oauth/start?returnTo=%2Fcoach%2F42");
  });

  it("gives plain links a framed click handler only when framed", () => {
    stubBrowser();
    expect(getLoginLinkProps()).toEqual({ href: "/api/oauth/start" });

    const { browser } = stubBrowser({ framed: true });
    const props = getLoginLinkProps();
    expect(props.href).toBe("/api/oauth/start");
    const event = { preventDefault: vi.fn() };
    props.onClick!(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(browser.open).toHaveBeenCalledWith("/api/oauth/start", "_blank");
  });
});

describe("destination remembered for a refused OAuth sign-in", () => {
  const NOW = 1_800_000_000_000;

  it("is read once", () => {
    const { storage } = stubBrowser();
    storage.setItem("oauthReturnPath", JSON.stringify({ path: "/coach/42", at: NOW - 15 * 60 * 1000 }));
    expect(takePendingOAuthReturnPath(NOW)).toBe("/coach/42");
    expect(takePendingOAuthReturnPath(NOW)).toBeNull();
  });

  it.each([
    ["an hour-old entry", { path: "/coach/42", at: NOW - 60 * 60 * 1000 - 1 }],
    ["a future entry", { path: "/coach/42", at: NOW + 1 }],
    ["an entry without a time", { path: "/coach/42" }],
    ["an unsafe path", { path: "//evil.example", at: NOW }],
    ["a non-string path", { path: ["/coach/42"], at: NOW }],
    ["a non-object", "/coach/42"],
  ])("ignores and forgets %s", (_label, entry) => {
    const { storage } = stubBrowser();
    storage.setItem("oauthReturnPath", JSON.stringify(entry));
    expect(takePendingOAuthReturnPath(NOW)).toBeNull();
    expect(storage.items.has("oauthReturnPath")).toBe(false);
  });

  it("ignores malformed or unavailable storage", () => {
    const { storage } = stubBrowser();
    storage.setItem("oauthReturnPath", "{not json");
    expect(takePendingOAuthReturnPath(NOW)).toBeNull();
    vi.stubGlobal("sessionStorage", undefined);
    expect(takePendingOAuthReturnPath(NOW)).toBeNull();
  });
});
