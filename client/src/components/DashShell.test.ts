import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashShell from "./DashShell";

const { getUnreadTotal } = vi.hoisted(() => ({ getUnreadTotal: vi.fn() }));

// No lesson queries are mocked: the badge must not depend on a lesson page.
vi.mock("@/lib/trpc", () => ({
  trpc: { messages: { getUnreadTotal: { useQuery: getUnreadTotal } } },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "Ann Lee" }, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/dashboard", vi.fn()] }));
vi.mock("./NotificationBell", () => ({ default: () => null }));

function render(role: "student" | "coach") {
  return renderToStaticMarkup(createElement(DashShell, {
    role, activeSection: "overview", onSectionChange: vi.fn(), children: null,
  }));
}

function badgeFor(html: string, label: string) {
  const button = html.match(new RegExp(`<button[^>]*><span>${label}</span>([\\s\\S]*?)</button>`))?.[1] ?? "";
  return button.replace(/<[^>]+>/g, "");
}

beforeEach(() => getUnreadTotal.mockReset());

describe("dashboard unread badge", () => {
  it.each([["student", "Messages"], ["coach", "Inbox"]] as const)(
    "shows the server's all-classes total for the %s role",
    (role, label) => {
      // 130 unread spread over more than 100 classes: the old badge counted only
      // the 50 most recent lessons, so it disagreed with the Messages panel.
      getUnreadTotal.mockReturnValue({ data: 130 });
      expect(badgeFor(render(role), label)).toBe("130");
      expect(getUnreadTotal).toHaveBeenCalledWith({ role }, { enabled: true, refetchInterval: 30000 });
    },
  );

  it.each([{ data: 0 }, { data: undefined }])("hides the badge when nothing is unread (%j)", query => {
    getUnreadTotal.mockReturnValue(query);
    expect(badgeFor(render("student"), "Messages")).toBe("");
  });
});
