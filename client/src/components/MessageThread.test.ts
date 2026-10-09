import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageThread from "./MessageThread";

const { effects, utils, thread, sendOptions } = vi.hoisted(() => {
  const view = () => ({ invalidate: vi.fn() });
  return {
    effects: [] as Array<() => unknown>,
    utils: {
      messages: {
        getForLesson: view(), getSummaries: view(),
        getUnreadCounts: view(), getUnreadTotal: view(), getClasses: view(),
      },
    },
    thread: { current: {} as { data?: unknown[]; isLoading: boolean; isError: boolean } },
    sendOptions: { current: undefined as undefined | { onSuccess: () => void } },
  };
});

// Static rendering runs no effects: record MessageThread's and run them after
// the render, as the browser would.
vi.mock("react", async importOriginal => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => unknown) => { effects.push(effect); },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => utils,
    messages: {
      getForLesson: { useQuery: () => thread.current },
      send: {
        useMutation: (options: { onSuccess: () => void }) => {
          sendOptions.current = options;
          return { isPending: false, mutate: vi.fn() };
        },
      },
    },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/components/PgnViewerModal", () => ({ default: () => null }));

const message = { id: 9, senderId: 2, contentType: "text", content: "See you Monday", createdAt: "2026-10-01T10:00:00Z" };

function render(open: boolean) {
  effects.length = 0;
  renderToStaticMarkup(createElement(MessageThread, { open, onOpenChange: vi.fn(), lessonId: 7, otherPartyName: "Bob" }));
  for (const effect of effects) effect();
}

const unreadViews = () => [utils.messages.getUnreadCounts, utils.messages.getUnreadTotal, utils.messages.getClasses];

beforeEach(() => {
  for (const view of Object.values(utils.messages)) view.invalidate.mockClear();
  thread.current = { data: [message], isLoading: false, isError: false };
});

// Sprint 3: the dashboard badge reads getUnreadTotal; without these refreshes it
// kept the old total for up to 30s after a thread was read or answered.
describe("message thread keeps the unread views in step", () => {
  it("refreshes the badge total, per-class counts and class list once an open thread loads (loading marks it read)", () => {
    render(true);
    for (const view of unreadViews()) expect(view.invalidate).toHaveBeenCalledOnce();
  });

  it("leaves them alone while the thread is closed or still loading", () => {
    render(false);
    thread.current = { data: undefined, isLoading: true, isError: false };
    render(true);
    for (const view of unreadViews()) expect(view.invalidate).not.toHaveBeenCalled();
  });

  it("refreshes them, the thread and the summaries after a message is sent", () => {
    render(false);
    sendOptions.current!.onSuccess();
    for (const view of unreadViews()) expect(view.invalidate).toHaveBeenCalledOnce();
    expect(utils.messages.getForLesson.invalidate).toHaveBeenCalledWith({ lessonId: 7 });
    expect(utils.messages.getSummaries.invalidate).toHaveBeenCalledOnce();
  });
});
