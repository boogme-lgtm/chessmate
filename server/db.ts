import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  coachProfiles, 
  studentProfiles, 
  lessons, 
  reviews, 
  achievements, 
  userAchievements,
  coachMatches,
  waitlist,
  coachApplications,
  InsertCoachProfile,
  InsertStudentProfile,
  InsertLesson,
  InsertReview,
  InsertWaitlist,
  InsertCoachMatch,
  InsertCoachApplication
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER OPERATIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserStripeCustomerId(userId: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ stripeCustomerId })
    .where(eq(users.id, userId));
}

export async function updateUserStripeConnectAccount(userId: number, accountId: string, onboarded: boolean = false) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ 
      stripeConnectAccountId: accountId,
      stripeConnectOnboarded: onboarded
    })
    .where(eq(users.id, userId));
}

// ============ COACH PROFILE OPERATIONS ============

export async function createCoachProfile(profile: InsertCoachProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(coachProfiles).values(profile);
  return result;
}

export async function getCoachProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCoachWithUser(coachProfileId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(eq(coachProfiles.id, coachProfileId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAvailableCoaches(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(eq(coachProfiles.isAvailable, true))
    .orderBy(desc(coachProfiles.averageRating))
    .limit(limit);

  return result;
}

export async function updateCoachStats(coachId: number) {
  const db = await getDb();
  if (!db) return;

  // Calculate average rating from reviews
  const reviewStats = await db
    .select({
      avgRating: sql<string>`AVG(${reviews.rating})`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(eq(reviews.coachId, coachId));

  const lessonStats = await db
    .select({
      totalLessons: sql<number>`COUNT(*)`,
      totalStudents: sql<number>`COUNT(DISTINCT ${lessons.studentId})`,
    })
    .from(lessons)
    .where(and(
      eq(lessons.coachId, coachId),
      eq(lessons.status, "released")
    ));

  const profile = await getCoachProfileByUserId(coachId);
  if (!profile) return;

  await db.update(coachProfiles)
    .set({
      averageRating: reviewStats[0]?.avgRating || "0.00",
      totalReviews: reviewStats[0]?.totalReviews || 0,
      totalLessons: lessonStats[0]?.totalLessons || 0,
      totalStudents: lessonStats[0]?.totalStudents || 0,
    })
    .where(eq(coachProfiles.userId, coachId));
}

// ============ STUDENT PROFILE OPERATIONS ============

export async function createStudentProfile(profile: InsertStudentProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(studentProfiles).values(profile);
  return result;
}

export async function getStudentProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudentXp(userId: number, xpToAdd: number) {
  const db = await getDb();
  if (!db) return;

  const profile = await getStudentProfileByUserId(userId);
  if (!profile) return;

  const newXp = (profile.totalXp || 0) + xpToAdd;
  const newLevel = Math.floor(newXp / 1000) + 1; // 1000 XP per level

  await db.update(studentProfiles)
    .set({
      totalXp: newXp,
      currentLevel: newLevel,
    })
    .where(eq(studentProfiles.userId, userId));
}

// ============ LESSON OPERATIONS ============

export async function createLesson(lesson: InsertLesson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(lessons).values(lesson);
  return result;
}

export async function getLessonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLessonsByStudent(studentId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(lessons)
    .where(eq(lessons.studentId, studentId))
    .orderBy(desc(lessons.scheduledAt))
    .limit(limit);
}

export async function getLessonsByCoach(coachId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(lessons)
    .where(eq(lessons.coachId, coachId))
    .orderBy(desc(lessons.scheduledAt))
    .limit(limit);
}

export async function updateLessonStatus(
  lessonId: number, 
  status: typeof lessons.$inferSelect["status"],
  additionalFields?: Partial<typeof lessons.$inferSelect>
) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({ status, ...additionalFields })
    .where(eq(lessons.id, lessonId));
}

export async function updateLessonPaymentIntent(lessonId: number, paymentIntentId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({ stripePaymentIntentId: paymentIntentId, status: "paid" })
    .where(eq(lessons.id, lessonId));
}

export async function updateLessonTransfer(lessonId: number, transferId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({ 
      stripeTransferId: transferId, 
      status: "released",
      payoutAt: new Date()
    })
    .where(eq(lessons.id, lessonId));
}

// ============ REVIEW OPERATIONS ============

export async function createReview(review: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reviews).values(review);
  
  // Update coach stats after new review
  await updateCoachStats(review.coachId);
  
  return result;
}

export async function getReviewsByCoach(coachId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.coachId, coachId), eq(reviews.isPublic, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

// ============ ACHIEVEMENT OPERATIONS ============

export async function getAllAchievements() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(achievements);
}

export async function getUserAchievements(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId));
}

export async function grantAchievement(userId: number, achievementId: number) {
  const db = await getDb();
  if (!db) return;

  // Check if already has achievement
  const existing = await db
    .select()
    .from(userAchievements)
    .where(and(
      eq(userAchievements.userId, userId),
      eq(userAchievements.achievementId, achievementId)
    ))
    .limit(1);

  if (existing.length > 0) return; // Already has it

  await db.insert(userAchievements).values({
    userId,
    achievementId,
  });

  // Get achievement XP reward and add to user
  const achievement = await db
    .select()
    .from(achievements)
    .where(eq(achievements.id, achievementId))
    .limit(1);

  if (achievement[0]?.xpReward) {
    await updateStudentXp(userId, achievement[0].xpReward);
  }
}

// ============ COACH MATCH OPERATIONS ============

export async function createCoachMatch(match: InsertCoachMatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(coachMatches).values(match);
}

export async function getMatchesForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(coachMatches)
    .innerJoin(coachProfiles, eq(coachMatches.coachId, coachProfiles.userId))
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(eq(coachMatches.studentId, studentId))
    .orderBy(desc(coachMatches.overallScore));
}

// ============ COACH EARNINGS OPERATIONS ============

/**
 * Get total earnings for a coach (sum of completed lessons)
 * Used for delayed Stripe onboarding - coaches don't need to add payment details until $100 threshold
 */
export async function getCoachTotalEarnings(coachId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${lessons.coachPayoutCents}), 0)`,
    })
    .from(lessons)
    .where(and(
      eq(lessons.coachId, coachId),
      eq(lessons.status, "released")
    ));

  return result[0]?.totalEarnings || 0;
}

/**
 * Get pending earnings (completed but not yet released)
 */
export async function getCoachPendingEarnings(coachId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      pendingEarnings: sql<number>`COALESCE(SUM(${lessons.coachPayoutCents}), 0)`,
    })
    .from(lessons)
    .where(and(
      eq(lessons.coachId, coachId),
      eq(lessons.status, "completed")
    ));

  return result[0]?.pendingEarnings || 0;
}

/**
 * Check if coach has reached the $100 threshold for Stripe onboarding
 * Returns true if total + pending earnings >= $100 (10000 cents)
 */
export async function hasCoachReachedPayoutThreshold(coachId: number, thresholdCents: number = 10000) {
  const totalEarnings = await getCoachTotalEarnings(coachId);
  const pendingEarnings = await getCoachPendingEarnings(coachId);
  return (totalEarnings + pendingEarnings) >= thresholdCents;
}

/**
 * Get coach earnings summary
 */
export async function getCoachEarningsSummary(coachId: number) {
  const totalEarnings = await getCoachTotalEarnings(coachId);
  const pendingEarnings = await getCoachPendingEarnings(coachId);
  const thresholdCents = 10000; // $100
  const hasReachedThreshold = (totalEarnings + pendingEarnings) >= thresholdCents;
  
  return {
    totalEarningsCents: totalEarnings,
    pendingEarningsCents: pendingEarnings,
    combinedEarningsCents: totalEarnings + pendingEarnings,
    thresholdCents,
    hasReachedThreshold,
    percentToThreshold: Math.min(100, Math.round(((totalEarnings + pendingEarnings) / thresholdCents) * 100)),
  };
}

// ============ WAITLIST OPERATIONS ============

export async function addToWaitlist(entry: InsertWaitlist) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(waitlist).values(entry);
    return { success: true };
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, error: "Email already registered" };
    }
    throw error;
  }
}

export async function getWaitlistCount() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(waitlist);

  return result[0]?.count || 0;
}

// ============ COACH APPLICATION OPERATIONS ============

export async function createCoachApplication(application: InsertCoachApplication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(coachApplications).values(application);
  
  // Return the created application with ID
  return {
    id: Number(result[0].insertId),
    ...application,
  };
}

export async function getCoachApplicationByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(coachApplications)
    .where(eq(coachApplications.email, email))
    .orderBy(desc(coachApplications.createdAt))
    .limit(1);

  return result[0] || null;
}

export async function getCoachApplicationById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(coachApplications)
    .where(eq(coachApplications.id, id))
    .limit(1);

  return result[0] || null;
}

export async function getPendingCoachApplications() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(coachApplications)
    .where(eq(coachApplications.status, "pending"))
    .orderBy(desc(coachApplications.createdAt));
}

export async function updateCoachApplicationStatus(
  id: number,
  status: "pending" | "under_review" | "approved" | "rejected" | "withdrawn",
  reviewedBy?: number,
  reviewNotes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(coachApplications)
    .set({
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes,
    })
    .where(eq(coachApplications.id, id));
}
