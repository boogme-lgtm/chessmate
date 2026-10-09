# Handoff to Astra: Claude cloud session, 2026-10-09

**Branch:** `claude/code-audit-review-icD40`. Based on main `8cdca86` (the PR #13 + #14 release candidate). Not merged, not deployed, no production/Stripe/Resend/database actions, **no schema or migration changes**.
**Validation on the branch tip:** `pnpm check` clean · `pnpm test` 1667 passed / 2 skipped (main baseline: 994 / 2) · `pnpm build` OK (existing >500 kB chunk warning only).
Companion detail: `docs/sprints-1-4-handoff-2026-10-09.md` (owner questions, follow-ups).

## 1. What the session did

1. **Audit of main since f5854a3** (your access-control, Connect-webhook, isolated-preview, OAuth-start work plus the Codex PRs #8–#14). Your work held up well: no CRITICAL/HIGH issues, all new tRPC procedures have ownership checks, the preview guards fail closed, the Connect secret routing is sound, and the earlier money fixes are intact. The audit drove the sprints below.
2. **Four sprints**, each built in an isolated worktree. Each one got a four-lens review (correctness, security/money, end-to-end UX, test adequacy with mutation checks); every finding was verified by an independent refuter and reproducer, and confirmed findings were fixed with regression tests. The optional second review round was cut to stay within the credit budget.
3. **Two follow-ups** done by hand, each with mutation checks.

| Commits | Change | Key files |
|---|---|---|
| `ded825b` `0194a60` | **Payment safety.** One payability check (stored flag → self-healing live Stripe check → fail closed) gates every student→coach money path: `lesson.book` and lesson checkout, tips, storefront, content-request create/accept/checkout, paid subscriptions, group lessons. Coaches may go live without Stripe; students see "Booking opens soon". `account.updated` now flips the flag both ways by re-fetching the account. `acceptingPayments` is exposed on public coach data (never the account id). Copy is now truthful: onboarding, landing, welcome email, dashboard banner. | `server/coachPayability.ts`, `shared/coachPayments.ts`, `server/webhooks.ts`, `server/routers.ts`, `client/src/hooks/useCoachAcceptsPayments.ts` |
| `387ed5c` `35866fa` | **Rating preservation.** Find-Another-Coach edits no longer reset `currentRating`/`skillLevel`/`targetRating`; the profile rating is the single source of truth; only answered questions are written; guest answers only fill empty profiles. | `shared/assessmentProfileUpdate.ts`, `shared/questionnaireDraft.ts`, `server/studentAssessment.ts`, `server/db.ts` |
| `7ca9749` `6f8fa22` | **Hardening.** `normalizeDisplayName` on every name write; all email templates escape inputs once and subjects are CR/LF-stripped; strict auth rate limits parse tRPC batch paths (budgets per kind, one strict call per batch); tolerant `APP_ENV` / boolean env parsing that fails *before* listen; one server-side unread total; misrouted platform webhooks return 200 + owner alert; preview storage visibility fix. | `server/emailSafety.ts`, `server/_core/rateLimits.ts`, `shared/displayName.ts`, `server/_core/previewPolicy.ts`, `server/_core/backgroundJobs.ts` |
| `4b839f8` `38764fe` | **Login CSRF.** OAuth sign-in is bound to the starting browser: `/api/oauth/start` → same-origin `/api/oauth/authorize` sets a 10-min httpOnly SameSite=Lax nonce cookie, the nonce rides in `state`, and the callback checks it in constant time before any token exchange. Email-verification links are bound the same way. Broken admin `/api/oauth/login` links fixed; `?redirect=` survives a refused sign-in. | `server/_core/oauthFlow.ts`, `server/_core/oauth.ts`, `server/_core/sdk.ts`, `server/emailVerificationBinding.ts`, `shared/returnPath.ts` |
| `5606628` | **Duplicate-key detection.** drizzle 0.45 wraps mysql2 errors (`DrizzleQueryError`, driver error on `.cause`), so all five `errno === 1062` checks silently missed: double storefront purchases weren't refunded, concurrent subscribes threw, repeat waitlist signups returned 500s. `isDuplicateKeyError` walks the cause chain. | `server/dbErrors.ts` |
| `b4f610e` | **Expire open checkouts** for lessons, content requests and tips when a coach becomes unpayable (on `account.updated` including redeliveries, on `confirmStripeOnboarded`, and on account deletion). Stored session ids are kept on purpose so the existing expired→replace path bumps the idempotency key. | `server/coachPayability.ts` (`expireOpenCheckoutsForCoach`) |

Merge conflicts were resolved by hand in four places, each re-tested: `server/email.ts` (Sprint 1 welcome-email copy + Sprint 3 escape-once), `server/auth.ts` (verification binding + name normalization), and import-only conflicts in `authRouter.ts`, `db.ts`, `StudentDashboard.tsx`, `CoachMatchingAssessment.tsx`. No agent ran a cross-sprint integration review (budget); the full suite is green on the combined tree.

## 2. Risks and bugs to know about

**Must verify before production (cannot be tested from the repo):**
- **Manus OAuth broker compatibility.** State is now `base64("<redirectUri>?nonce=<43 chars>")`. The `redirectUri` param and the token exchange are byte-identical, but if `/app-auth` rejects or alters the state, every Google sign-in fails. Run one real sign-in on preview first. Fallback is documented in `oauthFlow.ts`: a cookie-only check with the original state (weaker).
- Users mid-sign-in during the deploy (or a rollback) fail once with a friendly retry message.
- Real `account.updated` disable → flag off + sessions expired; escaped emails rendering in Resend; strict rate limits behind the production proxy.
- **Env values now fail at boot:** an unrecognised `APP_ENV` (e.g. `staging`, or a non-exact `Preview`), or a garbage `BACKGROUND_JOBS_ENABLED` / `AUTO_RELEASE_PAYOUTS_ENABLED`. Check Manus's saved values before publishing.

**Production data (urgent, owner action):** `.manus` query logs suggest sample coaches elena.petrov / carlos.rodriguez / sarah.chen @example.com have fake `acct_test_*` ids with `stripeConnectOnboarded = true` in the production DB. Under the new rules they count as payable; payouts would fail. Unflag or remove them with owner approval.

**Open security issue (not fixed):** tRPC v11 accepts `multipart/form-data` POSTs, which any site can send cross-origin without CORS. Combined with the OAuth session cookie's `SameSite=None`, 8 signed-in no-input mutations are reachable cross-site. Fix: reject non-JSON POSTs on `/api/trpc` or require a custom header; or switch the OAuth session cookie to `Lax` if the Manus editor preview no longer needs it.

**Pre-existing bugs found, not fixed:**
- `contentRequest.createCheckout` never clears an expired session (permanent CONFLICT).
- `tip.createCheckout` deletes a pending tip whose session may still be payable (orphaned payment).
- Soft-deleted coaches still appear in browse.
- Paid coach subscriptions record a price but never charge.
- "Pay only after your lesson" copy contradicts the upfront-escrow model.
- Storefront Checkout Sessions aren't stored, so they can't be expired; the webhook owed-payout alert is the backstop.
- No DOM test environment, so BookingModal and Register submit flows lack component tests.

**Still needs the indexes migration** from the main audit: `messages(lessonId, createdAt)`, `messages(lessonId, readAt)`, `lessons(studentId)`, `lessons(coachId)`, plus a separate class-title column so a coach's rename stops overwriting the student's booking topic. Rehearse on the isolated preview DB; never `pnpm db:push` on production (the migration chain is inconsistent).

## 3. How to take it into main

1. **Review:** `git fetch origin && git diff 8cdca86..origin/claude/code-audit-review-icD40`. Commits are grouped in pairs per sprint (table above), so the branch can go in as one PR or be split into per-sprint PRs by cherry-picking each pair onto a branch from main. Order matters for conflicts: 1 → 2 → 3 → 4 → follow-ups.
2. **Rebase if main moved:** `git rebase origin/main`, then `npx --yes pnpm@10.4.1 install --frozen-lockfile && pnpm check && pnpm test && pnpm build` (Node 24).
3. **Second-agent review** of the diff, per the collaboration rules in `docs/astra-ownership-transition.md`. Suggested focus: `oauthFlow.ts`/`oauth.ts`, `coachPayability.ts`, `rateLimits.ts`, `server/email.ts`.
4. **Preview rehearsal** (your isolated-preview plan, sandbox Stripe only), covering:
   - Google sign-in through the real broker.
   - A coach with an unfinished Stripe setup: can go live, students are blocked, the banner shows.
   - Finishing Stripe: the flag heals and booking opens.
   - Disabling the account in the sandbox: the flag goes off and open checkouts expire.
   - Rating edit in Find Another Coach.
   - Email rendering in Mailpit.
5. **Fix the production sample-coach data** (owner-approved), then **merge to main via PR**.
6. **Manus integration:** Manus imports GitHub main, reruns `pnpm check` / `pnpm test` / `pnpm build`, and records a checkpoint. **Publishing stays behind explicit owner approval.** After publishing, verify:
   - public routes return 200;
   - one real Google sign-in;
   - one email sign-up and verification;
   - a signed platform webhook diagnostic and a Connect diagnostic.

   No new env vars or migrations are required; confirm the existing env values parse (see the risks above).

## 4. For Claude Code on the owner's machine (not a cloud session)

`git fetch origin && git checkout claude/code-audit-review-icD40`, then read this file and `docs/sprints-1-4-handoff-2026-10-09.md`. Work one sprint at a time with a single review pass. The heavy parallel multi-agent setup used here is expensive. Suggested next sprints, in order:
1. tRPC cross-site form CSRF (above).
2. The pre-existing payment bugs listed above.
3. Indexes + class-title migration, preview-rehearsed.
4. Merge `astra/security-headers-1` once you've confirmed whether Manus frames the site.
5. Add jsdom/testing-library for client flow tests.

Product direction to keep in mind: BooGMe as the all-in-one chess platform (lessons, messaging, product exchange, analysis, file storage, Chessable-style courses, Chess Monitor / chess.ceo-style training, PPV content). The payability module (`requirePayableCoach`) and the escape-once email templates are meant to be reused by future paid products.
