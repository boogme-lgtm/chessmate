import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignIn from "./SignIn";

const { route } = vi.hoisted(() => ({ route: { search: "" } }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    auth: {
      login: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      resendVerification: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/sign-in", vi.fn()],
  useSearch: () => route.search,
  Link: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("@/components/Logo", () => ({ default: () => createElement("span", null, "BooGMe") }));

beforeEach(() => { route.search = ""; });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sign-in before runtime OAuth availability settles", () => {
  it("keeps native sign-in and recovery available while ignoring compiled OAuth visibility", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://stale-oauth.example");
    const html = renderToStaticMarkup(createElement(SignIn));

    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('href="/register?redirect=%2F"');
    expect(html).not.toContain("Sign in with Google");
  });

  it.each([
    ["/dashboard", "%2Fdashboard"],
    ["https://external.example", "%2F"],
    // Browsers read a leading "/\" as "//", so this would leave the site after signing in.
    ["/\\external.example", "%2F"],
    ["/api/force-logout", "%2F"],
  ])("preserves the native registration return path for %s", (redirect, expected) => {
    route.search = `?redirect=${encodeURIComponent(redirect)}`;
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain(`href="/register?redirect=${expected}"`);
  });
});

describe("sign-in after a refused OAuth callback", () => {
  it("shows a polite retry message in the existing alert while keeping native sign-in available", () => {
    route.search = "?oauthError=expired";
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your sign-in expired or was started in another tab or browser. Please try again.");
    expect(html).not.toContain("Resend verification email");
    expect(html).toContain('id="email"');
    expect(html).toContain('type="submit"');
  });

  it("shows no alert on an ordinary visit", () => {
    route.search = "?redirect=%2Fdashboard";
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).not.toContain('role="alert"');
  });

  it("keeps the destination the server sent back, so a password retry or registration still gets there", () => {
    route.search = "?oauthError=expired&redirect=%2Fcoach%2F42";
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain('href="/register?redirect=%2Fcoach%2F42"');
  });

  it("falls back to the destination this tab sent to OAuth when the server no longer knew it, once", () => {
    const storage = new Map([["oauthReturnPath", JSON.stringify({ path: "/coach/42", at: Date.now() })]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => void storage.delete(key),
    });
    route.search = "?oauthError=expired";
    expect(renderToStaticMarkup(createElement(SignIn))).toContain('href="/register?redirect=%2Fcoach%2F42"');
    expect(storage.has("oauthReturnPath")).toBe(false);
  });

  it("ignores a remembered destination on an ordinary visit", () => {
    const storage = new Map([["oauthReturnPath", JSON.stringify({ path: "/coach/42", at: Date.now() })]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => void storage.delete(key),
    });
    expect(renderToStaticMarkup(createElement(SignIn))).toContain('href="/register?redirect=%2F"');
    expect(storage.has("oauthReturnPath")).toBe(true);
  });

  it("explains how to recover inside an embedded preview", () => {
    const frame = { top: {} };
    vi.stubGlobal("window", Object.assign(frame, { self: frame }));
    route.search = "?oauthError=expired";
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain("Sign-in can&#x27;t finish inside an embedded preview. Open BooGMe in its own browser tab and try again.");
  });
});
