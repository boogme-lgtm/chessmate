# BooGMe Architecture

Snapshot of the codebase as of Sprint 0. This document is maintained alongside
`BUILD_PLAN.md` and should be updated whenever major structural changes are
made.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + wouter (routing) |
| Styling | Tailwind 4 + Radix UI + Framer Motion |
| API | tRPC 11 over Express |
| Auth | Custom email/password + Google OAuth, JWT sessions (jose), bcryptjs |
| Database | MySQL via Drizzle ORM + mysql2 |
| Payments | Stripe Connect (Express accounts) |
| Email | Resend (verified sender `contact.boogme.com`) |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| Testing | Vitest |

## Build & Run

```bash
pnpm install
pnpm check   # TypeScript typecheck (tsc --noEmit)
pnpm test    # Vitest — see "Test status" below
pnpm build   # Vite client build + esbuild server bundle
pnpm dev     # tsx watch server/_core/index.ts
pnpm db:push # drizzle-kit generate + migrate
```

## Directory Layout

```
.
├── BUILD_PLAN.md           — Master sprint plan (source of truth for work)
├── ARCHITECTURE.md         — This file
├── client/                 — React SPA
│   └── src/
│       ├── App.tsx         — Router definitions (wouter)
│       ├── main.tsx        — App entry, tRPC client setup
│       ├── pages/          — Route components (see "Pages" below)
│       ├── components/     — Shared UI (BookingModal, BookingCalendar, ErrorBoundary, …)
│       ├── components/ui/  — shadcn/ui primitives (Radix wrappers)
│       ├── _core/hooks/    — useAuth, etc.
│       ├── contexts/       — ThemeContext
│       ├── hooks/          — useComposition, useMobile, usePersistFn
│       └── lib/            — trpc client, utils
├── server/                 — Express + tRPC backend
│   ├── _core/              — Framework plumbing (index, context, trpc, cookies, env, oauth, sdk)
│   ├── routers.ts          — Main tRPC router (see "tRPC routers" below)
│   ├── authRouter.ts       — Auth procedures (register, login, logout, verifyEmail, reset)
│   ├── auth.ts             — Password hashing, verification, reset flows
│   ├── db.ts               — Drizzle queries + raw SQL helpers
│   ├── stripe.ts           — Stripe client, checkout session, refunds
│   ├── stripeConnect.ts    — Connect accounts, escrow payment intents
│   ├── webhooks.ts         — Stripe webhook handler
│   ├── emailService.ts     — Resend wrapper + HTML templates
│   ├── email.ts            — Low-level Resend fetch wrapper (legacy)
│   ├── nurtureEmailScheduler.ts — 5-email waitlist drip campaign
│   ├── reminderScheduler.ts     — 24h lesson reminder scheduler
│   ├── bookingService.ts   — Booking pricing/availability helpers
│   ├── aiVettingService.ts — LLM-based coach application vetting
│   ├── storage.ts          — S3 upload proxy
│   └── *.test.ts           — Vitest tests (mixed unit/integration)
├── shared/                 — Code shared between client and server
│   ├── types.ts            — Re-exports Drizzle inferred types
│   ├── const.ts            — COOKIE_NAME, timeouts, error messages
│   └── _core/errors.ts     — Error helpers
├── drizzle/
│   ├── schema.ts           — Source of truth for all DB tables
│   ├── relations.ts        — (currently empty)
│   └── 0000-0008_*.sql     — 9 migrations + meta/
├── scripts/                — One-off ops (sample data, resend welcome emails)
├── test/                   — Vitest setup (dummy env vars)
├── patches/                — pnpm patchedDependencies (wouter@3.7.1)
└── vitest.config.ts
```

## Database Schema

All 14 tables live in `drizzle/schema.ts`. Dialect: MySQL.

| Table | Purpose | Key relationships |
|-------|---------|-------------------|
| `users` | Core account record | Has `role` (`user`/`admin`) and `userType` (`student`/`coach`/`both`). Stores Stripe customer/Connect IDs, email verification & password reset tokens, timezone. |
| `coach_profiles` | Coach-specific fields | FK `userId → users.id`. Holds FIDE rating, title, specialties (JSON), hourly rate, commission rate, tier, onboarding progress, availability schedule. |
| `student_profiles` | Student-specific fields | FK `userId → users.id`. Holds skill level, goals, playing style, gamification (XP, streaks). |
| `lessons` | Core booking entity | FK `studentId`, `coachId → users.id`. Tracks full lifecycle: `pending_confirmation → confirmed → paid → in_progress → completed/cancelled → released/refunded`. Stores Stripe IDs, cancellation token, refund amounts, reminderSentAt. |
| `reviews` | Mutual Airbnb-style reviews | FK `lessonId → lessons.id`, `reviewerId`/`revieweeId → users.id`. Detailed ratings (knowledge, communication, preparedness). `isVisible` toggled when both sides submit. |
| `achievements` | Gamification badge catalog | |
| `user_achievements` | Badges unlocked per user | FK `userId`, `achievementId`. |
| `coach_matches` | AI matching output | FK `studentId`, `coachId`. Stores quiz snapshot + per-dimension scores. |
| `waitlist` | Pre-launch signups | Tracks 5-email nurture sequence + unsubscribe status. |
| `coach_applications` | Coach onboarding applications | Stores full questionnaire + AI vetting results. |
| `lesson_packages` | Multi-lesson bundles | FK `studentId`, `coachId`. Per-lesson escrow release planned. |
| `cancellations` | Cancellation records | Refund policy audit log. |
| `disputes` | Post-lesson dispute tracking | Reason enum + resolution fields. |
| `payouts` | Coach payout ledger | Tied to lessons/packages + Stripe transfer IDs. |

### Known Schema Gotchas

1. **No foreign keys** — all relationships are by convention; `relations.ts` is empty.
2. **Raw SQL for lesson inserts** — Drizzle emits `id = 'default'` which MySQL
   rejects. `server/db.ts:createLesson` uses `db.execute(sql\`INSERT …\`)`
   as a workaround.
3. **JSON stored as `text`** — `specialties`, `languages`, `availabilitySchedule`,
   `lessonDurations`, `quizAnswers`, etc. Every read needs a try/catch.
4. **No indexes declared** — FK columns and frequently-queried `status`
   columns lack indexes; this will need attention before scale.

## tRPC Routers (`server/routers.ts`)

| Namespace | Line | Purpose |
|-----------|------|---------|
| `system` | (imported) | Health check |
| `auth` | (imported) | Register, login, logout, verify, reset |
| `puzzle` | 23 | Lichess puzzle proxy (Sprint 6 will expand) |
| `waitlist` | 77 | Join, count, confirm email |
| `coachApplication` | 143 | Submit + status |
| `coach` | 315 | List, get by id, availability, profile CRUD, onboarding, earnings |
| `student` | 548 | Profile + AI matching |
| `lesson` | 594 | Book, cancel, confirm, decline, requestRefund |
| `payment` | 824 | `createCheckout` — Stripe checkout session |
| `admin` | 871 | Applications, emails, waitlist management |
| `booking` | 1228 | Legacy/duplicate booking endpoints |
| `gamification` | 1320 | XP + achievements |

The `booking` router appears to duplicate parts of `lesson` and should be
consolidated in a later sprint.

## Client Pages (`client/src/pages/`)

Routes defined in `client/src/App.tsx`:

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Home` | Landing page |
| `/coaches` | `CoachBrowse` | Coach directory |
| `/for-coaches` | `Coaches` | Marketing page for coaches |
| `/coach/apply` | `CoachApplicationPage` | Multi-step coach application |
| `/coach/dashboard` | `CoachDashboard` | Coach earnings + lessons (userType guard) |
| `/coach/:id` | `CoachDetail` | Public coach profile + booking CTA |
| `/dashboard` | `StudentDashboard` | Student lessons with live countdown |
| `/lessons/:id` | `LessonPaymentSuccess` | Post-Stripe return page |
| `/register`, `/sign-in`, `/verify-email` | | Custom email/password auth |
| `/forgot-password`, `/reset-password` | | Reset flow |
| `/admin/applications` | `AdminApplications` | Coach application review |
| `/admin/waitlist` | `AdminWaitlist` | Waitlist export |
| `/dev-dashboard` | `DevDashboard` | Internal debug tools |
| `/unsubscribe`, `/privacy`, `/terms` | | Static/compliance pages |

Missing from the router (flagged in plan): `/dashboard/*` nested routes,
`ComponentShowcase` (orphan file at `pages/ComponentShowcase.tsx`).

## Environment Variables

Required at startup (`server/_core/env.ts` throws on missing):

- `VITE_APP_ID`
- `JWT_SECRET`
- `DATABASE_URL`

Optional but needed for features:

- `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` — Google OAuth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `VITE_FRONTEND_URL` — canonical URL for email links and Stripe redirects
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — Manus LLM proxy

Test suite uses `test/setup.ts` to inject dummy values so tests can import
server modules without a real environment.

## Build & Test Status (Sprint 0 baseline)

- `pnpm check` — **PASS** (no TS errors)
- `pnpm build` — **PASS** (client + server bundle)
- `pnpm test` — **18 passing / 10 failing (28 total)**

### Test failures are pre-existing and external-dependency-related

| Test file | Failure cause |
|-----------|---------------|
| `auth.logout.test.ts` | Needs MySQL (uses real `db.upsertUser`) |
| `booking.test.ts` | Needs MySQL for coach/lesson queries |
| `puzzle.test.ts` | Calls live Lichess API (timeout in sandbox) |
| `unsubscribe.test.ts` | Needs MySQL |
| `waitlist.test.ts` | Needs MySQL |
| `webhook.test.ts` | **Excluded** — integration test that fetches `http://localhost:3000` |

Sprint 0 intentionally does not fix these — they require either mocked DB
layers or a running Docker compose stack. Noted here for future sprints.

## Critical Runtime Behaviors

1. **Stripe webhook endpoint** — `POST /api/stripe/webhook` is mounted *before*
   `express.json()` because Stripe signature verification requires the raw
   body. See `server/_core/index.ts:50`.
2. **HTTPS redirect** — enforced in production via `x-forwarded-proto` header
   (`server/_core/index.ts:35`).
3. **Force-logout endpoint** — `GET /api/force-logout` clears the session
   cookie and redirects to `/`. Used as an emergency reset tool.
4. **Reminder scheduler** — `reminderScheduler.ts` runs an hourly
   `setInterval` started from `_core/index.ts` on boot.
5. **Session cookies** — `sameSite: "none" + secure: true` over HTTPS; falls
   back to `sameSite: "lax"` when the request is insecure (dev).

## Known Bugs Being Tracked (from `BUILD_PLAN.md`)

| # | Bug | Sprint |
|---|-----|--------|
| 1 | Post-payment lesson not appearing in dashboard | 1 |
| 2 | Calendar time slots not updating on date change | 2 |
| 3 | Drizzle INSERT `id` field bug (workaround in place) | tracked |
| 4 | Cookie handling fragility | tracked |
| 5 | PuzzleDemo FEN parsing crash | 6 |
| 6 | Mobile booking redirect issues | 8 |
