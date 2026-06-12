# Claude → Manus Handoff: Sprint 42 (Admin Name Resolution)

Last updated: 2026-06-08
Author: Claude Code
Branch: `claude/code-audit-review-icD40` (HEAD `d47d89e`)

This is the first Claude→Manus handoff in the Codex+Manus review loop. It explains
exactly what I did so you can review it, integrate it into `main`, and continue the
back-and-forth. I followed the conventions in `docs/...` / the Codex handoff:
name exact files/functions, state behavior, require behavioral tests + verification.

---

## 0. Branch / sync state (read this first)

There are two active lines of work and we must not let them silently diverge:

- **`origin/main`** — your authoritative build (Sprint 27→41).
- **`claude/code-audit-review-icD40`** — my working branch. I cannot push to `main`
  directly, so my completed work lands here and needs to be merged into `main` by
  you / the maintainer.

What I did before any feature work:

1. `git merge origin/main` into my branch. The only conflicts were two add/add
   collisions on homepage-v2 scaffolding files that *both* sides had created:
   - `client/src/components/BgMark.tsx`
   - `client/src/components/hero/QuizResultMockup.tsx`
   Both were functionally identical; I kept **main's** (prettier-formatted) version
   for each. Merge commit: `de02843`.
2. My branch now contains all of Sprint 27→41 **plus** my Sprint 42 work, and is
   `0` commits behind `origin/main`.

**Proposed sync discipline going forward** (please confirm):
- You keep committing sprints to `main`.
- Before each new task I `git merge origin/main` into my branch so I'm current.
- My finished work (a single squashed/merged feature commit) gets pulled into `main`
  by the maintainer. I will always state the exact commit SHA to merge.

> Note: a stray 111 KB file literally named `design claude` is present in `main`'s
> tree (came in via your history, looks like an accidental commit). I left it
> untouched. Flagging in case you want to remove it.

---

## 1. Verification baseline (re-confirmed on merged branch)

I re-ran the full baseline after the merge, before writing any code. All three match
the Codex handoff numbers exactly:

| Check | Result |
|---|---|
| `corepack pnpm test` | **337 passing** (16 files) — pre-Sprint-42 |
| `corepack pnpm exec tsc --noEmit` | exit 0 |
| `corepack pnpm audit --prod` | 26 total / 2 high / 22 moderate / 2 low |

The 2 high advisories remain the documented transitive `lodash` / `lodash-es`
issues via `recharts` and `streamdown → mermaid`. No regressions introduced.

I also spot-reviewed the core money paths against the 10 invariants
(`payoutService.releaseLessonPayoutToCoach`, `claimLessonPayoutSlot`,
`finalizeLessonPayout`, `releaseLessonPayoutSlot`, `claimLessonCoachDecision`).
All CAS helpers are correctly conditional (`WHERE ... IS NULL` / sentinel guards),
Stripe is only called after a slot is claimed, idempotency keys are deterministic,
and terminal state is written only after Stripe success. No issues found.

---

## 2. Sprint 42 — what I built (Admin Name Resolution)

**Goal (from the Codex handoff "Open Items"):** the Admin Disputes Panel showed raw
numeric student/coach IDs. Resolve them to display names + emails via a batched
admin-only procedure.

**This is read-only. No money path, no state machine, no Stripe call was touched.**

Feature commit: **`d47d89e`** (merge this into `main`).

### Files changed

**`server/db.ts`**
- New: `getUsersByIds(ids: number[]): Promise<{id, name, email}[]>`
  - De-dupes input, filters non-positive/non-integer ids, returns only existing rows.
  - Uses drizzle `inArray` (added `inArray` to the existing `drizzle-orm` import).

**`server/routers.ts`**
- New sub-router `admin.users` with one procedure:
  - `admin.users.getByIds` — `protectedProcedure` + the same
    `if (ctx.user.role !== "admin") throw FORBIDDEN` `.use()` middleware the rest of
    the admin router uses.
  - Input: `{ ids: z.array(z.number().int().positive()).max(200) }`.
  - Short-circuits `[]` for an empty list (no DB hit); otherwise delegates to
    `db.getUsersByIds`.
  - Placed immediately after the `disputes` sub-router, before `waitlist`.

**`client/src/pages/AdminDisputesPanel.tsx`**
- Collects every `studentId` + `coachId` across **both** tabs (disputed +
  payout-ready) into a de-duped list via `useMemo`.
- Calls `trpc.admin.users.getByIds` (enabled only for admins with a non-empty id
  list) and builds a `Map<number, {name, email}>`.
- `LessonTableRow` now takes optional `student` / `coach` props and renders names +
  emails in the Parties cell, with raw IDs kept as secondary mono debug text.
- Graceful fallback to `Student #N` / `#N` when a name is unresolved.

**`server/sprint42.test.ts`** (new) — 4 behavioral tests via `appRouter.createCaller`:
- `S42-1` admin caller gets mapped rows; asserts `db.getUsersByIds` called with ids.
- `S42-2` non-admin caller → `FORBIDDEN`, and db is **not** called.
- `S42-3` empty id list short-circuits, db **not** called.
- `S42-4` missing ids are omitted (only existing rows returned).

### Verification after my change

| Check | Result |
|---|---|
| `corepack pnpm test` | **341 passing** (17 files; +4 new) |
| `corepack pnpm exec tsc --noEmit` | exit 0 |
| `corepack pnpm build` | clean |
| `corepack pnpm audit --prod` | unchanged (26 / 2 / 22 / 2) |

### Review asks for you (Manus)

1. Confirm the `admin.users.getByIds` placement and the 200-id cap are acceptable.
2. Confirm you're OK reusing this generic lookup elsewhere (e.g. admin applications),
   or whether you'd prefer it scoped under `admin.disputes`.
3. Any preference on showing email vs. name-only in the Parties cell for PII reasons?

---

## 3. Next agreed task — Bulk Payout Release (spec, not yet built)

From the Codex open items. I plan to implement this next unless you want it.

**Goal:** a "Release All Eligible" action on the Payout-Ready tab that iterates the
visible payout-ready lessons and calls the **existing** `admin.disputes.releasePayout`
mutation for each — **no new backend money path**.

**Constraints (must preserve invariants 1–10):**
- Reuse `releaseLessonPayoutToCoach` via the existing procedure only.
- Per-lesson sequential calls; surface a progress count and a partial-failure summary
  (e.g. "7 of 9 released, 2 failed: #id — reason").
- Only the payout-ready tab (status `completed`, window expired); never auto-release
  disputed lessons (those require a per-lesson admin override reason).
- Idempotent/safe under double-click; disable the button while running.
- No client-trusted amounts/eligibility — server still enforces everything.

**Proposed test (`server/sprint43.test.ts`):** behavioral test that a bulk helper
calls `releasePayout` once per eligible lesson, aggregates successes/conflicts, and
does not throw on individual `CONFLICT`/`PRECONDITION_FAILED` results.

Tell me if you'd rather build this and have me review, or vice versa.

---

## 3b. Sprint 43 — Bulk Payout Release (BUILT, commit `48d14ff`)

Built per §3. **No new money path** — it orchestrates the existing hardened
per-lesson service.

### Files changed
- **`server/payoutService.ts`** — new `releaseAllEligiblePayouts(): BulkPayoutResult`.
  Queries the server-owned eligible set (`db.getCompletedLessonsReadyForPayout`), then
  calls `releaseLessonPayoutToCoach({ lessonId })` per lesson, **sequentially**.
  Returns `{ total, releasedCount, failedCount, released[], failed[] }`. Never passes
  `adminOverrideReason` (disputed lessons can't be force-released and aren't in the
  set). A single failure is recorded in `failed[]` and does not abort the loop.
  Idempotent — already-released lessons return `alreadyReleased: true` and are counted
  as success, never re-transferred.
- **`server/routers.ts`** — `admin.disputes.releaseAllEligible` (admin-gated, no input)
  wraps the helper. Imported `releaseAllEligiblePayouts` from `./payoutService`.
- **`client/src/pages/AdminDisputesPanel.tsx`** — "Release All Eligible (N)" button on
  the Payout-Ready tab header → irreversible-action confirm dialog → summary toast
  (success count, or partial-failure breakdown via `formatAdminActionError`). Button
  disabled while in flight; only shown when the tab has rows.
- **`server/sprint43.test.ts`** — 7 behavioral tests against the real service path
  (db + stripeConnect mocked): S43-1 full success, S43-2 partial-failure isolation,
  S43-3 idempotent already-released, S43-4 empty set, S43-5 Stripe-failure slot
  release, S43-6 non-admin FORBIDDEN, S43-7 admin summary.

### Verification
- `corepack pnpm test`: **348 passing** (18 files; +7) ·
  `tsc --noEmit`: exit 0 · `pnpm build`: clean · audit unchanged.

### Review asks for you (Manus)
1. Confirm you're OK with bulk iteration living **server-side** (one request → N
   sequential transfers) vs. the originally-sketched client-side loop. I chose
   server-side for testability in the vitest harness and fewer round-trips; safety is
   identical because each lesson still goes through the full per-lesson service.
2. Confirm sequential (not concurrent) processing is acceptable for expected volumes.

## 3c. Sprint 44 — Booking UX + notifications (BUILT, commit `61e098e`)

8 fixes from the live E2E test. **No money path touched.** Two important
corrections to the handoff's assumptions are flagged below as review asks.

### What changed
- **S44-1** `client/src/components/BookingModal.tsx` — the post-booking toast that
  auto-closed in 2s is replaced by a **persistent payment step**: lesson summary +
  **Pay Now** (calls `payment.createCheckout` with the returned `lessonId` and
  redirects to Stripe) and **Pay Later** (dismisses; lesson stays Awaiting Payment).
  Correction: the booking mutation does **not** return a checkout URL — Pay Now calls
  `createCheckout` to get it.
- **S44-2** `server/db.ts` `getLessonsByStudent` now `LEFT JOIN users` → `coachName`;
  `client/src/pages/StudentDashboard.tsx` renders `lesson.coachName` on the card title
  and in the message thread (fallback `Coach #id`). Note: `admin.users.getByIds`
  (Sprint 42) is admin-only, so it could **not** be reused here — enriched the query
  instead.
- **S44-3** `client/src/pages/LessonPaymentSuccess.tsx` invalidates `lesson.myLessons`
  on mount; the dashboard query uses `refetchOnMount:"always"` + `refetchOnWindowFocus`
  + an 8s poll **only while a transient lesson exists** (review ask #1 fallback).
  Correction: Stripe redirects to `/lessons/:id?payment=success`, not
  `/dashboard?payment_success=1`.
- **S44-4 / S44-5** `client/src/components/MessageThread.tsx` — PGN "Browse file"
  upload via `FileReader`; flex scroll fix (`min-h-0` on the list, `shrink-0` sticky
  footer, capped textarea) so Send is always reachable.
- **S44-6** `server/emailService.ts` new `getStudentBookingReservedEmail`;
  `server/routers.ts` `lesson.book` sends it fire-and-forget at booking time.
- **server/sprint44.test.ts** — 5 behavioral tests (S44-6 student-only email +
  failure-safe; S44-7/S44-8 webhook coach + student emails).

### Review asks (please confirm) — divergences from the literal handoff
1. **S44-7 not done at booking time (deliberate).** The handoff asked to email the
   coach "after a lesson is created." But the payment-first model only notifies the
   coach after payment (the webhook already does this), and `confirmAsCoach` requires
   `status === 'payment_collected'` — a booking-time "accept" link would dead-end with
   PRECONDITION_FAILED. So I kept coach notification in the webhook and added a test.
   If you want a purely *informational* booking-time coach email (no accept action),
   say so and I'll add it.
2. **S44-8 was already implemented.** `checkout.session.completed` already sends the
   student a receipt via `getStudentBookingConfirmationEmail`, which already contains
   escrow language + the cancellation policy + a CTA. I left it intact and added a test
   rather than duplicating it. The live-test "no emails received" was almost certainly
   a Resend delivery/config issue (key/domain), not missing send calls — worth checking
   `RESEND_API_KEY` + verified sender domain in the test environment.

### Verification
- `pnpm test`: **353 passing** (19 files; +5) · `tsc --noEmit`: 0 · `build`: clean ·
  audit unchanged (26/2h/22m/2l).

## 3d. Sprint 44 patch — Email diagnostics (BUILT, commit to merge: see latest)

All P1–P5 implemented. No money path, no template changes.
- **P1/P2** `server/emailService.ts`: startup warning if `RESEND_API_KEY` unset; pre-send
  log line; plus sendEmail now short-circuits on an empty key (warn + `{success:false}`)
  instead of a silent 401. (Minor enhancement beyond the literal spec — flagged here.)
- **P3** `admin.system.testEmail` (`adminProcedure`) returns the raw `sendEmail` result.
  New **/admin/system** page with a "Send Test Email" button (defaults to the admin's
  own email, shows the raw result); "System" added to `AdminNav` everywhere.
- **P4** `lesson.book`: warn+skip when student has no email; log recipient before send.
- **P5** `server/webhooks.ts`: warn when student/coach can't be resolved for a paid lesson.
- **server/sprint44patch.test.ts**: empty-key warn+`{success:false}`; testEmail returns
  `{success:false}` (no throw) + admin-gated.

### Review asks (the live diagnostic you should run)
1. Go to **/admin/system**, enter your email, click **Send Test Email**, report the raw
   result. `{success:false, error:{statusCode:401}}` ⇒ `RESEND_API_KEY` missing/wrong in
   the deployed env. `{success:true, id:"..."}` ⇒ delivery works; the live-test miss was
   elsewhere.
2. If the test email succeeds but booking emails still don't arrive, check whether
   `student.email` is populated for Manus-OAuth users (P4's new warn log will say
   `Student <id> has no email address` in that case).

Verification: 356 tests, tsc 0, build clean, audit unchanged.

## 3e. Sprint 45 — webhook path + cancellation policy (BUILT, latest commit)

All 6 bugs addressed. **The critical S45-2 root cause was NOT raw-body parsing** (that
was already correct) — it was a **route path mismatch**.

- **S45-2 (critical)** `server/_core/index.ts`: the handler was only mounted at
  `/api/stripe/webhook`, but Stripe now posts to `/api/webhooks/stripe`, so events fell
  through to the SPA catch-all and never ran → lesson stuck `pending_payment`,
  `stripePaymentIntentId = null`. Fixed by registering the handler at **both** paths
  with `express.raw()` before `express.json()`. This also fixes **S45-3** (the
  "already processing" toast) and **S45-4** (missing emails) — both were symptoms.
- **S45-1** single **1-hour** refund cutoff (`>1h → 100%`, `≤1h → 0%`); 48h/24h/50%
  removed. UI copy updated (CancellationDialog, CountdownBanner, policy list).
- **S45-6** unpaid lessons (no payment intent) always cancel **free**. `lesson.cancel`
  already guards the Stripe refund on `amountCents>0 && stripePaymentIntentId`, so $0
  issues no Stripe call.
- Refactor: `shared/cancellationPolicy.ts` `computeCancellationRefund` is the single
  source of truth for both `db.claimLessonCancellation` and `db.cancelLesson`.
- **S45-5** removed the "Pay Later" button from `BookingModal` (payment-first → Pay Now
  only, with a subtle Cancel link).
- **server/sprint45.test.ts**: refund policy (paid >1h / <1h / exactly 1h / unpaid any
  time) + structural check that both webhook paths use `express.raw()` before
  `express.json()`.

### Review ask
- Confirm the deployed Stripe dashboard endpoint. I registered **both** path spellings
  so it works either way, but if the dashboard is configured for yet another path, tell
  me and I'll add it. After merging, re-run the live E2E: the paid checkout should now
  flip the lesson to `payment_collected` and fire both emails.

Verification: 362 tests, tsc 0, build clean, audit unchanged.

## 3f. Sprint 46 — coach dashboard data + post-payment copy (BUILT, latest commit)

All 6 fixed.
- **S46-1** `getLessonsByCoach` LEFT JOINs users → `studentName`; CoachDashboard uses it
  (booking-request card, lesson row, message thread) with a `Student #id` fallback.
- **S46-2** All Lessons sorted client-side by status priority (payment_collected →
  confirmed → completed → cancelled → declined → other), then soonest date.
- **S46-3** "Lessons" stat card excludes cancelled/declined.
- **S46-4** `getCoachPendingEarnings` sums payout across `payment_collected`, `confirmed`,
  `completed` (all escrowed) — "Pending" now shows real money owed.
- **S46-5** resolved by S46-4 (progress bar already uses `percentToThreshold`).
- **S46-6** payment-success copy corrected (student was already charged; escrow holds the
  coach payout). Note: that string lives in **LessonPaymentSuccess.tsx**, not BookingModal
  as the handoff stated.
- Refactor: `shared/coachEarnings.ts` (`COACH_PENDING_STATUSES` + `buildCoachEarningsSummary`)
  is the single source of truth.
- **server/sprint46.test.ts**: pending-status set, summary math (escrowed pending drives
  the threshold), + structural check of the studentName JOIN.

Verification: 368 tests, tsc 0, build clean, audit unchanged.

## 3g. Sprint 47 — PGN limit + stale landing copy (BUILT, latest commit)

- **S47-1** `messages.send` validator raised `4000 → 500_000` chars; migrated
  `messages.content` `text` (64KB) → `mediumtext` (16MB). Generated migration
  **`drizzle/0020_free_ezekiel_stane.sql`** (`ALTER TABLE messages MODIFY content
  mediumtext NOT NULL`). No frontend `maxLength` existed on the PGN textarea.
- **S47-2** `Home.tsx`: `48h · Refund window` → `1h · Cancellation window`; feature
  copy "Dispute it within 48 hours" → "Cancel more than 1 hour before your lesson for
  a full refund" (matches Sprint 45).
- **S47-3** deferred (authenticated landing redesign).
- **server/sprint47.test.ts**: 100k accepted, 500k accepted, 500,001 rejected pre-DB,
  empty rejected.

### ACTION REQUIRED (Manus)
- Run `pnpm db:push` (or `drizzle-kit migrate`) to **apply migration 0020** to the live
  DB. I generated the migration file but can't reach the DB to apply it here. Until
  it's applied, sends over 64KB will still fail at the DB layer even though the
  validator allows them.

Verification: 372 tests, tsc 0, build clean, audit unchanged.

## 3h. Sprint 48 — message copy button (BUILT, latest commit)

Pure frontend (`MessageThread.tsx`), no backend/DB.
- `copiedId` state + `handleCopy` (clipboard write, "Copied to clipboard" toast, icon →
  checkmark for 2s).
- **PGN bubbles**: "Copy PGN" always visible inline in the PGN header row (opacity-60 →
  100 on hover).
- **Text bubbles**: icon-only copy floats top-right, revealed on hover (`relative group`
  + `opacity-0 group-hover:opacity-100`); body padded `pr-5` so text doesn't run under it.
- Color inherits the bubble foreground; matches the dark aesthetic.
- **server/sprint48.test.ts**: smoke test that `messages.send` preserves `contentType`
  (the contract the copy UI branches on).

Verification: 374 tests, tsc 0, build clean.

## 3i. Sprint 49 — interactive PGN analysis board (BUILT, latest commit)

New `PgnViewerModal.tsx`: click a PGN message → full analysis board (chess.js parse,
react-chessboard v5, move list, nav + keyboard, flip, Stockfish eval bar + best-move
arrow, malformed-PGN safe). `MessageThread.tsx` PGN bubble is now clickable (Copy PGN
still works via stopPropagation).

### Important deviations from the handoff (all deliberate, lower-risk)
1. **Single-threaded Stockfish, NO COOP/COEP headers.** I used the
   `stockfish-18-lite-single` build (7MB, no `SharedArrayBuffer`) served from
   `client/public/stockfish/`. This means I did **not** add the COOP/COEP headers — which
   is exactly what protects the Manus OAuth popup the handoff warned about. OAuth is
   untouched. If you later want multi-threaded speed, that's a separate change that must
   scope COOP/COEP carefully.
2. **No `vite.config.ts` change.** The worker is a static public asset (`new
   Worker("/stockfish/stockfish-18-lite-single.js")`), not bundled, so `optimizeDeps`/
   `assetsInclude` are unnecessary.
3. **react-chessboard v5 API**: the handoff's snippets were v4 (`position`,
   `customArrows`, `areDraggable`). v5 uses a single `options` prop and Arrow objects
   `{startSquare,endSquare,color}` — implemented against the real v5 types.
4. **Eval sign correctness**: engine `score cp` is side-to-move POV; I normalize to
   white-POV (negate when black to move) and handle `score mate`.

deps added: `react-chessboard@5.10`, `stockfish@18.0.7`. The 7MB wasm is committed under
`client/public/stockfish/` and copies into `dist/public/` on build (verified).

**server/sprint49.test.ts**: getForLesson exposes contentType; 500k PGN round-trip.

Verification: 376 tests, tsc 0, build clean, audit unchanged. Worth a manual smoke test
after merge: open a PGN message, confirm the board + engine eval appear and OAuth login
still works.

## 3j. Sprint 49 patch — un-commit Stockfish binary (BUILT, latest commit)

Housekeeping only. `git rm --cached` the 7MB wasm + worker js, `.gitignore`
`client/public/stockfish/`, and added `scripts/copy-stockfish.mjs` run via a new
`postinstall` (copies from `node_modules/stockfish/bin/` on every install). No
component/test changes — `PgnViewerModal` still loads `/stockfish/stockfish-18-lite-single.js`.
Verified the script repopulates the files from an empty dir; 376 tests, tsc 0.

> Deploy note: the deploy pipeline must run `postinstall` (default for pnpm install)
> so the files land in `client/public/stockfish/` before `vite build` copies them to
> `dist/public/`.

## 3k. Sprint 49 fix — viewer board/colors/engine/best-move (BUILT, latest commit)

All four in `PgnViewerModal.tsx` only, per the handoff.
- **S49-2** `aspect-square` on the board wrapper (true 1:1 at any dialog width); eval bar
  `w-4` + `self-stretch`.
- **S49-3** Lichess classic square colors (`#b58863` / `#f0d9b5`).
- **S49-4** isready/readyok sync barrier: eval effect parks the FEN in `pendingFenRef`
  and sends `stop` + `isready`; the `readyok` handler dispatches `position`+`go`. One
  addition beyond the spec: while a position is pending, info/bestmove lines from the
  aborted search are **ignored**, so stale evals/arrows can't flash during navigation.
  Ref cleared on worker teardown; initial-open double-`isready` resolves to exactly one
  search.
- **S49-5** `uciToSan` helper (handles promotion) → status line shows "Best: Nf3", falls
  back to `e2→e4`.

Verification: 376 tests, tsc 0, build clean. Manual smoke after merge: navigate moves and
confirm the depth counter resets + climbs on every move, board is square, colors are the
Lichess scheme, and the Best: line updates.

## 3l. Sprint 49 fix-2 — board gaps + engine stall (BUILT, commit b648049)

Both in `PgnViewerModal.tsx` only.
- **S49-6** boardStyle override (v5 defaults but `height:'auto'`) so grid rows size to
  the squares' 1:1 aspect — board naturally square, no dark gaps. `aspect-square`
  removed from the wrapper.
- **S49-7** barrier removed (`pendingFenRef` deleted); eval effect sends
  `stop → position fen → go infinite` directly. `engineReady` flips on `readyok`.

### One necessary deviation (please review)
Under `go infinite` the engine emits `bestmove` **only after a stop** — i.e. it always
belongs to the previous, aborted position. Handling those lines (as the handoff spec
retained) would only ever show stale/illegal moves and the arrow would never update
mid-search. So `bestmove` lines are now **ignored**, and the live best move is parsed
from the **principal variation** in info lines (`… pv e2e4 …`), which streams
continuously — this is how real GUIs drive their arrows and is what actually delivers
the handoff's own expected-behavior table (arrow + "Best:" updating as depth climbs).
Regex `\bpv (\S+)` cannot match inside "multipv" (word boundary).

Verification: 376 tests, tsc 0, build clean. Manual smoke: no row gaps; depth climbs
1,2,3… continuously per position; rapid arrow-keys never stall at depth 0; arrow +
"Best:" update live during the search.

## 4. Remaining open items

- **Live Stripe end-to-end test** — needs a human with Stripe test cards; I can't run
  it. Steps are in the Codex handoff. This is the last gate before enabling
  `AUTO_RELEASE_PAYOUTS_ENABLED=true` in production.
- (Admin Name Resolution — Sprint 42 — and Bulk Payout Release — Sprint 43 — are both
  built and pushed; awaiting your integration into `main`.)

---

## 5. Collaboration protocol going forward

1. Whoever implements names exact files/functions and writes behavioral tests that
   exercise the production path (not source-string assertions).
2. Always run and report `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm audit --prod`.
3. State changed files, the exact commit SHA, and remaining risks.
4. Reviewer returns concrete findings or a precise prompt; implementer patches; repeat
   until no deploy blocker remains.
5. Keep money-path changes behind the 10 invariants in the Codex handoff §"Invariants".
