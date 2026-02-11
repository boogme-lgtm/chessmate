import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extends to support both students and coaches.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // Make nullable for email/password users
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(), // Now required and unique
  password: varchar("password", { length: 255 }), // Hashed password for email/password auth
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 64 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  passwordResetToken: varchar("passwordResetToken", { length: 64 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // User type: student, coach, or both
  userType: mysqlEnum("userType", ["student", "coach", "both"]).default("student").notNull(),
  
  // Stripe Connect - only store IDs, not sensitive data
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeConnectAccountId: varchar("stripeConnectAccountId", { length: 64 }),
  stripeConnectOnboarded: boolean("stripeConnectOnboarded").default(false),
  
  // Profile fields
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  country: varchar("country", { length: 64 }),
  timezone: varchar("timezone", { length: 64 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Coach profiles with chess-specific information
 */
export const coachProfiles = mysqlTable("coach_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Chess credentials
  title: mysqlEnum("title", ["none", "CM", "FM", "IM", "GM", "WCM", "WFM", "WIM", "WGM"]).default("none"),
  fideRating: int("fideRating"),
  lichessUsername: varchar("lichessUsername", { length: 64 }),
  chesscomUsername: varchar("chesscomUsername", { length: 64 }),
  
  // Coaching details
  specialties: text("specialties"), // JSON array: ["openings", "endgames", "tactics", etc.]
  teachingStyle: mysqlEnum("teachingStyle", ["visual", "interactive", "analytical", "competitive"]),
  experienceYears: int("experienceYears"),
  languages: text("languages"), // JSON array of language codes
  
  // Pricing (in cents to avoid floating point issues)
  hourlyRateCents: int("hourlyRateCents").default(5000), // $50 default
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Coach subscription tier determines platform fee
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "growth", "business"]).default("free"),
  
  // Platform commission rate (percentage, e.g., 15 = 15%)
  // Free: 15%, Growth: 10%, Business: 5%
  commissionRate: int("commissionRate").default(15),
  
  // Stats
  totalStudents: int("totalStudents").default(0),
  totalLessons: int("totalLessons").default(0),
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }).default("0.00"),
  totalReviews: int("totalReviews").default(0),
  
  // Availability
  isAvailable: boolean("isAvailable").default(true),
  availabilitySchedule: text("availabilitySchedule"), // JSON schedule object
  
  // Onboarding progress
  onboardingStep: int("onboardingStep").default(1), // Current step (1-7)
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  
  // Profile completion
  profilePhotoUrl: text("profilePhotoUrl"),
  videoIntroUrl: text("videoIntroUrl"),
  
  // Availability settings
  minAdvanceHours: int("minAdvanceHours").default(24),
  maxAdvanceDays: int("maxAdvanceDays").default(30),
  bufferMinutes: int("bufferMinutes").default(15),
  
  // Lesson settings
  lessonDurations: text("lessonDurations"), // JSON array [30, 60, 90]
  lessonFormats: text("lessonFormats"), // JSON array
  packageDiscountEnabled: boolean("packageDiscountEnabled").default(false),
  packageDiscountPercent: int("packageDiscountPercent").default(0),
  
  // Guidelines
  guidelinesAgreed: boolean("guidelinesAgreed").default(false),
  guidelinesAgreedAt: timestamp("guidelinesAgreedAt"),
  
  // Profile activation
  profileActive: boolean("profileActive").default(false),
  profileActivatedAt: timestamp("profileActivatedAt"),
  
  // Verification
  isVerified: boolean("isVerified").default(false),
  verifiedAt: timestamp("verifiedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoachProfile = typeof coachProfiles.$inferSelect;
export type InsertCoachProfile = typeof coachProfiles.$inferInsert;

/**
 * Student profiles with learning preferences
 */
export const studentProfiles = mysqlTable("student_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Chess level
  skillLevel: mysqlEnum("skillLevel", ["beginner", "intermediate", "advanced", "expert"]).default("beginner"),
  currentRating: int("currentRating"),
  targetRating: int("targetRating"),
  
  // Learning preferences (from quiz)
  primaryGoal: mysqlEnum("primaryGoal", ["rating_improvement", "tournament_prep", "openings", "tactics", "endgames", "general"]),
  playingStyle: mysqlEnum("playingStyle", ["aggressive", "positional", "balanced", "defensive"]),
  learningStyle: mysqlEnum("learningStyle", ["visual", "interactive", "analytical", "competitive"]),
  practiceSchedule: mysqlEnum("practiceSchedule", ["casual", "regular", "serious", "intensive"]),
  
  // Gamification
  totalXp: int("totalXp").default(0),
  currentLevel: int("currentLevel").default(1),
  currentStreak: int("currentStreak").default(0),
  longestStreak: int("longestStreak").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type InsertStudentProfile = typeof studentProfiles.$inferInsert;

/**
 * Lessons - the core booking entity
 */
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  
  // Participants
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  
  // Scheduling
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  timezone: varchar("timezone", { length: 64 }),
  
  // Lesson details
  topic: varchar("topic", { length: 255 }),
  notes: text("notes"),
  meetingUrl: text("meetingUrl"),
  
  // Status flow: pending_confirmation -> confirmed -> paid -> in_progress -> completed/cancelled/disputed
  status: mysqlEnum("status", [
    "pending_confirmation", // Awaiting coach confirmation (Airbnb-style)
    "confirmed",    // Coach confirmed, awaiting payment
    "declined",     // Coach declined the booking
    "paid",         // Payment held in escrow
    "in_progress",  // Lesson happening
    "completed",    // Lesson done, awaiting reviews
    "released",     // Payment released to coach
    "cancelled",    // Cancelled before lesson
    "no_show",      // Student or coach didn't show up
    "disputed",     // Student raised dispute
    "refunded"      // Refund processed
  ]).default("pending_confirmation"),
  
  // Pricing snapshot (at time of booking)
  amountCents: int("amountCents").notNull(),
  commissionCents: int("commissionCents").notNull(),
  coachPayoutCents: int("coachPayoutCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Stripe payment tracking (only IDs, not sensitive data)
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  stripeTransferId: varchar("stripeTransferId", { length: 64 }),
  
  // Booking confirmation tracking
  coachConfirmedAt: timestamp("coachConfirmedAt"), // When coach accepted the booking
  coachDeclinedAt: timestamp("coachDeclinedAt"),   // When coach declined the booking
  confirmationDeadline: timestamp("confirmationDeadline"), // Auto-decline if not confirmed by this time
  
  // Completion tracking
  studentConfirmedAt: timestamp("studentConfirmedAt"),
  completedAt: timestamp("completedAt"),
  payoutAt: timestamp("payoutAt"),
  
  // Refund window (48 hours after completion)
  refundWindowEndsAt: timestamp("refundWindowEndsAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

/**
 * Reviews - student feedback on lessons
 */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  
  // Who is reviewing whom (mutual reviews)
  reviewerId: int("reviewerId").notNull(),
  revieweeId: int("revieweeId").notNull(),
  reviewerType: mysqlEnum("reviewerType", ["student", "coach"]).notNull(),
  
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"), // Written review
  
  // Detailed ratings
  knowledgeRating: int("knowledgeRating"),
  communicationRating: int("communicationRating"),
  preparednessRating: int("preparednessRating"),
  
  // Airbnb-style hidden reviews until both submit
  isVisible: boolean("isVisible").default(false),
  visibleAt: timestamp("visibleAt"),
  
  isPublic: boolean("isPublic").default(true),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

/**
 * Achievements/Badges for gamification
 */
export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  iconName: varchar("iconName", { length: 64 }), // Lucide icon name
  category: mysqlEnum("category", ["learning", "social", "streak", "milestone", "special"]),
  
  // Requirements
  xpReward: int("xpReward").default(0),
  requirement: text("requirement"), // JSON object with unlock conditions
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

/**
 * User achievements - tracks which users have which badges
 */
export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

/**
 * Coach-Student matches from AI matching
 */
export const coachMatches = mysqlTable("coach_matches", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  
  // Match scores (0-100)
  overallScore: int("overallScore").notNull(),
  styleScore: int("styleScore"),
  goalScore: int("goalScore"),
  scheduleScore: int("scheduleScore"),
  communicationScore: int("communicationScore"),
  
  // Quiz answers snapshot
  quizAnswers: text("quizAnswers"), // JSON
  
  status: mysqlEnum("status", ["suggested", "contacted", "active", "inactive"]).default("suggested"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CoachMatch = typeof coachMatches.$inferSelect;
export type InsertCoachMatch = typeof coachMatches.$inferInsert;

/**
 * Waitlist for early access
 */
export const waitlist = mysqlTable("waitlist", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  
  userType: mysqlEnum("userType", ["student", "coach", "both"]).default("student"),
  referralSource: varchar("referralSource", { length: 128 }),
  
  // Email nurture sequence tracking
  confirmationEmailSent: boolean("confirmationEmailSent").default(false),
  nurtureEmail1Sent: boolean("nurtureEmail1Sent").default(false),
  nurtureEmail2Sent: boolean("nurtureEmail2Sent").default(false),
  nurtureEmail3Sent: boolean("nurtureEmail3Sent").default(false),
  nurtureEmail4Sent: boolean("nurtureEmail4Sent").default(false),
  nurtureEmail5Sent: boolean("nurtureEmail5Sent").default(false),
  lastEmailSentAt: timestamp("lastEmailSentAt"),
  
  // Unsubscribe tracking
  unsubscribed: boolean("unsubscribed").default(false),
  unsubscribedAt: timestamp("unsubscribedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

/**
 * Coach applications - stores application data before approval
 */
export const coachApplications = mysqlTable("coach_applications", {
  id: int("id").autoincrement().primaryKey(),
  
  // Personal Information
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  country: varchar("country", { length: 64 }).notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  
  // Chess Credentials
  chessTitle: varchar("chessTitle", { length: 32 }).notNull(),
  currentRating: int("currentRating").notNull(),
  ratingOrg: varchar("ratingOrg", { length: 32 }).notNull(),
  yearsExperience: varchar("yearsExperience", { length: 32 }).notNull(),
  totalStudents: int("totalStudents"),
  profilePhotoUrl: text("profilePhotoUrl"),
  
  // Expertise
  certifications: text("certifications"),
  achievements: text("achievements").notNull(),
  specializations: text("specializations").notNull(), // JSON array
  targetLevels: text("targetLevels").notNull(), // JSON array
  teachingPhilosophy: text("teachingPhilosophy").notNull(),
  
  // Availability & Pricing
  hourlyRateCents: int("hourlyRateCents").notNull(), // Store in cents
  availability: text("availability").notNull(), // JSON object
  lessonFormats: text("lessonFormats").notNull(), // JSON array
  languages: text("languages").notNull(), // JSON array
  
  // Teaching Approach
  bio: text("bio").notNull(),
  whyBoogme: text("whyBoogme").notNull(),
  sampleLesson: text("sampleLesson").notNull(),
  videoIntroUrl: text("videoIntroUrl"),
  
  // Agreements
  backgroundCheckConsent: boolean("backgroundCheckConsent").notNull().default(false),
  termsAgreed: boolean("termsAgreed").notNull().default(false),
  
  // Application Status
  status: mysqlEnum("status", [
    "pending",      // Submitted, awaiting review
    "under_review", // Being reviewed by team
    "approved",     // Approved, coach profile created
    "rejected",     // Rejected
    "withdrawn"     // Applicant withdrew
  ]).default("pending").notNull(),
  
  reviewedBy: int("reviewedBy"), // Admin user ID who reviewed
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  
  // AI Vetting Results
  aiVettingScore: int("aiVettingScore"), // 0-100 confidence score
  aiVettingDetails: text("aiVettingDetails"), // JSON with full vetting breakdown
  aiVettingTimestamp: timestamp("aiVettingTimestamp"),
  autoApproved: boolean("autoApproved").default(false),
  humanReviewReason: text("humanReviewReason"), // Why flagged for human review
  
  // Link to created coach profile (after approval)
  coachProfileId: int("coachProfileId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoachApplication = typeof coachApplications.$inferSelect;
export type InsertCoachApplication = typeof coachApplications.$inferInsert;

/**
 * Lesson Packages - Multi-lesson bundles with per-lesson escrow release
 */
export const lessonPackages = mysqlTable("lesson_packages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Participants
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  
  // Package details
  totalLessons: int("totalLessons").notNull(), // e.g., 5 lessons
  completedLessons: int("completedLessons").default(0),
  remainingLessons: int("remainingLessons").notNull(),
  
  // Pricing
  totalAmountCents: int("totalAmountCents").notNull(), // Total package price
  perLessonAmountCents: int("perLessonAmountCents").notNull(), // Amount per lesson
  discountPercent: int("discountPercent").default(0),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Stripe tracking
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  
  // Status
  status: mysqlEnum("status", [
    "active",      // Package in use
    "completed",   // All lessons completed
    "cancelled",   // Package cancelled
    "expired"      // Expired without completion
  ]).default("active"),
  
  // Expiration
  expiresAt: timestamp("expiresAt"), // Packages expire after X months
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonPackage = typeof lessonPackages.$inferSelect;
export type InsertLessonPackage = typeof lessonPackages.$inferInsert;

/**
 * Cancellations - Track lesson cancellations and refund calculations
 */
export const cancellations = mysqlTable("cancellations", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  
  // Who cancelled
  cancelledBy: mysqlEnum("cancelledBy", ["student", "coach"]).notNull(),
  cancelledByUserId: int("cancelledByUserId").notNull(),
  
  // Timing
  lessonScheduledAt: timestamp("lessonScheduledAt").notNull(),
  cancelledAt: timestamp("cancelledAt").defaultNow().notNull(),
  hoursBeforeLesson: int("hoursBeforeLesson").notNull(),
  
  // Refund calculation
  refundPercent: int("refundPercent").notNull(), // 0, 50, or 100
  refundAmountCents: int("refundAmountCents").notNull(),
  coachCompensationCents: int("coachCompensationCents").notNull(),
  
  // Reason
  reason: text("reason"),
  
  // Stripe refund tracking
  stripeRefundId: varchar("stripeRefundId", { length: 64 }),
  refundProcessedAt: timestamp("refundProcessedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Cancellation = typeof cancellations.$inferSelect;
export type InsertCancellation = typeof cancellations.$inferInsert;

/**
 * Disputes - Track refund requests during 24-hour window
 */
export const disputes = mysqlTable("disputes", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  
  // Disputer
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  
  // Dispute details
  reason: mysqlEnum("reason", [
    "coach_no_show",
    "poor_quality",
    "technical_issues",
    "inappropriate_behavior",
    "other"
  ]).notNull(),
  description: text("description").notNull(),
  
  // Evidence
  evidence: text("evidence"), // JSON array of URLs/notes
  
  // Status
  status: mysqlEnum("status", [
    "pending",     // Awaiting review
    "investigating", // Under review
    "resolved_refund", // Refund issued
    "resolved_no_refund", // No refund issued
    "escalated"    // Needs manual intervention
  ]).default("pending"),
  
  // Resolution
  resolvedBy: int("resolvedBy"), // Admin user ID
  resolvedAt: timestamp("resolvedAt"),
  resolutionNotes: text("resolutionNotes"),
  refundAmountCents: int("refundAmountCents"),
  
  // Stripe refund tracking
  stripeRefundId: varchar("stripeRefundId", { length: 64 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = typeof disputes.$inferInsert;

/**
 * Payouts - Track all transfers to coaches
 */
export const payouts = mysqlTable("payouts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Coach
  coachId: int("coachId").notNull(),
  lessonId: int("lessonId"), // Null for package payouts
  packageId: int("packageId"), // Null for single lesson payouts
  
  // Amount
  amountCents: int("amountCents").notNull(),
  platformFeeCents: int("platformFeeCents").notNull(),
  processingFeeCents: int("processingFeeCents").default(0), // Only for Business tier
  netAmountCents: int("netAmountCents").notNull(), // What coach actually receives
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Stripe tracking
  stripeTransferId: varchar("stripeTransferId", { length: 64 }),
  stripePayoutId: varchar("stripePayoutId", { length: 64 }),
  
  // Status
  status: mysqlEnum("status", [
    "pending",     // Awaiting release
    "processing",  // Being transferred
    "completed",   // Successfully paid out
    "failed"       // Transfer failed
  ]).default("pending"),
  
  // Timing
  releasedAt: timestamp("releasedAt"),
  completedAt: timestamp("completedAt"),
  failureReason: text("failureReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = typeof payouts.$inferInsert;
