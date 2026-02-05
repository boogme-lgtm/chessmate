# Email Integration - BooGMe

## Overview

BooGMe uses **Resend** as the email service provider to send waitlist confirmation emails and automated nurture campaigns. The integration includes:

- **Immediate confirmation emails** when users join the waitlist
- **5-email nurture sequence** sent over 30 days to keep students engaged pre-launch
- **Email tracking** in the database to prevent duplicate sends
- **Admin controls** for manual testing and batch sending

---

## Email Sequence

### Confirmation Email (Day 0)
- Sent immediately when a user joins the waitlist
- Personalized for students vs coaches
- Includes welcome message and what to expect next

### Nurture Sequence (Days 5, 10, 15, 22, 30)

1. **Email 1 (Day 5)**: "Why I'm building BooGMe"
   - Introduces Coach Cristian's background
   - Explains the problem BooGMe solves
   - Highlights 3 key differentiators

2. **Email 2 (Day 10)**: "How AI Matching Works"
   - Details the 20-question assessment
   - Explains AI analysis process
   - Shows example of personalized matching

3. **Email 3 (Day 15)**: "Payment Protection Explained"
   - Describes escrow system
   - Walks through 4-step payment flow
   - Emphasizes zero upfront risk

4. **Email 4 (Day 22)**: "Transparent Pricing"
   - Breaks down pricing for students and coaches
   - Explains minimal platform fees
   - Compares to industry standards

5. **Email 5 (Day 30)**: "We're Launching Soon"
   - Final email before launch
   - Explains early access benefits
   - Sets expectations for next steps

---

## Configuration

### Environment Variables

- `RESEND_API_KEY`: Your Resend API key (configured via Management UI → Settings → Secrets)

### Default From Address

Currently set to `onboarding@resend.dev` (Resend's test domain). To use a custom domain:

1. Add and verify your domain at https://resend.com/domains
2. Update the `from` address in `/home/ubuntu/chessmate/server/emailService.ts`:
   ```typescript
   from: options.from || 'BooGMe <noreply@yourdomain.com>',
   ```

---

## Database Schema

The `waitlist` table includes email tracking fields:

```sql
confirmationEmailSent BOOLEAN DEFAULT FALSE
nurtureEmail1Sent BOOLEAN DEFAULT FALSE
nurtureEmail2Sent BOOLEAN DEFAULT FALSE
nurtureEmail3Sent BOOLEAN DEFAULT FALSE
nurtureEmail4Sent BOOLEAN DEFAULT FALSE
nurtureEmail5Sent BOOLEAN DEFAULT FALSE
lastEmailSentAt TIMESTAMP
```

---

## Admin Controls

### Manual Nurture Email Batch

Trigger the nurture email scheduler manually (sends to all eligible waitlist members):

```typescript
// Via tRPC endpoint (admin only)
trpc.admin.emails.sendNurtureBatch.useMutation()
```

### Send Test Email

Send a test nurture email to a specific address:

```typescript
// Via tRPC endpoint (admin only)
trpc.admin.emails.sendTestEmail.useMutation({
  emailNumber: 1, // 1-5
  testEmail: 'test@example.com'
})
```

---

## Automated Scheduling

The nurture email system is designed to run automatically via a daily cron job or scheduled task. The scheduler checks for waitlist entries that:

1. Have received the confirmation email
2. Haven't received the specific nurture email yet
3. Were created the correct number of days ago (within a 24-hour window)

### Implementation Options

**Option 1: Manus Scheduled Tasks** (Recommended)
```typescript
// Use the Manus `schedule` tool to run daily
schedule({
  type: 'cron',
  cron: '0 9 * * *', // 9 AM daily
  repeat: true,
  name: 'Send Nurture Emails',
  prompt: 'Run the nurture email scheduler to send automated emails to waitlist members'
})
```

**Option 2: External Cron Service**
- Use a service like Vercel Cron, GitHub Actions, or cron-job.org
- Hit the admin endpoint: `POST /api/trpc/admin.emails.sendNurtureBatch`
- Include admin authentication headers

**Option 3: Server-side Cron**
- Add a cron job on the server running the application
- Call `sendNurtureEmails()` from `nurtureEmailScheduler.ts`

---

## Testing

Run the email integration tests:

```bash
pnpm test emailService.test.ts
pnpm test waitlist.email.test.ts
pnpm test nurtureEmailScheduler.test.ts
```

All tests validate:
- Email template generation
- Personalization (student vs coach)
- Content accuracy for each nurture email
- Proper sequencing and timing

---

## Resend Pricing

- **Free tier**: 3,000 emails/month, 100 emails/day
- **Paid tier**: $20/month for 50,000 emails/month

Current usage estimate:
- Confirmation emails: 1 per waitlist signup
- Nurture sequence: 5 per student over 30 days
- **Total**: 6 emails per student

With 500 students on waitlist: 3,000 emails total (fits within free tier)

---

## Files

### Core Email Service
- `/server/emailService.ts` - Email sending logic and HTML templates
- `/server/nurtureEmailScheduler.ts` - Automated nurture sequence scheduler
- `/server/routers.ts` - tRPC endpoints for email operations

### Database
- `/drizzle/schema.ts` - Waitlist table with email tracking fields
- `/server/db.ts` - Database functions for email status updates

### Tests
- `/server/emailService.test.ts` - Email template validation
- `/server/waitlist.email.test.ts` - Waitlist email integration tests
- `/server/nurtureEmailScheduler.test.ts` - Nurture sequence tests

---

## Next Steps

1. **Verify domain** in Resend dashboard (https://resend.com/domains)
2. **Update from address** in `emailService.ts` to use verified domain
3. **Set up automated scheduling** using one of the options above
4. **Monitor email delivery** via Resend dashboard
5. **Track engagement** (optional: add open/click tracking via Resend webhooks)

---

## Support

For issues with email delivery:
- Check Resend dashboard for delivery logs
- Verify API key is correctly configured
- Ensure domain is verified for custom from addresses
- Review error logs in server console
