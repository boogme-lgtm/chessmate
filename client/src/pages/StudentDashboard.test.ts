import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENTS_PENDING_COPY } from "@shared/coachPayments";
import { LessonDetailDialog, NewContentRequestDialog, StudentDashboardContent } from "./StudentDashboard";

const { myLessons, listForStudent, acceptingPayments } = vi.hoisted(() => ({
  myLessons: vi.fn(),
  listForStudent: vi.fn(),
  acceptingPayments: vi.fn(),
}));

vi.mock("@/lib/trpc", async () => {
  const { createTrpcStub } = await import("@/test/trpcStub");
  return {
    trpc: createTrpcStub({
      "lesson.myLessons": { useQuery: myLessons },
      "contentRequest.listForStudent": { useQuery: listForStudent },
      "coach.acceptingPayments": { useQuery: acceptingPayments },
    }),
  };
});
// Render open dialogs inline (Radix portals render nothing on the server).
vi.mock("@/components/ui/dialog", async () => {
  const { createElement: h } = await import("react");
  const pass = ({ children }: { children?: unknown }) => h("div", null, children as any);
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: unknown }) => (open ? h("div", null, children as any) : null),
    DialogContent: pass,
    DialogDescription: pass,
    DialogFooter: pass,
    DialogHeader: pass,
    DialogTitle: pass,
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 }, loading: false }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/dashboard", vi.fn()], Link: () => null }));
vi.mock("@/components/DashShell", () => ({ default: () => null }));
vi.mock("@/components/MessageThread", () => ({ default: () => null }));
vi.mock("@/components/OrganizedMessages", () => ({ default: () => null }));
vi.mock("@/components/ReviewDialog", () => ({ default: () => null }));

const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
const COACH = 42;

/** The <button> whose visible text contains `label`. */
function button(html: string, label: string): string {
  const match = html.match(new RegExp(`<button\\b[^>]*>(?:(?!</button>)[\\s\\S])*?${label}(?:(?!</button>)[\\s\\S])*?</button>`));
  expect(match, `button "${label}"`).toBeTruthy();
  return match![0];
}

/** React renders the boolean attribute as disabled="" (classes contain "disabled:"). */
const DISABLED_ATTR = /\sdisabled=""/;

function coachAccepts(accepts: boolean | undefined) {
  acceptingPayments.mockReturnValue({ data: accepts === undefined ? undefined : { [COACH]: accepts } });
}

beforeEach(() => {
  vi.clearAllMocks();
  myLessons.mockReturnValue({
    data: [{
      id: 7, coachId: COACH, coachName: "Coach", status: "pending_payment",
      scheduledAt: inDays(3), durationMinutes: 60, amountCents: 5000, currency: "USD",
    }],
    isLoading: false,
  });
  listForStudent.mockReturnValue({
    data: [
      { id: 1, coachId: COACH, coachName: "Coach", title: "Endgame drills", status: "quoted", amountCents: 3000 },
      { id: 2, coachId: COACH, coachName: "Coach", title: "Opening file", status: "pending_payment", amountCents: 2000 },
    ],
  });
});

describe("student dashboard paid actions", () => {
  it("are closed with clear copy while the coach finishes payment setup", () => {
    coachAccepts(false);
    const html = renderToStaticMarkup(createElement(StudentDashboardContent, { user: { id: 1 } }));
    expect(button(html, "Pay Now")).toMatch(DISABLED_ATTR);
    expect(button(html, "ACCEPT &amp; PAY")).toMatch(DISABLED_ATTR);
    expect(button(html, "COMPLETE PAYMENT")).toMatch(DISABLED_ATTR);
    expect(html).toContain(PAYMENTS_PENDING_COPY.payment);
    // One batched lookup for the coaches on screen.
    expect(acceptingPayments).toHaveBeenCalledWith({ coachIds: [COACH] }, expect.anything());
  });

  it.each([
    ["confirmed", true],
    ["still loading", undefined],
  ])("stay open when the coach's payout setup is %s", (_label, accepts) => {
    coachAccepts(accepts);
    const html = renderToStaticMarkup(createElement(StudentDashboardContent, { user: { id: 1 } }));
    expect(button(html, "Pay Now")).not.toMatch(DISABLED_ATTR);
    expect(button(html, "ACCEPT &amp; PAY")).not.toMatch(DISABLED_ATTR);
    expect(button(html, "COMPLETE PAYMENT")).not.toMatch(DISABLED_ATTR);
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.payment);
  });
});

describe("lesson detail tips", () => {
  const completed = {
    id: 7, coachId: COACH, coachName: "Coach", status: "completed",
    scheduledAt: inDays(-3), durationMinutes: 60, amountCents: 5000,
  };
  const render = () =>
    renderToStaticMarkup(createElement(LessonDetailDialog, { open: true, onOpenChange: () => {}, lesson: completed }));

  it("are closed while the coach finishes payment setup", () => {
    coachAccepts(false);
    const html = render();
    expect(html).toContain(PAYMENTS_PENDING_COPY.tip);
    expect(html).not.toContain("Leave a Tip");
  });

  it("are open for a coach students can pay", () => {
    coachAccepts(true);
    const html = render();
    expect(html).toContain("Leave a Tip");
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.tip);
  });
});

describe("new content request", () => {
  const render = () =>
    renderToStaticMarkup(createElement(NewContentRequestDialog, {
      open: true, onOpenChange: () => {}, coaches: [{ id: COACH, name: "Coach" }],
    }));

  it("is closed with clear copy while the coach finishes payment setup", () => {
    coachAccepts(false);
    const html = render();
    expect(html).toContain(PAYMENTS_PENDING_COPY.contentRequest);
    expect(button(html, "Send Request")).toMatch(DISABLED_ATTR);
  });

  it("is open for a coach students can pay", () => {
    coachAccepts(true);
    expect(render()).not.toContain(PAYMENTS_PENDING_COPY.contentRequest);
  });
});
