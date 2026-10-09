/**
 * What the coach profile's storefront buttons actually do when clicked: a free
 * item goes straight into the student's library (no checkout, whatever the
 * coach's payout state); a paid item starts Stripe checkout.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import CoachDetail from "./CoachDetail";

const { auth, coachState, buttons, claimFree, createStorefrontCheckout, listOwnedInvalidate, setLocation } = vi.hoisted(() => ({
  auth: { user: { id: 1 } as { id: number } | null },
  coachState: { acceptingPayments: false },
  buttons: [] as Array<{ children?: unknown; disabled?: boolean; onClick?: () => unknown }>,
  claimFree: vi.fn(),
  createStorefrontCheckout: vi.fn(),
  listOwnedInvalidate: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => () => ({ data, isLoading: false, refetch: () => {} });
  const mutation = () => ({ mutate: () => {}, isPending: false });
  return {
    trpc: {
      useUtils: () => ({
        client: { content: { claimFree: { mutate: claimFree }, createStorefrontCheckout: { mutate: createStorefrontCheckout } } },
        coach: { getById: { invalidate: vi.fn() } },
        content: { list: { invalidate: vi.fn() }, listOwned: { invalidate: listOwnedInvalidate } },
      }),
      coach: {
        getById: {
          useQuery: () => ({
            data: { id: 42, name: "Coach", profile: { hourlyRateCents: 6000 }, acceptingPayments: coachState.acceptingPayments },
            isLoading: false,
          }),
        },
        getReviews: { useQuery: query([]) },
        getAvailability: { useQuery: query(undefined) },
      },
      content: {
        list: {
          useQuery: query([
            { id: 1, coachId: 42, title: "Paid course", kind: "course", priceCents: 2900 },
            { id: 2, coachId: 42, title: "Free sampler", kind: "pdf", priceCents: 0 },
          ]),
        },
      },
      lichess: { getProfile: { useQuery: query(undefined) } },
      coachSubscription: {
        getSettings: { useQuery: query(undefined) },
        isSubscribed: { useQuery: query(false) },
        subscribe: { useMutation: mutation },
        cancel: { useMutation: mutation },
      },
    },
  };
});
// Capture each button's props so a test can run its click handler.
vi.mock("@/components/ui/button", async () => {
  const { createElement: h } = await import("react");
  return {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => unknown }) => {
      buttons.push(props);
      return h("button", { disabled: props.disabled }, props.children as any);
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/useDocumentTitle", () => ({ useDocumentTitle: () => {} }));
vi.mock("wouter", () => ({ useParams: () => ({ id: "42" }), useLocation: () => ["/coach/42", setLocation] }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BookingModal", () => ({ default: () => null }));

/** Render the profile and click the store button labelled `label`. */
async function clickStoreButton(label: string) {
  buttons.length = 0;
  renderToStaticMarkup(createElement(CoachDetail));
  const target = buttons.find((b) => b.children === label);
  expect(target, `button "${label}"`).toBeTruthy();
  expect(target!.disabled).toBeFalsy();
  await target!.onClick?.();
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1 };
  coachState.acceptingPayments = false;
  vi.stubGlobal("window", { location: { href: "" } });
});

describe("storefront item buttons", () => {
  it("a free item is added to the library — no checkout, even while the coach can't take payments", async () => {
    claimFree.mockResolvedValue({ alreadyOwned: false });
    await clickStoreButton("Free");
    expect(claimFree).toHaveBeenCalledWith({ contentItemId: 2 });
    expect(createStorefrontCheckout).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Added to your library");
    expect(listOwnedInvalidate).toHaveBeenCalled();
    expect(setLocation).toHaveBeenCalledWith("/dashboard?section=content-library");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a free item the student already has just opens the library", async () => {
    claimFree.mockResolvedValue({ alreadyOwned: true });
    await clickStoreButton("Free");
    expect(toast.success).toHaveBeenCalledWith("Already in your library");
    expect(setLocation).toHaveBeenCalledWith("/dashboard?section=content-library");
  });

  it("a free item asks a signed-out visitor to sign in first", async () => {
    auth.user = null;
    await clickStoreButton("Free");
    expect(claimFree).not.toHaveBeenCalled();
    expect(setLocation).toHaveBeenCalledWith("/sign-in?redirect=/coach/42");
  });

  it("a paid item starts Stripe checkout once the coach can take payments", async () => {
    coachState.acceptingPayments = true;
    createStorefrontCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/item" });
    await clickStoreButton("$29.00");
    expect(createStorefrontCheckout).toHaveBeenCalledWith({ contentItemId: 1 });
    expect(claimFree).not.toHaveBeenCalled();
    expect(window.location.href).toBe("https://checkout.stripe.com/item");
  });
});
