import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extends to support both students and coaches.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
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
  
  // Platform commission rate (percentage, e.g., 15 = 15%)
  commissionRate: int("commissionRate").default(15),
  
  // Stats
  totalStudents: int("totalStudents").default(0),
  totalLessons: int("totalLessons").default(0),
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }).default("0.00"),
  totalReviews: int("totalReviews").default(0),
  
  // Availability
  isAvailable: boolean("isAvailable").default(true),
  availabilitySchedule: text("availabilitySchedule"), // JSON schedule object
  
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
  
  // Status flow: pending -> confirmed -> in_progress -> completed/cancelled/disputed
  status: mysqlEnum("status", [
    "pending",      // Awaiting coach confirmation
    "confirmed",    // Coach confirmed, awaiting payment
    "paid",         // Payment held in escrow
    "in_progress",  // Lesson happening
    "completed",    // Lesson done, awaiting student confirmation
    "released",     // Payment released to coach
    "cancelled",    // Cancelled before lesson
    "disputed",     // Student raised dispute
    "refunded"      // Refund processed
  ]).default("pending"),
  
  // Pricing snapshot (at time of booking)
  amountCents: int("amountCents").notNull(),
  commissionCents: int("commissionCents").notNull(),
  coachPayoutCents: int("coachPayoutCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Stripe payment tracking (only IDs, not sensitive data)
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  stripeTransferId: varchar("stripeTransferId", { length: 64 }),
  
  // Completion tracking
  studentConfirmedAt: timestamp("studentConfirmedAt"),
  coachConfirmedAt: timestamp("coachConfirmedAt"),
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
  lessonId: int("lessonId").notNull().unique(),
  studentId: int("studentId").notNull(),
  coachId: int("coachId").notNull(),
  
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  
  // Detailed ratings
  knowledgeRating: int("knowledgeRating"),
  communicationRating: int("communicationRating"),
  preparednessRating: int("preparednessRating"),
  
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
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;
