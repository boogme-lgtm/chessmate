# Sprints 1–4 handoff (2026-10-09)

Branch `claude/code-audit-review-icD40`, based on main `8cdca86`. Two commits per sprint (build, then audit fixes). Not merged, not deployed. No schema/migration changes.

Validation on the integrated branch: `pnpm check` clean, `pnpm test` 1648 passed / 2 skipped (main: 994), `pnpm build` OK.
Each sprint was built, reviewed by four independent lenses (correctness, security/money, end-to-end UX, test adequacy with mutation checks), every finding verified by a refuter and a reproducer, and confirmed findings fixed. The optional second review round was stopped to stay within the credit budget.

## What changed

1. **Payment safety** — `server/coachPayability.ts` is the single "can this coach receive money" check (stored flag, self-healing live Stripe check, fails closed). Applied to every student→coach payment path: lesson booking + checkout, tips, storefront, content requests (create/accept/checkout), paid subscriptions, group lessons. Coaches can go live without Stripe; students see "Booking opens soon". `account.updated` now also turns the flag off, re-fetching the account instead of trusting stale payloads. Public coach data exposes `acceptingPayments` (never the account id). Coach dashboard banner + truthful onboarding/landing/welcome-email copy.
2. **Rating preservation** — the profile's `currentRating` is the single source of truth. Questionnaire edits only change fields the student actually answered; dashboard rating changes keep saved answers in sync; guest answers only fill empty profiles.
3. **Hardening** — `normalizeDisplayName` on every name write; every email template escapes its inputs once (`server/emailSafety.ts`) and subjects are stripped of CR/LF; auth rate limit can't be bypassed via tRPC batching (`server/_core/rateLimits.ts`); tolerant `APP_ENV` / boolean env parsing that fails before listen; single server-side unread total; "Find a coach" link restored; misrouted platform webhooks return 200 + owner alert; preview storage visibility fix; Dockerfile background-jobs warning.
4. **Login CSRF** — OAuth sign-in is bound to the starting browser (nonce cookie + nonce in `state`, `server/_core/oauthFlow.ts`); email-verification links are bound the same way; broken admin "Log In" links fixed; `?redirect=` destinations survive a refused sign-in.

## Must verify before releasing to production

- **One real Google sign-in on a preview/staging host.** The design assumes the Manus broker echoes `state` unchanged. If it rejects the new state, fall back to a cookie-only check (weaker; see `oauthFlow.ts` comments).
- **Production data (urgent):** per `.manus` query logs, sample coaches elena.petrov / carlos.rodriguez / sarah.chen @example.com appear to have fake `acct_test_*` ids with `stripeConnectOnboarded = true` in the production DB. Under the new rules they count as payable; payouts would fail. Unflag or remove them. Nothing here touched any database.
- Escaped emails rendering in real inboxes (Resend), rate limits behind the production proxy, and a real `account.updated` event.

## Owner decisions requested

- Paid coach subscriptions record a price but never charge (recurring billing TODO). Disable paid subscriptions until billing exists?
- Lessons/content requests already in `pending_payment` for unpayable coaches: auto-cancel or notify? Expire old Checkout Sessions for those coaches?
- Rank unpayable-but-live coaches lower in browse/matching? (Currently same position + badge.)
- Dashboard rating has no rating-system choice (FIDE/Lichess/Chess.com) while matching interprets it via the questionnaire's system; and once set it can only be changed via Find Another Coach. Add a selector / editing / lichess+chess.com sync?
- First questionnaire save without a rating still writes 1200 (unchanged behaviour). Leave rating empty instead?
- `AUTO_RELEASE_PAYOUTS_ENABLED` still requires exactly `"true"` in production (deliberately strict because it moves money). Accept other spellings or fail at boot?
- OAuth sign-in overwrites a user's custom name with the provider name on every login. Intended?
- Is the Manus editor's embedded preview still needed? If not, switch the OAuth session cookie from `SameSite=None` to `Lax`.

## Recommended next sprints

1. **CSRF hardening for tRPC:** tRPC v11 accepts `multipart/form-data` POSTs, which any site can send cross-origin; with the `SameSite=None` OAuth session cookie, 8 no-input mutations are reachable. Reject non-JSON POSTs to `/api/trpc` or require a custom header.
2. **Pre-existing bugs found during the sprints:** `contentRequest.createCheckout` never clears an expired session (permanent CONFLICT); `tip.createCheckout` deletes a pending tip whose session may still be payable (orphaned payment); soft-deleted coaches still appear in browse; drizzle 0.45 wraps MySQL errors, so duplicate-key checks in `recordContentPurchase` / `subscribeToCoach` / `addToWaitlist` never fire; "Pay only after your lesson" copy contradicts the upfront-escrow model.
3. **DB indexes + class-title column** (from the main audit) — needs a migration; rehearse on the isolated preview DB first, never `pnpm db:push` on production.
4. **Merge `astra/security-headers-1`** after confirming whether Manus frames the site.
5. Add a DOM test environment (jsdom/testing-library) so client flows (BookingModal, Register) get component tests.
