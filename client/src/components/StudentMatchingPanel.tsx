import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { savedMatchingPreferences } from "@shared/savedMatchingPreferences";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { MatchResult } from "@shared/coachMatching";

export default function StudentMatchingPanel() {
  const utils = trpc.useUtils();
  const profile = trpc.student.getProfile.useQuery(undefined, { retry: false });
  const matches = trpc.match.getMatchedCoaches.useQuery(undefined, {
    // Fetch after each successful profile read, including cache invalidation
    // elsewhere in the dashboard. An automatic fetch could race that read.
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
    trpc: { abortOnUnmount: true },
  });
  const [snapshot, setSnapshot] = useState<{
    profileVersion: number;
    data: MatchResult[];
    error: boolean;
  } | null>(null);
  const refetchMatches = matches.refetch;
  useEffect(() => {
    if (!profile.isSuccess || !profile.data || profile.isFetching || profile.isPaused) return;
    let current = true;
    const profileVersion = profile.dataUpdatedAt;
    setSnapshot(null);
    void (async () => {
      // cancelRefetch alone can reuse an in-flight first request when there is
      // no cached data. Cancel and await it before starting this profile's read.
      await utils.match.getMatchedCoaches.cancel();
      if (!current) return;
      const result = await refetchMatches();
      if (current) setSnapshot({ profileVersion, data: result.data ?? [], error: !result.isSuccess });
    })();
    // A newer profile response or navigation makes this result obsolete.
    return () => { current = false; };
  }, [profile.dataUpdatedAt, profile.data, profile.isSuccess, profile.isFetching, profile.isPaused, refetchMatches, utils]);

  const preferences = savedMatchingPreferences(profile.data?.assessmentData);
  const paused = profile.isPaused || matches.isPaused;
  const currentSnapshot = snapshot?.profileVersion === profile.dataUpdatedAt ? snapshot : null;
  const busy = profile.isPending || profile.isFetching || matches.isFetching || (profile.isSuccess && !!profile.data && !currentSnapshot);
  const requestError = profile.isError || currentSnapshot?.error;

  // Refresh reads the profile; the effect then reads recommendations for it.
  // There are no quiz/profile/match mutations on this surface.
  async function refresh() {
    if (busy || paused) return;
    await profile.refetch();
  }

  return (
    <section id="coach-matching" aria-labelledby="coach-matching-heading" className="min-w-0">
      <Card className="bg-ink-raised border-border/20 rounded-sm min-w-0">
        <CardContent className="p-4 sm:p-6 space-y-5 min-w-0 break-words">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="coach-matching-heading" className="text-lg font-semibold text-bone">Your coach matching</h2>
              <p className="text-sm text-bone-muted">Your saved questionnaire preferences and current recommendations.</p>
            </div>
            <Button type="button" variant="outline" disabled={busy || paused} onClick={refresh}>
              {requestError ? "Retry matching" : "Refresh matching"}
            </Button>
          </div>

          <div role="status" aria-live="polite" aria-atomic="true">
            {paused ? <p>Waiting for a connection to check your saved preferences and recommendations.</p>
              : busy ? <p>Checking your saved preferences and recommendations…</p>
              : profile.isError ? <p>We couldn’t load your saved preferences. Please retry.</p>
              : profile.isSuccess && !profile.data ? <p>No saved questionnaire answers to display.</p>
              : currentSnapshot?.error ? <p>We couldn’t load recommendations. Your saved preferences are still shown below. Please retry.</p>
              : currentSnapshot && !currentSnapshot.data.length ? <p>No recommendations available right now. You can check again with Refresh matching.</p>
              : <p>Coaches to consider based on your saved profile. A recommendation does not confirm a lesson time or price.</p>}
          </div>

          {profile.isSuccess && (
            <details open>
              <summary className="cursor-pointer text-bone font-medium focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-4">Saved matching preferences</summary>
              <p className="text-sm text-bone-muted mt-3">These are the answers saved with your account. Missing answers are marked “Not saved”.</p>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {preferences.map(({ label, value }) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-sm text-bone-muted">{label}</dt>
                    <dd className="text-sm text-bone mt-1 [overflow-wrap:anywhere]">{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <p className="text-sm text-bone-muted">Preferred times are questionnaire answers, not confirmed availability. Timezone differences and daylight saving changes are not verified by these recommendations. Check lesson times and prices on the coach’s profile.</p>

          {!busy && !paused && profile.isSuccess && !!profile.data && currentSnapshot && !currentSnapshot.error && !!currentSnapshot.data.length && (
            <ul className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Recommended coaches">
              {currentSnapshot.data.slice(0, 3).map(match => (
                <li key={match.coachUserId} className="min-w-0 border border-border/30 rounded-sm p-4 space-y-3">
                  <h3 className="font-medium text-bone [overflow-wrap:anywhere]">{match.coachName}</h3>
                  <ul className="text-sm text-bone-muted space-y-2">
                    {match.reasons.map(reason => <li key={reason}>{reason}</li>)}
                  </ul>
                  <Link href={`/coach/${match.coachUserId}`} className="inline-block text-sm text-ember underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ember">View profile<span className="sr-only"> for {match.coachName}</span></Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
