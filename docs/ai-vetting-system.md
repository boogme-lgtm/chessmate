# AI-Powered Coach Vetting System

## Overview

Instant AI vetting system that auto-approves qualified coaches (80-90% of applications) and flags edge cases for human review (10-20%). Target: reduce approval time from 24-48 hours to instant for most coaches.

## Vetting Criteria

### Auto-Approval Thresholds (Confidence Score ≥ 85/100)

**Must meet ALL of the following:**

1. **Valid Chess Credentials** (30 points)
   - Title matches rating range:
     - GM: 2500+ rating
     - IM: 2400-2599 rating
     - FM: 2300-2499 rating
     - CM/NM: 2200-2399 rating
     - Expert: 2000-2299 rating
     - No title: any rating
   - Rating organization is recognized (FIDE, USCF, Chess.com, Lichess)
   - Rating is within reasonable bounds (800-3000)

2. **Teaching Experience** (25 points)
   - Years of experience: 1+ years
   - Total students taught: mentioned or implied
   - Teaching philosophy is coherent and specific (not generic)
   - Sample lesson demonstrates chess knowledge and teaching ability

3. **Professional Bio Quality** (20 points)
   - Bio length: 150-300 words
   - Contains specific achievements or experience
   - Professional tone (not overly casual or aggressive)
   - No obvious AI-generated patterns (e.g., "As a chess coach...")
   - No spelling/grammar issues that suggest lack of professionalism

4. **Reasonable Pricing** (10 points)
   - Hourly rate aligns with credentials:
     - GM: $80-200/hr
     - IM: $50-150/hr
     - FM: $35-100/hr
     - CM/NM/Expert: $25-75/hr
     - No title: $20-60/hr
   - Not suspiciously low (< $15/hr) or high (> $300/hr)

5. **Complete Application** (10 points)
   - All required fields filled
   - Specializations selected (3-5)
   - Target levels selected
   - Availability provided
   - Contact information valid

6. **Platform Fit** (5 points)
   - "Why BooGMe" answer shows understanding of platform
   - Demonstrates commitment to online teaching
   - Expresses interest in growing student base

### Red Flags (Trigger Human Review)

**Any ONE of these drops confidence score below 85:**

1. **Credential Mismatch** (-30 points)
   - Title significantly higher than rating (e.g., GM with 2100 rating)
   - Claims unverifiable titles or organizations
   - Suspicious achievements (e.g., "World Champion 2023")

2. **Teaching Experience Issues** (-25 points)
   - Teaching philosophy is generic or copied
   - Sample lesson shows lack of chess knowledge
   - Claims 10+ years experience but age/timeline doesn't match
   - No clear teaching methodology described

3. **Professionalism Concerns** (-20 points)
   - Bio contains inappropriate content
   - Multiple spelling/grammar errors
   - Overly aggressive or salesy language
   - Mentions competing platforms negatively

4. **Pricing Red Flags** (-15 points)
   - Rate is 2x+ above typical for credentials
   - Rate is below minimum wage equivalent
   - Inconsistent pricing across formats

5. **Incomplete Information** (-15 points)
   - Missing critical fields (bio, teaching philosophy, sample lesson)
   - Vague or one-word answers
   - Copy-pasted content across multiple fields

6. **Suspicious Patterns** (-20 points)
   - Email domain is suspicious (temporary email services)
   - Phone number format invalid
   - Multiple applications from same IP/email
   - Application submitted in < 3 minutes (likely bot)

## AI Vetting Process

### Step 1: Structured Data Validation (Rule-Based)

- Check rating vs title consistency
- Validate email/phone format
- Check pricing against market ranges
- Verify all required fields present
- Calculate completion score

### Step 2: LLM Content Analysis

**Prompt Template:**

```
You are an expert chess coach recruiter evaluating a coaching application for BooGMe, an online chess coaching marketplace. Analyze the following application and provide a structured assessment.

APPLICATION DATA:
- Name: {fullName}
- Chess Title: {chessTitle}
- Current Rating: {currentRating} ({ratingOrg})
- Years Experience: {yearsExperience}
- Total Students: {totalStudents}
- Hourly Rate: ${hourlyRate}

WRITTEN RESPONSES:
Teaching Philosophy: {teachingPhilosophy}

Sample Lesson Description: {sampleLesson}

Professional Bio: {bio}

Why BooGMe: {whyBoogme}

Achievements: {achievements}

EVALUATION CRITERIA:

1. **Teaching Competence** (0-25 points)
   - Does the teaching philosophy demonstrate understanding of pedagogy?
   - Is the sample lesson specific and shows chess knowledge?
   - Are teaching methods clearly articulated?

2. **Chess Expertise** (0-20 points)
   - Do achievements match the claimed credentials?
   - Does the bio demonstrate deep chess knowledge?
   - Are specializations credible given experience?

3. **Professionalism** (0-20 points)
   - Is the writing clear, professional, and error-free?
   - Does the bio sound authentic (not AI-generated)?
   - Is the tone appropriate for a coaching marketplace?

4. **Platform Fit** (0-10 points)
   - Does "Why BooGMe" show genuine interest?
   - Is the coach committed to online teaching?
   - Do they understand the platform's value proposition?

5. **Red Flags** (deduct points if present)
   - Generic or copied content (-10)
   - Inconsistencies between fields (-15)
   - Inappropriate content or tone (-20)
   - Obvious AI-generated text (-15)

OUTPUT FORMAT (JSON):
{
  "teachingScore": 0-25,
  "expertiseScore": 0-20,
  "professionalismScore": 0-20,
  "platformFitScore": 0-10,
  "redFlags": ["flag1", "flag2"],
  "totalContentScore": 0-75,
  "reasoning": "Brief explanation of scores",
  "recommendation": "APPROVE" | "REVIEW" | "REJECT"
}
```

### Step 3: Calculate Final Confidence Score

```
Confidence Score = 
  Credential Score (0-30) +
  Teaching Experience Score (0-25) +
  LLM Content Score (0-75) +
  Pricing Score (0-10) +
  Completion Score (0-10) +
  Platform Fit Score (0-5)
  - Red Flag Penalties

Total: 0-155 points (normalized to 0-100)
```

### Step 4: Decision Logic

```
if (confidenceScore >= 85 && redFlags.length === 0):
  → AUTO-APPROVE
  → Create coach profile immediately
  → Send approval email with onboarding link
  
elif (confidenceScore >= 70 && redFlags.length <= 2):
  → HUMAN REVIEW (Priority: Normal)
  → Notify admin within 4 hours
  → Expected review time: 4-12 hours
  
elif (confidenceScore >= 50):
  → HUMAN REVIEW (Priority: Low)
  → Review within 24 hours
  → Likely approval with minor feedback
  
else:
  → AUTO-REJECT (with feedback)
  → Send rejection email with specific improvement suggestions
  → Allow reapplication after 30 days
```

## Implementation Details

### Database Schema Updates

Add to `coach_applications` table:
- `aiVettingScore` (integer, 0-100)
- `aiVettingDetails` (JSON with breakdown)
- `aiVettingTimestamp` (datetime)
- `autoApproved` (boolean)
- `humanReviewReason` (text, why flagged for review)

### API Flow

1. Coach submits application → `coachApplications.submit`
2. Trigger AI vetting → `aiVettingService.vetApplication()`
3. AI returns confidence score + recommendation
4. If score ≥ 85:
   - Update status to "approved"
   - Create coach profile
   - Send approval email
5. If score 50-84:
   - Update status to "under_review"
   - Add to admin queue with priority
   - Send "under review" email
6. If score < 50:
   - Update status to "rejected"
   - Send rejection email with feedback

### Email Templates

**Auto-Approval Email:**
```
Subject: Welcome to BooGMe! Your Application is Approved 🎉

Hi {name},

Great news! Your coach application has been approved and you're now part of the BooGMe community.

Next Steps:
1. Complete your Stripe Connect setup (required for payments)
2. Review the Coach Handbook
3. Set your availability calendar
4. Get your first student!

Your profile is live at: https://boogme.com/coach/{id}

Welcome aboard!
```

**Human Review Email:**
```
Subject: Your BooGMe Application is Under Review

Hi {name},

Thanks for applying to join BooGMe! Your application is currently under review by our team.

We'll get back to you within 12 hours with a decision.

In the meantime, feel free to reply to this email with any questions.
```

**Auto-Rejection Email:**
```
Subject: BooGMe Application Update

Hi {name},

Thank you for your interest in joining BooGMe. After reviewing your application, we're unable to approve it at this time.

Areas for improvement:
{specific feedback based on low scores}

You're welcome to reapply in 30 days after addressing these items.

If you have questions, please reply to this email.
```

## Success Metrics

- **Auto-Approval Rate**: Target 80-85% of applications
- **False Positive Rate**: < 5% (auto-approved but should have been reviewed)
- **False Negative Rate**: < 10% (flagged for review but was clearly qualified)
- **Average Approval Time**: < 5 minutes for auto-approved, < 12 hours for human review
- **Coach Satisfaction**: 90%+ satisfied with approval process speed

## Continuous Improvement

- Track admin overrides (approve/reject decisions that differ from AI)
- Adjust scoring thresholds based on false positive/negative rates
- Collect feedback from coaches on rejection reasons
- Refine LLM prompts based on edge cases
- Add new red flags as patterns emerge
