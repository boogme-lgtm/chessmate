import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENTS_PENDING_COPY } from "@shared/coachPayments";
import CoachDetail from "./CoachDetail";

const { getById, contentList, subSettings } = vi.hoisted(() => ({
  getById: vi.fn(),
  contentList: vi.fn(),
  subSettings: vi.fn(),
}));

vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => () => ({ data, isLoading: false, refetch: () => {} });
  const mutation = () => ({ mutate: () => {}, isPending: false });
  return {
    trpc: {
      useUtils: () => ({}),
      coach: {
        getById: { useQuery: getById },
        getReviews: { useQuery: query([]) },
        getAvailability: { useQuery: query(undefined) },
      },
      content: { list: { useQuery: contentList } },
      lichess: { getProfile: { useQuery: query(undefined) } },
      coachSubscription: {
        getSettings: { useQuery: subSettings },
        isSubscribed: { useQuery: query(false) },
        subscribe: { useMutation: mutation },
        cancel: { useMutation: mutation },
      },
    },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/hooks/useDocumentTitle", () => ({ useDocumentTitle: () => {} }));
vi.mock("wouter", () => ({ useParams: () => ({ id: "42" }), useLocation: () => ["/coach/42", vi.fn()] }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BookingModal", () => ({ default: () => null }));

function render({ acceptingPayments, monthlyPriceCents = 0 }: { acceptingPayments: boolean; monthlyPriceCents?: number }) {
  getById.mockReturnValue({
    data: { id: 42, name: "Coach", profile: { hourlyRateCents: 6000, isAvailable: true }, acceptingPayments },
    isLoading: false,
  });
  contentList.mockReturnValue({
    data: [
      { id: 1, coachId: 42, title: "Paid course", kind: "course", priceCents: 2900, acceptingPayments },
      { id: 2, coachId: 42, title: "Free sampler", kind: "pdf", priceCents: 0, acceptingPayments },
    ],
    isLoading: false,
  });
  subSettings.mockReturnValue({ data: { enabled: true, monthlyPriceCents } });
  return renderToStaticMarkup(createElement(CoachDetail));
}

/** The <button> whose visible text contains `label`. */
function button(html: string, label: string): string {
  const match = html.match(new RegExp(`<button\\b[^>]*>(?:(?!</button>)[\\s\\S])*?${label}(?:(?!</button>)[\\s\\S])*?</button>`));
  expect(match, `button "${label}"`).toBeTruthy();
  return match![0];
}

/** React renders the boolean attribute as disabled="" (classes contain "disabled:"). */
const DISABLED_ATTR = /\sdisabled=""/;

beforeEach(() => vi.clearAllMocks());

describe("coach profile paid actions", () => {
  it("are open for a coach whose payout setup is confirmed", () => {
    const html = render({ acceptingPayments: true, monthlyPriceCents: 500 });
    expect(button(html, "Book a Lesson")).not.toMatch(DISABLED_ATTR);
    expect(button(html, "\\$29\\.00")).not.toMatch(DISABLED_ATTR);
    expect(button(html, "Subscribe — \\$5/mo")).not.toMatch(DISABLED_ATTR);
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.booking);
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.purchase);
  });

  it("are disabled with clear copy while the coach finishes payment setup", () => {
    const html = render({ acceptingPayments: false, monthlyPriceCents: 500 });
    expect(button(html, "Booking opens soon")).toMatch(DISABLED_ATTR);
    expect(html).toContain(PAYMENTS_PENDING_COPY.booking);
    expect(button(html, "\\$29\\.00")).toMatch(DISABLED_ATTR);
    expect(html).toContain(PAYMENTS_PENDING_COPY.purchase);
    expect(button(html, "Subscribe — \\$5/mo")).toMatch(DISABLED_ATTR);
    expect(html).toContain(PAYMENTS_PENDING_COPY.subscription);
    // Free content stays available.
    expect(button(html, "Free")).not.toMatch(DISABLED_ATTR);
  });

  it("keeps free follows open while the coach finishes payment setup", () => {
    const html = render({ acceptingPayments: false, monthlyPriceCents: 0 });
    expect(button(html, "Follow \\(Free\\)")).not.toMatch(DISABLED_ATTR);
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.subscription);
  });
});
