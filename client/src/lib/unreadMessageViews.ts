import type { trpc } from "@/lib/trpc";

type Utils = ReturnType<typeof trpc.useUtils>;

/**
 * Reading a thread (the server marks it read when it is fetched) or sending a
 * message changes every unread view. Refresh them together — the per-class
 * counts, the dashboard badge's all-classes total and the class list — so the
 * badge and the Messages panel never disagree. Call it from anywhere messages
 * are read or sent.
 */
export function refreshUnreadMessageViews(utils: Utils): void {
  utils.messages.getUnreadCounts.invalidate();
  utils.messages.getUnreadTotal.invalidate();
  utils.messages.getClasses.invalidate();
}
