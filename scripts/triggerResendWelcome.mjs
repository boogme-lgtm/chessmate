import { resendWelcomeEmails } from '../server/resendWelcomeEmails.ts';

console.log('Starting welcome email resend...\n');

try {
  const result = await resendWelcomeEmails();
  
  console.log('\n=== RESULTS ===');
  console.log(`Total Subscribers: ${result.totalSubscribers}`);
  console.log(`Successfully Sent: ${result.successCount}`);
  console.log(`Failed: ${result.failCount}`);
  console.log('\nDone!');
  
  process.exit(0);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
