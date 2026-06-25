import { eq, and, or, desc, ne, sql, gte, lte, isNotNull, isNull, inArray } from "drizzle-orm";
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
  pgnAnalyses,
  InsertPgnAnalysis,
  referrals,
  InsertReferralCode,
  InsertReferral,
  tips,
  InsertTip,
  lessonDisputes,
  type DisputeCategory,
  contentRequests,
  InsertContentRequest,
  type ContentRequest,
  contentItems,
  contentPurchases,
  type InsertContentItem,
  type ContentItem,
  coachSubscriptionSettings,
  coachSubscriptions,
  notifications,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { computeCancellationRefund } from "@shared/cancellationPolicy";
import { COACH_PENDING_STATUSES, buildCoachEarningsSummary } from "@shared/coachEarnings";

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

/**
 * Batch-fetch minimal display info (id, name, email) for a set of user IDs.
 * Used by the admin disputes panel to resolve raw student/coach IDs to names.
 * De-duplicates input IDs; returns only the rows that exist.
 */
export async function getUsersByIds(
  ids: number[]
): Promise<{ id: number; name: string | null; email: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return [];

  const result = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, uniqueIds));

  return result;
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
      eq(reviews.coachId, coachId),
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
      inArray(lessons.status, ["completed", "released"])
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

export async function updateStudentProfile(
  userId: number,
  data: Partial<InsertStudentProfile>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(studentProfiles).set(data).where(eq(studentProfiles.userId, userId));
}

export async function getWaitlistEntryByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudentChessProfiles(
  userId: number,
  data: { chesscomUsername?: string; lichessUsername?: string; fideId?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(studentProfiles).set(data).where(eq(studentProfiles.userId, userId));
}

export async function updateStudentRating(userId: number, currentRating: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(studentProfiles)
    .set({ currentRating })
    .where(eq(studentProfiles.userId, userId));
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

  // Use raw SQL to avoid Drizzle transaction isolation issues.
  // LEFT JOIN users to resolve the coach's display name (coachName) so the
  // student dashboard can render "Lesson with <Coach>" instead of a raw ID.
  const result: any = await db.execute(sql`
    SELECT l.*, u.name AS coachName
    FROM lessons l
    LEFT JOIN users u ON u.id = l.coachId
    WHERE l.studentId = ${studentId}
    ORDER BY l.scheduledAt DESC
    LIMIT ${limit}
  `);

  return result[0] || [];
}

export async function getLessonsByCoach(coachId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  // LEFT JOIN users to resolve the student's display name (studentName) so the
  // coach dashboard can render the student's name instead of a raw ID (S46-1).
  const result: any = await db.execute(sql`
    SELECT l.*, u.name AS studentName
    FROM lessons l
    LEFT JOIN users u ON u.id = l.studentId
    WHERE l.coachId = ${coachId}
    ORDER BY l.scheduledAt DESC
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
export async function updateLessonPaymentCollected(
  lessonId: number,
  paymentIntentId: string,
  chargeId?: string | null,
) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({
      stripePaymentIntentId: paymentIntentId,
      // Only overwrite the charge when we actually resolved one — never null out
      // a previously stored charge on a webhook retry.
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
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
    await updateCoachStats(review.coachId);
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
      eq(reviews.coachId, coachId),
      eq(reviews.reviewerType, 'student'),
      eq(reviews.isPublic, true),
      eq(reviews.isVisible, true)
    ))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/**
 * Public reviews for a coach, with the reviewing student's name joined in
 * (S-PROFILE-1). Same filter as getReviewsByCoach + a LEFT JOIN on users so a
 * deleted student yields a null reviewerName rather than dropping the review.
 */
export async function getReviewsByCoachWithStudentName(coachId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: reviews.id,
      lessonId: reviews.lessonId,
      studentId: reviews.studentId,
      coachId: reviews.coachId,
      reviewerType: reviews.reviewerType,
      rating: reviews.rating,
      comment: reviews.comment,
      knowledgeRating: reviews.knowledgeRating,
      communicationRating: reviews.communicationRating,
      preparednessRating: reviews.preparednessRating,
      isVisible: reviews.isVisible,
      isPublic: reviews.isPublic,
      createdAt: reviews.createdAt,
      reviewerName: users.name,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.studentId, users.id))
    .where(and(
      eq(reviews.coachId, coachId),
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
  userId: number
) {
  const db = await getDb();
  if (!db) return null;
  // The id must be PAIRED with the role: both review rows of a lesson carry
  // the same studentId/coachId, so a plain (studentId=u OR coachId=u) match
  // would return the OTHER party's review too (S-REV-1 handoff correction).
  const rows = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.lessonId, lessonId),
        or(
          and(eq(reviews.studentId, userId), eq(reviews.reviewerType, "student")),
          and(eq(reviews.coachId, userId), eq(reviews.reviewerType, "coach"))
        )
      )
    )
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

  // S46-4: money is escrowed for the coach across all of these states — the
  // student has already paid (payment_collected / confirmed) or the lesson is
  // done and awaiting payout (completed). "Pending" should reflect all of them,
  // not just completed.
  const result = await db
    .select({
      pendingEarnings: sql<number>`COALESCE(SUM(${lessons.coachPayoutCents}), 0)`,
    })
    .from(lessons)
    .where(and(
      eq(lessons.coachId, coachId),
      inArray(lessons.status, [...COACH_PENDING_STATUSES])
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
export async function getCoachContentEarnings(coachId: number): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  const result = await database
    .select({
      total: sql<number>`COALESCE(SUM(${contentPurchases.amountPaidCents}), 0)`,
    })
    .from(contentPurchases)
    .innerJoin(contentItems, eq(contentItems.id, contentPurchases.contentItemId))
    .where(eq(contentItems.coachId, coachId));
  return result[0]?.total || 0;
}

export async function getCoachEarningsSummary(coachId: number) {
  const totalEarnings = await getCoachTotalEarnings(coachId);
  const pendingEarnings = await getCoachPendingEarnings(coachId);
  const contentEarnings = await getCoachContentEarnings(coachId);
  return {
    ...buildCoachEarningsSummary(totalEarnings, pendingEarnings),
    contentEarningsCents: contentEarnings,
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
  
  // Refund policy (S45-1 1-hour cutoff, S45-6 free for unpaid) — shared helper.
  const { refundPercentage, refundAmountCents } = computeCancellationRefund({
    amountCents: lesson.amountCents,
    scheduledAt: lesson.scheduledAt,
    stripePaymentIntentId: lesson.stripePaymentIntentId,
  });

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

/**
 * Flag a lesson as having a failed refund attempt.
 * Used when Stripe refund creation fails during coach decline or auto-decline.
 * The lesson remains in its current status (payment_collected) so admin can retry.
 * The cancellationReason is updated to make it visible in admin views.
 */
export async function flagLessonRefundFailed(lessonId: number, reason: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(lessons)
    .set({
      cancellationReason: `REFUND_FAILED: ${reason}`,
      cancelledBy: "system",
    })
    .where(eq(lessons.id, lessonId));
}

/**
 * Atomic CAS for payout release — claim the payout slot only if it's currently NULL.
 * Uses a WHERE stripeTransferId IS NULL guard to prevent double-transfer under concurrent calls.
 * Returns true if this call won the race (slot was NULL and is now set to a placeholder).
 * Returns false if another request already claimed it (stripeTransferId was already set).
 *
 * The caller must then perform the actual Stripe transfer and update with the real transfer ID.
 * If the Stripe transfer fails, the caller should clear the placeholder so the slot can be retried.
 */
export async function claimLessonPayoutSlot(lessonId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result: any = await db.execute(sql`
    UPDATE lessons
    SET stripeTransferId = '__pending_payout__'
    WHERE id = ${lessonId}
      AND stripeTransferId IS NULL
      AND status IN ('completed', 'disputed')
  `);

  return result[0]?.affectedRows === 1;
}

/**
 * Finalize a payout after a successful Stripe transfer.
 * Replaces the __pending_payout__ placeholder with the real transfer ID.
 */
export async function finalizeLessonPayout(lessonId: number, transferId: string) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET stripeTransferId = ${transferId},
        status = 'released',
        payoutAt = NOW()
    WHERE id = ${lessonId}
      AND stripeTransferId = '__pending_payout__'
  `);

  const lesson = await getLessonById(lessonId);
  if (lesson) {
    await updateCoachStats(lesson.coachId);
  }
}

/**
 * Release the payout slot placeholder if the Stripe transfer failed.
 * This allows the admin to retry the payout.
 */
export async function releaseLessonPayoutSlot(lessonId: number) {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET stripeTransferId = NULL
    WHERE id = ${lessonId}
      AND stripeTransferId = '__pending_payout__'
  `);
}

/**
 * S29-1: Atomic CAS for coach accept/decline.
 *
 * Transitions the lesson from `payment_collected` to either `confirmed` (accept)
 * or `decline_pending` (decline) in a single UPDATE ... WHERE status = 'payment_collected'.
 *
 * Returns true if this call won the race (row was in payment_collected and is now claimed).
 * Returns false if another request already transitioned the row (concurrent accept or decline).
 *
 * For accept: the caller may proceed immediately — no Stripe call needed.
 * For decline: the caller must attempt the Stripe refund, then call finalizeCoachDecline()
 *   on success or releaseCoachDeclineClaim() on failure.
 */
export async function claimLessonCoachDecision(
  lessonId: number,
  toStatus: 'confirmed' | 'decline_pending'
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result: any = await db.execute(sql`
    UPDATE lessons
    SET status = ${toStatus},
        coachConfirmedAt = CASE WHEN ${toStatus} = 'confirmed' THEN NOW() ELSE coachConfirmedAt END,
        coachDeclinedAt  = CASE WHEN ${toStatus} = 'decline_pending' THEN NOW() ELSE coachDeclinedAt END
    WHERE id = ${lessonId}
      AND status = 'payment_collected'
  `);

  return result[0]?.affectedRows === 1;
}

/**
 * Finalize coach decline after Stripe refund succeeds.
 * Transitions from decline_pending → declined.
 */
export async function finalizeCoachDecline(
  lessonId: number,
  refundAmountCents: number,
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET status = 'declined',
        refundAmountCents = ${refundAmountCents},
        refundProcessedAt = NOW(),
        cancellationReason = ${reason}
    WHERE id = ${lessonId}
      AND status = 'decline_pending'
  `);
}

/**
 * Release the coach decline claim if Stripe refund fails.
 * Transitions from decline_pending → payment_collected so admin can retry.
 */
export async function releaseCoachDeclineClaim(lessonId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET status = 'payment_collected',
        coachDeclinedAt = NULL,
        cancellationReason = 'REFUND_FAILED: Coach decline refund failed — admin retry required'
    WHERE id = ${lessonId}
      AND status = 'decline_pending'
  `);
}

/**
 * S29-4: Atomic CAS for student cancellation.
 *
 * Transitions the lesson from a cancellable status to `cancel_pending` in a single
 * UPDATE ... WHERE status NOT IN (terminal states).
 *
 * Returns the lesson's refund calculation fields if the claim succeeded, or null if
 * the lesson was already in a terminal state (concurrent cancel or completion).
 */
export async function claimLessonCancellation(
  lessonId: number,
  cancelledBy: 'student' | 'coach' | 'system',
  cancellationReason: string | undefined
): Promise<{ refundAmountCents: number; refundPercentage: number } | null> {
  const lesson = await getLessonById(lessonId);
  if (!lesson) return null;

  // Refund policy (S45-1 1-hour cutoff, S45-6 free for unpaid) — shared helper.
  const { refundPercentage, refundAmountCents } = computeCancellationRefund({
    amountCents: lesson.amountCents,
    scheduledAt: lesson.scheduledAt,
    stripePaymentIntentId: lesson.stripePaymentIntentId,
  });

  const db = await getDb();
  if (!db) return null;

  // S30-4: Atomic CAS: claim the cancellation slot.
  // Use an explicit ALLOWLIST of pre-completion statuses to prevent cancellation of
  // disputed, no_show, or any future terminal/post-completion states.
  // Only these statuses represent a lesson that has not yet been completed or settled:
  //   - pending_payment: booking created, student hasn't paid yet
  //   - payment_collected: student paid, coach hasn't confirmed yet
  //   - confirmed: coach confirmed, lesson hasn't happened yet
  const result: any = await db.execute(sql`
    UPDATE lessons
    SET status = 'cancel_pending',
        cancelledAt = NOW(),
        cancelledBy = ${cancelledBy},
        cancellationReason = ${cancellationReason || null},
        refundAmountCents = ${refundAmountCents}
    WHERE id = ${lessonId}
      AND status IN ('pending_payment', 'payment_collected', 'confirmed')
  `);

  if (result[0]?.affectedRows !== 1) return null;

  return { refundAmountCents, refundPercentage };
}

/**
 * Finalize student cancellation after Stripe refund succeeds (or when no refund is due).
 * Transitions from cancel_pending → cancelled.
 */
export async function finalizeCancellation(
  lessonId: number,
  refundSucceeded: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET status = 'cancelled',
        refundProcessedAt = CASE WHEN ${refundSucceeded} THEN NOW() ELSE refundProcessedAt END
    WHERE id = ${lessonId}
      AND status = 'cancel_pending'
  `);
}

/**
 * Release the cancellation claim if Stripe refund fails.
 * Transitions from cancel_pending → cancelled but flags the refund failure.
 * The lesson is still cancelled (student cannot re-book), but the refund needs admin retry.
 */
export async function releaseCancellationWithRefundFailed(lessonId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET status = 'cancelled',
        cancellationReason = CONCAT(COALESCE(cancellationReason, ''), ' [REFUND_FAILED: Stripe refund creation failed — admin retry required]')
    WHERE id = ${lessonId}
      AND status = 'cancel_pending'
  `);
}

/**
 * S30-1: Atomic settlement claim for admin refund.
 * Atomically sets stripeTransferId = '__pending_refund__' only when:
 *   - stripeTransferId IS NULL (no payout in flight or completed)
 *   - status is in the refundable set (disputed, completed)
 * Returns true if the claim was won (affectedRows = 1), false if lost to a concurrent payout.
 */
/**
 * S31-4: Claim the refund slot AND store the intended refund amount atomically.
 * This allows recovery to reconstruct the correct amount after a process crash.
 */
export async function claimLessonRefundSlot(lessonId: number, intendedRefundAmountCents?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result: any = await db.execute(sql`
    UPDATE lessons
    SET stripeTransferId = '__pending_refund__',
        -- Store intended refund amount so recovery can reconstruct it after a crash.
        -- Only set if provided; leave existing value if NULL is passed.
        refundAmountCents = COALESCE(${intendedRefundAmountCents ?? null}, refundAmountCents)
    WHERE id = ${lessonId}
      AND stripeTransferId IS NULL
      AND status IN ('disputed', 'completed')
  `);

  return result[0]?.affectedRows === 1;
}

/**
 * Finalize admin refund: clear the __pending_refund__ slot and mark lesson as refunded.
 * Only transitions from the pending state to prevent double-finalization.
 */
export async function finalizeAdminRefund(
  lessonId: number,
  refundAmountCents: number,
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET status = 'refunded',
        stripeTransferId = NULL,
        refundAmountCents = ${refundAmountCents},
        refundProcessedAt = NOW(),
        cancellationReason = ${reason}
    WHERE id = ${lessonId}
      AND stripeTransferId = '__pending_refund__'
  `);
}

/**
 * Release the __pending_refund__ slot back to NULL on Stripe failure.
 * Allows the admin to retry.
 */
export async function releaseAdminRefundClaim(lessonId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`
    UPDATE lessons
    SET stripeTransferId = NULL
    WHERE id = ${lessonId}
      AND stripeTransferId = '__pending_refund__'
  `);
}

// ─── S38: Post-payout transfer reversal helpers ───────────────────────────────

/**
 * S38: Atomically claim the reversal slot for a released lesson.
 * Sets stripeReversalId = '__pending_reversal__' only when:
 *   - status = 'released'   (payout has been made)
 *   - stripeReversalId IS NULL  (no reversal in progress or completed)
 *
 * Returns true if the claim was won (affectedRows = 1), false otherwise.
 */
export async function claimPostPayoutReversalSlot(
  lessonId: number,
  intendedReversalAmountCents: number,
  intendedStudentRefundCents: number  // S38P2: persist at claim time for stable retry/recovery
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE lessons
    SET stripeReversalId = '__pending_reversal__',
        stripeReversalAmountCents = ${intendedReversalAmountCents},
        stripeIntendedStudentRefundCents = ${intendedStudentRefundCents}
    WHERE id = ${lessonId}
      AND status = 'released'
      AND stripeReversalId IS NULL
  `);
  return result[0]?.affectedRows === 1;
}

/**
 * S38: Advance the slot from '__pending_reversal__' to '__pending_post_payout_refund__'
 * after the Stripe transfer reversal succeeds.
 * Stores the real Stripe reversal ID for idempotency and audit.
 */
export async function advanceToPostPayoutRefundSlot(
  lessonId: number,
  stripeReversalId: string
): Promise<boolean> {  // S38P2: return CAS success
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE lessons
    SET stripeReversalId = ${stripeReversalId},
        stripePostPayoutRefundId = '__pending_post_payout_refund__'
    WHERE id = ${lessonId}
      AND stripeReversalId = '__pending_reversal__'
  `);
  return result[0]?.affectedRows === 1;
}

/**
 * S38: Finalize the post-payout refund after both Stripe operations succeed.
 * Stores the real Stripe refund ID, sets status = 'refunded', records amounts.
 */
export async function finalizePostPayoutRefund(
  lessonId: number,
  stripeRefundId: string,
  refundAmountCents: number,
  reason: string
): Promise<boolean> {  // S38P2: return CAS success
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE lessons
    SET status = 'refunded',
        stripePostPayoutRefundId = ${stripeRefundId},
        refundAmountCents = ${refundAmountCents},
        refundProcessedAt = NOW(),
        cancellationReason = ${reason}
    WHERE id = ${lessonId}
      AND stripePostPayoutRefundId = '__pending_post_payout_refund__'
  `);
  return result[0]?.affectedRows === 1;
}

/**
 * S38: Release the reversal slot back to NULL on Stripe failure (before reversal).
 * Allows the admin to retry.
 */
export async function releasePostPayoutReversalClaim(lessonId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE lessons
    SET stripeReversalId = NULL,
        stripeReversalAmountCents = NULL,
        stripeIntendedStudentRefundCents = NULL
    WHERE id = ${lessonId}
      AND stripeReversalId = '__pending_reversal__'
  `);
}

/**
 * S38: Release the post-payout refund slot on Stripe refund failure.
 * Only releases if in '__pending_post_payout_refund__' state.
 * The stripeReversalId already holds the real reversal ID at this point.
 * Allows the admin to retry the refund step.
 */
export async function releasePostPayoutRefundClaim(lessonId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE lessons
    SET stripePostPayoutRefundId = NULL
    WHERE id = ${lessonId}
      AND stripePostPayoutRefundId = '__pending_post_payout_refund__'
  `);
}

/**
 * S38P Fix 2: Claim the post-payout refund slot when the transfer reversal is already done.
 * This is the correct retry helper for the case where stripeReversalId holds a real trr_ ID
 * (reversal succeeded) but stripePostPayoutRefundId is still NULL (refund failed or never ran).
 *
 * advanceToPostPayoutRefundSlot cannot be used here because it only matches
 * WHERE stripeReversalId = '__pending_reversal__', which would affect 0 rows.
 *
 * Guards:
 *   - status = 'released'           (lesson must still be in released state)
 *   - stripeReversalId = expectedId  (must match the real reversal ID we already have)
 *   - stripePostPayoutRefundId IS NULL (no concurrent refund in progress)
 */
export async function claimPostPayoutRefundSlotAfterReversal(
  lessonId: number,
  expectedReversalId: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE lessons
    SET stripePostPayoutRefundId = '__pending_post_payout_refund__'
    WHERE id = ${lessonId}
      AND status = 'released'
      AND stripeReversalId = ${expectedReversalId}
      AND stripePostPayoutRefundId IS NULL
  `);
  return result[0]?.affectedRows === 1;
}

/**
 * S38P2: Recovery helper — fetch lessons stuck in __pending_post_payout_refund__ state.
 * Returns the stored stripeIntendedStudentRefundCents so recovery uses the original
 * intended amount, not a re-computed value from a new request.
 */
export async function getStuckPostPayoutRefundLessons(stuckBeforeMs: number): Promise<Array<{
  id: number;
  stripeReversalId: string;
  stripeIntendedStudentRefundCents: number;
  amountCents: number;
  coachPayoutCents: number;
  adminOverrideReason: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - stuckBeforeMs);
  const rows: any = await db.execute(sql`
    SELECT id, stripeReversalId, stripeIntendedStudentRefundCents,
           amountCents, coachPayoutCents, adminOverrideReason
    FROM lessons
    WHERE stripePostPayoutRefundId = '__pending_post_payout_refund__'
      AND updatedAt < ${cutoff}
  `);
  return (rows[0] ?? []).map((r: any) => ({
    id: r.id,
    stripeReversalId: r.stripeReversalId,
    stripeIntendedStudentRefundCents: r.stripeIntendedStudentRefundCents ?? r.amountCents,
    amountCents: r.amountCents,
    coachPayoutCents: r.coachPayoutCents,
    adminOverrideReason: r.adminOverrideReason ?? null,
  }));
}

// ============ PGN ANALYSIS OPERATIONS (Sprint 50) ============

export async function createPgnAnalysis(data: InsertPgnAnalysis) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pgnAnalyses).values(data);
  return { id: Number(result[0].insertId) };
}

/** Update the annotated PGN. Scoped to the owning student — returns false if
 *  no row matched (not found OR not owned). */
export async function updatePgnAnalysis(
  id: number,
  studentId: number,
  annotatedPgn: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db
    .update(pgnAnalyses)
    .set({ annotatedPgn })
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.studentId, studentId)));
  return (result[0]?.affectedRows ?? 0) > 0;
}

export async function getPgnAnalysisById(id: number, studentId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pgnAnalyses)
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.studentId, studentId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPgnAnalysesByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(pgnAnalyses)
    .where(eq(pgnAnalyses.studentId, studentId))
    .orderBy(desc(pgnAnalyses.updatedAt));
}

export async function markPgnAnalysisSent(id: number, annotatedPgn: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(pgnAnalyses)
    .set({ status: "sent", sentAt: new Date(), annotatedPgn })
    .where(eq(pgnAnalyses.id, id));
}

// ============ PGN ANALYSIS — COACH-SCOPED HELPERS (Sprint 50 Fix-1) ============

export async function getPgnAnalysisByIdForCoach(id: number, coachId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pgnAnalyses)
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.coachId, coachId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updatePgnAnalysisForCoach(
  id: number,
  coachId: number,
  annotatedPgn: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db
    .update(pgnAnalyses)
    .set({ annotatedPgn })
    .where(and(eq(pgnAnalyses.id, id), eq(pgnAnalyses.coachId, coachId)));
  return (result[0]?.affectedRows ?? 0) > 0;
}

export async function listPgnAnalysesByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(pgnAnalyses)
    .where(eq(pgnAnalyses.coachId, coachId))
    .orderBy(desc(pgnAnalyses.updatedAt));
}

// ============ TIPS (S-UI-1) ============

export async function createTip(tip: InsertTip) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tips).values(tip);
  return result;
}

export async function getTipByLessonAndStudent(lessonId: number, studentId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(tips)
    .where(and(eq(tips.lessonId, lessonId), eq(tips.studentId, studentId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTipByCheckoutSession(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(tips)
    .where(eq(tips.stripeCheckoutSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateTipStatus(
  tipId: number,
  status: "pending" | "paid" | "transferred" | "failed",
  extra?: { paidAt?: Date; transferredAt?: Date; stripeTransferId?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tips)
    .set({ status, ...extra })
    .where(eq(tips.id, tipId));
}

export async function setTipCheckoutSession(tipId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tips)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(tips.id, tipId));
}

export async function deleteTip(tipId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tips).where(eq(tips.id, tipId));
}

// ============ LESSON DISPUTES (S-REF-1) ============

export async function createLessonDispute(data: {
  lessonId: number;
  raisedBy: number;
  category: DisputeCategory;
  description: string | null;
  evidenceUrls?: string[] | null;
  status?: string;
  resolution?: string;
  abuseFlag?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.insert(lessonDisputes).values({
    lessonId: data.lessonId,
    raisedBy: data.raisedBy,
    category: data.category,
    description: data.description,
    evidenceUrls: data.evidenceUrls ? JSON.stringify(data.evidenceUrls) : null,
    ...(data.status ? { status: data.status as any } : {}),
    ...(data.resolution ? { resolution: data.resolution as any, resolvedAt: new Date(), resolvedBy: "system" as const } : {}),
    ...(data.abuseFlag !== undefined ? { abuseFlag: data.abuseFlag } : {}),
  });
  return result[0]?.insertId ?? null;
}

export async function getDisputeByLessonId(lessonId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(lessonDisputes)
    .where(eq(lessonDisputes.lessonId, lessonId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDisputeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(lessonDisputes)
    .where(eq(lessonDisputes.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function countNonNoShowDisputesByStudent(studentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(lessonDisputes)
    .where(and(
      eq(lessonDisputes.raisedBy, studentId),
      sql`${lessonDisputes.category} != 'coach_no_show'`
    ));
  return rows[0]?.count ?? 0;
}

/**
 * Return all lesson_disputes rows joined with basic lesson + raiser (student)
 * info, newest first. Powers the admin Lesson Disputes panel (S-REF-2).
 */
export async function getAllLessonDisputes() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: lessonDisputes.id,
      lessonId: lessonDisputes.lessonId,
      raisedBy: lessonDisputes.raisedBy,
      category: lessonDisputes.category,
      description: lessonDisputes.description,
      evidenceUrls: lessonDisputes.evidenceUrls,
      status: lessonDisputes.status,
      coachResponse: lessonDisputes.coachResponse,
      coachRespondedAt: lessonDisputes.coachRespondedAt,
      coachAction: lessonDisputes.coachAction,
      resolution: lessonDisputes.resolution,
      refundAmountCents: lessonDisputes.refundAmountCents,
      resolvedBy: lessonDisputes.resolvedBy,
      resolvedAt: lessonDisputes.resolvedAt,
      adminNote: lessonDisputes.adminNote,
      abuseFlag: lessonDisputes.abuseFlag,
      createdAt: lessonDisputes.createdAt,
      updatedAt: lessonDisputes.updatedAt,
      lessonAmountCents: lessons.amountCents,
      lessonStatus: lessons.status,
      lessonScheduledAt: lessons.scheduledAt,
      lessonStripePaymentIntentId: lessons.stripePaymentIntentId,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(lessonDisputes)
    .leftJoin(lessons, eq(lessonDisputes.lessonId, lessons.id))
    .leftJoin(users, eq(lessonDisputes.raisedBy, users.id))
    .orderBy(desc(lessonDisputes.createdAt));
}

/**
 * Update a lesson_dispute row (admin resolution, S-REF-2).
 */
export async function updateLessonDispute(
  id: number,
  data: {
    status?: string;
    resolution?: string;
    refundAmountCents?: number | null;
    resolvedBy?: "coach" | "admin" | "system";
    resolvedAt?: Date;
    adminNote?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(lessonDisputes)
    .set({
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.resolution ? { resolution: data.resolution as any } : {}),
      ...(data.refundAmountCents !== undefined ? { refundAmountCents: data.refundAmountCents } : {}),
      ...(data.resolvedBy ? { resolvedBy: data.resolvedBy } : {}),
      ...(data.resolvedAt ? { resolvedAt: data.resolvedAt } : {}),
      ...(data.adminNote !== undefined ? { adminNote: data.adminNote } : {}),
    })
    .where(eq(lessonDisputes.id, id));
}

// Content Requests (S-DASH-1)

export async function createContentRequest(data: InsertContentRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.insert(contentRequests).values(data);
  return result[0]?.insertId ?? null;
}

export async function getContentRequestsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: contentRequests.id,
      studentId: contentRequests.studentId,
      coachId: contentRequests.coachId,
      title: contentRequests.title,
      description: contentRequests.description,
      amountCents: contentRequests.amountCents,
      status: contentRequests.status,
      dueDate: contentRequests.dueDate,
      deliveredAt: contentRequests.deliveredAt,
      coachNote: contentRequests.coachNote,
      contentItemId: contentRequests.contentItemId,
      createdAt: contentRequests.createdAt,
      coachName: users.name,
    })
    .from(contentRequests)
    .leftJoin(users, eq(contentRequests.coachId, users.id))
    .where(eq(contentRequests.studentId, studentId))
    .orderBy(desc(contentRequests.createdAt));
}

export async function getContentRequestsByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: contentRequests.id,
      studentId: contentRequests.studentId,
      coachId: contentRequests.coachId,
      title: contentRequests.title,
      description: contentRequests.description,
      amountCents: contentRequests.amountCents,
      status: contentRequests.status,
      dueDate: contentRequests.dueDate,
      deliveredAt: contentRequests.deliveredAt,
      coachNote: contentRequests.coachNote,
      contentItemId: contentRequests.contentItemId,
      createdAt: contentRequests.createdAt,
      studentName: users.name,
    })
    .from(contentRequests)
    .leftJoin(users, eq(contentRequests.studentId, users.id))
    .where(and(
      eq(contentRequests.coachId, coachId),
      ne(contentRequests.status, "cancelled")
    ))
    .orderBy(contentRequests.status, desc(contentRequests.dueDate));
}

export async function getContentRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentRequests).where(eq(contentRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateContentRequestStatus(
  id: number,
  status: "in_progress" | "delivered" | "cancelled" | "overdue",
  extra?: { deliveredAt?: Date; contentItemId?: number; coachNote?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests).set({ status, ...extra }).where(eq(contentRequests.id, id));
}

// Coach sets/revises a quote (price, due date, note) on a content request.
export async function updateContentRequestQuote(
  id: number,
  data: { amountCents: number; dueDate?: Date; coachNote?: string | null }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({
      amountCents: data.amountCents,
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      // A re-quote always rewrites the note (cleared field → null), so a coach
      // can remove a previous note rather than have it stick.
      coachNote: data.coachNote ?? null,
    })
    .where(eq(contentRequests.id, id));
}

// S-CONTENT-2: Set status to "quoted" and store price/date/note
export async function quoteContentRequest(
  requestId: number,
  data: { amountCents: number; dueDate?: Date; coachNote?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ status: "quoted", amountCents: data.amountCents, dueDate: data.dueDate, coachNote: data.coachNote, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Student accepts quote -> pending_payment
export async function acceptContentRequestQuote(requestId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ status: "pending_payment", updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Student rejects quote -> back to queued, clear price/date
export async function rejectContentRequestQuote(requestId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ status: "queued", amountCents: 0, dueDate: null, coachNote: null, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Atomic CAS: set stripeCheckoutSessionId to "__pending__" only if currently NULL
// Uses raw SQL since Drizzle .update().set().where() doesn't return affectedRows reliably
export async function claimContentRequestCheckoutSlot(requestId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    UPDATE content_requests
    SET stripeCheckoutSessionId = '__pending__', updatedAt = NOW()
    WHERE id = ${requestId} AND stripeCheckoutSessionId IS NULL
  `);
  return (result[0]?.affectedRows ?? 0) > 0;
}

// S-CONTENT-2: Set the real session ID (overwrite __pending__)
export async function setContentRequestCheckoutSession(requestId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Clear the checkout session slot (on failure or expiry)
export async function clearContentRequestCheckoutSession(requestId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Mark payment collected -- store payment intent + charge, set status
export async function markContentRequestPaymentCollected(
  requestId: number,
  paymentIntentId: string,
  chargeId: string | null
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({
      status: "payment_collected",
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId ?? undefined,
      stripeCheckoutSessionId: null,
      updatedAt: new Date(),
    })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Coach starts work (payment_collected -> in_progress)
export async function startContentRequestWork(requestId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Coach marks delivered -- set deliveredAt and payoutAt (48h window)
export async function deliverContentRequest(requestId: number) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const payoutAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await db.update(contentRequests)
    .set({ status: "delivered", deliveredAt: now, payoutAt, updatedAt: now })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Fetch all delivered content requests whose payout window has expired and payout not yet released
export async function getContentRequestsReadyForPayout() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(contentRequests)
    .where(and(
      eq(contentRequests.status, "delivered"),
      isNotNull(contentRequests.payoutAt),
      lte(contentRequests.payoutAt, now),
      isNull(contentRequests.payoutReleasedAt),
      // Eligible with EITHER a charge OR a payment intent — a transient
      // null-charge at webhook time must not permanently strand the payout;
      // the service resolves the charge lazily from the PI before transfer.
      or(
        isNotNull(contentRequests.stripeChargeId),
        isNotNull(contentRequests.stripePaymentIntentId),
      ),
    ));
}

// S-CONTENT-2: backfill the charge id on a content request (recovery path
// when getChargeIdForPaymentIntent returned null at webhook time).
export async function setContentRequestChargeId(requestId: number, chargeId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ stripeChargeId: chargeId, updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// S-CONTENT-2: Mark payout released (stores the transfer id for reconciliation)
export async function markContentRequestPayoutReleased(requestId: number, transferId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentRequests)
    .set({ stripeTransferId: transferId, payoutReleasedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentRequests.id, requestId));
}

// ============ CONTENT REQUEST DEADLINE & OVERDUE HELPERS (S-CONTENT-3) ============

export async function getContentRequestsDueForReminder24h() {
  const db = await getDb();
  if (!db) return [];
  const result: any = await db.execute(sql`
    SELECT cr.*, su.name AS studentName, su.email AS studentEmail,
           cu.name AS coachName, cu.email AS coachEmail
    FROM content_requests cr
    JOIN users su ON su.id = cr.studentId
    JOIN users cu ON cu.id = cr.coachId
    WHERE cr.status IN ('payment_collected', 'in_progress')
      AND cr.dueDate IS NOT NULL
      AND cr.dueDate BETWEEN DATE_ADD(NOW(), INTERVAL 20 HOUR) AND DATE_ADD(NOW(), INTERVAL 28 HOUR)
      AND cr.deadline24hReminderSentAt IS NULL
  `);
  return result[0] || [];
}

export async function getContentRequestsDueForReminder1h() {
  const db = await getDb();
  if (!db) return [];
  const result: any = await db.execute(sql`
    SELECT cr.*, su.name AS studentName, su.email AS studentEmail,
           cu.name AS coachName, cu.email AS coachEmail
    FROM content_requests cr
    JOIN users su ON su.id = cr.studentId
    JOIN users cu ON cu.id = cr.coachId
    WHERE cr.status IN ('payment_collected', 'in_progress')
      AND cr.dueDate IS NOT NULL
      AND cr.dueDate BETWEEN DATE_ADD(NOW(), INTERVAL 45 MINUTE) AND DATE_ADD(NOW(), INTERVAL 75 MINUTE)
      AND cr.deadline1hReminderSentAt IS NULL
  `);
  return result[0] || [];
}

export async function getOverdueContentRequests() {
  const db = await getDb();
  if (!db) return [];
  const result: any = await db.execute(sql`
    SELECT cr.*, su.name AS studentName, su.email AS studentEmail,
           cu.name AS coachName, cu.email AS coachEmail
    FROM content_requests cr
    JOIN users su ON su.id = cr.studentId
    JOIN users cu ON cu.id = cr.coachId
    WHERE cr.status IN ('payment_collected', 'in_progress')
      AND cr.dueDate IS NOT NULL
      AND cr.dueDate < NOW()
      AND cr.overdueNotifiedAt IS NULL
  `);
  return result[0] || [];
}

export async function stampContentRequestDeadlineReminder(
  id: number,
  field: "deadline24hReminderSentAt" | "deadline1hReminderSentAt" | "overdueNotifiedAt"
) {
  const allowed = ["deadline24hReminderSentAt", "deadline1hReminderSentAt", "overdueNotifiedAt"];
  if (!allowed.includes(field)) {
    throw new Error(`Invalid field: ${field}`);
  }
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE content_requests SET ${sql.raw(field)} = NOW() WHERE id = ${id}`);
}

export async function proposeContentRequestDeadlineExtension(id: number, newDueDate: Date) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE content_requests
    SET dueDate = ${newDueDate},
        status = 'in_progress',
        deadline24hReminderSentAt = NULL,
        deadline1hReminderSentAt = NULL,
        overdueNotifiedAt = NULL,
        updatedAt = NOW()
    WHERE id = ${id}
  `);
}

export async function cancelOverdueContentRequest(id: number) {
  const db = await getDb();
  if (!db) return;
  // CAS: only cancel if still overdue — prevents a read-then-write race
  // where two concurrent cancelOverdue calls both pass the router's status
  // check. (The Stripe idempotency key already prevents double-refund, but
  // this keeps the DB transition atomic too.)
  await db.execute(sql`
    UPDATE content_requests
    SET status = 'cancelled', updatedAt = NOW()
    WHERE id = ${id} AND status = 'overdue'
  `);
}

// Coach Student Roster (S-DASH-1)

export async function getStudentRoster(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows: any = await db.execute(sql`
    SELECT
      u.id, u.name, u.avatarUrl,
      sp.currentRating,
      MAX(l.scheduledAt) AS lastLessonAt,
      COUNT(l.id) AS totalLessons
    FROM lessons l
    LEFT JOIN users u ON u.id = l.studentId
    LEFT JOIN student_profiles sp ON sp.userId = l.studentId
    WHERE l.coachId = ${coachId}
      AND l.status IN ('completed', 'released', 'confirmed', 'payment_collected')
    GROUP BY u.id, u.name, u.avatarUrl, sp.currentRating
    ORDER BY lastLessonAt DESC
    LIMIT 20
  `);
  return rows[0] || [];
}

// ============ COACH SUBSCRIPTION OPERATIONS (S-DASH-3) ============

export async function getCoachSubscriptionSettings(coachId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(coachSubscriptionSettings).where(eq(coachSubscriptionSettings.coachId, coachId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertCoachSubscriptionSettings(coachId: number, data: {
  enabled: boolean;
  monthlyPriceCents: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getCoachSubscriptionSettings(coachId);
  if (existing) {
    await db.update(coachSubscriptionSettings)
      .set({ enabled: data.enabled, monthlyPriceCents: data.monthlyPriceCents, description: data.description ?? null })
      .where(eq(coachSubscriptionSettings.coachId, coachId));
  } else {
    await db.insert(coachSubscriptionSettings).values({
      coachId,
      enabled: data.enabled,
      monthlyPriceCents: data.monthlyPriceCents,
      description: data.description ?? null,
    });
  }
}

export async function isUserSubscribedToCoach(subscriberId: number, coachId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(coachSubscriptions)
    .where(and(
      eq(coachSubscriptions.subscriberId, subscriberId),
      eq(coachSubscriptions.coachId, coachId),
      eq(coachSubscriptions.status, "active")
    ))
    .limit(1);
  return rows.length > 0;
}

export async function subscribeToCoach(subscriberId: number, coachId: number, monthlyPriceCents: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check for existing (possibly cancelled) subscription to reactivate
  const existing = await db.select().from(coachSubscriptions)
    .where(and(
      eq(coachSubscriptions.subscriberId, subscriberId),
      eq(coachSubscriptions.coachId, coachId)
    ))
    .limit(1);
  if (existing.length > 0) {
    await db.update(coachSubscriptions)
      .set({ status: "active", monthlyPriceCents })
      .where(eq(coachSubscriptions.id, existing[0].id));
    return existing[0].id;
  }
  try {
    const result: any = await db.insert(coachSubscriptions).values({
      subscriberId,
      coachId,
      monthlyPriceCents,
      status: "active",
    });
    return result[0]?.insertId ?? 0;
  } catch (err: any) {
    // Handle race condition: concurrent subscribe → duplicate key
    if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
      const refetched = await db.select().from(coachSubscriptions)
        .where(and(
          eq(coachSubscriptions.subscriberId, subscriberId),
          eq(coachSubscriptions.coachId, coachId)
        ))
        .limit(1);
      if (refetched.length > 0) {
        await db.update(coachSubscriptions)
          .set({ status: "active", monthlyPriceCents })
          .where(eq(coachSubscriptions.id, refetched[0].id));
        return refetched[0].id;
      }
    }
    throw err;
  }
}

export async function cancelCoachSubscription(subscriberId: number, coachId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(coachSubscriptions)
    .set({ status: "cancelled" })
    .where(and(
      eq(coachSubscriptions.subscriberId, subscriberId),
      eq(coachSubscriptions.coachId, coachId),
      eq(coachSubscriptions.status, "active")
    ));
}

export async function getActiveSubscriptionsForUser(subscriberId: number): Promise<Array<{
  coachId: number;
  coachName: string;
  coachTitle: string | null;
  monthlyPriceCents: number;
  status: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  const rows: any = await db.execute(sql`
    SELECT cs.coachId, cs.monthlyPriceCents, cs.status,
           u.name AS coachName,
           cp.title AS coachTitle
    FROM coach_subscriptions cs
    LEFT JOIN users u ON u.id = cs.coachId
    LEFT JOIN coach_profiles cp ON cp.userId = cs.coachId
    WHERE cs.subscriberId = ${subscriberId} AND cs.status = 'active'
    ORDER BY cs.createdAt DESC
  `);
  return (rows[0] || []).map((r: any) => ({
    coachId: r.coachId,
    coachName: r.coachName || `Coach #${r.coachId}`,
    coachTitle: r.coachTitle || null,
    monthlyPriceCents: r.monthlyPriceCents,
    status: r.status,
  }));
}

export async function getCoachSubscriberCount(coachId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`COUNT(*)` })
    .from(coachSubscriptions)
    .where(and(
      eq(coachSubscriptions.coachId, coachId),
      eq(coachSubscriptions.status, "active")
    ));
  return rows[0]?.count ?? 0;
}

// ============ NOTIFICATION OPERATIONS (S-DASH-3) ============

// NOTE (S-DASH-4): when omitted, recipientRole falls back to the column default
// 'student'. Coach-only/student-only types route by TYPE so they ignore it, and
// new_message always supplies it. But any FUTURE role-ambiguous type whose
// recipient can be a coach (e.g. lesson_*, new_review) MUST pass recipientRole,
// or a "both" account will be mis-routed to the student dashboard.
export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  body: string;
  relatedUserId?: number;
  relatedLessonId?: number;
  relatedContentRequestId?: number;
  recipientRole?: "coach" | "student";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.insert(notifications).values({
    userId: data.userId,
    type: data.type as any,
    title: data.title,
    body: data.body,
    relatedUserId: data.relatedUserId ?? null,
    relatedLessonId: data.relatedLessonId ?? null,
    relatedContentRequestId: data.relatedContentRequestId ?? null,
    ...(data.recipientRole ? { recipientRole: data.recipientRole } : {}),
  });
  return result[0]?.insertId ?? 0;
}

export async function getNotificationsForUser(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      isNull(notifications.readAt)
    ));
  return rows[0]?.count ?? 0;
}

export async function markNotificationRead(notificationId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      isNull(notifications.readAt)
    ));
}

// ============ SUBSCRIPTION DM OPERATIONS (S-DASH-3) ============

export async function getSubscriptionDmLesson(studentId: number, coachId: number) {
  const db = await getDb();
  if (!db) return null;
  const result: any = await db.execute(sql`
    SELECT * FROM lessons
    WHERE studentId = ${studentId} AND coachId = ${coachId} AND status = 'subscription_dm'
    LIMIT 1
  `);
  const rows = result[0];
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function createSubscriptionDmLesson(studentId: number, coachId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.execute(sql`
    INSERT INTO lessons (studentId, coachId, scheduledAt, durationMinutes, status, amountCents, commissionCents, coachPayoutCents, topic)
    VALUES (${studentId}, ${coachId}, NOW(), 0, 'subscription_dm', 0, 0, 0, 'Direct Message Channel')
  `);
  return result[0]?.insertId ?? null;
}

// ============ CONTENT ITEMS (S-STOREFRONT-1) ============

/** Fetch a single content item by id (all fields). */
export async function getContentItemById(id: number): Promise<ContentItem | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Insert a new content item. Returns the new insertId. */
export async function createContentItem(data: InsertContentItem): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.insert(contentItems).values(data);
  return Number(result[0].insertId);
}

/**
 * All content items for a coach (published + unpublished, every accessType).
 * Includes targetStudentName via LEFT JOIN on users(targetStudentId).
 */
export async function getContentItemsByCoach(coachId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result: any = await db.execute(sql`
    SELECT
      ci.id, ci.coachId, ci.title, ci.description, ci.kind,
      ci.storageKey, ci.thumbnailUrl, ci.priceCents, ci.currency,
      ci.previewContent, ci.published, ci.publishedAt,
      ci.accessType, ci.targetStudentId,
      ci.createdAt, ci.updatedAt,
      u.name AS targetStudentName
    FROM content_items ci
    LEFT JOIN users u ON u.id = ci.targetStudentId
    WHERE ci.coachId = ${coachId}
    ORDER BY ci.createdAt DESC
  `);
  return result[0] || [];
}

/**
 * All content items a user can access:
 *  (a) anything they purchased (content_purchases join)
 *  (b) student_only items targeted at them
 *  (c) request_fulfillment items whose linked request is theirs AND delivered
 * Includes coachName and unlockedAt. Ordered by unlockedAt DESC.
 */
export async function getOwnedContentItems(
  userId: number
): Promise<Array<ContentItem & { unlockedAt: Date; coachName: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const result: any = await db.execute(sql`
    SELECT t.*, u.name AS coachName FROM (
      SELECT
        ci.id, ci.coachId, ci.title, ci.description, ci.kind,
        ci.storageKey, ci.thumbnailUrl, ci.priceCents, ci.currency,
        ci.previewContent, ci.published, ci.publishedAt,
        ci.accessType, ci.targetStudentId, ci.createdAt, ci.updatedAt,
        cp.unlockedAt AS unlockedAt
      FROM content_purchases cp
      JOIN content_items ci ON ci.id = cp.contentItemId
      WHERE cp.userId = ${userId}

      UNION

      SELECT
        ci.id, ci.coachId, ci.title, ci.description, ci.kind,
        ci.storageKey, ci.thumbnailUrl, ci.priceCents, ci.currency,
        ci.previewContent, ci.published, ci.publishedAt,
        ci.accessType, ci.targetStudentId, ci.createdAt, ci.updatedAt,
        ci.createdAt AS unlockedAt
      FROM content_items ci
      WHERE ci.accessType = 'student_only' AND ci.targetStudentId = ${userId}

      UNION

      SELECT
        ci.id, ci.coachId, ci.title, ci.description, ci.kind,
        ci.storageKey, ci.thumbnailUrl, ci.priceCents, ci.currency,
        ci.previewContent, ci.published, ci.publishedAt,
        ci.accessType, ci.targetStudentId, ci.createdAt, ci.updatedAt,
        cr.deliveredAt AS unlockedAt
      FROM content_items ci
      JOIN content_requests cr ON cr.contentItemId = ci.id
      WHERE ci.accessType = 'request_fulfillment'
        AND cr.studentId = ${userId}
        AND cr.status = 'delivered'
    ) t
    LEFT JOIN users u ON u.id = t.coachId
    ORDER BY t.unlockedAt DESC
  `);
  return result[0] || [];
}

/** Update provided fields of a content item, scoped to its owning coach. */
export async function updateContentItem(
  id: number,
  coachId: number,
  data: Partial<InsertContentItem>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (Object.keys(data).length === 0) return;
  await db.update(contentItems).set(data).where(and(eq(contentItems.id, id), eq(contentItems.coachId, coachId)));
}

/** Hard delete a content item, scoped to its owning coach. */
export async function deleteContentItem(id: number, coachId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.coachId, coachId)));
}

/** Toggle published state (and publishedAt), scoped to owning coach. */
export async function setContentItemPublished(
  id: number,
  coachId: number,
  published: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(contentItems)
    .set({ published, publishedAt: published ? new Date() : null })
    .where(and(eq(contentItems.id, id), eq(contentItems.coachId, coachId)));
}

/**
 * Whether a user may access a content item:
 *  - they are the coach owner, OR
 *  - they have a purchase row, OR
 *  - they are the targetStudentId of a student_only item, OR
 *  - they are the student of a delivered request_fulfillment item.
 */
export async function userHasContentAccess(userId: number, contentItemId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(sql`
    SELECT 1 FROM content_items ci
    WHERE ci.id = ${contentItemId}
      AND (
        ci.coachId = ${userId}
        OR EXISTS (
          SELECT 1 FROM content_purchases cp
          WHERE cp.contentItemId = ci.id AND cp.userId = ${userId}
        )
        OR (ci.accessType = 'student_only' AND ci.targetStudentId = ${userId})
        OR (
          ci.accessType = 'request_fulfillment'
          AND EXISTS (
            SELECT 1 FROM content_requests cr
            WHERE cr.contentItemId = ci.id
              AND cr.studentId = ${userId}
              AND cr.status = 'delivered'
          )
        )
      )
    LIMIT 1
  `);
  return (result[0]?.length ?? 0) > 0;
}

/** Count purchase rows for a content item (drives the delete soft/hard decision). */
export async function getContentPurchaseCount(contentItemId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM content_purchases WHERE contentItemId = ${contentItemId}
  `);
  return Number(result[0]?.[0]?.cnt ?? 0);
}

/**
 * Outcome of recording a storefront content purchase:
 *  - "inserted": a new purchase row was created -> proceed to pay the coach.
 *  - "duplicate_same_pi": the SAME PaymentIntent was already recorded (a webhook
 *    retry) -> no-op, no payout, no refund.
 *  - "duplicate_other_pi": the buyer already owns this item via a DIFFERENT
 *    PaymentIntent (a concurrent double-checkout) -> no payout; the redundant
 *    charge must be refunded.
 */
export type RecordContentPurchaseResult =
  | "inserted"
  | "duplicate_same_pi"
  | "duplicate_other_pi";

/**
 * Record a storefront content purchase (called from the webhook). Race-safe and
 * idempotent via two UNIQUE constraints: stripePaymentIntentId (retry dedupe)
 * and (contentItemId, userId) (one unlock per buyer+item). The composite
 * constraint is what catches a concurrent double-checkout, where the buyer ends
 * up with two distinct PaymentIntents for the same item.
 */
export async function recordContentPurchase(data: {
  contentItemId: number;
  userId: number;
  amountPaidCents: number;
  stripePaymentIntentId: string;
}): Promise<RecordContentPurchaseResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.execute(sql`
      INSERT INTO content_purchases
        (contentItemId, userId, unlockMethod, amountPaidCents, stripePaymentIntentId)
      VALUES
        (${data.contentItemId}, ${data.userId}, 'purchase', ${data.amountPaidCents}, ${data.stripePaymentIntentId})
    `);
    return "inserted";
  } catch (err: any) {
    if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
      // A row already exists for this (item, user). Determine whether it's the
      // same PaymentIntent (true retry) or a different one (double-purchase).
      const existing: any = await db.execute(sql`
        SELECT stripePaymentIntentId FROM content_purchases
        WHERE contentItemId = ${data.contentItemId} AND userId = ${data.userId}
        LIMIT 1
      `);
      const existingPI = existing[0]?.[0]?.stripePaymentIntentId ?? null;
      return existingPI === data.stripePaymentIntentId
        ? "duplicate_same_pi"
        : "duplicate_other_pi";
    }
    throw err;
  }
}

/** Number of content_requests that reference this content item (drives delete safety). */
export async function getContentRequestRefCount(contentItemId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM content_requests WHERE contentItemId = ${contentItemId}
  `);
  return Number(result[0]?.[0]?.cnt ?? 0);
}
