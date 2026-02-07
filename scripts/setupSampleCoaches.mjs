import { getDb } from '../server/db.ts';
import { coachProfiles } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

// For testing purposes, we'll mark the sample coaches as having completed Stripe onboarding
// In production, coaches would go through the real Stripe Connect flow

const sampleCoachEmails = [
  'elena.petrov@example.com',
  'carlos.rodriguez@example.com', 
  'sarah.chen@example.com'
];

console.log('Setting up sample coaches for testing...\n');

const db = await getDb();

for (const email of sampleCoachEmails) {
  await db
    .update(coachProfiles)
    .set({
      stripeConnectAccountId: `acct_test_${email.split('@')[0].replace('.', '_')}`,
      stripeConnectOnboarded: true
    })
    .where(eq(coachProfiles.email, email));
  
  console.log(`✅ Updated coach: ${email}`);
}

console.log('\n✨ All sample coaches are now ready to accept bookings!');
process.exit(0);
