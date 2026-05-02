# BooGMe Project TODO

## Completed
- [x] Initial website setup with Digital Grandmaster design
- [x] Hero section with AI-generated chess imagery
- [x] Features showcase section
- [x] AI Matching section with compatibility bars
- [x] Coach profiles section
- [x] Interactive gamification demo with XP, badges, ranks
- [x] Global community section
- [x] Pricing plans (Free, Premium, Pro)
- [x] Interactive Coach Finder Quiz
- [x] Rebrand from ChessMate to BooGMe
- [x] Payment Protection section with escrow system showcase
- [x] Upgrade to full-stack with database and backend
- [x] Stripe Connect Express integration for coach payouts
- [x] Database schema for coaches, students, lessons, payments
- [x] Escrow payment flow implementation
- [x] Coach onboarding with embedded Stripe form
- [x] Business model document
- [x] Email capture / waitlist functionality
- [x] Interactive puzzle demo
- [x] Coach dashboard with earnings tracking
- [x] Swiss Modern + Neo-Minimal redesign with burgundy/terracotta palette

## Launch Preparation (In Progress)
- [x] Remove inflated metrics (10K+ students, 500+ coaches, 50+ countries)
- [x] Update with realistic pre-launch numbers
- [x] Shift messaging to coach-first value proposition
- [x] Create stealth launch strategy document
- [x] Design modern tech-inspired logo (Palantir/OpenAI/xAI style)
- [ ] Reserve social media handles across platforms
- [ ] Create coach outreach email templates
- [ ] Set up analytics and tracking

## Future Features
- [ ] Coach video introductions
- [ ] Coach profile pages with booking calendar
- [ ] Student dashboard with progress tracking
- [ ] Integrate Lichess Puzzle API for real puzzles


## Logo Refinement (In Progress)
- [x] Generate logo variations with Palantir-inspired typography
- [x] Create multiple color palette options (minimalistic to modern)
- [x] Implement chosen logo variation across website
- [ ] Update favicon and social media assets


## Website Redesign - Palantir Aesthetic (In Progress)
- [x] Implement new dark mode logo across all pages
- [x] Update typography to ultra-thin Palantir-style fonts
- [x] Switch to dark mode as primary theme
- [x] Update color palette to minimalist tech-forward scheme
- [x] Add generous whitespace and clean lines
- [x] Implement subtle animations and micro-interactions
- [x] Remove inflated metrics (10K+ students, 500+ coaches)
- [x] Shift messaging to coach-first value proposition
- [x] Update hero section with realistic pre-launch messaging
- [x] Simplify navigation and layout


## Favicon and Social Media Assets (In Progress)
- [x] Generate favicon.ico (16x16, 32x32, 48x48)
- [x] Generate Open Graph image (1200x630)
- [x] Generate Twitter Card image (1200x600)
- [x] Implement favicon across website
- [x] Update Open Graph meta tags
- [x] Update Twitter Card meta tags


## Lichess Puzzle API Integration (In Progress)
- [x] Research Lichess Puzzle API endpoints and authentication
- [x] Create backend API route for fetching puzzles
- [x] Update PuzzleDemo component to use real Lichess puzzles
- [x] Add puzzle difficulty filtering
- [x] Add puzzle rating display
- [x] Test puzzle solving flow with real data

## Website Polish (In Progress)
- [x] Identify areas needing improvement
- [x] Create polish improvement plan
- [x] Phase 1: Improve hero copy for clarity
- [x] Phase 1: Add urgency messaging to waitlist
- [x] Phase 1: Enhance typography hierarchy
- [x] Phase 1: Fix spacing consistency
- [x] Phase 1: Strengthen coach value proposition
- [x] Phase 2: Create dedicated /coaches landing page
- [x] Phase 2: Add interactive earnings calculator component
- [x] Phase 2: Add onboarding flow visualization for coaches
- [x] Phase 2: Add coach FAQ section
- [x] Phase 2: Create route for /coaches page in App.tsx
- [ ] Phase 2: Expand payment protection with examples
- [ ] Phase 2: Add "How It Works" for coaches


## Bug Fixes (In Progress)
- [x] Fix puzzle FEN parsing error causing crash when opening puzzle demo
- [x] Fix student quiz flow to capture email for waitlist signup (was showing stealth mode message without email form)

## Questionnaire Enhancement (New)
- [x] Research best practices from questionnaire-based matching platforms
- [x] Design comprehensive 20-question AI-powered assessment
- [x] Remove "Try a Puzzle" demo from homepage
- [x] Replace 5-question quiz with 20-question comprehensive assessment
- [x] Implement multi-step questionnaire with progress tracking
- [x] Add AI-powered analysis and coach matching logic
- [x] Update "Find Your Coach" CTA to launch questionnaire

## Messaging Corrections
- [x] Remove Chess.com fee comparison claims from coaches page
- [x] Remove Chess.com fee comparison claims from homepage
- [x] Replace with accurate value props focusing on unique services (payment protection, AI matching, escrow)

## Cost Analysis & Financial Planning
- [ ] Research infrastructure and hosting costs for marketplace platforms
- [ ] Research video hosting and streaming costs (live lessons + content library)
- [ ] Research payment processing fees (Stripe, escrow, international)
- [ ] Research chess-specific tool costs (engines, databases, PGN processing)
- [ ] Calculate customer acquisition costs and marketing budget
- [ ] Create comprehensive cost structure document
- [ ] Perform break-even analysis for Year 1 and Year 2
- [ ] Identify cost optimization strategies

## Messaging Consistency & Branding Polish
- [x] Remove all "80-85%" or specific percentage claims from homepage
- [x] Remove all specific percentage claims from coaches page
- [x] Replace with vague "keep more of your earnings" messaging
- [x] Enhance logo visibility (increase size, improve contrast)
- [ ] Audit all pages for consistent messaging about fees
- [ ] Create comprehensive website polish checklist

## Coach Profile Design
- [x] Design three fictional coach profiles with diverse backgrounds
- [x] Generate professional headshots for each coach
- [x] Create coach profile card component
- [x] Add coach profiles section to homepage
- [ ] Test coach profile display on all devices

## Coach Filtering System
- [x] Create CoachFilters component with price, rating, and specialization controls
- [x] Implement price range slider (dual-handle for min/max)
- [x] Add rating level dropdown filter
- [x] Add specialization tag filters
- [x] Integrate filtering logic with coach profiles display
- [x] Add filter reset functionality
- [ ] Test filtering on mobile devices

## Timezone & Availability Filtering
- [x] Enhance CoachProfile interface with detailed availability data structure
- [x] Add time slot filters (morning/afternoon/evening/weekend)
- [x] Implement time slot filtering logic for availability matching
- [x] Update coach data with detailed availability schedules
- [ ] Test timezone filtering with different user timezones

## Coach Application Process
- [x] Research coaching marketplace application best practices
- [x] Design 8-10 minute application flow with clear sections
- [x] Define required fields and validation rules
- [x] Create multi-step coach application component
- [x] Add value proposition messaging throughout application
- [x] Implement progress tracking and save/resume functionality
- [x] Create database schema for coach applications
- [x] Build backend API for application submission
- [ ] Add application review/approval workflow
- [ ] Create confirmation email and next steps communication

## Admin Dashboard for Coach Applications
- [ ] Design admin dashboard layout and navigation
- [x] Create backend API endpoints for listing applications
- [x] Create backend API endpoint for getting application details
- [x] Create backend API endpoint for approving applications
- [x] Create backend API endpoint for rejecting applications
- [x] Implement admin authentication middleware
- [x] Create AdminApplicationsList component
- [x] Create ApplicationDetailView component
- [x] Create approval/rejection modal with review notes
- [x] Add status filtering (pending, under_review, approved, rejected)
- [x] Add search functionality by name/email
- [x] Create admin route at /admin/applications
- [x] Test admin dashboard functionality


## AI-Powered Instant Coach Vetting
- [x] Design AI vetting criteria (auto-approve vs human review)
- [x] Define confidence scoring system (0-100)
- [x] Create red flag detection logic (incomplete info, suspicious patterns)
- [x] Implement AI vetting service using LLM
- [x] Add structured output for vetting decisions
- [x] Update coach application submission to trigger AI vetting
- [x] Implement auto-approval flow for high-confidence applications
- [x] Route low-confidence applications to human review queue
- [x] Add vetting results to application record
- [x] Add AI vetting results display to admin dashboard
- [x] Show confidence score, red flags, and score breakdown
- [x] Display human review reason when flagged
- [ ] Test AI vetting with various application scenarios


## Coach Onboarding Wizard
- [ ] Design onboarding wizard flow (5-7 steps)
- [ ] Define completion requirements for each step
- [x] Implement Stripe Connect account creation for coaches
- [x] Add onboarding fields to coach profiles database schema
- [x] Create Stripe Connect service with account creation and linking
- [ ] Build onboarding wizard component with progress tracking
- [ ] Create Step 1: Welcome and orientation
- [ ] Create Step 2: Stripe Connect setup
- [ ] Create Step 3: Profile completion (bio, photo, video)
- [ ] Create Step 4: Availability calendar setup
- [ ] Create Step 5: Pricing and lesson formats
- [ ] Create Step 6: Platform guidelines and best practices
- [ ] Create Step 7: Review and go live
- [ ] Add onboarding progress tracking to database
- [ ] Create coach dashboard showing onboarding status
- [ ] Test complete onboarding flow


## Student Booking Flow (Priority)
- [x] Design complete booking flow (discovery → scheduling → payment → confirmation)
- [ ] Create bookings database schema
- [ ] Implement Stripe payment intent creation for lesson bookings
- [ ] Build coach detail page with full profile and booking CTA
- [ ] Create availability calendar component showing coach's open slots
- [ ] Implement lesson booking form (date/time selection, duration, notes)
- [ ] Add Stripe checkout integration for lesson payment
- [ ] Create booking confirmation page
- [ ] Build student dashboard showing upcoming/past lessons
- [ ] Add booking cancellation flow (48-hour policy)
- [ ] Implement booking status tracking (pending, confirmed, completed, cancelled)
- [ ] Test complete booking flow end-to-end


## Homepage Updates
- [x] Remove fictional coach profiles from homepage
- [x] Show empty state message when no coaches are available
- [x] Keep coach filtering and layout components for future use


## Legal Pages
- [x] Draft Privacy Policy content covering data collection and usage
- [x] Draft Terms of Service covering marketplace rules and obligations
- [x] Create Privacy Policy page component at /privacy
- [x] Create Terms of Service page component at /terms
- [x] Add legal page links to footer
- [x] Test legal pages display and formatting


## Student Booking Flow Implementation
- [x] Design bookings database schema (lessons, time slots, payments)
- [x] Create bookings table with Stripe payment tracking
- [x] Add coach availability slots table
- [x] Build backend API for creating bookings
- [x] Build backend API for Stripe payment intent creation
- [x] Build backend API for fetching coach availability
- [x] Create coach detail page at /coach/[id]
- [x] Create coach browse page at /coaches
- [x] Build availability calendar component
- [x] Build booking modal with time slot selection
- [x] Integrate Stripe checkout flow
- [x] Create student dashboard at /dashboard
- [x] Write vitest tests for booking API endpoints (8 tests passing)
- [ ] Display full coach bio, credentials, and specializations
- [ ] Build availability calendar component
- [ ] Implement time slot selection interface
- [ ] Integrate Stripe payment form
- [ ] Create booking confirmation flow
- [ ] Build student bookings dashboard at /my-bookings
- [ ] Add booking cancellation and refund logic
- [ ] Test complete booking flow end-to-end


## Email Nurture Sequence for Waitlist
- [x] Design 5-email nurture sequence strategy (30-day timeline)
- [x] Write email content for immediate confirmation (Day 0)
- [x] Write email content for Email 1: Welcome & Platform Vision (Day 2)
- [x] Write email content for Email 2: Meet the Founder & C-Squared (Day 7)
- [x] Write email content for Email 3: How AI Matching Works (Day 14)
- [x] Write email content for Email 4: Payment Protection Deep Dive (Day 21)
- [x] Write email content for Email 5: Launch Countdown & Early Access (Day 28)
- [ ] Implement email service integration using built-in notification system
- [ ] Create automated email scheduling system
- [ ] Add email templates to database
- [ ] Trigger confirmation email on waitlist signup
- [ ] Schedule nurture sequence emails automatically
- [ ] Test complete email flow end-to-end


## Waitlist UX Improvements
- [x] Fix backend duplicate email error handling to send proper error message
- [x] Update frontend to show friendly toast for duplicate emails

## Admin Waitlist Management
- [x] Create backend API endpoint to fetch all waitlist entries
- [x] Create admin waitlist management page at /admin/waitlist
- [x] Add CSV export functionality
- [x] Add admin authentication check

## Email Unsubscribe System
- [x] Add unsubscribed field to waitlist database schema
- [x] Create backend unsubscribe endpoint
- [x] Add unsubscribe links to all email templates
- [x] Create unsubscribe confirmation page
- [x] Update email scheduler to skip unsubscribed users
- [x] Test complete unsubscribe flow

## Email Template Updates
- [x] Replace pawn emoji with BooGMe logo in all email templates
- [x] Create test email broadcast functionality for all subscribers
- [x] Send test email to verify logo appears correctly

## Unsubscribe Link Fix
- [ ] Fix unsubscribe URLs to use correct domain instead of localhost
- [ ] Test unsubscribe functionality with correct URL

## Publishing Preparation
- [x] Verify all features are working correctly
- [ ] Create final pre-publish checkpoint
- [ ] Guide user through Manus publish process
- [ ] Configure boogme.com domain with GoDaddy DNS
- [ ] Set VITE_FRONTEND_URL environment variable
- [ ] Test published website and email links

## Domain Configuration
- [x] Set VITE_FRONTEND_URL environment variable to https://boogme.com
- [x] Verify unsubscribe links work with published domain

## Payment System Development
- [x] Design database schema for bookings, payments, and escrow
- [x] Implement Stripe Connect for coach payouts
- [ ] Create coach onboarding flow with Stripe Connect
- [ ] Build booking system with time slot selection
- [ ] Implement Stripe checkout for lesson payments
- [ ] Create escrow hold and release system
- [ ] Add lesson confirmation flow (both parties confirm)
- [ ] Implement 24-hour dispute window
- [ ] Build package deal system with per-lesson escrow release
- [ ] Add cancellation policy logic (>24hrs, <24hrs, no-show)
- [ ] Implement tiered platform fees (15%, 10%, 5%)
- [ ] Add payment processing fee handling by tier
- [ ] Create coach payout dashboard
- [ ] Test complete payment flow end-to-end

## Student Quiz Flow Fix
- [ ] Add email capture form to quiz completion/results page
- [ ] Connect email to waitlist signup endpoint
- [ ] Test complete quiz flow with email capture

## Recent Changes (In Progress)
- [x] Simplify student quiz email capture to only require email (remove name field)

## Student Booking Flow - Complete Implementation (In Progress)
- [x] Verify bookings database schema is complete
- [x] Create backend API: Create booking with Stripe payment intent
- [x] Create backend API: Get coach availability slots
- [x] Create backend API: Get student's bookings
- [x] Build coach detail page at /coach/[id] with full profile
- [ ] Add route for coach detail page in App.tsx
- [ ] Create availability calendar component showing open time slots
- [ ] Build booking form with date/time selection and lesson details
- [ ] Implement Stripe checkout integration for lesson payment
- [ ] Create booking confirmation page with next steps
- [ ] Build student dashboard at /dashboard showing upcoming/past lessons
- [ ] Add booking cancellation flow (48-hour policy)
- [ ] Test complete booking flow end-to-end
- [ ] Write vitest tests for booking API endpoints

### Testing & Sample Data (Completed)
- [x] Create three sample coach profiles with varied availability (GM Elena Petrov, IM Carlos Rodriguez, FM Sarah Chen)
- [x] Test booking modal and calendar display
- [x] Verify UI components render correctly (modal, calendar, time slots)
- [x] Backend API tests passing (8/8 tests)
- [ ] Complete end-to-end booking test with authenticated user (requires OAuth login)
- [ ] Verify Stripe checkout with real test payment (requires authenticated session)t works with test payment methods

## Stripe Webhook Integration (In Progress)
- [ ] Create webhook endpoint at /api/stripe/webhook
- [ ] Handle checkout.session.completed event
- [ ] Handle payment_intent.succeeded event
- [ ] Handle payment_intent.payment_failed event
- [ ] Update booking status when payment succeeds
- [ ] Test webhook with Stripe CLI
- [ ] Configure webhook in Stripe Dashboard


## Stripe Webhook Integration
- [x] Create webhook handler code in server/stripe.ts
- [x] Add database helpers for booking status updates
- [x] Register webhook endpoint in Express server (POST /api/stripe/webhook)
- [x] Write tests for webhook endpoint (2 tests passing)
- [ ] Configure webhook endpoint URL in Stripe Dashboard
- [ ] Test complete payment flow with webhook confirmation

## Sample Coach Setup for Testing
- [x] Add Stripe Connect account IDs to sample coaches (GM Elena Petrov, IM Carlos Rodriguez, FM Sarah Chen)
- [x] Mark sample coaches as having completed payment onboarding


## UX Improvements - Coach Discovery
- [x] Add "Browse Coaches" link to homepage hero section
- [x] Add "Browse Coaches" to main navigation header
- [x] Make coach browsing the primary CTA (assessment as secondary option)
- [x] Update homepage messaging to clarify assessment is optional


## Stripe Connect Test Fix
- [x] Update checkout creation to handle test bookings without real Stripe Connect accounts
- [x] Add conditional logic to skip Connect transfers for mock coach accounts
- [ ] Test complete booking flow with fixed payment handling


## Stripe Checkout Redirect Fix
- [x] Update success_url and cancel_url to use production domain instead of localhost
- [ ] Test payment flow with corrected redirect URLs


## Payment Success/Cancel Pages
- [x] Create LessonPaymentSuccess page component
- [x] Create LessonPaymentCancel page component  
- [x] Add routes for /lessons/:id with payment query params
- [ ] Test complete booking flow with success/cancel redirects


## Payment Success Page UX Fixes
- [x] Remove automatic redirect from payment success page
- [x] Let users manually navigate via buttons instead of forced redirect


## Booking Calendar UX Improvements
- [x] Add "Next Available" button to jump to next open time slot
- [x] Implement logic to find next available slot across multiple days
- [x] Update calendar UI to highlight and scroll to next available slot


## Custom Authentication System (Replace Manus OAuth)
- [x] Design database schema for email/password authentication
- [x] Implement password hashing with bcrypt
- [x] Create registration endpoint with validation
- [x] Build email confirmation token system
- [x] Create email verification endpoint
- [x] Implement login endpoint with JWT session management
- [x] Build password reset flow (forgot password)
- [x] Create Register page UI
- [x] Create Sign In page UI
- [x] Create email confirmation page UI
- [x] Send verification email on registration
- [x] Send welcome email after confirmation
- [x] Update all auth-protected routes to use new system
- [x] Remove Manus OAuth dependencies
- [x] Fix email sender domain (Resend sandbox)
- [ ] Test complete registration flow
- [ ] Test login flow
- [ ] Test password reset flow

## Mobile Booking Bug Fix
- [ ] Debug mobile booking redirect issue
- [ ] Fix redirect to payment link on mobile
- [ ] Test mobile booking flow end-to-end

## Production Issues (Urgent)
- [x] Fix email "Forbidden" error on published site
- [x] Investigate why email fix didn't deploy to production - was using sandbox domain instead of verified contact.boogme.com
- [x] Fix "Not Secure" HTTPS warning on boogme.com - added automatic HTTPS redirect
- [x] Improved HTTPS redirect to handle multiple protocol detection methods
- [ ] Ensure RESEND_API_KEY is set in production environment

## HTTPS Redirect Fix
- [x] Add client-side HTTPS redirect as backup (server-side not working with Manus platform)

## Email Domain Fix (Critical)
- [x] Change email sender from noreply@boogme.com to noreply@contact.boogme.com (verified domain) - already correct in code

## Email Sender Domain Investigation (Critical)
- [x] Find where email sender is being overridden to use boogme.com instead of contact.boogme.com - Found in server/email.ts
- [x] Check if there's an environment variable setting the email sender - Not an env var issue
- [x] Check auth.ts registration function for hardcoded email sender - auth.ts imports from email.ts which had wrong domain

## Mobile Navigation Fixes (User Reported)
- [x] Add "Limited spots for founding members" badge to mobile waitlist page - improved visibility with whitespace-nowrap and full width on mobile
- [x] Add back button/navigation header to coaches page
- [x] Ensure hamburger menu is available on all pages for mobile navigation

## Logo Fix (User Reported)
- [x] Fix broken logo image in CoachBrowse navigation header - updated to use correct CDN URL
- [x] Fix badge text visibility issue - "Limited spots" text invisible on some iOS devices
- [x] Fix badge text visibility with alternative approach (inline styles, font-weight 500, text shadow)
- [x] Verify Android rendering compatibility for all pages
- [x] Swap "Browse Coaches" with "Take AI Assessment" in navigation priority
- [x] Create welcome popup on page load asking "Are you a student or coach?"
- [x] Route popup responses to appropriate AI assessment flow
- [x] Fix welcome popup routing - now opens assessment modal instead of routing to 404
- [x] Add engaging animations to welcome popup (backdrop fade, modal scale, staggered buttons, icon hover)
- [x] Fix React.Children.only error - removed asChild prop and wrapped content in motion.div
- [x] Fix authentication redirect loop - now redirects back to coach page after login
- [x] Preserve intended destination - stored in localStorage through verification flow
- [x] Ensure session/cookies persist - auth.me.invalidate refreshes user state
- [x] Fix auth state not refreshing - changed invalidate() to await refetch() before redirect
- [x] Add loading indicator to SignIn page - full screen overlay with spinner and message
- [x] Add loading overlay to Register page - full screen with spinner
- [x] Create minimal user menu component - clean dropdown with user name
- [x] Integrate user menu into navigation - desktop and mobile
- [x] Fix OAuth redirect URI error - changed to navigate to /sign-in page instead of direct OAuth
- [x] Test complete sign-in flow - found logout bug, user stays logged in
- [x] Fix logout - clearSessionCookie matches setSessionCookie HTTPS detection
- [x] Fix session persistence - login succeeds and user stays logged in
- [x] Fix sign-in loop - changed cookie to secure:true sameSite:none
- [x] Add Google OAuth sign-in button to sign-in page
- [ ] Fix logout - still not clearing session cookie properly
- [x] Added force logout endpoint at /api/force-logout
- [ ] Test sign-in and logout with sameSite:lax secure:true
- [x] Fixed cookie name mismatch - authRouter used "session" but SDK expected "app_session_id"
- [x] Fixed JWT payload mismatch - authRouter now creates {openId, appId, name} payload
- [x] Improved force-logout with redirect and cache-control headers
- [x] Fixed sign-in loop - use local_ID for email users
- [x] Fixed render-phase navigation in StudentDashboard causing sign-in loop
- [x] Fixed: SignIn now waits for user data fetch before redirect
- [x] Root cause found: React Query cache not propagating
- [x] Fix logout to verify auth state cleared before redirect
- [ ] Revert fetch() to refetch() with 100ms delay in SignIn and UserMenu
- [ ] Test sign-in with jen@chimaeric.com / testtestA1
- [ ] Test logout functionality

## Fixed Auth Bugs (2026-02-10)
- [x] Fix logout not working properly (upsertUser required non-null openId)
- [x] Fix sign-in failing to load user data after authentication
- [x] Root cause: email/password users have openId=null, but upsertUser() required non-null openId
- [x] Solution: Use synthetic openId (local_123) when upserting email/password users

## Navigation Issues (2026-02-10)
- [ ] Fix sign-in redirect - should stay on current page, not auto-redirect to dashboard
- [ ] Add Home button to dashboard navigation to return to main page

## Authentication Issues
- [x] Fix Google OAuth redirect (now working correctly)
- [ ] Consider adding additional auth methods (Apple, Magic Link, etc.)

## New Features & Improvements
- [x] Add show/hide password toggle to all password input fields (sign-in, register, reset password)
- [ ] Improve student dashboard with real functionality and data
- [ ] Improve coach dashboard with real functionality and data

## Phase 1 - Dashboard Improvements (In Progress)
- [x] Update database schema for lesson statuses (pending_confirmation, confirmed, completed, cancelled, declined, no_show)
- [x] Add booking confirmation flow (coach Accept/Decline buttons)
- [ ] Add lesson status badges to student dashboard
- [ ] Add cancel/reschedule buttons with 24hr countdown timer
- [ ] Show "Pending Confirmation" state in student dashboard
- [ ] Implement coach confirmation UI in coach dashboard
- [x] Add coach stats display (total lessons, avg rating)
- [ ] Fix past lesson statuses (show Completed/Cancelled/No-show instead of Pending Payment)
- [ ] Test all Phase 1 features in browser

## Future Phases
### Phase 2 - Reviews & Ratings
- [ ] Airbnb-style mutual review system (hidden until both submit)
- [ ] Written reviews with star ratings
- [ ] Review categories (Communication, Teaching, Punctuality)
- [ ] Display reviews on coach profiles

### Phase 3 - Communication & Materials
- [ ] In-app messaging per lesson
- [ ] Upload/download PGN files
- [ ] Coach notes functionality
- [ ] Pre-lesson prep materials section

### Phase 4 - Automation & Notifications
- [ ] Auto-decline after confirmation deadline
- [ ] Email notifications (confirmation requests, review reminders, cancellation deadline)
- [ ] Lesson stats and analytics

## Phase 3: Group Lessons (Future)
- [ ] Design group lesson database schema (groupLessons, participants tables)
- [ ] Add "Book Group Lesson" option to coach profiles
- [ ] Implement organizer booking flow (set participant count 2-6)
- [ ] Create shareable invite links for group participants
- [ ] Implement payment splitting logic (total price / participants)
- [ ] Add participant management UI (track who joined, payment status)
- [ ] Update coach dashboard to show group lesson bookings
- [ ] Add coach settings for group lesson pricing tiers
- [ ] Implement AI-compiled group reviews (aggregate all participant feedback)
- [ ] Add "My Group Lessons" section to student dashboard (organized vs joined)
- [ ] Handle participant dropouts >24hrs (auto-refund, recalculate splits)


## Critical Bug Fixes from User Testing (Feb 12, 2026)
- [x] Fix timezone selector stuck on Los Angeles in coach application (now editable dropdown with 50+ timezones)
- [x] Add scroll functionality to country selector in coach application (converted to scrollable Select with 50+ countries)
- [x] Remove minimum word count restrictions from all text boxes in coach application (removed all word count validations)
- [x] Simplify background check consent UI (changed wording from "background check" to "verification", made less intimidating)
- [x] Add clear messaging for Google OAuth verification code (added "Check your email inbox" message)
- [x] Add "Coach" or "Student" label to dashboard header for role clarity (added role badges to both dashboards)
- [ ] Simplify terms of service consent UI (improve button/checkbox visibility) - needs further testing
- [ ] Make dashboard UI more role-specific (different layouts for coach vs student) - partially done with badges
- [ ] Fix "Book Lesson" payment error for students (investigate payment flow bug) - needs testing with real accounts
- [ ] Test both student and coach accounts with provided credentials


## CRITICAL: Booking Flow Database Fix (Feb 15, 2026)
- [x] Rolled back to checkpoint adfedf8 before breaking changes
- [x] Fixed database INSERT error using raw SQL to bypass Drizzle's id field handling
- [x] Updated fictional coaches to have 1-hour minimum advance booking (was 24 hours)
- [ ] Calendar date selection appears to work but time slots not updating correctly - needs manual testing
- [ ] Complete end-to-end booking flow test with payment

**Root Cause:** Drizzle ORM was including `id` field in INSERT statement with value "default", which MySQL rejects. Fixed by using raw SQL with mysql2 directly.

**Next Steps:**
1. Test booking flow manually with your test accounts (jen@chimaeric.com / cchirila@saintlouischessclub.org)
2. Select a future date (Feb 16 or later) and verify time slots appear
3. Click a time slot and verify modal advances to booking details
4. Click "Continue to Payment" and verify Stripe checkout opens
5. Complete payment with test card 4242 4242 4242 4242

## Post-Payment Issues (Critical)
- [x] Fix lesson detail page showing "Lesson not found" after payment
- [x] Fix lessons not appearing in student dashboardt dashboard after booking
- [ ] Investigate why lesson query fails after payment redirect

## Email Notifications & Reminder System (Priority)
- [x] Design booking confirmation email templates (student + coach)
- [x] Implement booking confirmation emails in webhook handler
- [x] Design 24-hour reminder email templates with cancellation links
- [x] Create automated reminder scheduler (check every hour for upcoming lessons)
- [x] Implement lesson cancellation endpoint with refund logic
- [x] Add cancellation policy enforcement (>48hrs full, 24-48hrs partial, <24hrs none)
- [ ] Create cancellation confirmation email templates
- [ ] Test complete notification flow end-to-end
- [x] Add reminder clock/countdown UI component for students and coaches

## 3-Step Flow Build (March 17, 2026)

### Step 1: Automated 24-Hour Reminder Scheduler
- [x] Create server-side cron job that runs every hour
- [x] Query lessons scheduled 20-28 hours from now that haven't had reminder sent
- [x] Send 24-hour reminder email to student with lesson details + cancellation link
- [x] Send 24-hour reminder email to coach with lesson details
- [x] Mark lesson as reminder_sent in database to prevent duplicate sends
- [x] Add reminderSentAt column to lessons table
- [x] Register cron job in server startup

### Step 2: Cancellation Confirmation Dialog + Countdown Timer
- [x] Build CancellationDialog component with refund breakdown
- [x] Show exact refund amount based on time until lesson (>48h=100%, 24-48h=50%, <24h=0%)
- [x] Add countdown timer showing time remaining until lesson on each lesson card
- [x] Add "time to cancel with full refund" countdown on lesson cards
- [x] Wire Cancel button to open dialog instead of firing immediately
- [x] Show cancellation confirmation email will be sent

### Step 3: Cristian's Coach Profile
- [ ] Navigate to /coach/apply and complete the application as Cristian
- [ ] Verify AI vetting auto-approves the application
- [ ] Confirm coach profile appears in /coaches browse page
- [ ] Test booking flow against Cristian's coach profile

## Sprint 10: Coach Dashboard Link + Email Funnel (April 20, 2026)
- [x] Add conditional "Coach Dashboard" link to UserMenu dropdown (visible for userType coach/both)
- [x] Email notification on coach Go Live: welcome email to coach via Resend
- [x] Email notification on coach Go Live: owner notification via notifyOwner helper
- [x] Fire-and-forget email sends (Promise.allSettled, never blocks Go Live)

## Sprint 11: Unified Dashboard + Context-Aware Navigation (April 21, 2026)
- [x] Create unified Dashboard.tsx at /dashboard with role switcher (Student/Coach toggle for "both" users)
- [x] Extract StudentDashboardContent and CoachDashboardContent as reusable components
- [x] Redirect /coach/dashboard → /dashboard
- [x] Collapse UserMenu "Coach Dashboard" + "My Bookings" into single "Dashboard" link
- [x] Rename DashboardLayout sidebar "My Lessons" → "Dashboard"
- [x] Make /for-coaches page redirect logged-in coaches to /dashboard
- [x] Homepage nav: "For Coaches" → "My Dashboard" for logged-in coaches (desktop + mobile)

## Sprint 12: Smart userType Promotion (April 21, 2026)
- [x] Go Live: promote student→both if they have lesson bookings, otherwise student→coach
- [x] Lesson booking: promote coach→both on first student booking
- [x] Manual DB fix: updated Cristian + 3 test coaches from coach→both

## Sprint 13: Dashboard Fixes + Design Alignment (April 21, 2026)
- [x] Fix: Coach dashboard showing student lessons at the bottom (data leak between views)
- [x] Fix: Payout Status card should have actionable Stripe Connect onboarding link instead of just "Pending Setup"
- [x] Design: Align coach dashboard UX with the editorial dark aesthetic of the rest of the site
- [x] Design: Align student dashboard UX with the editorial dark aesthetic of the rest of the site

## Sprint 14: Country Selector Fix
- [x] Replace free-text country input with searchable country dropdown in coach application form
- [x] Store ISO 3166-1 alpha-2 country codes instead of full country names
- [x] Update any other forms that collect country (profile edit) to use the same selector

## Sprint 15: Phase 2 Completion (April 26, 2026)

### Task 1: Settings Page
- [x] Create Settings page at /settings with profile editing (name, bio, country, timezone)
- [x] Password change with current password verification (hidden for Google OAuth users)
- [x] Notification preference toggles (booking, reminders, reviews, marketing) saved as JSON on user record
- [x] Danger zone with soft-delete account + password confirmation dialog
- [x] Add Settings link to DashboardLayout sidebar navigation
- [x] Add notificationPreferences and deletedAt columns to users table

### Task 2: Dashboard Design Refinement
- [x] Role switcher → pill-shaped segmented control with bg-ink-deep / bg-ember active state
- [x] Stat cards → text-3xl font-bold font-mono tabular-nums with hover states and semantic colors
- [x] Payout status card → animated dot indicators (green pulse for active, amber for pending)
- [x] Lesson rows → ember left accent border (border-l-2 border-ember)
- [x] Empty states → larger padding, muted icons, better copy + CTAs

### Task 3: Coach Referral System
- [x] Create referral_codes and referrals database tables in schema
- [x] Add tRPC procedures: referral.generateCode, getMyCode, validateCode, recordSignup
- [x] Coach dashboard "Invite Students" card with copy/share buttons and referral stats
- [x] /ref/:code route → stores code in localStorage, redirects to homepage with toast
- [x] ReferralLanding page component

### Verification
- [x] 26/26 tests passing
- [x] tsc --noEmit clean (0 errors)
- [x] pnpm build clean
- [x] Database migration applied (referral tables, notification prefs, deletedAt)

## Sprint 16: Homepage v2 Redesign (YC Framework)
- [x] Extract BgMark into standalone component
- [x] Create QuizResultMockup component (replaces HeroScene3D)
- [x] Rewrite HeroV2 with shimmer animation + new copy
- [x] Add SocialProofBar (founding-coach beta)
- [x] Add ProblemStatement (3-column)
- [x] Update Features 03 + 04 (messaging + PPV content)
- [x] Add TestimonialBlockV2 (founding principle)
- [x] Add CoachDashboardPreview (dark section)
- [x] Add FoundersBlock (Cristian Chirila, dark section)
- [x] Add PricingTable (3-tier)
- [x] Add ClosingCTA (full-bleed)
- [x] Apply dark section background fix (Footer, dark sections)
- [x] Remove deprecated sections (PaymentProtection, ForCoaches)
- [x] Verify build + tests pass

## Sprint 17: Homepage Design Fixes (Claude Design Board Alignment)
- [x] Restore hero 3D mouse-tracker shadow effect on QuizResultMockup
- [x] Improve ProblemStatement section to match design board (more visual weight, editorial feel)
- [x] Fix section order: remove misplaced early CTA, ensure natural flow
- [x] Add Onboarding quiz section (20 questions / 8 minutes / One perfect match + live quiz mockup)
- [x] Replace coach filter UI with 3-card match results (match scores, coach details, Book a Trial Lesson CTAs)
- [x] Upgrade CoachDashboardPreview with full browser-chrome mockup (sidebar, stats, upcoming lessons)

## Sprint 18: Navigation & Auth UX Fixes
- [x] Fix "For Coaches" nav button — changed from /coaches to /for-coaches (coach recruitment landing)
- [x] Fix /coach/onboarding auth redirect loop — replaced hard redirect with inline auth gate (sign in / create account / back to home)

## Sprint 19: Security Remediation (Codex GPT-5.5 Audit)
- [x] P0-1: Fix webhook — confirmed lessons must transition to paid on checkout.session.completed
- [x] P0-2: Require status=paid + stripePaymentIntentId for lesson.confirmCompletion
- [x] P1-1: Remove pricingTier from client-controllable coach.updateProfile
- [x] P1-2: Verify Stripe PaymentIntent server-side for content.recordPurchase
- [x] P1-3: Dependency audit — resolve critical/high advisories
- [x] P2-1: Require password for account deletion on password-backed accounts
- [x] P2-2: Bind referral.recordSignup to authenticated user (remove public userId param)

## Sprint 20: Security Patches Round 2 (Codex Review)
- [x] R2-1: payment.createCheckout guard — require lesson.status === 'confirmed'
- [x] R2-2: webhook checkout.session.completed — only transition confirmed → paid, reject all others
- [x] R2-3: Harden content.recordPurchase — hard metadata requirements, amount/currency verify, DB unique constraint
- [x] R2-4: Harden referral.recordSignup — duplicate prevention with uniqueness constraint
- [x] R2-5: Replace shallow string tests with behavioral tests
- [x] R2-6: Run pnpm audit --prod and capture exact output

## Sprint 21: Security Patches Round 3 (Codex Review)
- [x] R3-1: Upgrade axios to >=1.13.5, regenerate lockfile, verify audit
- [x] R3-2: Make lesson checkout creation idempotent (DB-side guard)
- [x] R3-3: Update audit-report.md with accurate post-fix audit results
- [x] R3-4: Replace source-string tests with behavioral tRPC procedure tests

## Sprint 22: Security Patches Round 4 (Codex Review)
- [x] R4-1: Handle completed checkout sessions without clearing (return PRECONDITION_FAILED)
- [x] R4-2: Add DB-level atomic guard + Stripe idempotency key to prevent concurrent duplicate sessions
- [x] R4-3: Add behavioral tests for completed session and concurrent race scenarios

## Sprint 23: Security Patches Round 5 (Codex Review)
- [x] R5-1: Fix CAS column name to use Drizzle schema reference instead of raw string
- [x] R5-2: Treat __pending__ as in-progress (no Stripe retrieve, no clear, return CONFLICT)
- [x] R5-3: Add version component to idempotency key for safe re-checkout after expiry
- [x] R5-4: Add behavioral tests for all required scenarios

## Sprint 24: Security Patches Round 6 (Codex Review)
- [x] R6-1: Make clearLessonCheckoutSession return new checkoutAttempt value
- [x] R6-2: Use returned attempt value in createCheckout idempotency key (not stale in-memory value)
- [x] R6-3: Add behavioral test for expired session using incremented attempt in idempotency key

## Sprint 25: Security Patches Round 7 (Codex Review)
- [x] R7-1: Add clearLessonCheckoutSessionIfMatches (conditional atomic clear with WHERE session = expected)
- [x] R7-2: Update createCheckout to use conditional clear and handle 0-row result (re-read + CONFLICT)
- [x] R7-3: Add behavioral tests for concurrent expired-session race

## Sprint 26: Security Patches Round 8 (Codex Review)
- [x] R8-1: Distinguish transient Stripe errors from resource-not-found in createCheckout catch block
- [x] R8-2: Add behavioral tests for transient error and missing/invalid session paths

## Sprint 27: Payment Model Redesign — Protected Checkout + Delayed Coach Payout
- [x] PM-1: Audit existing codebase (schema, booking, payment, webhooks, coach actions, completion, frontend)
- [x] PM-2: DB schema migration — new status enum (pending_payment, payment_collected, confirmed, declined, cancelled, completed, disputed, released, refunded), payout columns, issue window fields
- [x] PM-3: Backend — booking creates pending_payment, createCheckout from pending_payment, webhook marks payment_collected, notify coach
- [x] PM-4: Backend — coach accept (payment_collected → confirmed), coach decline (→ refund + declined), confirmation deadline expiry (→ refund)
- [x] PM-5: Backend — completion starts 24h issue window, dispute handling, payout release after window
- [x] PM-6: Backend — admin resolution (release payout, full/partial refund), refund rules
- [x] PM-7: Frontend — booking flow, dashboard labels, checkout copy, coach request UI, terminology updates
- [x] PM-8: Email templates and notification copy updates
- [x] PM-9: Behavioral tests for all 15 required scenarios
- [x] PM-10: Verification, Stripe architecture documentation, migration mapping

## Sprint 28 — Payment-First Model Hardening (Completed)
- [x] S28-1: declineAsCoach — Stripe failure must NOT silently succeed; throw INTERNAL_SERVER_ERROR, leave in payment_collected, flag for admin
- [x] S28-2: confirmCompletion — require lesson end time + 15min grace to have passed before student can confirm
- [x] S28-3: releasePayout — enforce issueWindowEndsAt <= now, atomic CAS, Stripe idempotency key, admin override for disputed
- [x] S28-4: autoDeclineStaleBookings — process payment_collected (not just pending_confirmation), full Stripe refund, no silent failure
- [x] S28-5: autoCompletePastLessons — always set issueWindowEndsAt = now + 24h on completion (both confirmed and legacy paid)
- [x] S28-6: Behavioral tests for all 5 scenarios above (101 tests passing, 0 failures)
## Sprint 29 — Atomic Settlement Hardening (Completed)
- [x] S29-1: Atomic coach accept/decline CAS — claimLessonCoachDecision(lessonId, to='confirmed'|'decline_pending'), no email until state transition won
- [x] S29-2: Race-safe autoDeclineStaleBookings — atomically claim row to decline_pending BEFORE calling Stripe; skip if CAS returns 0 affectedRows
- [x] S29-3: Shared settlement guard — refundStudent rejects if stripeTransferId = '__pending_payout__' (CONFLICT) or real transfer ID (PRECONDITION_FAILED)
- [x] S29-4: Hardened student cancellation — claimLessonCancellation CAS, throw on Stripe failure, releaseCancellationWithRefundFailed, no false success
- [x] S29-5: Recovery scan for stuck pending states — recoverStuckPendingStates() in scheduler handles decline_pending and __pending_payout__ after crash
- [x] S29-6: Behavioral tests for all 5 scenarios — 118 tests passing, tsc clean (exit 0)
- [ ] S29-AUDIT: pnpm audit high vulns — path-to-regexp (express@4 transitive, ReDoS), lodash (recharts/streamdown transitive, code injection via _.template) — no fix available without major upgrades; document as known risk
## Sprint 30 — Final Payment Settlement Hardening (Completed)
- [x] S30-1: Atomic admin refund vs payout — claimLessonRefundSlot CAS before Stripe call; CONFLICT if payout wins; releases claim on Stripe failure
- [x] S30-2: Recovery refund amounts — cancel_pending uses stored refundAmountCents (not full); deterministic idempotency keys for all recovery refunds
- [x] S30-3: Disable legacy lesson.requestRefund — throws METHOD_NOT_SUPPORTED; post-payout refunds require transfer reversal (not yet implemented)
- [x] S30-4: claimLessonCancellation allowlist — only pending_payment, payment_collected, confirmed; all other statuses blocked
- [x] S30-5: Behavioral tests for all 4 scenarios — 137 tests passing, tsc --noEmit exits 0

## Sprint 31 — Pending-Refund Settlement Cleanup (Completed)
- [x] S31-1: Fix recovery query — refundAmountCents added to SELECT in recoverStuckPendingStates()
- [x] S31-2: Deterministic idempotency keys on first attempts — declineAsCoach: lesson_decline_refund_{id}, cancel: lesson_cancel_refund_{id}, autoDecline: lesson_decline_refund_{id}
- [x] S31-3: releasePayout rejects __pending_refund__ with CONFLICT; only real transfer IDs return alreadyReleased=true
- [x] S31-4: Recovery for stuck __pending_refund__ — claimLessonRefundSlot stores refundAmountCents before Stripe; recovery retries with stored amount + idempotency key; finalizes on success; releases slot on retryable failure
- [x] S31-5: Behavioral tests for all 4 scenarios — 146 tests passing, tsc --noEmit exits 0

## Sprint 32 — Cancel_pending Recovery Edge (Completed)
- [x] S32-1: cancel_pending with refundAmountCents=0 recovers to cancelled without calling Stripe
- [x] S32-2: cancel_pending with Stripe failure finalizes to cancelled+refund_failed (not payment_collected)
- [x] S32-3: decline_pending failure behavior unchanged — returns to payment_collected for admin retry
- [x] S32 tests: 149 tests passing, tsc --noEmit exits 0

## Sprint 33 — Auto-Release Payout Cron (Completed)
- [x] S33-1: Extract shared releaseLessonPayoutToCoach helper to server/payoutService.ts — all safety guards preserved
- [x] S33-2: Refactor admin.disputes.releasePayout to use shared helper — no duplicate money-moving logic
- [x] S33-3: Add autoReleasePayouts() to reminderScheduler — runs every 30 min, env flag AUTO_RELEASE_PAYOUTS_ENABLED, overlap guard
- [x] S33-4: 7 behavioral tests in server/autoReleasePayout.test.ts — eligible payout, window not expired, disputed skipped, __pending_refund__ blocks, Stripe failure releases slot, multi-lesson continues after failure, disabled flag skips
- [x] S33-5: 156 tests passing, tsc --noEmit exits 0

## Sprint 34 — Payout Override Scope Fix (Completed)
- [x] S34-1: Fix releasePayout — read lesson once in router; skipIssueWindowCheck = isDisputed && hasOverrideReason (not just hasOverrideReason)
- [x] S34-2: completed lesson inside window + adminOverrideReason still rejects (PRECONDITION_FAILED)
- [x] S34-3: disputed lesson without adminOverrideReason rejects (BAD_REQUEST)
- [x] S34-4: disputed lesson with adminOverrideReason skips window check and succeeds
- [x] S34-5: autoReleasePayouts never passes skipIssueWindowCheck — 160 tests passing, tsc --noEmit exits 0
## Sprint 35 — Service-Owned Override Decision (Completed)
- [x] S35-1: Remove skipIssueWindowCheck from PayoutReleaseInput — service computes skipWindow from its own lesson read
- [x] S35-2: Service logic: skipWindow = lesson.status === "disputed" && !!adminOverrideReason?.trim()
- [x] S35-3: Completed lessons always enforce issueWindowEndsAt regardless of adminOverrideReason
- [x] S35-4: Disputed lessons without adminOverrideReason return precondition failure
- [x] S35-5: Router simplified — passes adminOverrideReason directly, no local skipIssueWindowCheck computation
- [x] S35-6: 4 behavioral tests (S35-1 through S35-4): completed+override rejects, disputed+override succeeds, stale-read race rejects, autoRelease never skips window
- [x] S35-7: 164 tests passing, tsc --noEmit exits 0
## Sprint 36 — Student "Confirm Lesson Complete" Button (Completed)
- [x] S36-1: Confirm Lesson Complete button — only shown for status="confirmed" AND now >= scheduledAt + durationMinutes + 15 min grace
- [x] S36-2: Button calls lesson.confirmCompletion({ lessonId }); on success invalidates myLessons cache and shows 24-hour issue window toast
- [x] S36-3: Issue window banner — shown on completed lessons while issueWindowEndsAt is in the future; shows window close time
- [x] S36-4: Issue window expired banner — shown when issueWindowEndsAt has passed; confirms coach payout released
- [x] S36-5: Raise Issue button — shown only during active issue window; opens dialog with reason textarea; calls lesson.raiseIssue
- [x] S36-6: Terminal statuses (payment_collected, completed, disputed, released, cancelled, declined, refunded, no_show) never show Confirm Complete button
- [x] S36-7: 20 behavioral tests in server/sprint36.test.ts (S36-1 through S36-8); 184 tests passing, tsc --noEmit exits 0
## Sprint 36 Patch — Time-gated UI refresh + banner copy fix
- [x] P36-1: Add `now` interval state (30s) to LessonCard; use for canConfirmComplete, issueWindowActive, issueWindowExpired, canCancel/hoursUntilLesson
- [x] P36-2: Extract pure helpers into shared/lessonTimeHelpers.ts: getLessonEndWithGrace(), canConfirmLessonComplete(), getIssueWindowState(), canRaiseIssue() — testable with fixed dates
- [x] P36-3: Fix expired issue-window banner: completed+expired → "eligible for release"; added separate released banner → "coach payout has been released"
- [x] P36-4: 39 unit tests in server/lessonTimeHelpers.test.ts covering getLessonEndWithGrace, canConfirmLessonComplete (all statuses + grace boundary), getIssueWindowState (all statuses + active/expired/released), canRaiseIssue, and all three banner scenarios
