import { eq, and, desc, sql, gte, lte, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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
  messages,
  InsertCoachProfile,
  InsertStudentProfile,
  InsertLesson,
  InsertReview,
  InsertWaitlist,
  InsertCoachMatch,
  InsertCoachApplication,
  InsertMessage,
  referralCodes,
  referrals,
  InsertReferralCode,
  InsertReferral,
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
  if (!user.email) {
    throw new Error("User email is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      email: user.email,
    };
    const updateSet: Record<string, unknown> = {};

    // Handle nullable text fields
    if (user.name !== undefined) {
      const normalized = user.name ?? null;
      values.name = normalized;
      updateSet.name = normalized;
    }
    
    // Email is required, already set in values
    if (user.email !== undefined && user.email !== values.email) {
      values.email = user.email;
      updateSet.email = user.email;
    }
    
    if (user.loginMethod !== undefined) {
      const normalized = user.loginMethod ?? null;
      values.loginMethod = normalized;
      updateSet.loginMethod = normalized;
    }

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

export async function updateCoachProfile(userId: number, data: Partial<InsertCoachProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Upsert — create the coach profile row if it doesn't yet exist. This is
  // critical for the onboarding wizard: brand-new users (userType="student")
  // have no coach profile until they complete step 7. Without the upsert,
  // step 2-6 saves silently no-op and step 7 server validation throws
  // "Please set your hourly rate" even though the user filled it in.
  const existing = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(coachProfiles).values({ userId, ...data });
    return;
  }

  await db.update(coachProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(coachProfiles.userId, userId));
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; avatarUrl?: string; country?: string; timezone?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ ...data })
    .where(eq(users.id, userId));
}

export async function updateUserType(userId: number, userType: "student" | "coach" | "both") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ userType })
    .where(eq(users.id, userId));
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

export async function getActiveCoaches(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(and(
      eq(coachProfiles.profileActive, true),
      eq(coachProfiles.isAvailable, true)
    ))
    .orderBy(desc(coachProfiles.averageRating))
    .limit(limit)
    .offset(offset);

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
    .where(and(
      eq(reviews.revieweeId, coachId),
      eq(reviews.reviewerType, 'student'),
      eq(reviews.isVisible, true)
    ));

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

export async function createLesson(lesson: Omit<InsertLesson, 'id'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Generate a secure cancellation token for email cancel links
  const crypto = await import('crypto');
  const cancellationToken = crypto.randomBytes(32).toString('hex');

  // Default the confirmation deadline to 24h from now if the caller doesn't
  // provide one (Sprint 4 — auto-decline stale pending_confirmation lessons).
  const confirmationDeadline = lesson.confirmationDeadline
    ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Use raw SQL to bypass Drizzle's automatic field inclusion
  // Only include the fields we actually want to insert
  const result = await db.execute(sql`
    INSERT INTO lessons (
      studentId, coachId, scheduledAt, durationMinutes,
      status, amountCents, commissionCents, coachPayoutCents,
      cancellationToken, confirmationDeadline
    ) VALUES (
      ${lesson.studentId}, ${lesson.coachId}, ${lesson.scheduledAt}, ${lesson.durationMinutes},
      ${lesson.status}, ${lesson.amountCents}, ${lesson.commissionCents}, ${lesson.coachPayoutCents},
      ${cancellationToken}, ${confirmationDeadline}
    )
  `);
  
  // Construct the lesson object manually to avoid transaction isolation issues
  // DO NOT query the database immediately after INSERT
  const insertId = Number(result[0].insertId);
  const now = new Date();
  
  return {
    id: insertId,
    studentId: lesson.studentId,
    coachId: lesson.coachId,
    scheduledAt: lesson.scheduledAt,
    durationMinutes: lesson.durationMinutes,
    timezone: lesson.timezone || null,
    topic: lesson.topic || null,
    notes: lesson.notes || null,
    meetingUrl: lesson.meetingUrl || null,
    status: lesson.status,
    amountCents: lesson.amountCents,
    commissionCents: lesson.commissionCents,
    coachPayoutCents: lesson.coachPayoutCents,
    currency: lesson.currency || "USD",
    stripePaymentIntentId: lesson.stripePaymentIntentId || null,
    stripeTransferId: lesson.stripeTransferId || null,
    coachConfirmedAt: lesson.coachConfirmedAt || null,
    coachDeclinedAt: lesson.coachDeclinedAt || null,
    confirmationDeadline: confirmationDeadline,
    studentConfirmedAt: lesson.studentConfirmedAt || null,
    completedAt: lesson.completedAt || null,
    payoutAt: lesson.payoutAt || null,
    refundWindowEndsAt: lesson.refundWindowEndsAt || null,
    createdAt: lesson.createdAt || now,
    updatedAt: lesson.updatedAt || now,
  };
}

export async function getLessonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  // Use raw SQL to avoid Drizzle transaction isolation issues
  const result: any = await db.execute(sql`
    SELECT * FROM lessons WHERE id = ${id} LIMIT 1
  `);
  
  // Raw SQL returns [rows, fields] - we want the first row
  const rows = result[0];
  return rows && rows.length > 0 ? rows[0] : undefined;
}

export async function getLessonsByStudent(studentId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  // Use raw SQL to avoid Drizzle transaction isolation issues
  const result: any = await db.execute(sql`
    SELECT * FROM lessons 
    WHERE studentId = ${studentId} 
    ORDER BY scheduledAt DESC 
    LIMIT ${limit}
  `);
  
  return result[0] || [];
}

export async function getLessonsByCoach(coachId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  // Use raw SQL to avoid Drizzle transaction isolation issues
  const result: any = await db.execute(sql`
    SELECT * FROM lessons 
    WHERE coachId = ${coachId} 
    ORDER BY scheduledAt DESC 
    LIMIT ${limit}
  `);
  
  return result[0] || [];
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

/**
 * Payment-first model: mark lesson as payment_collected.
 * Sets status, stores the PaymentIntent ID, and resets the confirmation deadline
 * to 24 hours from now (coach has 24h to accept/decline after payment).
 */
export async function updateLessonPaymentCollected(lessonId: number, paymentIntentId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({
      stripePaymentIntentId: paymentIntentId,
      status: "payment_collected",
      confirmationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
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

// R5-1: Atomic compare-and-set — claim the checkout slot only if it's currently NULL.
// Uses Drizzle column references to ensure column name matches schema.
// Returns true if this call won the race (slot was NULL and is now set to a placeholder).
// Returns false if another request already claimed it.
export async function claimLessonCheckoutSlot(lessonId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Atomic UPDATE ... WHERE stripeCheckoutSessionId IS NULL
  // Only succeeds (affectedRows > 0) if no other request has set the value.
  // Uses Drizzle column references so TypeScript catches any column name mismatch.
  const result: any = await db.execute(sql`
    UPDATE ${lessons}
    SET ${lessons.stripeCheckoutSessionId} = '__pending__'
    WHERE ${lessons.id} = ${lessonId} AND ${lessons.stripeCheckoutSessionId} IS NULL
  `);
  // mysql2 returns [ResultSetHeader, ...] where affectedRows indicates success
  const affectedRows = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
  return affectedRows > 0;
}

// R3-2: Set active checkout session on a lesson (idempotency guard)
export async function setLessonCheckoutSession(lessonId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(lessons.id, lessonId));
}

// R7-1: Conditional atomic clear — only clears if the current session ID matches expectedSessionId.
// This prevents a concurrent request from wiping out a __pending__ slot claimed by another request.
// Returns { cleared: boolean, checkoutAttempt: number }.
export async function clearLessonCheckoutSessionIfMatches(
  lessonId: number,
  expectedSessionId: string
): Promise<{ cleared: boolean; checkoutAttempt: number }> {
  const db = await getDb();
  if (!db) return { cleared: false, checkoutAttempt: 0 };

  const result = await db.update(lessons)
    .set({
      stripeCheckoutSessionId: null,
      checkoutAttempt: sql`${lessons.checkoutAttempt} + 1`,
    })
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.stripeCheckoutSessionId, expectedSessionId)
      )
    );

  // MySQL returns affectedRows; if 0, the session ID didn't match (race lost)
  const affectedRows = (result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0;
  if (affectedRows === 0) {
    return { cleared: false, checkoutAttempt: 0 };
  }

  // Read back the incremented value to return it
  const [row] = await db.select({ checkoutAttempt: lessons.checkoutAttempt })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  return { cleared: true, checkoutAttempt: row?.checkoutAttempt ?? 0 };
}

// R7-1: Unconditional clear for webhook use (after payment succeeds, we know the session is ours).
// Used only by the webhook handler where we own the session and there's no race concern.
export async function clearLessonCheckoutSession(lessonId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  await db.update(lessons)
    .set({
      stripeCheckoutSessionId: null,
      checkoutAttempt: sql`${lessons.checkoutAttempt} + 1`,
    })
    .where(eq(lessons.id, lessonId));

  const [row] = await db.select({ checkoutAttempt: lessons.checkoutAttempt })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  return row?.checkoutAttempt ?? 0;
}

export async function getLessonByPaymentIntent(paymentIntentId: string) {
  const db = await getDb();
  if (!db) return null;

  // Raw SQL for consistency with other lesson reads that bypass Drizzle
  // transaction isolation quirks.
  const result: any = await db.execute(sql`
    SELECT * FROM lessons WHERE stripePaymentIntentId = ${paymentIntentId} LIMIT 1
  `);

  const rows = result[0];
  return rows && rows.length > 0 ? rows[0] : null;
}

// ============ REVIEW OPERATIONS ============

export async function createReview(review: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reviews).values(review);
  
  // Update coach stats after new review (if reviewing a coach)
  if (review.reviewerType === 'student') {
    await updateCoachStats(review.revieweeId);
  }
  
  return result;
}

export async function getReviewsByCoach(coachId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(reviews)
    .where(and(
      eq(reviews.revieweeId, coachId),
      eq(reviews.reviewerType, 'student'),
      eq(reviews.isPublic, true),
      eq(reviews.isVisible, true)
    ))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/**
 * Look up the current user's review for a specific lesson (if any).
 */
export async function getReviewByLessonAndReviewer(
  lessonId: number,
  reviewerId: number
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.lessonId, lessonId), eq(reviews.reviewerId, reviewerId)))
    .limit(1);
  return rows[0] || null;
}

/**
 * Look up the "other side" review for a lesson — i.e. if the current reviewer
 * is a student, find the coach's review for the same lesson (or vice versa).
 */
export async function getCounterpartReview(
  lessonId: number,
  reviewerType: "student" | "coach"
) {
  const db = await getDb();
  if (!db) return null;
  const otherType = reviewerType === "student" ? "coach" : "student";
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.lessonId, lessonId), eq(reviews.reviewerType, otherType)))
    .limit(1);
  return rows[0] || null;
}

/**
 * Flip a review's visibility (used when both parties have submitted).
 */
export async function setReviewsVisibleForLesson(lessonId: number) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db
    .update(reviews)
    .set({ isVisible: true, visibleAt: now })
    .where(eq(reviews.lessonId, lessonId));
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
    // Check for duplicate entry errors (MySQL error codes)
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return { success: false, error: "This email is already on the waitlist" };
    }
    // Check if error message contains duplicate-related keywords
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('Duplicate') || errorMsg.includes('duplicate') || errorMsg.includes('unique constraint')) {
      return { success: false, error: "This email is already on the waitlist" };
    }
    // Log unexpected errors for debugging
    console.error('[Waitlist] Unexpected error:', error);
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

export async function getAllWaitlistEntries() {
  const db = await getDb();
  if (!db) return [];

  const entries = await db
    .select()
    .from(waitlist)
    .orderBy(desc(waitlist.createdAt));

  return entries;
}

export async function updateWaitlistEmailStatus(
  email: string,
  updates: {
    confirmationEmailSent?: boolean;
    nurtureEmail1Sent?: boolean;
    nurtureEmail2Sent?: boolean;
    nurtureEmail3Sent?: boolean;
    nurtureEmail4Sent?: boolean;
    nurtureEmail5Sent?: boolean;
    lastEmailSentAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(waitlist)
    .set(updates)
    .where(eq(waitlist.email, email));
}

export async function unsubscribeFromWaitlist(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(waitlist)
    .set({
      unsubscribed: true,
      unsubscribedAt: new Date(),
    })
    .where(eq(waitlist.email, email));

  return { success: true };
}

export async function getWaitlistEntriesForNurture(emailNumber: 1 | 2 | 3 | 4 | 5) {
  const db = await getDb();
  if (!db) return [];

  // Calculate the days since signup based on email number
  // Email 1: 5 days, Email 2: 10 days, Email 3: 15 days, Email 4: 22 days, Email 5: 30 days
  const daysMap = { 1: 5, 2: 10, 3: 15, 4: 22, 5: 30 };
  const targetDays = daysMap[emailNumber];
  
  // Get entries that:
  // 1. Have confirmation email sent
  // 2. Haven't received this nurture email yet
  // 3. Were created targetDays ago (within a 1-day window)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - targetDays);
  const windowStart = new Date(cutoffDate);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(cutoffDate);
  windowEnd.setHours(23, 59, 59, 999);

  // Build the where clause based on which email we're checking
  let whereClause;
  switch (emailNumber) {
    case 1:
      whereClause = and(
        eq(waitlist.confirmationEmailSent, true),
        eq(waitlist.nurtureEmail1Sent, false),
        eq(waitlist.unsubscribed, false),
        gte(waitlist.createdAt, windowStart),
        lte(waitlist.createdAt, windowEnd)
      );
      break;
    case 2:
      whereClause = and(
        eq(waitlist.confirmationEmailSent, true),
        eq(waitlist.nurtureEmail2Sent, false),
        eq(waitlist.unsubscribed, false),
        gte(waitlist.createdAt, windowStart),
        lte(waitlist.createdAt, windowEnd)
      );
      break;
    case 3:
      whereClause = and(
        eq(waitlist.confirmationEmailSent, true),
        eq(waitlist.nurtureEmail3Sent, false),
        eq(waitlist.unsubscribed, false),
        gte(waitlist.createdAt, windowStart),
        lte(waitlist.createdAt, windowEnd)
      );
      break;
    case 4:
      whereClause = and(
        eq(waitlist.confirmationEmailSent, true),
        eq(waitlist.nurtureEmail4Sent, false),
        eq(waitlist.unsubscribed, false),
        gte(waitlist.createdAt, windowStart),
        lte(waitlist.createdAt, windowEnd)
      );
      break;
    case 5:
      whereClause = and(
        eq(waitlist.confirmationEmailSent, true),
        eq(waitlist.nurtureEmail5Sent, false),
        eq(waitlist.unsubscribed, false),
        gte(waitlist.createdAt, windowStart),
        lte(waitlist.createdAt, windowEnd)
      );
      break;
  }
  
  const entries = await db
    .select()
    .from(waitlist)
    .where(whereClause);

  return entries;
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

export async function getCoachApplications(status?: "pending" | "under_review" | "approved" | "rejected" | "withdrawn") {
  const db = await getDb();
  if (!db) return [];

  if (status) {
    return await db
      .select()
      .from(coachApplications)
      .where(eq(coachApplications.status, status))
      .orderBy(desc(coachApplications.createdAt));
  }

  return await db
    .select()
    .from(coachApplications)
    .orderBy(desc(coachApplications.createdAt));
}

export async function getCoachApplicationStats() {
  const db = await getDb();
  if (!db) {
    return {
      pending: 0,
      underReview: 0,
      approvedLast30Days: 0,
      rejectedLast30Days: 0,
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [pendingResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coachApplications)
    .where(eq(coachApplications.status, "pending"));

  const [underReviewResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coachApplications)
    .where(eq(coachApplications.status, "under_review"));

  const [approvedResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coachApplications)
    .where(
      and(
        eq(coachApplications.status, "approved"),
        sql`${coachApplications.reviewedAt} >= ${thirtyDaysAgo}`
      )
    );

  const [rejectedResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coachApplications)
    .where(
      and(
        eq(coachApplications.status, "rejected"),
        sql`${coachApplications.reviewedAt} >= ${thirtyDaysAgo}`
      )
    );

  return {
    pending: pendingResult?.count || 0,
    underReview: underReviewResult?.count || 0,
    approvedLast30Days: approvedResult?.count || 0,
    rejectedLast30Days: rejectedResult?.count || 0,
  };
}



/**
 * Generate a secure cancellation token for a lesson
 */
export async function generateCancellationToken(lessonId: number): Promise<string> {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Store the token in the database
  await db.execute(sql`
    UPDATE lessons 
    SET cancellationToken = ${token}
    WHERE id = ${lessonId}
  `);
  
  return token;
}

/**
 * Cancel a lesson and process refund based on cancellation policy
 * Policy: >48hrs = 100%, 24-48hrs = 50%, <24hrs = 0%
 */
export async function cancelLesson(
  lessonId: number,
  cancelledBy: 'student' | 'coach' | 'system',
  cancellationReason?: string
): Promise<{ success: boolean; refundAmountCents: number; refundPercentage: number }> {
  const lesson = await getLessonById(lessonId);
  
  if (!lesson) {
    throw new Error('Lesson not found');
  }
  
  if (lesson.status === 'cancelled' || lesson.status === 'completed') {
    throw new Error('Lesson cannot be cancelled');
  }
  
  // Calculate hours until lesson
  const now = new Date();
  const lessonTime = new Date(lesson.scheduledAt);
  const hoursUntilLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // Determine refund amount based on cancellation policy
  let refundPercentage = 0;
  if (hoursUntilLesson > 48) {
    refundPercentage = 100; // Full refund
  } else if (hoursUntilLesson >= 24) {
    refundPercentage = 50; // 50% refund
  } else {
    refundPercentage = 0; // No refund
  }
  
  const refundAmountCents = Math.round((lesson.amountCents * refundPercentage) / 100);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Atomically set status to cancelled — prevents double-cancellation race condition
  const updateResult: any = await db.execute(sql`
    UPDATE lessons
    SET
      status = 'cancelled',
      cancelledAt = NOW(),
      cancelledBy = ${cancelledBy},
      cancellationReason = ${cancellationReason || null},
      refundAmountCents = ${refundAmountCents}
    WHERE id = ${lessonId}
      AND status NOT IN ('cancelled', 'completed', 'refunded')
  `);

  // If no rows updated, the lesson was already cancelled/completed
  if (updateResult[0].affectedRows === 0) {
    throw new Error('Lesson cannot be cancelled in its current state');
  }

  // Process Stripe refund if payment was made and refund is due
  let stripeRefundSucceeded = false;
  if (refundAmountCents > 0 && lesson.stripePaymentIntentId) {
    try {
      const stripeService = await import("./stripe");
      await stripeService.createRefund(
        lesson.stripePaymentIntentId,
        refundAmountCents,
        "requested_by_customer"
      );
      stripeRefundSucceeded = true;
    } catch (err) {
      console.error(`[cancelLesson] Stripe refund failed for lesson ${lessonId}:`, err);
    }
  }

  // Only mark refundProcessedAt if Stripe refund actually succeeded
  if (stripeRefundSucceeded) {
    await db.execute(sql`
      UPDATE lessons
      SET refundProcessedAt = NOW()
      WHERE id = ${lessonId}
    `);
  }

  return {
    success: true,
    refundAmountCents,
    refundPercentage
  };
}

/**
 * Verify cancellation token for secure cancellation
 */
export async function verifyCancellationToken(lessonId: number, token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result: any = await db.execute(sql`
    SELECT cancellationToken 
    FROM lessons 
    WHERE id = ${lessonId}
  `);
  
  const rows = result[0];
  if (!rows || rows.length === 0) {
    return false;
  }
  
  const lesson = rows[0] as any;
  if (!lesson.cancellationToken || !token) return false;
  // Use constant-time comparison to prevent timing attacks
  const crypto = await import('crypto');
  const a = Buffer.from(lesson.cancellationToken);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ============ MESSAGE OPERATIONS ============

export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: any = await db.execute(sql`
    INSERT INTO messages (lessonId, senderId, contentType, content)
    VALUES (${message.lessonId}, ${message.senderId}, ${message.contentType || "text"}, ${message.content})
  `);
  const insertId = Number(result[0]?.insertId);
  return {
    id: insertId,
    lessonId: message.lessonId,
    senderId: message.senderId,
    contentType: message.contentType || "text",
    content: message.content,
    readAt: null as Date | null,
    createdAt: new Date(),
  };
}

export async function getMessagesForLesson(lessonId: number, limit: number = 200) {
  const db = await getDb();
  if (!db) return [] as any[];

  const result: any = await db.execute(sql`
    SELECT * FROM messages
    WHERE lessonId = ${lessonId}
    ORDER BY createdAt ASC
    LIMIT ${limit}
  `);
  return (result[0] || []) as any[];
}

/**
 * Mark all messages in a lesson as read for everyone except the specified user.
 * (The user opening the thread marks the counterpart's messages as read.)
 */
export async function markLessonMessagesRead(lessonId: number, readerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE messages
    SET readAt = NOW()
    WHERE lessonId = ${lessonId}
      AND senderId <> ${readerId}
      AND readAt IS NULL
  `);
}

/**
 * Count unread messages per lesson for a given reader. Returns a Map of
 * lessonId -> unread count.
 */
export async function getUnreadMessageCountsForUser(
  userId: number,
  lessonIds: number[]
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (lessonIds.length === 0) return counts;

  const db = await getDb();
  if (!db) return counts;

  // mysql2 interpolates arrays as a comma list when passed via sql.join
  const result: any = await db.execute(sql`
    SELECT lessonId, COUNT(*) AS unread
    FROM messages
    WHERE readAt IS NULL
      AND senderId <> ${userId}
      AND lessonId IN (${sql.join(lessonIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY lessonId
  `);
  const rows = (result[0] || []) as { lessonId: number; unread: number | string }[];
  for (const row of rows) {
    counts.set(Number(row.lessonId), Number(row.unread));
  }
  return counts;
}

// ============ USER SETTINGS OPERATIONS ============

export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

export async function updateNotificationPreferences(userId: number, prefs: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ notificationPreferences: prefs }).where(eq(users.id, userId));
}

export async function softDeleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
}

// ============ REFERRAL OPERATIONS ============

export async function createReferralCode(data: InsertReferralCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(referralCodes).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function getReferralCodeByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(referralCodes)
    .where(and(eq(referralCodes.coachId, coachId), eq(referralCodes.isActive, true)))
    .limit(1);
  return rows[0] || null;
}

export async function getReferralCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(referralCodes)
    .where(and(eq(referralCodes.code, code), eq(referralCodes.isActive, true)))
    .limit(1);
  return rows[0] || null;
}

export async function createReferral(data: InsertReferral) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(referrals).values(data);
}

export async function getReferralStats(coachId: number) {
  const db = await getDb();
  if (!db) return { totalReferrals: 0, completedLessons: 0, creditsEarned: 0 };

  const code = await getReferralCodeByCoach(coachId);
  if (!code) return { totalReferrals: 0, completedLessons: 0, creditsEarned: 0 };

  const [stats] = await db.select({
    totalReferrals: sql<number>`COUNT(*)`,
    completedLessons: sql<number>`SUM(CASE WHEN ${referrals.status} IN ('lesson_completed','reward_issued') THEN 1 ELSE 0 END)`,
    creditsEarned: sql<number>`SUM(CASE WHEN ${referrals.status} = 'reward_issued' THEN 500 ELSE 0 END)`,
  }).from(referrals).where(eq(referrals.referralCodeId, code.id));

  return {
    totalReferrals: stats?.totalReferrals || 0,
    completedLessons: stats?.completedLessons || 0,
    creditsEarned: stats?.creditsEarned || 0,
  };
}

export async function incrementReferralCodeUses(codeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(referralCodes)
    .set({ totalUses: sql`${referralCodes.totalUses} + 1` })
    .where(eq(referralCodes.id, codeId));
}


// ============ DISPUTE & PAYOUT HELPERS ============

/**
 * Get all lessons with a specific status (for admin views).
 */
export async function getLessonsByStatus(status: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(lessons).where(eq(lessons.status, status as any));
}

/**
 * Get completed lessons where the 24-hour issue window has expired
 * and no dispute was raised — these are ready for coach payout release.
 * Only returns lessons that haven't already been paid out (no stripeTransferId).
 */
export async function getCompletedLessonsReadyForPayout() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(lessons).where(
    and(
      eq(lessons.status, "completed"),
      isNotNull(lessons.issueWindowEndsAt),
      sql`${lessons.issueWindowEndsAt} < NOW()`,
      isNull(lessons.stripeTransferId),
    )
  );
}
