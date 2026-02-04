# BooGMe Coach Application Design

## Application Flow Overview

**Target Completion Time**: 8-10 minutes  
**Total Steps**: 5  
**Approval Timeline**: 24-48 hours

---

## Pre-Application Landing Page

### Hero Section
**Headline**: "Turn Your Chess Expertise Into a Thriving Coaching Business"  
**Subheadline**: "Join 200+ elite coaches earning $2,500-6,000/month on BooGMe"

### Value Propositions (3-column grid)
1. **AI-Powered Student Matching**
   - Icon: Brain/Target
   - "We bring qualified students to you through intelligent matching"
   
2. **Payment Protection & Escrow**
   - Icon: Shield/Lock
   - "Get paid for every lesson with our secure escrow system"
   
3. **Professional Business Tools**
   - Icon: Chart/Calendar
   - "Calendar, analytics, and student management included"

### Application CTA
- Time estimate badge: "⏱️ 8-10 minutes"
- Primary button: "Start Your Application"
- Secondary text: "No credit card required • Free to apply"

---

## Step 1: About You (2 minutes)

### Progress Indicator
"Step 1 of 5 • About You"

### Sidebar Value Prop
"💡 **Did you know?** Coaches with complete profiles get 3x more student inquiries"

### Fields

**Personal Information**
- Full Name* (text input)
- Email Address* (email input with validation)
- Phone Number (optional, for faster communication)
- Country/Region* (dropdown)
- City* (text input)
- Timezone* (auto-detected, editable dropdown)

**Chess Credentials**
- Chess Title* (dropdown)
  - Options: Grandmaster (GM), International Master (IM), FIDE Master (FM), Candidate Master (CM), National Master (NM), Expert, Class A, Class B, Other
- Current Rating* (number input)
  - Helper text: "FIDE, USCF, or equivalent"
  - Validation: 1000-3000 range
- Rating Organization* (dropdown: FIDE, USCF, Other)

**Coaching Experience**
- Years of Coaching Experience* (dropdown)
  - Options: Less than 1 year, 1-2 years, 3-5 years, 6-10 years, 10+ years
- Total Students Taught (number input, optional)
  - Helper text: "Approximate number of students you've coached"

**Profile Photo**
- Upload button with preview
- Requirements: "Professional headshot, min 400x400px, max 5MB"
- Optional at application stage, required before going live

### Validation Rules
- All fields marked with * are required
- Email must be valid format and unique
- Rating must be realistic for selected title

### Next Button
"Continue to Expertise →"

---

## Step 2: Your Expertise (2-3 minutes)

### Progress Indicator
"Step 2 of 5 • Your Expertise"

### Sidebar Value Prop
"🎯 **Pro Tip**: Students search by specialization. Be specific about what you teach best!"

### Fields

**Qualifications & Achievements**
- Teaching Certifications (text area, optional)
  - Placeholder: "e.g., USCF Certified Coach, Chess in Schools Instructor"
  - Helper text: "List any relevant certifications"
  
- Notable Achievements* (text area, 100-500 characters)
  - Placeholder: "e.g., Coached 3 students to state championship, Former national team member, Published opening repertoire book"
  - Helper text: "What makes you stand out as a coach?"

**Specializations** (multi-select checkboxes, select 3-5)
- Tournament Preparation
- Strategic Mastery
- Tactical Training
- Endgame Technique
- Opening Repertoire
- Psychological Training
- Beginner Foundations
- Junior Development (U12)
- Teen Development (13-18)
- Adult Learners
- Women's Chess
- Rapid/Blitz Training
- Classical Time Control
- Online Chess Specific

**Target Student Levels** (multi-select, select 1-3)
- Complete Beginners (0-800)
- Novice (800-1200)
- Intermediate (1200-1600)
- Advanced (1600-2000)
- Expert (2000-2200)
- Master Level (2200+)

**Teaching Philosophy**
- Short text area (50-150 words)
- Placeholder: "Describe your approach to coaching. What's your teaching style? How do you help students improve?"
- Helper text: "This helps students understand if you're the right fit"

### Validation Rules
- Notable achievements required, min 100 characters
- Must select 3-5 specializations
- Must select at least 1 target student level
- Teaching philosophy required, 50-150 words

### Navigation
- Back button: "← Previous"
- Next button: "Continue to Availability →"

---

## Step 3: Availability & Pricing (1-2 minutes)

### Progress Indicator
"Step 3 of 5 • Availability & Pricing"

### Sidebar Value Prop
"📈 **Success Metric**: Coaches with flexible availability earn 40% more than those with limited schedules"

### Fields

**Hourly Rate**
- Rate input (number, USD)
- Market guidance box:
  - "💰 **Market Rates by Title**"
  - GM: $100-150/hr
  - IM: $60-100/hr
  - FM/NM: $45-75/hr
  - Expert/Class A: $35-55/hr
- Helper text: "You can adjust this anytime. Start competitive to build reviews."

**Weekly Availability**
- Interactive calendar grid (7 days × 4 time slots)
- Time slots: Morning (6am-12pm), Afternoon (12pm-6pm), Evening (6pm-12am), Weekend (Sat-Sun any time)
- Click to toggle availability
- "Select all that apply" instruction
- Minimum: 6 hours/week recommended

**Lesson Formats** (multi-select checkboxes)
- One-on-One Lessons
- Small Group (2-4 students)
- Large Group (5+ students)
- Online Only
- In-Person (if local students available)

**Languages Spoken** (multi-select dropdown)
- English, Spanish, Russian, French, German, Mandarin, Portuguese, Italian, Other (specify)

### Validation Rules
- Hourly rate required, min $25, max $200
- Must select at least 6 hours of weekly availability
- Must select at least one lesson format
- Must select at least one language

### Navigation
- Back button: "← Previous"
- Next button: "Continue to Teaching Approach →"

---

## Step 4: Teaching Approach (2-3 minutes)

### Progress Indicator
"Step 4 of 5 • Teaching Approach"

### Sidebar Value Prop
"🎥 **Conversion Boost**: Coaches with video introductions convert 5x better than those without"

### Fields

**Professional Bio** (rich text area, 150-300 words)
- Prompts to guide writing:
  - "Start with your chess journey"
  - "Explain your coaching philosophy"
  - "Share student success stories"
  - "Describe what makes your lessons unique"
- Character counter
- Example bio link: "See example →"

**Why BooGMe?** (text area, 50-150 words)
- "Why do you want to join BooGMe? What are you hoping to achieve?"
- Helper text: "This helps us understand your goals and ensure we're a good fit"

**Sample Lesson Description** (text area, 100-200 words)
- "Describe a typical first lesson with a new student. What would you cover?"
- Helper text: "This helps students know what to expect"

**Video Introduction** (optional but strongly recommended)
- Upload or record video (max 2 minutes, max 50MB)
- Requirements: "Introduce yourself, explain your teaching style, and why students should choose you"
- Alternative: "Skip for now (you can add this later)"
- Badge: "⭐ Recommended - 5x higher conversion"

### Validation Rules
- Bio required, 150-300 words
- Why BooGMe required, 50-150 words
- Sample lesson required, 100-200 words
- Video optional but encouraged

### Navigation
- Back button: "← Previous"
- Next button: "Review Application →"

---

## Step 5: Review & Submit (1 minute)

### Progress Indicator
"Step 5 of 5 • Review & Submit"

### Application Summary
Collapsible sections showing all entered information:
1. Personal Info & Credentials
2. Expertise & Specializations
3. Availability & Pricing
4. Teaching Approach

Each section has "Edit" button to return to that step

### Agreements & Consents

**Background Check Consent**
- Checkbox: "I consent to a background check as part of the approval process"*
- Helper text: "We verify all coaches to maintain platform quality and student safety"

**Platform Terms**
- Checkbox: "I agree to BooGMe's Terms of Service and Coach Agreement"*
- Links: [Terms of Service] [Coach Agreement]

**Payment Setup**
- Info box: "💳 **Payment Setup**: You'll complete Stripe Connect onboarding after approval to receive payments"
- No action required at this stage

### What Happens Next

Timeline visualization:
1. **Now**: Application submitted
2. **Within 24-48 hours**: Review complete, approval email sent
3. **Day 3**: Complete profile setup & payment onboarding
4. **Day 4-7**: First student inquiries start arriving

### Submit Button
- Primary CTA: "Submit Application"
- Secondary text: "By submitting, you agree to our terms and consent to background verification"

---

## Post-Submission Success Screen

### Confirmation Message
"🎉 **Application Submitted Successfully!**"

"Thank you for applying to join BooGMe! We're excited to review your application."

### What's Next Section
**Timeline**:
- ✅ Application received (now)
- ⏳ Under review (24-48 hours)
- 📧 Approval email with next steps
- 🚀 Complete profile & start teaching

**Prepare While You Wait**:
- Set up your teaching space
- Prepare lesson materials
- Review our [Coach Best Practices Guide]
- Join our [Coach Community] (Discord/Slack)

### CTA Buttons
- Primary: "Return to Homepage"
- Secondary: "Learn More About BooGMe"

---

## Approval Email Template

**Subject**: "Welcome to BooGMe! Your Application Has Been Approved 🎉"

**Body**:
```
Hi [Coach Name],

Congratulations! Your application to join BooGMe has been approved.

You're now part of an elite community of 200+ chess coaches building successful teaching businesses on our platform.

**Next Steps to Get Started:**

1. **Complete Your Profile** (5 minutes)
   - Add your video introduction (if you haven't already)
   - Upload additional photos
   - Set your detailed availability

2. **Payment Onboarding** (10 minutes)
   - Connect your Stripe account to receive payments
   - [Complete Stripe Onboarding →]

3. **Review Coach Guidelines** (15 minutes)
   - Learn best practices for your first lesson
   - Understand our cancellation and refund policies
   - [Read Coach Handbook →]

4. **Join the Coach Community**
   - Connect with fellow coaches
   - Get tips and support
   - [Join Discord →]

**What to Expect:**
- Students will start finding your profile within 24 hours
- Average time to first booking: 3-7 days
- We'll send you email notifications for new student inquiries

**Need Help?**
Reply to this email or visit our [Help Center]

Welcome aboard!

The BooGMe Team
```

---

## Key Design Principles

1. **Progress Transparency**: Always show step number and completion percentage
2. **Value Reinforcement**: Each step includes sidebar messaging about benefits
3. **Friction Reduction**: Optional fields clearly marked, save & resume functionality
4. **Quality Signals**: Encourage video, detailed bios, specific specializations
5. **Clear Expectations**: Timeline and next steps communicated upfront
6. **Mobile Responsive**: All steps work seamlessly on mobile devices
7. **Validation Feedback**: Real-time validation with helpful error messages
8. **Exit Intent**: Save progress if user tries to leave mid-application

---

## Success Metrics to Track

- Application start rate (visits to form)
- Step completion rates (identify drop-off points)
- Average completion time
- Approval rate
- Time to first booking (post-approval)
- Profile completeness score
- Video upload rate
