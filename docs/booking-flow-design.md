# Student Booking Flow Design

## Overview

Complete end-to-end booking flow that allows students to discover coaches, schedule lessons, pay securely through Stripe, and manage their bookings.

## User Journey

### 1. Coach Discovery
**Entry Points**:
- Homepage "Find Your Coach" button → 20-question assessment → coach recommendations
- Browse all coaches on homepage (with filters)
- Direct link to coach profile

**Coach Profile Card** (on homepage):
- Profile photo
- Name, title (GM/IM/FM), rating
- Specializations (tags)
- Average rating (stars) + review count
- Hourly rate
- "View Profile" button

### 2. Coach Detail Page (`/coach/[id]`)
**URL**: `/coach/elena-volkov` (slug-based)

**Content Sections**:
- **Hero Section**:
  - Large profile photo
  - Name, title, rating, location
  - Average rating (4.9 ⭐) + "42 reviews"
  - Hourly rate: "$120/hour"
  - "Book a Lesson" CTA button (primary, prominent)
  - "Message Coach" button (secondary)

- **About**:
  - Professional bio (150-500 words)
  - Video introduction (if available)

- **Expertise**:
  - Specializations (badges)
  - Target student levels
  - Teaching style description
  - Chess credentials (FIDE rating, achievements)

- **Availability**:
  - "Next available: Tomorrow at 2:00 PM"
  - Mini calendar showing available dates
  - Timezone indicator

- **Reviews** (5 most recent):
  - Student name, rating, date
  - Review text
  - "See all reviews" link

- **Pricing**:
  - Lesson duration options (30min, 60min, 90min)
  - Pricing for each duration
  - Package discounts (if enabled)

### 3. Booking Modal/Page
**Triggered by**: "Book a Lesson" button

**Step 1: Select Date & Time**:
- Calendar view showing available dates (next 30 days)
- Time slots for selected date (15-min intervals)
- Timezone display: "Times shown in your timezone (EST)"
- Selected slot highlighted: "Tuesday, Feb 5 at 2:00 PM"

**Step 2: Lesson Details**:
- Duration dropdown: 30min, 60min, 90min
- Lesson format: One-on-one, Tournament prep, Opening prep, etc.
- Special requests (textarea): "What would you like to focus on?"
- Price calculation: "$120 × 1 hour = $120"
- Platform fee notice: "Minimal platform fees included"

**Step 3: Payment**:
- Stripe Checkout embedded or redirect
- Payment methods: Credit card, debit card
- Secure payment badge
- Total: $120
- "Complete Booking" button

**Step 4: Confirmation**:
- Success message: "Lesson Booked! ✓"
- Booking details summary
- Calendar invite download (.ics file)
- Zoom link (generated automatically)
- Coach contact info
- "View My Lessons" button

### 4. Student Dashboard (`/student/dashboard`)
**Tabs**:
- **Upcoming Lessons**:
  - List of scheduled lessons (chronological)
  - Each card shows:
    - Coach photo, name
    - Date, time, duration
    - Lesson type
    - Zoom link (if within 1 hour of start)
    - "Cancel" button (if >48 hours away)
    - "Reschedule" button

- **Past Lessons**:
  - Completed lessons
  - "Leave a Review" button (if not reviewed)
  - "Book Again" button

- **Cancelled**:
  - Cancelled lessons with refund status

**Quick Stats**:
- Total lessons: 12
- Favorite coach: Elena Volkov
- Total spent: $1,440

### 5. Cancellation Flow
**Policy**: 48-hour notice required for full refund

**Process**:
1. Click "Cancel" on lesson card
2. Modal: "Cancel this lesson?"
   - Show cancellation policy
   - If <48 hours: "No refund available"
   - If >48 hours: "Full refund to original payment method"
3. Reason dropdown (optional): "Schedule conflict", "Found another coach", "Personal reasons", etc.
4. "Confirm Cancellation" button
5. Confirmation: "Lesson cancelled. Refund processed."

---

## Database Schema

### Bookings Table

```sql
CREATE TABLE bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Parties
  student_id INT NOT NULL, -- references users.id
  coach_id INT NOT NULL, -- references users.id
  
  -- Lesson details
  scheduled_at TIMESTAMP NOT NULL, -- Lesson start time (UTC)
  duration_minutes INT NOT NULL, -- 30, 60, 90, 120
  lesson_type VARCHAR(64), -- "one-on-one", "tournament-prep", etc.
  special_requests TEXT,
  
  -- Pricing (in cents)
  coach_rate_cents INT NOT NULL, -- Coach's hourly rate at time of booking
  total_amount_cents INT NOT NULL, -- Total charged to student
  platform_fee_cents INT NOT NULL, -- BooGMe's commission
  coach_payout_cents INT NOT NULL, -- Amount coach receives
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Payment
  stripe_payment_intent_id VARCHAR(255), -- Stripe PaymentIntent ID
  stripe_charge_id VARCHAR(255), -- Stripe Charge ID (after payment succeeds)
  payment_status ENUM('pending', 'succeeded', 'failed', 'refunded') DEFAULT 'pending',
  paid_at TIMESTAMP,
  
  -- Status
  booking_status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  cancelled_by ENUM('student', 'coach', 'admin'),
  
  -- Refund
  refund_amount_cents INT DEFAULT 0,
  refund_status ENUM('none', 'pending', 'processed') DEFAULT 'none',
  refund_processed_at TIMESTAMP,
  stripe_refund_id VARCHAR(255),
  
  -- Communication
  zoom_link TEXT, -- Generated Zoom meeting link
  student_notes TEXT, -- Student's notes about the lesson
  coach_notes TEXT, -- Coach's notes about the lesson
  
  -- Reminders
  reminder_sent_24h BOOLEAN DEFAULT FALSE,
  reminder_sent_1h BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_student (student_id),
  INDEX idx_coach (coach_id),
  INDEX idx_scheduled_at (scheduled_at),
  INDEX idx_booking_status (booking_status),
  INDEX idx_payment_status (payment_status)
);
```

---

## Stripe Payment Flow

### 1. Create Payment Intent (Backend)
When student clicks "Complete Booking":

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: totalAmountCents, // e.g., 12000 = $120
  currency: 'usd',
  payment_method_types: ['card'],
  metadata: {
    booking_id: bookingId,
    student_id: studentId,
    coach_id: coachId,
    lesson_date: scheduledAt,
  },
  description: `Chess lesson with ${coachName}`,
  // Application fee (platform commission) - transferred to platform
  application_fee_amount: platformFeeCents,
  // Transfer to coach's Stripe Connect account
  transfer_data: {
    destination: coachStripeAccountId,
  },
});
```

**Key Points**:
- `application_fee_amount`: BooGMe's commission (15% of total)
- `transfer_data.destination`: Coach's Stripe Connect account ID
- Funds are held in escrow until lesson completion

### 2. Frontend Payment
Use Stripe Elements or Checkout:

```typescript
const stripe = await loadStripe(publishableKey);
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: studentName,
      email: studentEmail,
    },
  },
});
```

### 3. Webhook Handling
Listen for `payment_intent.succeeded`:

```typescript
if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object;
  const bookingId = paymentIntent.metadata.booking_id;
  
  // Update booking status
  await updateBooking(bookingId, {
    payment_status: 'succeeded',
    booking_status: 'confirmed',
    paid_at: new Date(),
    stripe_charge_id: paymentIntent.charges.data[0].id,
  });
  
  // Send confirmation emails to student and coach
  await sendBookingConfirmationEmail(bookingId);
}
```

### 4. Refund Flow (Cancellation)
If student cancels >48 hours before lesson:

```typescript
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  reason: 'requested_by_customer',
  metadata: {
    booking_id: bookingId,
    cancelled_by: 'student',
  },
});

// Update booking
await updateBooking(bookingId, {
  booking_status: 'cancelled',
  refund_status: 'processed',
  refund_amount_cents: totalAmountCents,
  stripe_refund_id: refund.id,
});
```

---

## Backend API (tRPC)

### Router: `booking`

**Procedures**:

1. `getCoachProfile` (public):
   - Input: `{ coachId: number }`
   - Output: Full coach profile with availability, pricing, reviews
   
2. `getCoachAvailability` (public):
   - Input: `{ coachId: number, startDate: Date, endDate: Date }`
   - Output: Array of available time slots
   
3. `createBooking` (protected, student only):
   - Input: `{ coachId, scheduledAt, durationMinutes, lessonType, specialRequests }`
   - Output: `{ bookingId, clientSecret }` (for Stripe payment)
   - Creates booking record + Stripe PaymentIntent
   
4. `confirmBooking` (protected, student only):
   - Input: `{ bookingId }`
   - Output: Booking details with Zoom link
   - Called after payment succeeds
   
5. `getMyBookings` (protected, student only):
   - Input: `{ status?: 'upcoming' | 'past' | 'cancelled' }`
   - Output: Array of student's bookings
   
6. `cancelBooking` (protected, student only):
   - Input: `{ bookingId, reason }`
   - Output: `{ refundAmount, refundStatus }`
   - Checks 48-hour policy, processes refund if eligible
   
7. `rescheduleBooking` (protected, student only):
   - Input: `{ bookingId, newScheduledAt }`
   - Output: Updated booking
   - Only if >48 hours before original time

---

## UI Components

### `CoachDetailPage.tsx`
- Full coach profile layout
- Booking CTA
- Reviews section
- Availability preview

### `BookingModal.tsx`
- Multi-step booking wizard
- Date/time picker
- Lesson details form
- Stripe payment integration

### `AvailabilityCalendar.tsx`
- Calendar view of coach's available dates
- Time slot picker for selected date
- Timezone conversion

### `StudentDashboard.tsx`
- Tabs for upcoming/past/cancelled lessons
- Booking cards with actions
- Quick stats

### `BookingCard.tsx`
- Reusable card showing lesson details
- Actions: Cancel, Reschedule, Review, Rebook

---

## Business Rules

### Booking Window
- Students can book lessons up to coach's `maxAdvanceDays` (default 30 days)
- Minimum advance notice: coach's `minAdvanceHours` (default 24 hours)

### Cancellation Policy
- **>48 hours before lesson**: Full refund
- **24-48 hours before lesson**: 50% refund
- **<24 hours before lesson**: No refund
- Coach can cancel anytime with full refund to student

### Payment Hold
- Funds held in escrow until lesson completion
- Released to coach 24 hours after scheduled lesson time
- If student reports issue within 24 hours, hold extended for review

### No-Show Policy
- If student doesn't join within 15 minutes, marked as "no-show"
- Coach receives full payment
- If coach doesn't show, full refund + $20 credit to student

---

## Success Metrics

**Conversion Funnel**:
- Coach profile views → Booking modal opens: Target 30%
- Booking modal opens → Payment initiated: Target 60%
- Payment initiated → Payment succeeded: Target 95%
- Overall conversion: 17%+ (profile view → completed booking)

**Booking Velocity**:
- Average time from profile view to booking: Target <10 minutes
- Booking completion rate: Target 90%+

**Cancellation Rate**:
- Student cancellations: Target <10%
- Coach cancellations: Target <2%

---

## Future Enhancements

- Recurring lesson packages (e.g., 10 lessons for $1,000)
- Group lesson bookings
- Instant booking (no coach confirmation needed)
- Waitlist for fully booked coaches
- Flexible rescheduling (drag-and-drop calendar)
- In-app video calling (replace Zoom)
- Lesson recording and replay
- Automated lesson reminders (SMS + email)
