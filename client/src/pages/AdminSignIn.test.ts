import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdminApplications from "./AdminApplications";
import AdminDisputesPanel from "./AdminDisputesPanel";

// Any tRPC hook the pages call answers "no data yet"; signed-out pages never get further.
vi.mock("@/lib/trpc", () => {
  const query = { data: undefined, isLoading: false, error: null, refetch: () => {} };
  const mutation = { mutate: () => {}, isPending: false };
  const api = (): unknown => new Proxy(() => {}, {
    get: (_target, key) => {
      if (key === "useQuery") return () => query;
      if (key === "useMutation") return () => mutation;
      if (key === "useUtils") return () => api();
      return api();
    },
  });
  return { trpc: api() };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: unknown }) => children,
  useLocation: () => ["/admin", vi.fn()],
}));

describe("signed-out admin pages", () => {
  it.each([
    ["applications", AdminApplications, "/sign-in?redirect=%2Fadmin%2Fapplications"],
    ["disputes", AdminDisputesPanel, "/sign-in?redirect=%2Fadmin%2Fdisputes"],
  ] as const)("send %s visitors to the sign-in page and back", (_label, Page, href) => {
    const html = renderToStaticMarkup(createElement(Page as ComponentType));
    expect(html).toContain("Authentication Required");
    expect(html).toMatch(new RegExp(`<a[^>]*href="${href.replace(/[?]/g, "\\?")}"[^>]*>Log In</a>`));
    expect(html).not.toContain("/api/oauth/login");
  });
});

describe("client OAuth links", () => {
  // The browser-facing OAuth routes server/_core/oauth.ts registers; /api/oauth/authorize and
  // /api/oauth/callback are only reached through the server's own redirects.
  const BROWSER_ROUTES = new Set(["/api/oauth/start", "/api/oauth/availability"]);
  const root = path.resolve(import.meta.dirname, "..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) return sourceFiles(file);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
    });
  }

  it("point only at OAuth routes the server serves", () => {
    const used = sourceFiles(root).flatMap(file =>
      [...readFileSync(file, "utf8").matchAll(/\/api\/oauth\/[A-Za-z0-9_-]+/g)].map(match => ({
        file: path.relative(root, file),
        route: match[0],
      })),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(({ route }) => !BROWSER_ROUTES.has(route))).toEqual([]);
  });
});
