import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachDashboardContent } from "./CoachDashboard";

const { getEarnings, coachLessons } = vi.hoisted(() => ({
  getEarnings: vi.fn(),
  coachLessons: vi.fn(),
}));

vi.mock("@/lib/trpc", async () => {
  const { createTrpcStub } = await import("@/test/trpcStub");
  return {
    trpc: createTrpcStub({
      "coach.getEarnings": { useQuery: getEarnings },
      "lesson.coachLessons": { useQuery: coachLessons },
    }),
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 42 }, loading: false }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/dashboard", vi.fn()] }));
vi.mock("@/components/DashShell", () => ({ default: () => null }));
vi.mock("@/components/MessageThread", () => ({ default: () => null }));
vi.mock("@/components/OrganizedMessages", () => ({ default: () => null }));
vi.mock("@/components/ReviewDialog", () => ({ default: () => null }));

const baseEarnings = {
  totalEarningsCents: 0, pendingEarningsCents: 0, combinedEarningsCents: 0, thresholdCents: 10000,
  hasReachedThreshold: false, percentToThreshold: 0, contentEarningsCents: 0,
};

function render(earnings: Record<string, unknown>) {
  getEarnings.mockReturnValue({ data: { ...baseEarnings, ...earnings } });
  return renderToStaticMarkup(createElement(CoachDashboardContent, { user: { id: 42 } }));
}

/** The payout-setup banner's markup, or null when it isn't shown. */
function banner(html: string): string | null {
  const start = html.indexOf('data-testid="payout-setup-banner"');
  return start === -1 ? null : html.slice(start, html.indexOf("</button>", start));
}

beforeEach(() => {
  vi.clearAllMocks();
  coachLessons.mockReturnValue({ data: [], isLoading: false, refetch: () => {} });
});

describe("coach dashboard payout-setup banner", () => {
  it("tells a live coach who can't be paid that students can't book yet, with a resume button", () => {
    const html = banner(render({
      acceptingPayments: false, stripeOnboarded: false, profileLive: true, payoutSetupStarted: true, needsOnboarding: true,
    }));
    expect(html).not.toBeNull();
    expect(html).toContain("Students can&#x27;t book or pay you yet");
    expect(html).toContain("Pick up where you left off");
    expect(html).toContain("Finish Stripe Setup");
  });

  it("offers to start Stripe setup when the live coach never began it", () => {
    const html = banner(render({
      acceptingPayments: false, stripeOnboarded: false, profileLive: true, payoutSetupStarted: false, needsOnboarding: true,
    }));
    expect(html).toContain("Set it up now");
    expect(html).toContain("Set Up Payments");
  });

  it("keeps the earnings-threshold copy before the coach goes live", () => {
    const html = banner(render({
      acceptingPayments: false, stripeOnboarded: false, profileLive: false, payoutSetupStarted: false,
      hasReachedThreshold: true, needsOnboarding: true,
    }));
    expect(html).toContain("Complete Your Payment Setup");
  });

  it("is not shown to a coach students can pay", () => {
    const html = render({
      acceptingPayments: true, stripeOnboarded: true, profileLive: true, payoutSetupStarted: true, needsOnboarding: false,
    });
    expect(banner(html)).toBeNull();
    expect(html).not.toContain("Set up payouts so students can book you");
  });

  it("is replaced by a soft nudge before going live and below the threshold", () => {
    const html = render({
      acceptingPayments: false, stripeOnboarded: false, profileLive: false, payoutSetupStarted: false, needsOnboarding: false,
    });
    expect(banner(html)).toBeNull();
    expect(html).toContain("Set up payouts so students can book you");
  });

  it("loads earnings outside the request batch, so a live Stripe check never holds back the dashboard", () => {
    render({ acceptingPayments: true, needsOnboarding: false });
    expect(getEarnings).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ trpc: { context: { skipBatch: true } } }),
    );
  });
});
