import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Register from "./Register";

vi.mock("@/lib/trpc", () => ({
  trpc: { auth: { register: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/register", vi.fn()],
  useSearch: () => "",
  Link: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

describe("registration form", () => {
  it("caps the name at the length the server accepts", () => {
    // Sprint 3: a longer name reached the server and came back as raw zod JSON.
    const html = renderToStaticMarkup(createElement(Register));
    expect(html).toMatch(/<input(?=[^>]*id="name")(?=[^>]*maxlength="100")[^>]*>/i);
  });
});
