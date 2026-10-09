import { trpc } from "@/lib/trpc";

/**
 * Whether the given coaches can take student payments right now, for gating
 * paid buttons (tip, pay, request) on surfaces that don't already carry the
 * `acceptingPayments` flag. Returns a lookup that yields undefined while
 * unknown — never block on that: the server re-checks every paid action.
 */
export function useCoachesAcceptPayments(coachIds: Array<number | null | undefined>) {
  const ids = Array.from(
    new Set(coachIds.filter((id): id is number => typeof id === "number" && id > 0)),
  ).sort((a, b) => a - b).slice(0, 100);
  const { data } = trpc.coach.acceptingPayments.useQuery(
    { coachIds: ids },
    { enabled: ids.length > 0, staleTime: 60_000 },
  );
  return (coachId: number | null | undefined): boolean | undefined =>
    data && typeof coachId === "number" && coachId in data ? data[coachId] === true : undefined;
}

/** Single-coach convenience wrapper around useCoachesAcceptPayments. */
export function useCoachAcceptsPayments(coachId: number | null | undefined): boolean | undefined {
  return useCoachesAcceptPayments([coachId])(coachId);
}
