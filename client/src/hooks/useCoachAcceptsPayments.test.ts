import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachAcceptsPayments, useCoachesAcceptPayments } from "./useCoachAcceptsPayments";

const { acceptingPayments } = vi.hoisted(() => ({ acceptingPayments: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { coach: { acceptingPayments: { useQuery: acceptingPayments } } },
}));

/** Run the hook inside a real render and report what it returned. */
function lookup(coachIds: Array<number | null | undefined>, probe: Array<number | null | undefined>) {
  let result: Array<boolean | undefined> = [];
  function Probe() {
    const accepts = useCoachesAcceptPayments(coachIds);
    result = probe.map((id) => accepts(id));
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  acceptingPayments.mockReturnValue({ data: { 42: false, 43: true } });
});

describe("useCoachesAcceptPayments", () => {
  it("reports each coach's flag, and unknown for ids the server didn't answer", () => {
    expect(lookup([42, 43], [42, 43, 44, null, undefined])).toEqual([false, true, undefined, undefined, undefined]);
  });

  it("is unknown (never false) while the lookup is loading or failed", () => {
    acceptingPayments.mockReturnValue({ data: undefined });
    expect(lookup([42, 43], [42, 43])).toEqual([undefined, undefined]);
  });

  it("asks for each valid coach once, in a stable order, and capped at the server's limit", () => {
    lookup([43, 42, 43, null, undefined, 0, -1], []);
    expect(acceptingPayments).toHaveBeenCalledWith({ coachIds: [42, 43] }, expect.objectContaining({ enabled: true }));

    acceptingPayments.mockClear();
    lookup(Array.from({ length: 150 }, (_, i) => i + 1), []);
    expect(acceptingPayments.mock.calls[0][0].coachIds).toHaveLength(100);
  });

  it("skips the query when there are no coaches to ask about", () => {
    lookup([null, undefined], [null]);
    expect(acceptingPayments).toHaveBeenCalledWith({ coachIds: [] }, expect.objectContaining({ enabled: false }));
  });
});

describe("useCoachAcceptsPayments", () => {
  it("answers for a single coach", () => {
    let pending: boolean | undefined;
    let payable: boolean | undefined;
    function Probe() {
      pending = useCoachAcceptsPayments(42);
      payable = useCoachAcceptsPayments(43);
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    expect(pending).toBe(false);
    expect(payable).toBe(true);
  });
});
