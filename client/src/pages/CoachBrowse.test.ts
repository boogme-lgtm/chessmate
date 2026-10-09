import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoachBrowse from "./CoachBrowse";

const { listActive } = vi.hoisted(() => ({ listActive: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    coach: { listActive: { useQuery: listActive } },
    student: { getProfile: { useQuery: () => ({ data: undefined }) } },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useDocumentTitle", () => ({ useDocumentTitle: () => {} }));
vi.mock("wouter", () => ({ useLocation: () => ["/coaches", vi.fn()] }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

beforeEach(() => listActive.mockReturnValue({ data: [], isLoading: false }));

function renderedHeader() {
  const html = renderToStaticMarkup(createElement(CoachBrowse));
  // The page's navigation precedes the hero heading and browse controls.
  return html.slice(0, html.indexOf("Find Your Chess Coach"));
}

describe("coach browse navigation", () => {
  it("names Home independently of its responsive visible text", () => {
    const header = renderedHeader();
    const home = header.match(/<button\b[^>]*>[\s\S]*?<\/button>/)?.[0];
    expect(home).toContain('aria-label="Back to Home"');
    expect(home).toContain('type="button"');
    expect(home).toContain('aria-hidden="true"');
    expect(home).toContain('class="hidden sm:inline">Back to Home</span>');
  });

  it.each([
    { label: "empty results", coaches: [] },
    {
      label: "populated results",
      coaches: [{ users: { id: 1, name: "Test Coach" }, coach_profiles: {} }],
    },
  ])(
    "renders only the working Home control in the header with $label",
    ({ coaches }) => {
      listActive.mockReturnValue({ data: coaches, isLoading: false });
      const header = renderedHeader();
      expect(header.match(/<button\b/g)).toHaveLength(1);
      expect(header).toContain('alt="BooGMe"');
    }
  );
});

describe("coach browse payment-readiness badge", () => {
  function renderWith(coaches: unknown[]) {
    listActive.mockReturnValue({ data: coaches, isLoading: false });
    return renderToStaticMarkup(createElement(CoachBrowse));
  }

  it("lists a coach without confirmed payout setup, with a subtle badge", () => {
    const html = renderWith([
      { users: { id: 1, name: "Payable Coach" }, coach_profiles: {}, acceptingPayments: true },
      { users: { id: 2, name: "Pending Coach" }, coach_profiles: {}, acceptingPayments: false },
    ]);
    // Never hidden from browse.
    expect(html).toContain("Payable Coach");
    expect(html).toContain("Pending Coach");
    expect(html.match(/data-testid="payments-pending-badge"/g)).toHaveLength(1);
    expect(html).toContain("Booking opens soon");
  });

  it("shows no badge when the flag is true or absent", () => {
    const html = renderWith([
      { users: { id: 1, name: "Payable Coach" }, coach_profiles: {}, acceptingPayments: true },
      { users: { id: 3, name: "Legacy Row" }, coach_profiles: {} },
    ]);
    expect(html).not.toContain("payments-pending-badge");
  });
});
