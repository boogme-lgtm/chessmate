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
