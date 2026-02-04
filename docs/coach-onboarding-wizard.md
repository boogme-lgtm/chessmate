# Coach Onboarding Wizard Design

## Overview

Post-approval onboarding wizard that guides new coaches from application approval to their first lesson. Target completion time: 15-20 minutes. Goal: 90%+ completion rate within 48 hours of approval.

## Onboarding Flow (7 Steps)

### Step 1: Welcome & Orientation (2 min)
**Purpose**: Set expectations and build excitement

**Content**:
- Congratulations message with coach's name
- Quick stats: "Join 200+ coaches earning $2,500-6,000/month"
- What to expect in onboarding (7 steps, 15-20 minutes)
- Key benefits reminder:
  - AI-powered student matching
  - Payment protection with escrow
  - Professional business tools
  - Marketing support
- Progress indicator: 7 steps shown at top
- CTA: "Let's Get Started" button

**Database**: No data collected, just orientation

---

### Step 2: Stripe Connect Setup (5-7 min)
**Purpose**: Enable payment processing

**Content**:
- Why Stripe Connect is required
  - "Receive payments directly to your bank account"
  - "Students pay through the platform, we handle all payment processing"
  - "Get paid within 2-7 business days after lesson completion"
- Stripe Connect onboarding button
  - Opens Stripe Connect OAuth flow in new tab
  - Returns to wizard after completion
- Status indicator: "Stripe account connected ✓" or "Connect your Stripe account"
- Skip option: "I'll do this later" (but can't go live without it)

**Technical**:
- Create Stripe Connect account link
- Handle OAuth callback
- Store `stripe_account_id` in coach profile
- Verify account status (details_submitted, charges_enabled)

**Database Fields**:
- `stripe_account_id` (string)
- `stripe_onboarding_completed` (boolean)
- `stripe_charges_enabled` (boolean)

---

### Step 3: Profile Completion (5-8 min)
**Purpose**: Create compelling public profile

**Content**:
- Profile photo upload (required)
  - Guidelines: Professional headshot, clear face, good lighting
  - Drag-and-drop or file picker
  - Image preview and crop tool
- Professional bio (150-500 words, pre-filled from application)
  - Rich text editor
  - Character counter
  - Tips: "Highlight your teaching style, achievements, and what makes you unique"
- Video introduction (optional but recommended)
  - "Coaches with video intros get 5x more bookings"
  - Upload or record 30-90 second intro
  - Guidelines: Introduce yourself, teaching approach, what students can expect
- Specializations (pre-filled from application, can edit)
  - Multi-select tags
- Target student levels (pre-filled, can edit)

**Database Fields**:
- `profile_photo_url` (string, required)
- `bio` (text, required, 150-500 chars)
- `video_intro_url` (string, optional)
- `specializations` (JSON array)
- `target_levels` (JSON array)

---

### Step 4: Availability & Scheduling (3-5 min)
**Purpose**: Set up when students can book lessons

**Content**:
- Timezone confirmation
  - Auto-detect from browser
  - Dropdown to change if needed
- Weekly availability grid
  - 7 days x 24 hours
  - Click to toggle time slots
  - Batch select: "Select all mornings (6am-12pm)"
  - Visual: Green = available, Gray = unavailable
- Minimum advance booking time
  - Dropdown: 2 hours, 4 hours, 12 hours, 24 hours, 48 hours
  - "How much notice do you need before a lesson?"
- Maximum advance booking time
  - Dropdown: 1 week, 2 weeks, 1 month, 3 months
- Buffer time between lessons
  - Dropdown: 0 min, 15 min, 30 min, 60 min
  - "Time needed between back-to-back lessons"

**Database Fields**:
- `timezone` (string, required)
- `availability_schedule` (JSON object: {monday: {morning: true, afternoon: false, ...}, ...})
- `min_advance_hours` (integer, default 24)
- `max_advance_days` (integer, default 30)
- `buffer_minutes` (integer, default 15)

---

### Step 5: Pricing & Lesson Formats (2-3 min)
**Purpose**: Set rates and lesson options

**Content**:
- Hourly rate (pre-filled from application, can edit)
  - Input field with currency symbol
  - Market guidance: "GMs typically charge $100-150/hr"
  - Note: "You can adjust this anytime"
- Lesson duration options
  - Checkboxes: 30 min, 45 min, 60 min, 90 min, 120 min
  - At least one required
  - Pricing calculator: "60-min lesson = $X"
- Lesson formats (pre-filled from application, can edit)
  - Checkboxes: One-on-one, Group lessons, Tournament prep, Opening prep, Game analysis
- Payment terms
  - Radio buttons:
    - "Pay per lesson" (default)
    - "Package discounts" (e.g., 10% off 5-lesson package)
  - If package selected, show discount percentage input

**Database Fields**:
- `hourly_rate_cents` (integer, required)
- `lesson_durations` (JSON array: [30, 60, 90])
- `lesson_formats` (JSON array)
- `package_discount_enabled` (boolean)
- `package_discount_percent` (integer, 0-30)

---

### Step 6: Platform Guidelines & Best Practices (2-3 min)
**Purpose**: Set expectations and share success tips

**Content**:
- Coach Handbook (embedded or link)
  - Communication guidelines
  - Lesson preparation tips
  - Cancellation policy (48-hour notice)
  - Refund policy (students can request refund within 24 hours if unsatisfied)
  - Code of conduct
- Success tips from top coaches
  - "Respond to booking requests within 2 hours"
  - "Prepare personalized lesson plans"
  - "Follow up after each lesson with homework"
  - "Ask for reviews from satisfied students"
- Platform features overview
  - AI matching system
  - Integrated video calling (Zoom)
  - Payment protection
  - Student management dashboard
- Checkbox: "I have read and agree to the Coach Guidelines"

**Database Fields**:
- `guidelines_agreed` (boolean, required)
- `guidelines_agreed_at` (timestamp)

---

### Step 7: Review & Go Live (2 min)
**Purpose**: Final check and activation

**Content**:
- Onboarding completion summary
  - ✓ Stripe Connect: Connected
  - ✓ Profile: Complete
  - ✓ Availability: Set
  - ✓ Pricing: Configured
  - ✓ Guidelines: Accepted
- Profile preview
  - Show how profile will appear to students
  - "Preview your profile" button (opens in new tab)
- Missing items warning (if any)
  - "⚠ You need to complete Stripe Connect before going live"
- Go Live button
  - Disabled if required steps incomplete
  - "Activate My Profile" or "Go Live"
- What happens next
  - "Your profile is now visible to students"
  - "You'll receive email notifications when students book lessons"
  - "Check your dashboard to manage bookings"

**Database Fields**:
- `onboarding_completed` (boolean)
- `onboarding_completed_at` (timestamp)
- `profile_active` (boolean)
- `profile_activated_at` (timestamp)

---

## Database Schema

### Coach Profiles Table

```sql
CREATE TABLE coach_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  application_id INT NOT NULL,
  
  -- Onboarding Progress
  onboarding_step INT DEFAULT 1, -- Current step (1-7)
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMP NULL,
  
  -- Step 2: Stripe Connect
  stripe_account_id VARCHAR(255),
  stripe_onboarding_completed BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  
  -- Step 3: Profile
  profile_photo_url TEXT,
  bio TEXT,
  video_intro_url TEXT,
  specializations TEXT, -- JSON array
  target_levels TEXT, -- JSON array
  
  -- Step 4: Availability
  timezone VARCHAR(64),
  availability_schedule TEXT, -- JSON object
  min_advance_hours INT DEFAULT 24,
  max_advance_days INT DEFAULT 30,
  buffer_minutes INT DEFAULT 15,
  
  -- Step 5: Pricing
  hourly_rate_cents INT,
  lesson_durations TEXT, -- JSON array [30, 60, 90]
  lesson_formats TEXT, -- JSON array
  package_discount_enabled BOOLEAN DEFAULT FALSE,
  package_discount_percent INT DEFAULT 0,
  
  -- Step 6: Guidelines
  guidelines_agreed BOOLEAN DEFAULT FALSE,
  guidelines_agreed_at TIMESTAMP NULL,
  
  -- Step 7: Activation
  profile_active BOOLEAN DEFAULT FALSE,
  profile_activated_at TIMESTAMP NULL,
  
  -- Stats
  total_lessons INT DEFAULT 0,
  total_students INT DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  response_time_hours INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## User Experience Flow

### Entry Point
- Coach receives approval email with "Complete Your Profile" CTA
- Email links to `/coach/onboarding` route
- Requires authentication (coach must be logged in)
- If onboarding already completed, redirect to coach dashboard

### Progress Persistence
- Save progress after each step
- Allow coaches to exit and resume later
- Show progress indicator: "Step 3 of 7"
- Auto-save draft data every 30 seconds

### Validation
- Each step has required fields
- "Continue" button disabled until requirements met
- Inline validation with helpful error messages
- Can go back to previous steps to edit

### Skip Options
- Only Step 2 (Stripe) and Step 3 (video intro) can be skipped
- Skipped steps show warning badge in progress indicator
- Can't go live without completing required steps

### Mobile Responsive
- Full wizard works on mobile
- Stripe Connect opens in mobile browser
- File uploads work on mobile camera

---

## Success Metrics

**Completion Rate**:
- Target: 90%+ complete onboarding within 48 hours
- Track drop-off at each step
- A/B test messaging and UI to improve completion

**Time to First Lesson**:
- Target: 7 days from approval to first lesson
- Measure: approval_date → first_lesson_date
- Optimize onboarding to reduce friction

**Profile Quality**:
- % with profile photo: Target 100%
- % with video intro: Target 60%+
- % with complete bio (>200 words): Target 90%+

**Stripe Connect**:
- % completing Stripe within 24 hours: Target 80%+
- % completing Stripe before going live: Target 100%

---

## Technical Implementation

### Frontend
- Multi-step wizard component (`CoachOnboardingWizard.tsx`)
- Progress indicator component
- Step components for each step
- Form validation with react-hook-form
- File upload with drag-and-drop
- Availability grid component (reusable)

### Backend
- tRPC router: `coachOnboarding`
  - `getProgress`: Get current onboarding state
  - `updateStep`: Save progress for a step
  - `createStripeAccount`: Generate Stripe Connect link
  - `handleStripeCallback`: Process OAuth return
  - `goLive`: Activate profile (final step)
- Database queries in `server/db.ts`
- Stripe Connect integration in `server/stripe.ts`

### Stripe Connect Flow
1. Coach clicks "Connect Stripe" button
2. Backend creates Stripe Connect account link
3. Opens in new tab/window
4. Coach completes Stripe onboarding
5. Stripe redirects back to `/coach/onboarding/stripe-callback?code=...`
6. Backend exchanges code for account ID
7. Store account ID and update status
8. Show success message in wizard

---

## Email Notifications

**Approval Email** (triggers onboarding):
```
Subject: Welcome to BooGMe! Complete Your Profile

Hi {name},

Congratulations! Your coach application has been approved.

You're now part of an elite community of chess coaches earning $2,500-6,000/month through BooGMe.

Next Step: Complete your profile setup (15-20 minutes)
[Complete Your Profile Button]

What's included:
✓ Stripe Connect setup for payments
✓ Profile customization
✓ Availability calendar
✓ Pricing configuration

Questions? Reply to this email.

Welcome aboard!
The BooGMe Team
```

**Onboarding Incomplete Reminder** (sent after 24 hours if not completed):
```
Subject: Complete Your Coach Profile - Start Earning

Hi {name},

You're almost there! Just a few more steps to activate your coach profile.

Current Progress: {X} of 7 steps complete

[Continue Setup Button]

Coaches who complete their profile within 48 hours get their first student 3x faster.

Need help? Reply to this email.
```

**Onboarding Complete** (sent when profile goes live):
```
Subject: Your Profile is Live! 🎉

Hi {name},

Great news! Your coach profile is now live and visible to students.

Your Profile: [View Profile Link]

What's Next:
1. Students can now book lessons with you
2. You'll receive email notifications for new bookings
3. Check your dashboard to manage lessons

Tips for Success:
• Respond to booking requests within 2 hours
• Prepare personalized lesson plans
• Ask satisfied students for reviews

Ready to get started!
The BooGMe Team
```

---

## Edge Cases

**Stripe Connect Failures**:
- If OAuth fails, show error and "Try Again" button
- If account is restricted, show message to contact Stripe
- If account needs more info, redirect to Stripe dashboard

**Incomplete Applications**:
- If coach profile already exists (shouldn't happen), redirect to dashboard
- If application not approved, show "Application pending" message

**Session Timeout**:
- Auto-save progress every 30 seconds
- If session expires, redirect to login with return URL
- After login, resume at last saved step

**Browser Back Button**:
- Allow navigation back to previous steps
- Don't lose data when going back
- Update progress indicator accordingly

---

## Future Enhancements

- Video recording directly in browser (no upload needed)
- AI-powered bio suggestions based on application
- Availability sync with Google Calendar
- Bulk availability import (CSV)
- Onboarding gamification (badges, progress bar)
- Live chat support during onboarding
- Onboarding analytics dashboard for admins
