# Saved student matching preferences - validation evidence

Base: verified main `38e9560899e4442ca7157a19e7aa2bf0c2b076ac`.
Branch: `codex/student-matching-panel`. Independent of pending PRs 6, 8 and 9.

## Behavior and limits

The student dashboard shows matching preferences from the original saved assessment JSON. It deliberately does not present default-filled profile columns as answers. It reuses `student.getProfile` and `match.getMatchedCoaches`; opening, refresh, retry, focus refresh and navigation do not call profile/quiz/match mutations. Guest answers continue through the existing waitlist-to-profile email-verification migration.

The endpoint returns an array without an inventory/suitability status, so an empty response says "No recommendations available right now." No inventory, notification service, match outcome or success probability is invented. Up to three real returned coach profiles and supported reasons are displayed. Missing answers, loading, request errors and paused/offline reads have separate states. A completed recommendation read is associated with the profile response that triggered it; older results are hidden while profile freshness changes.

Schedule and budget **scores and weights are unchanged**. Schedule explanations are suppressed for every timezone combination because local recurring buckets without dates cannot establish cross-zone/DST overlap or booking availability. This includes matching zones, missing/invalid zones, distant zones and regions with different DST transition dates. No reference date or guessed offset is introduced. Budget-fit explanations are also suppressed: the questionnaire asks about lessons while the existing scorer compares hourly prices. The panel labels a raw saved budget range as an unverified questionnaire answer without adding a unit conversion. Defaulted answers cannot justify personal recommendation explanations.

## Checks on the corrected source

All commands below completed with explicitly recorded exit code 0.

| Check | Result |
| --- | --- |
| Focused matching, mapping and new regressions | 109 passed (45 + 33 + 31) |
| Full applicable Vitest suite | 846 passed, 2 opt-in connection tests skipped |
| Operations tests | 13 passed |
| TypeScript | Passed |
| Vite client build | Passed; existing large-bundle warning remains |
| esbuild server build | Passed |
| Chrome 154.0.8037.93 | Passed at 320/360/768/1440 x 900px |
| Whitespace check | Passed |

The browser regression is `scripts/student-matching-browser.cjs`. It uses the built app, synthetic saved profiles and synthetic coach fixtures scored by the real matching engine. External requests are blocked, fonts fall back locally, and every API request is asserted to be GET. Each width covers loading, empty/error/retry, repeated refreshes, missing/malformed/null answers, inherited-property label strings, independent profile refresh, obsolete-result suppression, paused profile/matching reads and recovery, navigation interruption/back/reload, Tab/Enter/Space, named regions/live status, long saved values, and panel text bounds. No percentage is rendered. The actual registered dashboard route is `/dashboard`; `/student` is not registered on this main revision.

Both new-profile and existing-profile guest migrations are exercised through the real auth router with mocked DB/auth boundaries. Repeated subsequent profile/matching calls preserve the migrated bytes and never call create/update/upsert helpers. Request failures and retries are also exercised at the existing endpoint boundary.

## Review corrections and regression evidence

Four review findings were addressed: label lookup accepts only own string properties; matching reads follow every successful settled profile read; paused/pending states cannot masquerade as empty data; and rating explanations require finite, in-range raw answers. Before these fixes, the targeted suite reproduced five failures (three inherited label names, positive infinity parsed from JSON `1e999`, and out-of-range rating). The same cases now pass. Scores were not changed by these corrections.

Re-review identified a first-request race: with no cached match data, `cancelRefetch: true` can reuse profile A's pending request when B arrives. The effect now explicitly awaits cancellation of the obsolete matching query before starting B's read, and retains its generation cleanup guard. The focused browser regression freezes A's computed response before B arrives, requires an independent B request while A is held, completes B, then releases A and confirms B remains displayed. It failed before this correction (B never started its own read) and passes at all four widths afterward. All browser fixture responses now serialize before any delay so later fixture changes cannot conceal this race. Reads and cancellation perform no preference writes.

Local evidence under the task workspace: `review-regressions-before.log`, `browser-first-request-before.log`, `focused-race-fix.log`, `full-tests-race-fix.log`, `typecheck-race-fix.log`, `client-build-race-fix.log`, `server-build-race-fix.log`, `ops-tests-race-fix.log`, `browser-first-request-after.log`, and `browser-evidence/results.json`. Recommendation screenshots at 320px and 1440px were visually inspected; the cancellation change does not alter layout. Element screenshots may include the existing sticky header overlapping the capture; no DOM hiding was used.

## Existing narrow-dashboard limitation

A clean, detached worktree at the exact base SHA was built separately. The same synthetic user/profile and empty inventory were rendered in the same Chrome with the same blocked external resources. Baseline and current document widths are both **334px at 320px**, and **360px at 360px**. In both, the sole element extending past the 320px viewport is the existing header's **+ Book a Lesson** button, at x=267.40625 through x=334.28125. The matching panel itself stays at x=24 through x=296 and its text stays within its bounds. This is a pre-existing dashboard header limitation, not introduced or hidden by this feature.

Comparison evidence: `dashboard-width-comparison.log` and `browser-evidence/dashboard-baseline/results.json`, plus baseline/current viewport screenshots. The baseline worktree remained clean; current product source and build were not overwritten.

## Execution boundary

Ordinary sandbox execution initially blocked esbuild's ancestor-directory lookup at `C:/Users/chess`; the browser loader separately encountered `uv_os_get_passwd`. Normal reviewed execution admitted the same bounded validation commands. Validation scrubs inherited application settings, uses synthetic test configuration, blocks external Node connections, and disables Manus tooling. No approval-policy rejection was bypassed, filesystem permissions changed, credentials accessed, live customer data used, or Manus action called.

Not tested: physical devices, other browser engines, screen-reader software, real accounts/services, production assets, deployment or production acceptance. No merge or release is authorized by this evidence.
