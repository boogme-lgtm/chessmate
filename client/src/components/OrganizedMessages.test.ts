import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizedMessages from "./OrganizedMessages";

const { getClasses } = vi.hoisted(() => ({ getClasses: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { messages: { getClasses: { useInfiniteQuery: getClasses } } },
}));
vi.mock("wouter", () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children: ReactNode }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("@/components/MessageThread", () => ({ default: () => null }));

function render(viewerRole?: "student" | "coach") {
  return renderToStaticMarkup(createElement(OrganizedMessages, viewerRole ? { viewerRole } : {}));
}

beforeEach(() => {
  getClasses.mockReset().mockReturnValue({
    data: { pages: [{ items: [], nextCursor: undefined }] },
    isLoading: false, isError: false, hasNextPage: false,
  });
});

describe("empty Messages state", () => {
  // Restores the link dropped in 3d07422.
  it.each([undefined, "student"] as const)("offers a student (%s) a way to find a coach", role => {
    const html = render(role);
    expect(html).toContain("Messages with your coach appear here once you book a lesson.");
    expect(html).toMatch(/<a href="\/coaches"[^>]*>Find a coach →<\/a>/);
  });

  it("tells a coach where messages come from, without a find-a-coach link", () => {
    const html = render("coach");
    expect(html).toContain("Messages appear here when students book lessons with you.");
    expect(html).not.toContain("/coaches");
    expect(html).not.toContain("Find a coach");
  });

  it("does not show the empty state while classes load or fail", () => {
    getClasses.mockReturnValue({ isLoading: true, isError: false, hasNextPage: false });
    expect(render("student")).not.toContain("Find a coach");
    getClasses.mockReturnValue({ isLoading: false, isError: true, hasNextPage: false, refetch: vi.fn() });
    expect(render("student")).not.toContain("Find a coach");
  });
});
