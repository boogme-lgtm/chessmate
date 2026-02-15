/**
 * Seed script to create fictional coaches for testing
 * Run with: tsx scripts/seed-fictional-coaches.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { users, coachProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const FICTIONAL_COACHES = [
  {
    name: "GM Alexandra Petrov",
    email: "alexandra.petrov@fictional.boogme.com",
    title: "GM",
    fideRating: 2650,
    bio: "Former World Championship candidate with 15+ years of coaching experience. Specialized in opening preparation and tournament psychology. My students have achieved IM and GM norms under my guidance.",
    hourlyRateCents: 15000, // $150/hr
    specializations: ["Tournament Preparation", "Opening Repertoire", "Strategic Mastery"],
    yearsExperience: 15,
    languages: ["English", "Russian"],
    timezone: "Europe/Moscow",
  },
  {
    name: "IM Carlos Rodriguez",
    email: "carlos.rodriguez@fictional.boogme.com",
    title: "IM",
    fideRating: 2480,
    bio: "Passionate chess educator focused on tactical training and endgame mastery. I've coached over 200 students from beginner to expert level. Known for my patient teaching style and structured lesson plans.",
    hourlyRateCents: 8000, // $80/hr
    specializations: ["Tactical Training", "Endgame Technique", "Beginner Foundations"],
    yearsExperience: 10,
    languages: ["English", "Spanish"],
    timezone: "America/New_York",
  },
  {
    name: "FM Sarah Chen",
    email: "sarah.chen@fictional.boogme.com",
    title: "FM",
    fideRating: 2350,
    bio: "Specialist in junior chess development and online training. I've helped dozens of young players reach national championship level. My lessons are interactive, engaging, and results-driven.",
    hourlyRateCents: 6000, // $60/hr
    specializations: ["Junior Development (U12)", "Teen Development (13-18)", "Online Chess Specific"],
    yearsExperience: 8,
    languages: ["English", "Mandarin"],
    timezone: "America/Los_Angeles",
  },
];

async function seedFictionalCoaches() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  console.log("🌱 Seeding fictional coaches...");
  
  for (const coach of FICTIONAL_COACHES) {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, coach.email))
        .limit(1);
      
      let userId: number;
      
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        console.log(`✓ User already exists: ${coach.name} (ID: ${userId})`);
      } else {
        // Create user
        const [newUser] = await db.insert(users).values({
          email: coach.email,
          name: coach.name,
          emailVerified: true,
          role: "user",
          // Test Stripe Connect account ID (starts with acct_test_coach_ to bypass real Stripe)
          stripeConnectAccountId: `acct_test_coach_${coach.email.split('@')[0]}`,
        });
        
        userId = newUser.insertId;
        console.log(`✓ Created user: ${coach.name} (ID: ${userId})`);
      }
      
      // Check if coach profile exists
      const existingProfile = await db
        .select()
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, userId))
        .limit(1);
      
      if (existingProfile.length > 0) {
        // Update existing profile
        await db
          .update(coachProfiles)
          .set({
            title: coach.title,
            fideRating: coach.fideRating,
            bio: coach.bio,
            hourlyRateCents: coach.hourlyRateCents,
            specializations: JSON.stringify(coach.specializations),
            yearsExperience: coach.yearsExperience,
            languages: JSON.stringify(coach.languages),
            timezone: coach.timezone,
            profileActive: true,
            isAvailable: true,
            lessonDurations: JSON.stringify([60, 90, 120]),
            minAdvanceHours: 24,
            maxAdvanceDays: 60,
            bufferMinutes: 30,
          })
          .where(eq(coachProfiles.userId, userId));
        
        console.log(`✓ Updated coach profile for: ${coach.name}`);
      } else {
        // Create coach profile
        await db.insert(coachProfiles).values({
          userId,
          title: coach.title,
          fideRating: coach.fideRating,
          bio: coach.bio,
          hourlyRateCents: coach.hourlyRateCents,
          specializations: JSON.stringify(coach.specializations),
          yearsExperience: coach.yearsExperience,
          languages: JSON.stringify(coach.languages),
          timezone: coach.timezone,
          profileActive: true,
          isAvailable: true,
          lessonDurations: JSON.stringify([60, 90, 120]),
          minAdvanceHours: 24,
          maxAdvanceDays: 60,
          bufferMinutes: 30,
          averageRating: 4.8 + Math.random() * 0.2, // 4.8-5.0
          totalReviews: Math.floor(Math.random() * 50) + 20, // 20-70 reviews
          totalLessons: Math.floor(Math.random() * 200) + 100, // 100-300 lessons
        });
        
        console.log(`✓ Created coach profile for: ${coach.name}`);
      }
    } catch (error) {
      console.error(`✗ Error seeding ${coach.name}:`, error);
    }
  }
  
  console.log("✅ Fictional coaches seeded successfully!");
  process.exit(0);
}

seedFictionalCoaches().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
