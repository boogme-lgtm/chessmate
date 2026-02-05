import { sendEmail, getNurtureEmail1, getNurtureEmail2, getNurtureEmail3, getNurtureEmail4, getNurtureEmail5 } from './emailService';
import * as db from './db';

/**
 * Send nurture emails to waitlist members based on their signup date
 * This function should be called daily via a cron job or scheduled task
 */
export async function sendNurtureEmails() {
  console.log('[Nurture Scheduler] Starting nurture email batch...');
  
  const emailFunctions = [
    { number: 1 as const, getEmail: getNurtureEmail1, subject: 'Why I\'m building BooGMe' },
    { number: 2 as const, getEmail: getNurtureEmail2, subject: 'How AI Matching Works' },
    { number: 3 as const, getEmail: getNurtureEmail3, subject: 'Payment Protection Explained' },
    { number: 4 as const, getEmail: getNurtureEmail4, subject: 'Transparent Pricing - No Hidden Fees' },
    { number: 5 as const, getEmail: getNurtureEmail5, subject: 'We\'re Launching Soon - Early Access' },
  ];
  
  let totalSent = 0;
  let totalErrors = 0;
  
  for (const { number, getEmail, subject } of emailFunctions) {
    try {
      // Get waitlist entries that should receive this nurture email
      const entries = await db.getWaitlistEntriesForNurture(number);
      
      console.log(`[Nurture Scheduler] Found ${entries.length} entries for nurture email ${number}`);
      
      for (const entry of entries) {
        try {
          const emailHtml = getEmail(entry.name || entry.email.split('@')[0]);
          
          const result = await sendEmail({
            to: entry.email,
            subject,
            html: emailHtml,
          });
          
          if (result.success) {
            // Mark email as sent
            const updateField = `nurtureEmail${number}Sent` as 'nurtureEmail1Sent' | 'nurtureEmail2Sent' | 'nurtureEmail3Sent' | 'nurtureEmail4Sent' | 'nurtureEmail5Sent';
            await db.updateWaitlistEmailStatus(entry.email, {
              [updateField]: true,
              lastEmailSentAt: new Date(),
            });
            
            totalSent++;
            console.log(`[Nurture Scheduler] Sent email ${number} to ${entry.email}`);
          } else {
            totalErrors++;
            console.error(`[Nurture Scheduler] Failed to send email ${number} to ${entry.email}:`, result.error);
          }
          
          // Add a small delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          totalErrors++;
          console.error(`[Nurture Scheduler] Error sending email ${number} to ${entry.email}:`, error);
        }
      }
    } catch (error) {
      console.error(`[Nurture Scheduler] Error processing nurture email ${number}:`, error);
    }
  }
  
  console.log(`[Nurture Scheduler] Batch complete. Sent: ${totalSent}, Errors: ${totalErrors}`);
  
  return { sent: totalSent, errors: totalErrors };
}

/**
 * Manual trigger for testing - sends nurture emails immediately
 */
export async function sendNurtureEmailsManual(emailNumber: 1 | 2 | 3 | 4 | 5, testEmail?: string) {
  console.log(`[Nurture Scheduler] Manual trigger for email ${emailNumber}`);
  
  if (testEmail) {
    // Send test email to specific address
    const emailFunctions = [
      { number: 1, getEmail: getNurtureEmail1, subject: 'Why I\'m building BooGMe' },
      { number: 2, getEmail: getNurtureEmail2, subject: 'How AI Matching Works' },
      { number: 3, getEmail: getNurtureEmail3, subject: 'Payment Protection Explained' },
      { number: 4, getEmail: getNurtureEmail4, subject: 'Transparent Pricing - No Hidden Fees' },
      { number: 5, getEmail: getNurtureEmail5, subject: 'We\'re Launching Soon - Early Access' },
    ];
    
    const emailConfig = emailFunctions.find(e => e.number === emailNumber);
    if (!emailConfig) throw new Error(`Invalid email number: ${emailNumber}`);
    
    const emailHtml = emailConfig.getEmail('Test User');
    
    const result = await sendEmail({
      to: testEmail,
      subject: `[TEST] ${emailConfig.subject}`,
      html: emailHtml,
    });
    
    return result;
  }
  
  // Send to actual waitlist members
  return sendNurtureEmails();
}
