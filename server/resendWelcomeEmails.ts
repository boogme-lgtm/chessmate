import * as db from './db';
import { sendEmail } from './emailService';
import { getWaitlistConfirmationEmail } from './emailService';

/**
 * Resend welcome emails to all active subscribers
 */
export async function resendWelcomeEmails() {
  console.log('[Resend Welcome] Starting to resend welcome emails...');
  
  const entries = await db.getAllWaitlistEntries();
  const activeSubscribers = entries.filter(e => !e.unsubscribed);
  
  console.log(`[Resend Welcome] Found ${activeSubscribers.length} active subscribers`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const entry of activeSubscribers) {
    try {
      const userType = entry.userType === 'both' ? 'coach' : entry.userType;
      const emailHtml = getWaitlistConfirmationEmail(
        entry.name || entry.email.split('@')[0],
        userType as 'student' | 'coach',
        entry.email
      );
      
      const result = await sendEmail({
        to: entry.email,
        subject: userType === 'coach' 
          ? 'Welcome Back to BooGMe - Coach Waitlist' 
          : 'Welcome Back to BooGMe - Student Waitlist',
        html: emailHtml,
      });
      
      if (result.success) {
        successCount++;
        console.log(`[Resend Welcome] ✓ Sent to ${entry.email}`);
      } else {
        failCount++;
        console.error(`[Resend Welcome] ✗ Failed to send to ${entry.email}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Resend Welcome] Error sending to ${entry.email}:`, error);
      failCount++;
    }
  }
  
  console.log(`[Resend Welcome] Complete! Success: ${successCount}, Failed: ${failCount}`);
  
  return {
    success: true,
    totalSubscribers: activeSubscribers.length,
    successCount,
    failCount,
  };
}
