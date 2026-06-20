# S-COACH-ACTIVATION-1 — Self-Serve Coach Payout Activation

**Author:** Claude (audit-driven; supersedes the original "Coach Onboarding Wizard" proposal)
**Branch:** `claude/code-audit-review-icD40`
**Status:** Implemented, verified (tsc + build + 573/573 tests green), Opus-reviewed → APPROVED
**Schema changes:** none · **Server changes:** none · **Migration:** none

---

## Why this sprint looks different from the original plan

The original "Coach Onboarding" plan (Option A) was scoped from a flow audit that assumed the **admin-approval path** was the live coach funnel. A pre-build verification against the actual code disproved four of its premises:

| Original item | Finding (evidence) | Disposition |
|---|---|---|
| C1 — implement admin-approval side-effects (create account/profile/email) | The application/approval path is **deprecated**: `App.tsx:45-47` — *"/coach/apply is deprecated — the canonical coach flow is /coach/onboarding."* `coachApplication.submit` is unreachable (`CoachApplicationPage` is not mounted). | **Dropped** (dormant subsystem) |
| C6 — auto-approval profile creation in `coachApplication.submit` | Same deprecated/unreachable procedure. | **Dropped** (dead path) |
| C4 — change `coach.updateProfile` / `startOnboarding` to `coachProcedure` | The wizard calls these **while the user is still `userType:"student"`** — promotion to "coach" happens only at Go Live (`routers.ts:918-923`). `coachProcedure` requires coach/both, so this would `FORBIDDEN`-fail mid-wizard and **break onboarding**. | **Dropped** (harmful) |
| C2 — hard-gate Go Live on Stripe | Go Live is intentionally gated only on `guidelinesAgreed` (`CoachOnboarding.tsx:1120`); the server models an **earn-first** design: `needsOnboarding = hasReachedThreshold && !stripeOnboarded` (`routers.ts:847`). Coaches earn into escrow first, complete Stripe to withdraw. | **Reframed** as non-blocking nudges |
| C3 — add a missing dashboard Stripe nudge | A prominent banner already exists, but only fires on `needsOnboarding` (after the **$100 threshold**). A coach who just went live without Stripe (pre-threshold) gets no prominent prompt. | **Implemented** as an earlier soft banner |

The user chose to keep coaches **self-serve** (not revive admin approval). This sprint therefore targets the real gaps in the live self-serve flow.

---

## What was built (3 presentational changes)

### 1. Dashboard — earlier "set up payouts" nudge
**File:** `client/src/pages/CoachDashboard.tsx`

Added a second, softer banner above the modules, complementing the existing urgent one:

- **Existing (unchanged):** urgent banner when `earnings?.needsOnboarding` (threshold reached, no Stripe).
- **New:** soft informational banner when `earnings && !earnings.stripeOnboarded && !earnings.needsOnboarding` — i.e. a live coach who hasn't connected Stripe and hasn't yet hit the threshold. Copy: *"Set up payouts to withdraw earnings — your profile is live and can receive bookings…"* Button reuses the existing `startOnboarding.mutate()`.
- The two banners are **mutually exclusive** (soft requires `!needsOnboarding`) and the soft one is **flicker-safe** (guarded by truthy `earnings &&`, not `?.`). Added `CreditCard` to the lucide import.

### 2. Go-Live step — accurate, non-blocking Stripe messaging
**File:** `client/src/pages/CoachOnboarding.tsx` (step 7)

- Subtitle changed "Required to receive lesson payments" → **"Needed to withdraw your earnings"** (the old copy implied a hard requirement that doesn't exist).
- Added a helper line under the Stripe button: *"You can go live now and start getting booked — just finish this before withdrawing your earnings. We'll remind you on your dashboard."*
- **Go Live remains gated only on `guidelinesAgreed`** — non-blocking, preserving the earn-first design.

### 3. Coach waitlist — dead-end converted to onboarding CTA
**File:** `client/src/pages/Coaches.tsx` (`CoachWaitlistSection`)

- Previously: submit → toast → reset fields (no forward path).
- Now: a `submitted` state renders a success panel — *"You're on the list! … you don't have to wait"* — with a primary CTA **"Set up your coach profile"** → `setLocation("/coach/onboarding")`, routing coaches straight into the canonical self-serve flow.

---

## Verification

- `pnpm exec tsc --noEmit` — clean
- `pnpm build` — clean
- `pnpm test` — **573/573** pass, 46 files (no regressions; no new tests — changes are presentational and the repo has only server-side vitest, no client harness)
- **Opus review — APPROVED.** Confirmed: banners mutually exclusive & flicker-safe; Go Live still non-blocking; waitlist conditional balanced with all imports present; cross-surface earn-first messaging coherent. One MINOR copy nit (banner heading) applied.

---

## Remaining flow gaps (future sprints — from the audit, not this sprint)

These are documented for sequencing; **not** addressed here:

- **Student S1:** signup verification loop (register → verify → manual re-login). Auto-login after verification.
- **Student S2:** the homepage assessment quiz completes but doesn't route to matched coaches.
- **Student S3:** new students land on an empty dashboard with no "find a coach" guidance.
- **Student S4:** billing module is a "coming soon" stub.
- **Auth A1:** no frontend `ProtectedRoute` — `/admin/*` pages render UI for non-admins before the API 403s.
- **Landing pages:** separate coach/student value-prop landing pages (user-flagged as a known future need).
- **Deprecated approval subsystem:** if admin-gated coaching is ever desired, the `coachApplication.submit` + `admin.applications.approve` TODOs (`routers.ts:551-553`, `3485-3487`) remain unimplemented and `/coach/apply` would need re-enabling.
