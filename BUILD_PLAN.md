# BooGMe Build Plan — Claude Code Autonomous Execution

**Purpose**: This document is a self-contained, prioritized build plan for the BooGMe chess coaching marketplace. It is designed to be followed sequentially by Claude Code with minimal human intervention.

**Repo**: `https://github.com/boogme-lgtm/chessmate`
**Stack**: TypeScript, Vite + React (wouter), tRPC + Express, Drizzle ORM (MySQL), Stripe Connect, Resend email, Tailwind + Radix UI + Framer Motion
**Schema**: `./drizzle/schema.ts` | **DB dialect**: MySQL | **ORM**: Drizzle
**Key packages**: chess.js, stripe, resend, jose (JWT), bcryptjs, zod

---

## How to use this plan

Each sprint is a self-contained unit of work. Complete all tasks in a sprint before moving to the next. After each sprint:
1. Run `pnpm check` (TypeScript)
2. Run `pnpm test` (Vitest)
3. Test manually in browser if UI changes were made
4. Commit with message: `sprint-N: [description]`

**Critical rule**: Never break existing functionality. If a task requires DB schema changes, always run `pnpm db:push` after modifying `drizzle/schema.ts`.

---

## SPRINT 0: Codebase Health Check (Do First)

**Goal**: Ensure the project builds and tests pass before changing anything.

- [ ] `pnpm install`
- [ ] `pnpm check` — fix any TypeScript errors
- [ ] `pnpm test` — document which tests pass/fail
- [ ] `pnpm build` — verify production build succeeds
- [ ] Review `drizzle/schema.ts` and document all existing tables and their relationships
- [ ] Review `server/` directory structure — document all routers, services, and middleware
- [ ] Review `client/` directory structure — document all pages, components, and routes
- [ ] Create `ARCHITECTURE.md` in repo root summarizing findings

**Output**: A clean build, passing tests, and an architecture doc.

---

## SPRINT 1: Fix Post-Payment Booking Flow (CRITICAL BUG)

**Context**: After a student pays via Stripe checkout, they're redirected back but the lesson doesn't appear in their dashboard. The lesson detail page shows "Lesson not found." This is the #1 blocker.

**Root cause investigation**:
- [ ] Check `server/stripe.ts` webhook handler — verify `checkout.session.completed` event correctly updates booking status in DB
- [ ] Check the redirect URL from Stripe checkout — verify `success_url` includes correct params (lesson ID, session ID)
- [ ] Check the payment success page component — verify it queries for the lesson correctly
- [ ] Check the student dashboard query — verify it fetches lessons for the authenticated user
- [ ] Check that the Drizzle INSERT for bookings uses raw SQL (there was a known bug where Drizzle tried to insert `id` field with value "default" which MySQL rejects)

**Fixes needed**:
- [ ] Ensure webhook handler updates booking `status` from `pending_payment` → `confirmed` on successful payment
- [ ] Ensure webhook handler stores `stripePaymentIntentId` or `stripeSessionId` on the booking record
- [ ] Fix payment success page to query lesson by the correct ID (from URL params or Stripe session metadata)
- [ ] Fix student dashboard query to fetch all lessons where `studentId` matches authenticated user
- [ ] Add error logging to webhook handler for debugging
- [ ] Test with Stripe test card `4242 4242 4242 4242`

**Verification**: Book a lesson → pay → get redirected → see lesson in student dashboard with "Confirmed" status.

---

## SPRINT 2: Fix Booking Calendar Reliability

**Context**: Time slots don't update correctly after selecting a date in the booking calendar.

- [ ] Review the availability calendar component — check how it fetches coach availability slots
- [ ] Check if availability slots are stored in DB or generated dynamically
- [ ] Verify the API endpoint for `getCoachAvailability` returns correct data for selected date
- [ ] Fix time slot rendering — ensure selecting a date triggers a re-fetch or re-filter of available slots
- [ ] Add "Next Available" button that scans forward to find the coach's next open slot
- [ ] Ensure timezone handling is correct — store/display times in coach's timezone with conversion for student
- [ ] Test on mobile (touch interactions with calendar)

---

## SPRINT 3: 24-Hour Reminder System

**Context**: Automated email reminders before lessons, plus cancellation with refund logic.

### 3a: Reminder Scheduler
- [ ] Add `reminderSentAt` column to lessons/bookings table in `drizzle/schema.ts`
- [ ] Run `pnpm db:push`
- [ ] Create `server/reminderScheduler.ts`:
  - Runs every hour (use `setInterval` on server startup)
  - Queries lessons scheduled 20–28 hours from now where `reminderSentAt` is null
  - Sends reminder email to student (lesson details, coach name, time, cancellation link)
  - Sends reminder email to coach (lesson details, student name, time)
  - Updates `reminderSentAt` on the lesson record
- [ ] Register the scheduler in `server/_core/index.ts` on server start
- [ ] Create email templates for reminder emails using existing Resend integration

### 3b: Cancellation Flow
- [ ] Create cancellation API endpoint: `POST /api/trpc/lessons.cancel`
  - Accept `lessonId` and authenticated user context
  - Enforce cancellation policy:
    - `>48 hours` before lesson → full refund
    - `24–48 hours` → 50% refund
    - `<24 hours` → no refund
  - Process Stripe refund via `stripe.refunds.create()`
  - Update lesson status to `cancelled`
  - Send cancellation confirmation email to both parties
- [ ] Build `CancellationDialog` component:
  - Shows refund breakdown based on time until lesson
  - Confirms intent before processing
  - Shows success/failure state
- [ ] Add countdown timer to lesson cards showing:
  - Time until lesson
  - "Cancel with full refund" deadline
  - "Cancel with 50% refund" deadline

---

## SPRINT 4: Coach Confirmation Flow

**Context**: When a student books, the coach should accept/decline. Currently bookings go straight to confirmed.

- [ ] Add `coach_confirmation_required` status to booking flow
- [ ] Update booking creation: set initial status to `pending_confirmation` instead of `confirmed`
- [ ] Add Accept/Decline buttons to coach dashboard for pending bookings
- [ ] Create `lessons.confirmLesson` tRPC endpoint (coach accepts)
- [ ] Create `lessons.declineLesson` tRPC endpoint (coach declines → auto-refund student)
- [ ] Send email to coach when new booking arrives ("You have a new lesson request")
- [ ] Send email to student when coach confirms/declines
- [ ] Add auto-decline after 24 hours if coach doesn't respond (in reminder scheduler)
- [ ] Show "Pending Confirmation" badge on student dashboard

---

## SPRINT 5: Reviews & Ratings System

**Context**: Airbnb-style mutual reviews — hidden until both parties submit.

- [ ] Create `reviews` table in `drizzle/schema.ts`:
  ```
  id, lessonId, reviewerId, revieweeId, role (student|coach),
  overallRating (1-5), communicationRating (1-5),
  teachingRating (1-5), punctualityRating (1-5),
  writtenReview (text), createdAt
  ```
- [ ] Run `pnpm db:push`
- [ ] Create tRPC endpoints:
  - `reviews.submitReview` — validates lesson is completed, user was participant
  - `reviews.getReviewsForCoach` — returns visible reviews (only where both parties submitted)
  - `reviews.getPendingReviews` — returns lessons where user hasn't reviewed yet
- [ ] Build review submission form component (star ratings + text)
- [ ] Add review prompt to student dashboard after lesson is marked "completed"
- [ ] Display reviews on coach profile/detail page (average rating + individual reviews)
- [ ] Send email reminder to review after lesson completion (24 hours later)

---

## SPRINT 6: Lichess API Integration

**Context**: Replace mock puzzles with real Lichess data. Also use for player profile verification.

### 6a: Puzzle Integration
- [ ] Create `server/lichess.ts` service:
  - `getPuzzle(rating?: number)` → calls `https://lichess.org/api/puzzle/next` or `https://lichess.org/api/puzzle/{id}`
  - `getDailyPuzzle()` → calls `https://lichess.org/api/puzzle/daily`
  - Parse response: FEN, moves array, rating, themes
- [ ] Create tRPC endpoint: `puzzles.getNext` (with optional rating filter)
- [ ] Update the PuzzleDemo component to use real Lichess puzzles instead of hardcoded ones
- [ ] Fix the existing FEN parsing crash (noted in todo)
- [ ] Show puzzle rating and themes in the UI

### 6b: Player Profile Verification (optional but valuable)
- [ ] `getPlayerProfile(username)` → calls `https://lichess.org/api/user/{username}`
- [ ] Extract ratings (rapid, blitz, classical), game counts, join date
- [ ] Use in coach application to auto-verify claimed ratings
- [ ] Use in student questionnaire to pre-fill rating from Lichess username

---

## SPRINT 7: In-App Messaging

**Context**: Per-lesson messaging between coach and student.

- [ ] Create `messages` table in `drizzle/schema.ts`:
  ```
  id, lessonId, senderId, content (text), createdAt, readAt
  ```
- [ ] Run `pnpm db:push`
- [ ] Create tRPC endpoints:
  - `messages.send` — send message for a specific lesson
  - `messages.getForLesson` — fetch all messages for a lesson
  - `messages.markRead` — mark messages as read
- [ ] Build message thread component (chat-style UI)
- [ ] Add message thread to lesson detail page
- [ ] Show unread message count on dashboard lesson cards
- [ ] Allow coach to send pre-lesson prep notes
- [ ] Support PGN file attachments (store as text content with PGN type marker)

---

## SPRINT 8: Mobile UX Fixes

**Context**: Various mobile issues reported during user testing.

- [ ] Audit all pages at 320px, 375px, 414px widths
- [ ] Fix hamburger menu availability on all pages (especially /coaches)
- [ ] Fix "Limited spots for founding members" badge visibility on iOS
- [ ] Ensure all touch targets are minimum 44x44px
- [ ] Fix welcome popup routing (was navigating to 404)
- [ ] Test booking calendar on mobile (touch interactions)
- [ ] Test Stripe checkout redirect on mobile
- [ ] Fix any text overflow or horizontal scroll issues
- [ ] Ensure back button / navigation header present on all sub-pages

---

## SPRINT 9: Website Polish & Pre-Launch

**Context**: Final polish before going public. Reference `website-polish-checklist.md` in repo.

### 9a: Content & Messaging
- [ ] Remove ALL specific percentage claims ("80-85%", "15-20%") from every page
- [ ] Replace with "keep more of your earnings" / "minimal platform fees"
- [ ] Remove inflated metrics (10K+ students, 500+ coaches, 50+ countries)
- [ ] Replace with honest pre-launch messaging ("Join our founding community")
- [ ] Audit all CTAs for consistency: "Find Your Coach" (students), "Apply as Coach" (coaches)

### 9b: SEO & Meta
- [ ] Add unique `<title>` tags per page
- [ ] Add `<meta name="description">` per page
- [ ] Add Open Graph tags (og:title, og:description, og:image)
- [ ] Add Twitter Card tags
- [ ] Ensure favicon.ico is present and linked

### 9c: Performance
- [ ] Run Lighthouse audit, aim for 90+ on all scores
- [ ] Add `loading="lazy"` to below-fold images
- [ ] Verify code splitting is working (dynamic imports for heavy pages)
- [ ] Check bundle size — remove unused dependencies

### 9d: Accessibility
- [ ] Add skip-to-content link
- [ ] Verify all images have alt text
- [ ] Verify all form inputs have labels
- [ ] Check WCAG AA contrast ratios on dark theme
- [ ] Test keyboard navigation (Tab through all interactive elements)

### 9e: Legal
- [ ] Verify Privacy Policy page exists at `/privacy`
- [ ] Verify Terms of Service page exists at `/terms`
- [ ] Add footer with Privacy, Terms, Contact links on all pages
- [ ] Add copyright notice: "© 2026 BooGMe. All rights reserved."

---

## SPRINT 10: Group Lessons (Future Phase)

**Context**: This is Phase 3 from the business model. Build only after Sprints 0–9 are complete.

- [ ] Design `groupLessons` and `groupParticipants` tables
- [ ] Add "Book Group Lesson" option to coach profiles
- [ ] Implement organizer booking flow (set participant count 2–6)
- [ ] Create shareable invite links for group participants
- [ ] Implement payment splitting logic (total price / participants)
- [ ] Add participant management UI
- [ ] Handle participant dropouts (>24hrs: auto-refund, recalculate splits)

---

## SPRINT 11: Content Monetization (Future Phase)

**Context**: Phase 4 from business model — PPV content, subscriptions.

- [ ] Design content tables (courses, videos, PDFs, PGN files)
- [ ] Build content upload system for coaches (S3 integration exists via @aws-sdk/client-s3)
- [ ] Create content library browsing UI
- [ ] Implement pay-per-view unlock system with Stripe
- [ ] Build subscription tiers (Committed, Premium student plans)
- [ ] Create content preview/teaser functionality
- [ ] Add custom request workflow (opening prep, training plans)

---

## Architecture Notes

### Server Structure
```
server/
  _core/index.ts    — Express app entry point, middleware, route registration
  auth.ts           — Custom auth (email/password + Google OAuth, JWT sessions)
  stripe.ts         — Stripe Connect, checkout, webhooks
  email.ts          — Resend email service
  emailService.ts   — Email templates
  nurtureEmailScheduler.ts — Waitlist nurture automation
  [routers/]        — tRPC routers (coach, student, admin, lessons, etc.)
```

### Client Structure
```
client/
  pages/            — Route-level components (Home, Coaches, Dashboard, etc.)
  components/       — Reusable UI (coach cards, booking modal, calendar, etc.)
  hooks/            — Custom React hooks
  lib/              — Utilities, tRPC client setup
```

### Database
- **Dialect**: MySQL (via mysql2)
- **ORM**: Drizzle
- **Schema**: `drizzle/schema.ts`
- **Known issue**: Drizzle's auto-generated INSERT includes `id` field with value "default" which MySQL rejects. Some booking inserts use raw SQL via mysql2 as a workaround.

### Key Environment Variables
```
DATABASE_URL          — MySQL connection string
STRIPE_SECRET_KEY     — Stripe API key
STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret
RESEND_API_KEY        — Resend email API key
JWT_SECRET            — JWT signing secret
VITE_FRONTEND_URL     — Production domain (https://boogme.com)
GOOGLE_CLIENT_ID      — Google OAuth client ID
GOOGLE_CLIENT_SECRET  — Google OAuth client secret
```

### External APIs
- **Stripe Connect**: Coach payouts, lesson payments, escrow
- **Resend**: Transactional email (verified domain: contact.boogme.com)
- **Lichess API**: Puzzles, player profiles (no auth required, rate limit 30 req/min)
- **Google OAuth**: Sign-in

### Known Bugs (as of last commit)
1. Post-payment lesson not appearing in dashboard (Sprint 1)
2. Calendar time slots not updating on date change (Sprint 2)
3. Drizzle INSERT `id` field bug — workaround with raw SQL
4. Cookie handling: `secure:true, sameSite:lax` — was causing auth loops, fixed but fragile
5. PuzzleDemo FEN parsing crash
6. Mobile booking redirect issues

---

## Lichess API Reference (for Sprint 6)

```
# Daily puzzle
GET https://lichess.org/api/puzzle/daily
→ { game: { pgn }, puzzle: { id, rating, solution, themes } }

# Puzzle by ID  
GET https://lichess.org/api/puzzle/{id}

# User profile
GET https://lichess.org/api/user/{username}
→ { id, username, perfs: { blitz: { rating }, rapid: { rating } }, count: { all } }

# Rate limit: 30 requests/minute, no auth needed
# API docs: https://lichess.org/api
```
