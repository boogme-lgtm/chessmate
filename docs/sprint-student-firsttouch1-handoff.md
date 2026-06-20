# S-STUDENT-FIRSTTOUCH-1 — Auto-Login After Verification + New-Student Getting-Started

**Author:** Claude (audit-driven, Sprint 2)
**Branch:** `claude/code-audit-review-icD40`
**Status:** Implemented, verified (tsc + build + 573/573 tests), Opus-reviewed → APPROVED
**Schema changes:** none · **Server changes:** none · **Migration:** none

Scope chosen by product owner: **S1 + S3** (S2 assessment→coach-matching deferred to its own sprint — it touches a 1,447-line component and carries a stealth-waitlist-vs-live-matching product decision).

---

## S1 — Kill the post-verification re-login loop

**Problem (audit):** After clicking the email verification link, a student landed on `VerifyEmail.tsx`, saw a "Sign In Now" button, was routed to `/sign-in`, and had to re-enter credentials. 3 steps where there should be 0.

**Key finding:** The server **already logs the user in on verification** — `server/authRouter.ts:117-146` creates a session token and sets the auth cookie inside the verify procedure. The client was discarding an already-valid session.

**Fix — `client/src/pages/VerifyEmail.tsx` (client-only):**
- On verify success, read `postLoginRedirect` from localStorage, validate it's a safe same-origin relative path (`startsWith("/") && !startsWith("//")`, else `/dashboard`), clear the stored value, show the success card ~1.2s, then `window.location.href = target` (hard navigation so the SPA boots with the freshly-set session cookie).
- Replaced the "Sign In Now" button with "Go to your dashboard" → same target.
- Fallback safety: if the user somehow isn't authenticated, `/dashboard` bounces to `/` (`Dashboard.tsx:56-60`) — no broken state.
- No `Register.tsx` change needed: defaulting the verify destination to `/dashboard` covers the common case where no redirect was stored.

---

## S3 — Unified getting-started state for brand-new students

**Problem (audit):** A brand-new student landed on a dashboard of fragmented empty module cards. Only Module 1 had a real "Browse Coaches" CTA; Modules 2 (Lessons) and 3 (Messages) were dead text with no link.

**Fix — `client/src/pages/StudentDashboard.tsx` (client-only):**
- New `isNewStudent` flag: true only when the student has **no lessons, no content requests, no subscriptions, and no owned content** — and only once those queries have resolved (guards against the welcome panel flashing for returning students mid-load). `content.listOwned` is queried in the parent for the owned-content signal; React Query dedupes it with the Library module's identical query, so there's no extra network request.
- When `isNewStudent`, a "Welcome to BooGMe / Let's find your coach" panel renders at the top with a 3-step guide (browse → book → track) and a primary "Browse coaches" CTA.
- Module 1's "No upcoming lessons" empty card is suppressed for new students (`nextLesson ? (...) : isNewStudent ? null : (...)`) to avoid two stacked Browse-Coaches CTAs.
- The two dead-text empty states now have CTAs: `LessonHistorySection` → "Browse coaches" button; `MessagesModule` → "Find a coach →" link (each via a newly added `useLocation`).

---

## Verification

- `pnpm exec tsc --noEmit` — clean
- `pnpm build` — clean
- `pnpm test` — **573/573** pass (no regressions; presentational changes, repo has only server-side vitest, no client harness, so no new unit tests)
- **Opus review (Opus 4.8) — APPROVED.** Confirmed: no re-login loop, open-redirect-safe target, hard-nav correct with server-set cookie, unauthenticated fallback intact; new-student flicker guard correct, no double CTA, well-formed ternary, valid hooks. The one IMPORTANT finding it raised — `isNewStudent` initially ignored content-library purchases (a library-only student would be mislabeled "new") — was **fixed** by adding `ownedContent` to the gate before final sign-off.

---

## Remaining first-touch gaps (future sprints)

- **S2 (deferred):** the homepage assessment quiz (`CoachMatchingAssessment.tsx`) collects 20 signals, runs a *fake* analysis, then dumps into a stealth-mode waitlist email gate and discards everything — no `onComplete`, no persistence, no redirect. Wiring it to real coach-matching requires (a) replacing the waitlist gate with a route to `/coaches` carrying the signals and (b) adding query-param filter intake to `CoachBrowse.tsx` (which currently reads no params). Carries a product decision (demand-capture vs live matching).
- **S4:** Student billing module is a "coming soon" stub (`StudentDashboard.tsx`).
- **Auth A1:** no frontend `ProtectedRoute` — `/admin/*` pages render UI for non-admins before the API 403s.
- **Landing pages:** dedicated coach/student value-prop landing pages (user-flagged as a known future need).
