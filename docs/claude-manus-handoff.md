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

## 3m. Sprint 49 fix-3 — branded board, notation, engine toggle, MultiPV (BUILT, commit ea99991)

All four in `PgnViewerModal.tsx` only.
- **S49-8** navy/tan branded squares (#1A2C3D / #C8B89A); eval bar #151B22 bg + #E8633A
  fill; active move, eval label, Best: text all terracotta.
- **S49-9** 9px notation + per-square-type colors.
- **S49-10** Power toggle; startEngine/stopEngine refactor; three-state status.
- **S49-11** MultiPV 3; multipv-aware parsing (multipv 1 drives bar/arrow/Best); live
  top-3 variations table, reset per navigation.

### Two deviations to review
1. **Best-move ARROW stays cyan** — the spec listed which accents go terracotta and the
   arrow wasn't among them; cyan also reads better against both new square tones. Say
   the word if you want it branded too (1-line change to ARROW_COLOR).
2. **Omitted the base `color` from alpha/numericNotationStyle** (spec had
   rgba(255,255,255,0.55)). v5 renders those styles on INNER spans whose color would
   override the per-square color on the OUTER span — including it would have defeated
   the per-square colors entirely. Verified against react-chessboard dist source.

Verification: 376 tests, tsc 0, build clean. Manual smoke: branded board; small
non-overlapping notation; Power off→on restarts cleanly with depth climbing from 1;
three variation rows update live and reset on navigation.

## 3n. Sprint 49 fix-4 — engine stability + UX polish (BUILT, commit b6f3b98)

All five in `PgnViewerModal.tsx` only.
- **S49-12** `setoption MultiPV 3` → uciok handler (once per worker); hot path is the
  minimal `stop → position → go infinite`.
- **S49-13** full-PV variations: `Variation.pvUci: string[]` + `pvToSan()` → 5-move SAN
  lines per row. Refinement over spec: per-move try/break so a stale PV shows its legal
  prefix rather than collapsing the whole line to arrow notation.
- **S49-14** dialog `max-w-[92vw] w-full`; move list max-h 320/480px.
- **S49-15** eval bar center reference line + label floating at the fill boundary
  (clamped near bottom under 15% fill).
- **S49-16** flip board in its own labeled row with a perspective indicator; Power
  toggle right-aligned in the nav row.

Verification: 376 tests, tsc 0, build clean. Manual smoke: rapid arrow-key navigation —
depth climbs on EVERY move with no 3-step degradation; variation rows show 5-move SAN
lines; center line visible on the eval bar with the label tracking the fill; labeled
Flip board row with perspective text.

## 3o. Sprint 49 fix-5 — layout overhaul + engine hash (BUILT, commit 15a18b2)

All in `PgnViewerModal.tsx` only.
- **S49-17** fixed dialog: `max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden`;
  main area `flex-1 min-h-0 overflow-hidden` — content can never resize the dialog.
- **S49-18** eval bar parallel to the board.
- **S49-19** label removed from the bar; w-3 strip, terracotta fill, 2px midpoint notch
  (numeric eval remains in the tooltip + engine panel).
- **S49-20** right panel `w-[280px] shrink-0`, internal scroll (move list is the flex-1
  scroller); board gets the remaining width.
- **Engine**: `setoption name Hash value 16` added to the uciok init block.

### Two necessary deviations (please review)
1. **`self-start` on the left column** — the spec's layout tree alone does not fix
   S49-18: the left column is a flex-row child of the main area and stretches to the
   main-area height by default, so the bar's `self-stretch` would again exceed the
   board. `self-start` collapses the column to its content (the board), making the
   bar exactly board-height.
2. **Board width capped at `max-w-[calc(90vh-8rem)]`** — the square board sizes by
   width (height:auto grid). Uncapped, the spec's ~1067px board would vertically
   overflow the fixed 90vh dialog on common wide/short screens (e.g. 1440×900,
   ~700px available). The cap keeps the square fully visible; the bar+board pair is
   centered in any leftover width.

Verification: 376 tests, tsc 0, build clean. Manual smoke: dialog size stable across
all moves; bar flush left of the board at exactly board height with a visible notch;
board large and fully visible (no vertical clipping); right panel scrolls internally;
depth climbs past 9 with no stall.

## 3p. Sprint 49 fix-6 — bestmove-gated engine + deterministic board size (BUILT, commit 248140c)

The handoff's diagnosis (bestmove is the stop-ack; never send position/go before it)
is implemented — **hardened into a full state machine** with four additions beyond the
spec, each closing a real deadlock/corruption path:

1. **Terminal-position deadlock**: mate/stalemate under `go infinite` emits an
   UNSOLICITED `bestmove (none)` immediately. The handler marks the engine idle on any
   bestmove, and navigation from idle dispatches directly — without this, the next nav
   would send `stop` to an idle engine and wait forever for an ack that never comes.
2. **Stale-line gate**: while a stop is in flight, all info lines belong to the dying
   search and are ignored — no stale eval/arrow/variation flashes (and no sign-flipped
   scores from normalizing old-position lines against the new side-to-move).
3. **One stop per stop-cycle**: already-stopping navigations only replace the parked
   FEN (the spec re-sent `stop` on every nav; harmless but unprovable — this keeps the
   protocol trivially verifiable).
4. **Self-healing watchdog**: if the engine ever fails to ack a stop within 3s, the
   worker is fully restarted and the current position re-analyzes automatically. The
   viewer can no longer be permanently frozen, whatever the engine does.

Board size: explicit responsive column width `w-full
sm:w-[min(calc(90vh-8rem),calc(100%-296px))]` — the square fits BOTH height and width
budgets deterministically. **Deviation: `self-start` is KEPT** (the handoff said to
remove it) — explicit width is the main axis; the cross-axis stretch is what made the
eval bar exceed the board in S49-18, and removing self-start would regress it.
`sm:justify-center` centers the pair on ultrawide (scoped to sm+ for mobile safety).

Verification: 376 tests, tsc 0, build clean. THE definitive smoke: hammer the right
arrow 20× fast → depth must climb on the final position; navigate to a game-ending
mate position and back → engine keeps working; if you can ever freeze it, the 3s
watchdog must revive it on its own.

## 3q. Sprint 49 fix-7 — full PGN reader + board fills dialog (BUILT, commit 1c18315)

All in `PgnViewerModal.tsx`; engine machine untouched (input key only: `displayFen`).

**S49-24** full notation per the handoff architecture, with these fixes/upgrades:
1. **Branch-start rewind bug fixed**: the handoff's `nodes[len-2] : new Chess().fen()`
   fallback rewound nested variations on a branch's FIRST move to the *game* start —
   the branch start FEN is now threaded through `buildPgnTree`.
2. **Suffix annotations** ("Qd2?!", "d4!") tokenized and attached as NAGs — Lichess
   exports these as text; the handoff's tokenizer dropped them.
3. **Header stripping line-anchored** — the handoff's `/\[.*?\]/gs` would have mangled
   comments containing `[%clk]`-style tags; those command tags are also stripped from
   comment prose for display.
4. **moveNumber via `chess.moveNumber()`** (the handoff's primary snippet was broken;
   its own note recommended this form).
5. Pre-move comments (`commentBefore`), appended multi-comments, "N…" re-numbering
   after interruptions, result token at the end of the move list.
6. **Beyond the spec: sidelines are CLICKABLE** — board + engine jump to any variation
   move (Lichess-grade). `displayFen = selectedFen ?? fens[currentIndex]` is the single
   source for board/engine/PV/highlight; keyboard + mainline clicks clear the overlay.

**S49-23** left column `flex-1` + panel 300px per the handoff — **plus a kept
height-cap on the board wrapper** `min(calc(100%-18px), calc(90vh-8rem))`: the
flex-1-only fix re-introduces vertical clipping on wide/short screens (square board
sizes by width inside the fixed-height dialog). `self-start` kept (S49-18 guard).

Parser verified by direct execution against annotated fixtures (20/20 assertions):
nested variations, branch-start sub-variations, NAGs + suffixes, clk stripping,
pre-game comments, black-first numbering, FEN integrity vs chess.js, garbage safety.

Verification: 376 tests, tsc 0, build clean. Manual smoke: open an annotated study
PGN → indented sidelines, italic comments, NAG glyphs all render; click a sideline
move → board + engine follow; arrow keys return to the main line; board fills the
dialog with no clipping at any window size.

## 3r. Sprint 49 fix-8 — definitive sizing + NAGs + last-move highlight (BUILT, commit 140d733)

**S49-25 — the real root cause of the entire board-size saga, finally found:**
shadcn DialogContent's base classes include **`sm:max-w-lg` (512px)**. tailwind-merge
only collapses conflicts within the same variant group, so our base `max-w-[96vw]`
never beat the `sm:` variant — **the dialog itself has been capped at 512px on every
desktop screen**, which is why no inner-layout fix ever worked. Fixed with
`sm:max-w-[96vw]` (same group → the cap is now removed from the class list entirely).
Two more compounding bugs fixed: fix-6's `calc(90vh-8rem)` Tailwind class was INVALID
CSS (calc needs spaces around minus — the rule was silently dropped; now
`calc(90vh_-_130px)`), and percentage-based wrapper sizing.
Architecture per your handoff (concrete `--board-size` var consumed by both the board
wrapper and the eval bar) with **corrected arithmetic**: width budget 384px (your 340
overflows by 42px on tall/narrow screens — panel 300 + p-6 48 + gap 16 + bar 18 = 382),
height budget 130px (your 240 counted the right panel's rows as vertical chrome and
wasted ~110px of board). Mobile gets its own stacked-panel budget (96vw−70) and a
scrollable main area. **Right panel is now exactly board-height on desktop** — move
list/engine align flush with the board edges.

**S49-26** — full NAG map; unknown → "" (never raw $N). Two handoff-table corrections:
$20/$21 were swapped (White/Black crushing = +-/-+) and $141 is ∇, not △.

**S49-27** — v5 has **no `lastMove` option** (your snippet wouldn't compile);
implemented via `squareStyles` — the per-square style lands on an inner overlay div so
the terracotta rgba tint layers OVER the square color. from/to on PgnNode, aligned
`lastMoves[]`, `selectedLastMove` for sidelines, cleared on all navigation.

**Verified at every layer**: tsc 0 · 376 tests · build clean · parser fixtures 11/11
(from/to validated by chess.js replay; $11→=; $20→+-; $999 dropped; branch-start
rewind intact) · **compiled CSS inspected**: valid calc, desktop var sm-scoped, mobile
var unscoped, max-width:96vw inside the sm media block.

Manual smoke: on a laptop the dialog should now be dramatically wider (~96vw, not
512px) with a ~570-680px board; bar/board/panel top+bottom edges flush; highlight
follows every move incl. sideline clicks; `$11` renders `=`; board size never changes
during navigation.

## 3s. Sprint 49 fix-9 — white click-frame + branch picker (BUILT, commit fccd1aa)

**S49-28 — root cause corrected from the handoff.** The white frame is mouse-click
FOCUS: dnd-kit gives every piece `tabIndex=0` even with dragging disabled (verified in
the dist — attributes spread unconditionally; only `aria-disabled` changes), and the
app's global outline styles ring the focused piece. **`onSquareClick: () => {}` is a
pure optional callback in v5 (`onSquareClick?.()`) — it suppresses nothing.** Real fix:
the board wrapper prevents `mousedown` default (left button only) so focus is never
acquired by mouse — no ring, right-drag arrows and keyboard-Tab a11y untouched,
mechanism-agnostic.

**S49-29** — branch picker per the handoff (its tree-indexing insight is correct and
now fixture-verified). Plus the design detail its code snippet missed: **→ again while
the picker is open accepts the main line** (as the Design section specified). Escape =
dismiss + main line; ←/↑/↓, move-list clicks, sideline clicks, and new parses all
dismiss; empty variation arrays filtered.

Verified: tsc 0 · 376 tests · build clean · bifurcation-indexing fixture 4/4 · ten
interaction flows traced (double-→, dual Escape paths, outside-click, trigger
re-click) — each resolves to one correct transition.

Manual smoke: click any square/piece → NO white ring ever; → at a move with a
variation → picker with starred main line; click a sideline → board + engine jump with
highlight; → → at a bifurcation = straight through the main line; Escape = main line.

## 3t. Sprint 50 — analysis mode + send-to-coach (BUILT, latest commit)

All ten items shipped. **Eight corrections to the handoff spec, each verified:**
1. `server/analysisRouter.ts` (authRouter convention) — a `server/routers/` DIRECTORY
   would shadow `./routers` module resolution.
2. The codebase has **no `db.query.*` API** (drizzle initialized without schema) —
   builder-based helpers added to `server/db.ts` instead.
3. **Security**: coachId derived from the LESSON server-side + membership check —
   client coachId never trusted; Send gated on `lessonId` only.
4. `notifyOwner()` notifies the PLATFORM owner, not the coach — replaced with a
   best-effort coach email; the chat unread badge is the in-app signal. The note goes
   in as its own text message before the pgn message.
5. v5 board API is `allowDragging` + `onPieceDrop({sourceSquare,targetSquare})` — the
   handoff's `arePiecesDraggable`/(src,tgt,piece) is v4 and would not compile.
6. Nodes store NAG **glyphs**, not `$N` — the toolbar toggles glyphs, and the
   serializer re-emits suffix glyphs inline (`Nf3!?`) and symbol glyphs as canonical
   `$N` via a reverse map; the handoff's `nags.join("")` would not round-trip symbols.
   Serializer also fixes the handoff's numbering (interruption-aware `4... d5` —
   theirs produced invalid PGN after variations) and sanitizes `}` in comments.
7. Tree mutations are **in place + root identity bump** — the handoff's
   `structuredClone` would orphan SidelineContext references and break arrow nav.
   Drop semantics are GUI-standard: matching-next steps forward, matching variation
   enters it, otherwise insert/extend (mainline extension keeps fens/lastMoves
   aligned).
8. The global keyboard handler now ignores inputs/textareas (it would have hijacked
   the comment editor), and the S49-28 focus suppressor is skipped while analysing
   (preventDefault would interfere with drag initiation). Annotation UI is a single
   panel bound to the current move (calmer than inline-in-list editing).

### ACTION REQUIRED (Manus)
- Apply migration **drizzle/0021_striped_mandroid.sql** (`pnpm db:push`) — the
  `pgn_analyses` table must exist before Save works live.

Verified: tsc 0 · **388 tests** (+12 behavioral router tests) · build clean · audit
unchanged · serializer round-trip fixtures all pass (annotated nested tree
parse→serialize→parse structurally identical; analysis-appended moves + annotations
survive).

Manual smoke: open a lesson PGN → Analyse → drag a move → it appears as a variation
and the engine follows; replay the existing next move → no duplicate variation; add
!/± and a comment → they render; Save → reopen via analysisId → annotations load;
Send to Coach → note + PGN appear in the lesson chat, coach gets an email.

## 3u. Sprint S-REV-1 — reviews submission failure (CODE DONE — needs a live-DB ALTER)

Both review dialogs (coach reviewing student, student reviewing coach) failed at the
INSERT. **Root cause: the drizzle `reviews` schema didn't match the live table.** The
old schema declared `reviewerId`/`revieweeId`; the live table had been ALTERed to carry
`studentId`/`coachId`/`reviewerType` as `NOT NULL`. So every Drizzle INSERT both
referenced columns the live table no longer cared about AND omitted the live `NOT NULL`
columns → rejected.

### Code fix (BUILT, commit `0f4bf74`, merged into `9a47b10` — already on this branch)

- **`drizzle/schema.ts`** — `reviews` table rewritten to match the live shape:
  `studentId`/`coachId` (both `NOT NULL`) + `reviewerType` enum `['student','coach']`
  (says which side WROTE the review). `reviewerId`/`revieweeId` removed.
- **`server/db.ts`**
  - `createReview` stats hook now keys on `review.coachId`; `getReviewsByCoach` and
    `updateCoachStats` filter on `reviews.coachId`.
  - `getReviewByLessonAndReviewer(lessonId, userId)` rewritten with a **role-paired**
    predicate (added `or` to the drizzle import):
    ```ts
    .where(and(eq(reviews.lessonId, lessonId),
      or(
        and(eq(reviews.studentId, userId), eq(reviews.reviewerType, "student")),
        and(eq(reviews.coachId,  userId), eq(reviews.reviewerType, "coach"))
      )))
    ```
    **Correction to the S-REV-1 handoff spec**: the suggested
    `WHERE lessonId=? AND (studentId=? OR coachId=?)` is buggy — both review rows of a
    lesson share the same `studentId`/`coachId` pair, so it would match the OTHER
    party's row and corrupt the duplicate check (and the "both submitted → flip
    visible" gate). The role pairing is required for correctness.
- **`server/routers.ts`** — both `createReview` call sites (the inline review in
  `confirmCompletion` and `review.submit`) now pass
  `studentId: lesson.studentId, coachId: lesson.coachId, reviewerType` (derived from
  WHO is calling vs. the lesson), and no longer pass `reviewerId`/`revieweeId`.
- **`server/sprint-rev1.test.ts`** (new, 5 behavioral tests via `createCaller`):
  student-submit payload shape, coach-submit shape, duplicate rejection through the
  caller-scoped lookup, both-submitted visibility flip, third-party rejection.

Verification: **400 tests pass**, `tsc --noEmit` 0, `pnpm build` clean.

### ⛔ ACTION REQUIRED (Manus) — this is the remaining blocker, not code

After deploying the code fix, the live failure **persisted**, and the new error
screenshots prove why: they now list the corrected columns (`studentId`, `coachId`,
`reviewerType`; no `reviewerId`/`revieweeId`), so the code is deployed and correct. The
remaining rejection is **purely a live-DB constraint** — the old `reviewerId` /
`revieweeId` columns are still physically present on the live `reviews` table as
`NOT NULL` with no default, so MySQL rejects every INSERT that (correctly) omits them.

I **cannot** reach the DB to fix this. You must run ONE of these against the live DB:

```sql
-- Preferred: drop the dead columns the code no longer writes.
ALTER TABLE reviews DROP COLUMN reviewerId, DROP COLUMN revieweeId;
```
```sql
-- Or, if anything still reads them, make them tolerate the omission instead:
ALTER TABLE reviews
  MODIFY COLUMN reviewerId INT NULL DEFAULT 0,
  MODIFY COLUMN revieweeId INT NULL DEFAULT 0;
```

I did **not** generate a drizzle migration for this: `drizzle-kit generate` requires an
interactive TTY (unavailable here) to disambiguate rename-vs-drop, and a wrong
auto-answer could emit a catastrophic `RENAME COLUMN reviewerId TO studentId` that
would clobber live data. The ALTER above is safe and explicit — run it directly. Once
it's applied, both review dialogs will succeed with no further code change.

---

## 3v. Sprint S-UI-1 — lesson detail + tipping + cancelled toggle (BUILT, commit `7123393`)

Three features per the handoff.

### 1. Lesson Detail Dialog (student + coach)
- **`server/routers.ts`** — `review.getForLesson`: protected query, takes `{lessonId}`,
  returns `{myReview, counterpartReview}`. Counterpart only returned if `isVisible=true`.
  Reuses existing `getReviewByLessonAndReviewer` and `getCounterpartReview` helpers.
- **`client/src/pages/StudentDashboard.tsx`** — "View Details" button on past
  completed/released lessons opens `LessonDetailDialog` showing date, time, amount,
  status, both reviews (counterpart hidden until both submit), and tipping.
- **`client/src/pages/CoachDashboard.tsx`** — "Details" button on completed/released
  lessons in the All Lessons list opens `CoachLessonDetailDialog` (same layout, minus
  tipping). Imports `Dialog` components.

### 2. Student Tipping
- **`drizzle/schema.ts`** — `tips` table: id, lessonId, studentId, coachId, amountCents,
  currency, stripeCheckoutSessionId, stripeTransferId, status enum, timestamps.
- **`server/db.ts`** — `createTip`, `getTipByLessonAndStudent`, `getTipByCheckoutSession`,
  `updateTipStatus`, `setTipCheckoutSession`.
- **`server/stripe.ts`** — `createTipCheckoutSession`: single line item (tip amount),
  metadata `{type:"tip", lessonId, studentId, coachId}`. No platform fee, no
  `transfer_data` — tip is charged on the platform and transferred post-checkout.
- **`server/routers.ts`** — `tip.createCheckout` (student-only, completed lessons, one
  tip per lesson, $1–$500, validates coach has Connect account) and `tip.getForLesson`.
- **`server/webhooks.ts`** — `handleTipCheckoutCompleted`: on `checkout.session.completed`
  with `metadata.type === "tip"`, marks tip paid, calls `transferToCoach` (100% to coach
  via `stripeConnect.ts`), marks transferred. Idempotent (skips non-pending tips).
- **Student UI** — detail dialog has preset ($5/$10/$20) + custom amount, shows tip
  status after payment.

### 3. Cancelled Lesson Toggle
- **StudentDashboard** — Past tab sorts completed/released before cancelled/declined/
  refunded. "Show cancelled (N)" toggle (collapsed by default). Count badge in tab stays
  unchanged (shows all).
- **CoachDashboard** — All Lessons filtered by `showCancelled` toggle; sort unchanged
  (`STATUS_PRIORITY` already sinks cancelled). Toggle at the bottom of the list.

### ACTION REQUIRED (Manus)
- Create the `tips` table on the live DB. Migration couldn't be generated (no DB URL in
  this env). Schema:
  ```sql
  CREATE TABLE tips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lessonId INT NOT NULL,
    studentId INT NOT NULL,
    coachId INT NOT NULL,
    amountCents INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    stripeCheckoutSessionId VARCHAR(128),
    stripeTransferId VARCHAR(64),
    status ENUM('pending','paid','transferred','failed') DEFAULT 'pending',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paidAt TIMESTAMP NULL,
    transferredAt TIMESTAMP NULL
  );
  ```
  Add a unique index: `CREATE UNIQUE INDEX idx_tips_lesson_student ON tips(lessonId, studentId);`

### Verification
- **411 tests** (29 files, +11 new) · tsc 0 · build clean · audit unchanged.

---

## 4. Remaining open items

- **⛔ reviews live-DB ALTER (S-REV-1)** — drop or nullable-default the dead
  `reviewerId`/`revieweeId` columns on the live `reviews` table (SQL in §3u). This is
  the ONLY thing still blocking review submission; the code is done and pushed.
- **Create `tips` table (S-UI-1)** — CREATE TABLE + unique index SQL in §3v above.
- **Apply migration `drizzle/0021_striped_mandroid.sql`** (`pgn_analyses` table,
  Sprint 50) and **`drizzle/0020_free_ezekiel_stane.sql`** (messages `mediumtext`,
  Sprint 47) if not yet applied to the live DB.
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
