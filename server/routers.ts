import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./authRouter";
import { router, publicProcedure, protectedProcedure, coachProcedure } from "./_core/trpc";
import { vetCoachApplication } from "./aiVettingService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as stripeService from "./stripe";
import { ENV } from "./_core/env";
import { PRICING_TIERS, type PricingTier, calculateLessonBreakdown } from "@shared/pricing";
import { toCountryCode } from "@shared/countries";
import {
  sendEmail,
  getWaitlistConfirmationEmail,
  getStudentCancellationEmail,
  getCoachCancellationEmail,
  getCoachNewBookingRequestEmail,
  getStudentCoachConfirmedEmail,
} from "./emailService";
import { sendNurtureEmails, sendNurtureEmailsManual } from "./nurtureEmailScheduler";
import { resendWelcomeEmails } from "./resendWelcomeEmails";
import { storagePut } from "./storage";
import { sendEmail as sendSimpleEmail, getCoachWelcomeEmail } from "./email";
import { notifyOwner } from "./_core/notification";
import { transferToCoach } from "./stripeConnect";

/**
 * Send cancellation confirmation emails to both student and coach.
 * Best-effort — logs errors but does not throw (cancellation itself already succeeded).
 */
async function sendCancellationEmails(
  lessonId: number,
  cancelledBy: "student" | "coach" | "system",
  cancellationReason: string | null | undefined,
  refundAmountCents: number,
  refundPercentage: number,
): Promise<void> {
  try {
    const lesson = await db.getLessonById(lessonId);
    if (!lesson) return;
    const [student, coach] = await Promise.all([
      db.getUserById(lesson.studentId),
      db.getUserById(lesson.coachId),
    ]);
    if (!student?.email || !coach?.email) return;

    const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const lessonTime = new Date(lesson.scheduledAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const amountPaid = `$${(lesson.amountCents / 100).toFixed(2)}`;
    const refundAmount = `$${(refundAmountCents / 100).toFixed(2)}`;

    // When coach cancels, student gets a full refund regardless of timing.
    const effectiveRefundPct = cancelledBy === "coach" ? 100 : refundPercentage;

    await sendEmail({
      to: student.email,
      subject: `Lesson Cancelled — ${lessonDate}`,
      html: getStudentCancellationEmail({
        studentName: student.name || "Student",
        coachName: coach.name || "Your Coach",
        lessonDate,
        lessonTime,
        durationMinutes: lesson.durationMinutes ?? 60,
        amountPaid,
        refundAmount,
        refundPercentage: effectiveRefundPct,
        cancelledBy,
        cancellationReason,
      }),
    });

    await sendEmail({
      to: coach.email,
      subject: `Lesson Cancelled — ${lessonDate}`,
      html: getCoachCancellationEmail({
        coachName: coach.name || "Coach",
        studentName: student.name || "Student",
        lessonDate,
        lessonTime,
        durationMinutes: lesson.durationMinutes ?? 60,
        cancelledBy,
        cancellationReason,
      }),
    });
  } catch (err) {
    console.error(`[cancellation email] Failed for lesson ${lessonId}:`, err);
  }
}

export const appRouter = router({
  system: systemRouter,
  
  auth: authRouter,

  // ============ USER SETTINGS ============
  user: router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const prefs = user.notificationPreferences
        ? JSON.parse(user.notificationPreferences)
        : { bookingConfirmations: true, lessonReminders: true, newReviews: true, marketing: false };
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        country: user.country,
        timezone: user.timezone,
        loginMethod: user.loginMethod,
        lastSignedIn: user.lastSignedIn,
        createdAt: user.createdAt,
        notificationPreferences: prefs,
      };
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        country: z.string().max(64).optional(),
        timezone: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const { hashPassword, comparePassword } = await import("./auth");
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.password) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Password login not configured for this account" });
        }
        const valid = await comparePassword(input.currentPassword, user.password);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        const hashed = await hashPassword(input.newPassword);
        await db.updateUserPassword(ctx.user.id, hashed);
        return { success: true };
      }),

    updateNotificationPreferences: protectedProcedure
      .input(z.object({
        bookingConfirmations: z.boolean(),
        lessonReminders: z.boolean(),
        newReviews: z.boolean(),
        marketing: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateNotificationPreferences(ctx.user.id, JSON.stringify(input));
        return { success: true };
      }),

    deleteAccount: protectedProcedure
      .input(z.object({
        password: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        // P2-1: If user has a password (non-OAuth), REQUIRE it for deletion
        if (user.password) {
          if (!input.password) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Password is required to delete your account" });
          }
          const { comparePassword } = await import("./auth");
          const valid = await comparePassword(input.password, user.password);
          if (!valid) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
          }
        }
        await db.softDeleteUser(ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ REFERRAL SYSTEM ============
  referral: router({
    getMyCode: protectedProcedure.query(async ({ ctx }) => {
      const code = await db.getReferralCodeByCoach(ctx.user.id);
      const stats = await db.getReferralStats(ctx.user.id);
      return { code: code?.code || null, stats };
    }),

    generateCode: protectedProcedure.mutation(async ({ ctx }) => {
      const existing = await db.getReferralCodeByCoach(ctx.user.id);
      if (existing) return { code: existing.code };

      const crypto = await import("crypto");
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      await db.createReferralCode({ coachId: ctx.user.id, code });
      return { code };
    }),

    // P2-2 + R2-4: Bind referral recording to authenticated user with duplicate prevention
    recordSignup: protectedProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const ref = await db.getReferralCodeByCode(input.code);
        if (!ref) return { success: false };
        // Prevent self-referral
        if (ref.coachId === ctx.user.id) return { success: false };

        // R2-4: Handle duplicate gracefully — unique constraint on referredUserId
        // means the same user can only be referred once (idempotent).
        try {
          await db.createReferral({ referralCodeId: ref.id, referredUserId: ctx.user.id });
        } catch (err: any) {
          // MySQL duplicate entry error (ER_DUP_ENTRY = 1062)
          if (err?.errno === 1062 || err?.code === 'ER_DUP_ENTRY') {
            return { success: true, alreadyReferred: true };
          }
          throw err;
        }
        await db.incrementReferralCodeUses(ref.id);
        return { success: true, alreadyReferred: false };
      }),

    validateCode: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ input }) => {
        const ref = await db.getReferralCodeByCode(input.code);
        return { valid: !!ref };
      }),
  }),

  // ============ LICHESS PUZZLES ============
  puzzle: router({
    /**
     * Fetch the next puzzle for the student. Uses the Lichess daily puzzle
     * and a curated rotation of public puzzle IDs via server/lichess.ts.
     * The `difficulty` input is accepted for backwards compatibility with
     * the client but Lichess does not expose a public rating filter for
     * puzzles, so it's used only as part of the rotation seed.
     */
    getNext: publicProcedure
      .input(z.object({
        difficulty: z.enum(["easiest", "easier", "normal", "harder", "hardest"]).optional(),
        theme: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        try {
          const { getRotatingPuzzle } = await import("./lichess");
          // Mix in the difficulty string so different selections give
          // different seeds, and a coarse time slot so "refetch" rotates.
          const difficultySeed =
            (input?.difficulty?.length ?? 0) * 31 + (input?.theme?.length ?? 0) * 17;
          const timeSlot = Math.floor(Date.now() / (60 * 1000));
          return await getRotatingPuzzle(timeSlot + difficultySeed);
        } catch (error) {
          console.error("[Lichess API] Error fetching puzzle:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch puzzle",
          });
        }
      }),

    /** Explicit daily puzzle endpoint. */
    getDaily: publicProcedure.query(async () => {
      try {
        const { getDailyPuzzle } = await import("./lichess");
        return await getDailyPuzzle();
      } catch (error) {
        console.error("[Lichess API] Error fetching daily puzzle:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch daily puzzle",
        });
      }
    }),

    /** Fetch a specific puzzle by Lichess ID (used for replays). */
    getById: publicProcedure
      .input(z.object({ id: z.string().min(1).max(16) }))
      .query(async ({ input }) => {
        try {
          const { getPuzzleById } = await import("./lichess");
          return await getPuzzleById(input.id);
        } catch (error) {
          console.error("[Lichess API] Error fetching puzzle by id:", error);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Puzzle not found",
          });
        }
      }),
  }),

  // ============ LICHESS USER PROFILES ============
  lichess: router({
    /**
     * Fetch a Lichess user's public profile. Used by coach applications to
     * verify claimed FIDE/rapid/blitz ratings and by the student onboarding
     * questionnaire to pre-fill starting rating.
     */
    getProfile: publicProcedure
      .input(z.object({ username: z.string().min(2).max(20) }))
      .query(async ({ input }) => {
        try {
          const { getPlayerProfile, summarizeRatings } = await import("./lichess");
          const profile = await getPlayerProfile(input.username);
          return {
            id: profile.id,
            username: profile.username,
            country: profile.profile?.country,
            bio: profile.profile?.bio,
            ratings: summarizeRatings(profile),
          };
        } catch (error) {
          console.error("[Lichess API] Error fetching user profile:", error);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Lichess user not found",
          });
        }
      }),
  }),

  // ============ WAITLIST ============
  waitlist: router({
    join: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        userType: z.enum(["student", "coach", "both"]).default("student"),
        referralSource: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.addToWaitlist(input);
        if (!result.success) {
          throw new TRPCError({
            code: "CONFLICT",
            message: result.error || "Failed to join waitlist",
          });
        }
        
        // Send confirmation email
        try {
          const userType = input.userType === 'both' ? 'coach' : input.userType;
          const emailHtml = getWaitlistConfirmationEmail(
            input.name || input.email.split('@')[0],
            userType,
            input.email
          );
          
          const emailResult = await sendEmail({
            to: input.email,
            subject: userType === 'coach' 
              ? 'Welcome to BooGMe - Coach Waitlist' 
              : 'Welcome to BooGMe - Student Waitlist',
            html: emailHtml,
          });
          
          if (emailResult.success) {
            // Mark confirmation email as sent
            await db.updateWaitlistEmailStatus(input.email, {
              confirmationEmailSent: true,
              lastEmailSentAt: new Date(),
            });
            console.log(`[Waitlist] Confirmation email sent to ${input.email}`);
          }
        } catch (emailError) {
          // Log error but don't fail the waitlist signup
          console.error('[Waitlist] Failed to send confirmation email:', emailError);
        }
        
        return { success: true, message: "Successfully joined the waitlist!" };
      }),
    
    unsubscribe: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.unsubscribeFromWaitlist(input.email);
        return result;
      }),
    
    count: publicProcedure.query(async () => {
      const count = await db.getWaitlistCount();
      return { count };
    }),
  }),

  // ============ COACH APPLICATION ============
  coachApplication: router({
    submit: publicProcedure
      .input(z.object({
        // Personal Information
        fullName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        country: z.string().min(2),
        city: z.string().min(2),
        timezone: z.string(),
        
        // Chess Credentials
        chessTitle: z.string(),
        currentRating: z.number().min(1000).max(3000),
        ratingOrg: z.string(),
        yearsExperience: z.string(),
        totalStudents: z.number().optional(),
        profilePhotoUrl: z.string().optional(),
        
        // Expertise
        certifications: z.string().optional(),
        achievements: z.string().min(100),
        specializations: z.array(z.string()).min(3),
        targetLevels: z.array(z.string()).min(1),
        teachingPhilosophy: z.string().min(200),
        
        // Availability & Pricing
        hourlyRate: z.number().min(25).max(200),
        availability: z.record(z.string(), z.boolean()),
        lessonFormats: z.array(z.string()).min(1),
        languages: z.array(z.string()).min(1),
        
        // Teaching Approach
        bio: z.string().min(500),
        whyBoogme: z.string().min(200),
        sampleLesson: z.string().min(300),
        videoIntroUrl: z.string().optional(),
        
        // Agreements
        backgroundCheckConsent: z.boolean(),
        termsAgreed: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        // Validate agreements
        if (!input.backgroundCheckConsent || !input.termsAgreed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You must agree to all terms to submit your application",
          });
        }

        // Check if email already has pending/approved application
        const existing = await db.getCoachApplicationByEmail(input.email);
        if (existing && ["pending", "under_review", "approved"].includes(existing.status)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An application with this email already exists",
          });
        }

        // Prepare application data for AI vetting
        const applicationData = {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          city: input.city,
          timezone: input.timezone,
          chessTitle: input.chessTitle,
          currentRating: input.currentRating,
          ratingOrg: input.ratingOrg,
          yearsExperience: input.yearsExperience,
          totalStudents: input.totalStudents,
          profilePhotoUrl: input.profilePhotoUrl,
          certifications: input.certifications,
          achievements: input.achievements,
          specializations: JSON.stringify(input.specializations),
          targetLevels: JSON.stringify(input.targetLevels),
          teachingPhilosophy: input.teachingPhilosophy,
          hourlyRateCents: input.hourlyRate * 100, // Convert to cents
          availability: JSON.stringify(input.availability),
          lessonFormats: JSON.stringify(input.lessonFormats),
          languages: JSON.stringify(input.languages),
          bio: input.bio,
          whyBoogme: input.whyBoogme,
          sampleLesson: input.sampleLesson,
          videoIntroUrl: input.videoIntroUrl,
          backgroundCheckConsent: input.backgroundCheckConsent,
          termsAgreed: input.termsAgreed,
          status: "pending_confirmation",
        };

        // Run AI vetting (exclude availability as it's not needed for vetting)
        const vettingResult = await vetCoachApplication({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          timezone: input.timezone,
          chessTitle: input.chessTitle,
          currentRating: input.currentRating,
          ratingOrg: input.ratingOrg,
          yearsExperience: input.yearsExperience,
          totalStudents: input.totalStudents,
          certifications: input.certifications,
          achievements: input.achievements,
          specializations: JSON.stringify(input.specializations),
          targetLevels: JSON.stringify(input.targetLevels),
          teachingPhilosophy: input.teachingPhilosophy,
          hourlyRateCents: input.hourlyRate * 100,
          lessonFormats: JSON.stringify(input.lessonFormats),
          languages: JSON.stringify(input.languages),
          bio: input.bio,
          whyBoogme: input.whyBoogme,
          sampleLesson: input.sampleLesson,
        });

        // Update application with vetting results
        const finalStatus = vettingResult.approved ? "approved" : 
                           vettingResult.recommendation === "REJECT" ? "rejected" : "under_review";

        const application = await db.createCoachApplication({
          ...applicationData,
          status: finalStatus,
          aiVettingScore: vettingResult.confidenceScore,
          aiVettingDetails: JSON.stringify(vettingResult),
          aiVettingTimestamp: new Date(),
          autoApproved: vettingResult.approved,
          humanReviewReason: vettingResult.humanReviewReason,
        });

        // TODO: If auto-approved, create coach profile
        // TODO: Send appropriate email based on status
        // TODO: If under_review, notify admin team

        let message: string;
        if (vettingResult.approved) {
          message = "Congratulations! Your application has been approved. Check your email for next steps.";
        } else if (finalStatus === "under_review") {
          message = "Application submitted successfully! We'll review it and get back to you within 12 hours.";
        } else {
          message = "Thank you for applying. Unfortunately, we're unable to approve your application at this time. Check your email for details.";
        }

        return {
          success: true,
          applicationId: application.id,
          status: finalStatus,
          autoApproved: vettingResult.approved,
          confidenceScore: vettingResult.confidenceScore,
          message,
        };
      }),

    // Check application status by email
    checkStatus: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const application = await db.getCoachApplicationByEmail(input.email);
        if (!application) {
          return { found: false };
        }
        return {
          found: true,
          status: application.status,
          submittedAt: application.createdAt,
          reviewedAt: application.reviewedAt,
        };
      }),
  }),

  // ============ COACH OPERATIONS ============
  coach: router({
    // Get available coaches for browsing
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(20),
      }).optional())
      .query(async ({ input }) => {
        const coaches = await db.getAvailableCoaches(input?.limit || 20);
        return coaches;
      }),

    // Get coach profile by user ID
    getProfile: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const profile = await db.getCoachWithUser(input.userId);
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
        }
        return profile;
      }),

    // Get reviews for a coach
    getReviews: publicProcedure
      .input(z.object({
        coachId: z.number(),
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ input }) => {
        return await db.getReviewsByCoach(input.coachId, input.limit);
      }),

    // Get coach profile by ID (public) - for booking flow
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const coach = await db.getUserById(input.id);
        if (!coach) {
          return null;
        }
        const profile = await db.getCoachProfileByUserId(input.id);
        // Only return public fields — never expose password, tokens, or Stripe IDs
        const { password, emailVerificationToken, emailVerificationExpires,
          passwordResetToken, passwordResetExpires, stripeCustomerId,
          stripeConnectAccountId, ...publicCoach } = coach as any;
        return { ...publicCoach, profile };
      }),

    // Get coach availability (public)
    getAvailability: publicProcedure
      .input(z.object({
        coachId: z.number(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }))
      .query(async ({ input }) => {
        const profile = await db.getCoachProfileByUserId(input.coachId);
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
        }

        // Parse availability schedule (JSON) — safely handle malformed data
        let schedule = {};
        try {
          schedule = profile.availabilitySchedule
            ? JSON.parse(profile.availabilitySchedule as string)
            : {};
        } catch { /* malformed JSON, use empty schedule */ }

        // Get existing bookings to exclude. Return {start, durationMinutes}
        // so the client can compute real overlap (previously only timestamps
        // were returned, making overlap detection impossible for non-uniform
        // durations).
        const bookings = await db.getLessonsByCoach(input.coachId, 200);
        const EXCLUDED_STATUSES = new Set(["cancelled", "refunded", "declined"]);
        const bookedSlots = bookings
          .filter((l: any) => !EXCLUDED_STATUSES.has(l.status))
          .map((l: any) => ({
            start: l.scheduledAt,
            durationMinutes: l.durationMinutes || 60,
          }));

        let lessonDurations = [60];
        try {
          lessonDurations = profile.lessonDurations
            ? JSON.parse(profile.lessonDurations as string)
            : [60];
        } catch { /* malformed JSON, use default */ }

        return {
          schedule,
          bookedSlots,
          minAdvanceHours: profile.minAdvanceHours || 24,
          maxAdvanceDays: profile.maxAdvanceDays || 30,
          bufferMinutes: profile.bufferMinutes || 15,
          lessonDurations,
        };
      }),

    // List all active coaches (public)
    listActive: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit || 20;
        const offset = input?.offset || 0;
        return await db.getActiveCoaches(limit, offset);
      }),

    // Create coach profile (for logged-in users becoming coaches)
    createProfile: protectedProcedure
      .input(z.object({
        title: z.enum(["none", "CM", "FM", "IM", "GM", "WCM", "WFM", "WIM", "WGM"]).optional(),
        fideRating: z.number().min(0).max(3000).optional(),
        lichessUsername: z.string().optional(),
        chesscomUsername: z.string().optional(),
        specialties: z.array(z.string()).optional(),
        teachingStyle: z.enum(["visual", "interactive", "analytical", "competitive"]).optional(),
        experienceYears: z.number().min(0).max(50).optional(),
        languages: z.array(z.string()).optional(),
        hourlyRateCents: z.number().min(1000).max(100000).default(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if already has coach profile
        const existing = await db.getCoachProfileByUserId(ctx.user.id);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Coach profile already exists",
          });
        }

        await db.createCoachProfile({
          userId: ctx.user.id,
          title: input.title,
          fideRating: input.fideRating,
          lichessUsername: input.lichessUsername,
          chesscomUsername: input.chesscomUsername,
          specialties: input.specialties ? JSON.stringify(input.specialties) : null,
          teachingStyle: input.teachingStyle,
          experienceYears: input.experienceYears,
          languages: input.languages ? JSON.stringify(input.languages) : null,
          hourlyRateCents: input.hourlyRateCents,
        });

        return { success: true };
      }),

    // Start Stripe Connect onboarding
    startOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        console.log("[Onboarding] Starting for user:", ctx.user.id);
        const user = await db.getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        let accountId = user.stripeConnectAccountId;

        // Create Connect account if doesn't exist
        if (!accountId) {
          // Stripe requires ISO 3166-1 alpha-2 codes. New records store codes;
          // legacy records may have full country names — toCountryCode handles both.
          const countryCode = toCountryCode(user.country, "US");
          console.log("[Onboarding] Creating Connect account for:", user.email, "country:", user.country, "->", countryCode);
          const account = await stripeService.createConnectAccount(
            user.email || "",
            user.id,
            countryCode
          );
          accountId = account.id;
          console.log("[Onboarding] Connect account created:", accountId);
          await db.updateUserStripeConnectAccount(user.id, accountId, false);
        } else {
          console.log("[Onboarding] Using existing Connect account:", accountId);
        }

        // Generate onboarding link
        const baseUrl = ENV.frontendUrl || (ENV.isProduction 
          ? "https://boogme.com" 
          : "http://localhost:3000");
        console.log("[Onboarding] Using baseUrl:", baseUrl);
        
        const onboardingLink = await stripeService.createConnectOnboardingLink(
          accountId,
          `${baseUrl}/coach/onboarding/refresh`,
          `${baseUrl}/coach/onboarding/complete`
        );
        console.log("[Onboarding] Link generated successfully");
        return { url: onboardingLink.url };
      } catch (err: any) {
        console.error("[Onboarding] ERROR:", err.message, "type:", err.type, "code:", err.code, "statusCode:", err.statusCode);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Stripe onboarding failed: ${err.message}`,
        });
      }
    }),

    /**
     * After Stripe redirect, the client calls this to verify the Connect
     * account is fully onboarded and persist the flag to the DB.
     */
    confirmStripeOnboarded: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user?.stripeConnectAccountId) {
        return { onboarded: false };
      }
      const status = await stripeService.getConnectAccountStatus(user.stripeConnectAccountId);
      const onboarded = status.chargesEnabled && status.payoutsEnabled;
      if (onboarded && !user.stripeConnectOnboarded) {
        await db.updateUserStripeConnectAccount(ctx.user.id, user.stripeConnectAccountId, true);
      }
      return { onboarded };
    }),

    // Check onboarding status
    getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user?.stripeConnectAccountId) {
        return { onboarded: false, status: null };
      }

      const status = await stripeService.getConnectAccountStatus(user.stripeConnectAccountId);
      return {
        onboarded: status.chargesEnabled && status.payoutsEnabled,
        status,
      };
    }),

    // Get dashboard link for coaches
    getDashboardLink: coachProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user?.stripeConnectAccountId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Complete onboarding first",
        });
      }

      const loginLink = await stripeService.createConnectLoginLink(user.stripeConnectAccountId);
      return { url: loginLink.url };
    }),

    // Get coach earnings summary (for delayed signup flow)
    getEarnings: coachProcedure.query(async ({ ctx }) => {
      const earnings = await db.getCoachEarningsSummary(ctx.user.id);
      const user = await db.getUserById(ctx.user.id);
      
      return {
        ...earnings,
        stripeOnboarded: user?.stripeConnectOnboarded || false,
        needsOnboarding: earnings.hasReachedThreshold && !user?.stripeConnectOnboarded,
      };
    }),

    // Get my own coach profile (for wizard pre-filling)
    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getCoachProfileByUserId(ctx.user.id);
      const user = await db.getUserById(ctx.user.id);
      return { profile, user };
    }),

    // Update coach profile (used by onboarding wizard)
    updateProfile: protectedProcedure
      .input(z.object({
        // User-level fields
        name: z.string().min(2).max(100).optional(),
        bio: z.string().max(2000).optional(),
        avatarUrl: z.string().url().optional(),
        country: z.string().optional(),
        timezone: z.string().optional(),
        // Coach profile fields
        title: z.enum(["none", "CM", "FM", "IM", "GM", "WCM", "WFM", "WIM", "WGM"]).optional(),
        fideRating: z.number().min(0).max(3000).optional(),
        lichessUsername: z.string().max(64).optional(),
        chesscomUsername: z.string().max(64).optional(),
        specialties: z.array(z.string()).optional(),
        teachingStyle: z.enum(["visual", "interactive", "analytical", "competitive"]).optional(),
        experienceYears: z.number().min(0).max(50).optional(),
        languages: z.array(z.string()).optional(),
        hourlyRateCents: z.number().min(500).max(100000).optional(),
        // P1-1: pricingTier removed from client input — tier changes are server-owned
        // (subscription billing or admin-only). Coaches cannot self-select lower fees.
        availabilitySchedule: z.record(z.string(), z.object({
          enabled: z.boolean(),
          slots: z.array(z.object({ start: z.string(), end: z.string() })),
        })).optional(),
        lessonDurations: z.array(z.number()).optional(),
        minAdvanceHours: z.number().min(1).max(168).optional(),
        maxAdvanceDays: z.number().min(1).max(90).optional(),
        bufferMinutes: z.number().min(0).max(60).optional(),
        packageDiscountEnabled: z.boolean().optional(),
        packageDiscountPercent: z.number().min(0).max(50).optional(),
        guidelinesAgreed: z.boolean().optional(),
        onboardingStep: z.number().min(1).max(7).optional(),
        onboardingCompleted: z.boolean().optional(),
        profileActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { name, bio, avatarUrl, country, timezone, specialties, languages, lessonDurations, availabilitySchedule, ...coachFields } = input;

        // Update user-level fields — check !== undefined (not falsy) so empty strings can clear values
        if (name !== undefined || bio !== undefined || avatarUrl !== undefined || country !== undefined || timezone !== undefined) {
          await db.updateUserProfile(ctx.user.id, { name, bio, avatarUrl, country, timezone });
        }

        // Server-side validation when going live
        if (input.onboardingCompleted || input.profileActive) {
          const profile = await db.getCoachProfileByUserId(ctx.user.id);
          const user = await db.getUserById(ctx.user.id);
          if (!user?.name) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Please set your name before going live" });
          }
          if (!profile?.hourlyRateCents) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Please set your hourly rate before going live" });
          }
          const durations = profile?.lessonDurations ? JSON.parse(profile.lessonDurations) : [];
          if (!Array.isArray(durations) || durations.length === 0) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Please select at least one lesson duration" });
          }

          // Promote userType — if the student has ever booked a lesson, they've
          // acted in both roles, so set "both". Otherwise just "coach".
          if (user.userType === "student") {
            const studentLessons = await db.getLessonsByStudent(ctx.user.id, 1);
            const hasStudentBookings = Array.isArray(studentLessons) && studentLessons.length > 0;
            await db.updateUserType(ctx.user.id, hasStudentBookings ? "both" : "coach");
          }
        }

        // Update coach profile fields
        const coachUpdate: Record<string, unknown> = { ...coachFields };
        if (specialties !== undefined) coachUpdate.specialties = JSON.stringify(specialties);
        if (languages !== undefined) coachUpdate.languages = JSON.stringify(languages);
        if (lessonDurations !== undefined) coachUpdate.lessonDurations = JSON.stringify(lessonDurations);
        if (availabilitySchedule !== undefined) coachUpdate.availabilitySchedule = JSON.stringify(availabilitySchedule);
        if (input.onboardingCompleted) coachUpdate.onboardingCompletedAt = new Date();
        if (input.profileActive) coachUpdate.profileActivatedAt = new Date();
        if (input.guidelinesAgreed) coachUpdate.guidelinesAgreedAt = new Date();
        // P1-1: pricingTier is server-owned. Coaches cannot change their commission
        // rate through profile updates. Tier changes happen only through subscription
        // billing or admin action. All coaches default to Free tier until billing is live.

        if (Object.keys(coachUpdate).length > 0) {
          await db.updateCoachProfile(ctx.user.id, coachUpdate as any);
        }

        // Fire-and-forget welcome + owner emails when a coach goes live
        if (input.onboardingCompleted || input.profileActive) {
          const profile = await db.getCoachProfileByUserId(ctx.user.id);
          const coachName = name || ctx.user.name || "Coach";
          Promise.allSettled([
            (async () => {
              try {
                await sendSimpleEmail({
                  to: ctx.user.email,
                  subject: "Welcome to BooGMe, Coach!",
                  html: getCoachWelcomeEmail(coachName),
                });
              } catch (err) {
                console.error("[Email] Failed to send coach welcome email:", err);
              }
            })(),
            (async () => {
              try {
                await notifyOwner({
                  title: `New Coach Signed Up: ${coachName}`,
                  content: [
                    `Name: ${coachName}`,
                    `Email: ${ctx.user.email}`,
                    profile?.fideRating ? `FIDE Rating: ${profile.fideRating}` : null,
                    profile?.hourlyRateCents ? `Hourly Rate: $${(profile.hourlyRateCents / 100).toFixed(0)}/hr` : null,
                    `Pricing Tier: ${profile?.pricingTier || "free"}`,
                  ].filter(Boolean).join("\n"),
                });
              } catch (err) {
                console.error("[Email] Failed to notify owner of new coach:", err);
              }
            })(),
          ]);
        }

        return { success: true };
      }),

    // Upload profile photo to S3 and return the public URL
    uploadPhoto: protectedProcedure
      .input(z.object({
        // Base64-encoded image data (without the data:image/...;base64, prefix)
        base64Data: z.string().min(1).max(10_000_000), // ~7.5 MB max
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { base64Data, mimeType } = input;

        // Validate size (base64 is ~4/3 the binary size)
        const estimatedBytes = Math.ceil(base64Data.length * 0.75);
        if (estimatedBytes > 8_000_000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Image must be smaller than 8 MB",
          });
        }

        // Convert base64 to Buffer
        const buffer = Buffer.from(base64Data, "base64");

        // Build a unique S3 key so files can't be enumerated
        const ext = mimeType.split("/")[1] ?? "jpg";
        const key = `coach-photos/${ctx.user.id}-${Date.now()}.${ext}`;

        const { url } = await storagePut(key, buffer, mimeType);

        // Persist the URL on the user record immediately
        await db.updateUserProfile(ctx.user.id, { avatarUrl: url });

        return { url };
      }),

    // Check if coach needs to complete Stripe onboarding
    checkOnboardingRequired: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (user?.stripeConnectOnboarded) {
        return { required: false, reason: "already_onboarded" };
      }

      const hasReachedThreshold = await db.hasCoachReachedPayoutThreshold(ctx.user.id);
      return {
        required: hasReachedThreshold,
        reason: hasReachedThreshold ? "threshold_reached" : "below_threshold",
      };
    }),
  }),

  // ============ STUDENT OPERATIONS ============
  student: router({
    // Create/update student profile from quiz
    saveQuizResults: protectedProcedure
      .input(z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]),
        currentRating: z.number().optional(),
        targetRating: z.number().optional(),
        primaryGoal: z.enum(["rating_improvement", "tournament_prep", "openings", "tactics", "endgames", "general"]),
        playingStyle: z.enum(["aggressive", "positional", "balanced", "defensive"]),
        learningStyle: z.enum(["visual", "interactive", "analytical", "competitive"]),
        practiceSchedule: z.enum(["casual", "regular", "serious", "intensive"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getStudentProfileByUserId(ctx.user.id);
        
        if (existing) {
          // Update existing profile
          // For now, we'll create a new one - in production, implement update
          return { success: true, profileId: existing.id };
        }

        await db.createStudentProfile({
          userId: ctx.user.id,
          ...input,
        });

        return { success: true };
      }),

    // Get student profile
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStudentProfileByUserId(ctx.user.id);
    }),

    // Get student's achievements
    getAchievements: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAchievements(ctx.user.id);
    }),

    // Get AI coach matches
    getMatches: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMatchesForStudent(ctx.user.id);
    }),
  }),

  // ============ LESSON OPERATIONS ============
  lesson: router({
    // Book a lesson
    book: protectedProcedure
      .input(z.object({
        coachId: z.number(),
        scheduledAt: z.date().refine((d) => d > new Date(), {
          message: "Lesson must be scheduled in the future",
        }),
        durationMinutes: z.number().min(30).max(180).default(60),
        topic: z.string().optional(),
        timezone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Prevent self-booking
        if (ctx.user.id === input.coachId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot book a lesson with yourself" });
        }

        // Get coach profile for pricing
        const coachProfile = await db.getCoachProfileByUserId(input.coachId);
        if (!coachProfile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
        }

        // Calculate pricing using coach's tier (Free=12%, Pro=8%, Elite=5%).
        const hourlyRate = coachProfile.hourlyRateCents || 5000;
        const amountCents = Math.round((hourlyRate * input.durationMinutes) / 60);
        const breakdown = calculateLessonBreakdown({
          lessonPriceCents: amountCents,
          tier: coachProfile.pricingTier,
        });
        const commissionCents = breakdown.platformFeeCents;
        const coachPayoutCents = breakdown.coachPayoutCents;

        // Create lesson as pending_payment — student must pay before coach is notified.
        // confirmationDeadline is set by db.createLesson (now+24h) but only
        // starts mattering after payment_collected when the coach sees it.
        const lesson = await db.createLesson({
          studentId: ctx.user.id,
          coachId: input.coachId,
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          topic: input.topic,
          timezone: input.timezone,
          amountCents,
          commissionCents,
          coachPayoutCents,
          status: "pending_payment",
        });

        // If a coach is booking a lesson as a student for the first time, promote to "both"
        if (ctx.user.userType === "coach") {
          await db.updateUserType(ctx.user.id, "both");
        }

        // Coach is NOT notified at booking time. They will be notified
        // only after the student completes payment (webhook → payment_collected).

        // Return complete lesson object to avoid transaction isolation issues
        return { success: true, lessonId: lesson.id, lesson };
      }),

    // Get student's lessons
    myLessons: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getLessonsByStudent(ctx.user.id, input?.limit || 50);
      }),

    // Get coach's lessons
    coachLessons: coachProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getLessonsByCoach(ctx.user.id, input?.limit || 50);
      }),

    // Confirm lesson (coach)
    confirmAsCoach: coachProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        // Payment-first model: coach can only accept PAID booking requests.
        if (lesson.status !== "payment_collected") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson cannot be confirmed in its current state" });
        }

        // S29-1: Atomic CAS — claim the lesson from payment_collected → confirmed in one UPDATE.
        // If a concurrent decline request won the race first, this returns false and we reject.
        // Emails are only sent AFTER the CAS succeeds.
        const claimed = await db.claimLessonCoachDecision(input.lessonId, "confirmed");
        if (!claimed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This lesson was already acted on by a concurrent request. Please refresh and try again.",
          });
        }

        // CAS won — send confirmation email now (after state transition is committed)
        (async () => {
          try {
            const [student, coach] = await Promise.all([
              db.getUserById(lesson.studentId),
              db.getUserById(lesson.coachId),
            ]);
            if (!student?.email) return;
            const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            });
            const lessonTime = new Date(lesson.scheduledAt).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", hour12: true,
            });
            await sendEmail({
              to: student.email,
              subject: `${coach?.name || "Your coach"} accepted your lesson — you're all set!`,
              html: getStudentCoachConfirmedEmail({
                studentName: student.name || "Student",
                coachName: coach?.name || "Your Coach",
                lessonDate,
                lessonTime,
                durationMinutes: lesson.durationMinutes ?? 60,
                amount: `$${(lesson.amountCents / 100).toFixed(2)}`,
                lessonId: lesson.id,
              }),
            });
          } catch (err) {
            console.error(`[confirmAsCoach] Failed to send student confirmation email for lesson ${input.lessonId}:`, err);
          }
        })();

        return { success: true };
      }),

    // Decline lesson (coach) — payment-first model
    // Coach decline always triggers a FULL refund (100%) regardless of timing,
    // because the student paid upfront and the coach is choosing not to accept.
    declineAsCoach: coachProcedure
      .input(z.object({
        lessonId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        // Payment-first model: coach can only decline PAID booking requests.
        if (lesson.status !== "payment_collected") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson cannot be declined in its current state" });
        }

        // S29-1: Atomic CAS — claim the lesson from payment_collected → decline_pending.
        // This prevents a concurrent confirmAsCoach from also acting on the same lesson.
        // If the accept request won the race first, this returns false and we reject.
        const claimed = await db.claimLessonCoachDecision(input.lessonId, "decline_pending");
        if (!claimed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This lesson was already acted on by a concurrent request. Please refresh and try again.",
          });
        }

        // Full refund — coach decline is always 100% regardless of timing
        const refundAmountCents = lesson.amountCents;

        // No payment intent — data integrity issue; finalize decline without refund
        if (!lesson.stripePaymentIntentId) {
          await db.finalizeCoachDecline(
            input.lessonId,
            0,
            `${input.reason || 'Declined by coach'} (WARNING: no stripePaymentIntentId — manual refund required)`
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Lesson declined but no payment intent found — contact support to process your refund manually",
          });
        }

        // Attempt full Stripe refund.
        // If it fails, release the CAS claim back to payment_collected so admin can retry.
        // S31-2: Deterministic idempotency key — same key used in recovery so Stripe deduplicates.
        let refundSucceeded = false;
        try {
          await stripeService.createRefund(
            lesson.stripePaymentIntentId,
            undefined, // full refund
            "requested_by_customer",
            `lesson_decline_refund_${input.lessonId}`
          );
          refundSucceeded = true;
        } catch (stripeErr) {
          console.error(`[declineAsCoach] Stripe refund failed for lesson ${input.lessonId}:`, stripeErr);
        }

        if (!refundSucceeded) {
          // Release the CAS claim — lesson returns to payment_collected for admin retry.
          await db.releaseCoachDeclineClaim(input.lessonId);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Decline recorded but refund could not be processed. Our team will retry your refund automatically.",
          });
        }

        // Refund succeeded — finalize to declined (decline_pending → declined)
        await db.finalizeCoachDecline(
          input.lessonId,
          refundAmountCents,
          input.reason || "Declined by coach"
        );

        // Best-effort email notifications (only sent after successful refund + state finalized)
        await sendCancellationEmails(
          input.lessonId,
          'coach',
          input.reason || 'Declined by coach',
          refundAmountCents,
          100, // always 100% refund on coach decline
        );
        return { success: true, refundAmountCents };
      }),

    // Cancel lesson (student)
    cancel: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        // S29-4: Atomic CAS — claim the lesson into cancel_pending before calling Stripe.
        // This prevents concurrent cancellation attempts and ensures the refund policy
        // is calculated and locked atomically with the status transition.
        const claimed = await db.claimLessonCancellation(input.lessonId, 'student', input.reason);
        if (!claimed) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This lesson cannot be cancelled in its current state. It may have already been cancelled or completed.",
          });
        }

        const { refundAmountCents, refundPercentage } = claimed;

        // Attempt Stripe refund if one is due
        // S31-2: Deterministic idempotency key — same key used in recovery so Stripe deduplicates.
        let refundSucceeded = false;
        if (refundAmountCents > 0 && lesson.stripePaymentIntentId) {
          try {
            await stripeService.createRefund(
              lesson.stripePaymentIntentId,
              refundAmountCents,
              "requested_by_customer",
              `lesson_cancel_refund_${input.lessonId}`
            );
            refundSucceeded = true;
          } catch (stripeErr) {
            console.error(`[cancel] Stripe refund failed for lesson ${input.lessonId}:`, stripeErr);
          }

          if (!refundSucceeded) {
            // Stripe failed — finalize to cancelled but flag the refund failure.
            // The lesson is still cancelled (student cannot re-book), but admin must retry the refund.
            await db.releaseCancellationWithRefundFailed(input.lessonId);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Your lesson has been cancelled but the refund could not be processed. Our team will retry your refund automatically.",
            });
          }
        }

        // Finalize to cancelled (refund succeeded, or no refund was due)
        await db.finalizeCancellation(input.lessonId, refundSucceeded || refundAmountCents === 0);

        // Only send refund-success emails after confirmed Stripe success (or no-refund case)
        await sendCancellationEmails(
          input.lessonId,
          'student',
          input.reason,
          refundAmountCents,
          refundPercentage,
        );
        return {
          success: true,
          refundAmountCents,
          refundPercentage,
        };
      }),

    // Confirm completion (student) — payment-first model
    // Payment was already captured at checkout. This starts the 24-hour
    // issue window. Coach payout is NOT released here — it happens after
    // the issue window expires without a dispute.
    confirmCompletion: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        // Payment-first model: only confirmed lessons (coach accepted + student paid)
        // can be marked as completed.
        if (lesson.status !== "confirmed") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson must be confirmed before it can be completed" });
        }
        // Require a valid payment intent — cannot release funds without one
        if (!lesson.stripePaymentIntentId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment not recorded for this lesson" });
        }

        // Require the lesson end time to have passed.
        // Use scheduledAt + durationMinutes + 15 min grace period.
        // This prevents students from confirming completion before the lesson happens,
        // which would start the 24h issue window prematurely.
        const durationMs = (lesson.durationMinutes ?? 60) * 60 * 1000;
        const gracePeriodMs = 15 * 60 * 1000; // 15 minutes
        const lessonEndTime = new Date(lesson.scheduledAt).getTime() + durationMs + gracePeriodMs;
        if (Date.now() < lessonEndTime) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "The lesson has not ended yet. Please wait until the lesson is complete before confirming.",
          });
        }

        // NO capturePaymentIntent — payment was already captured at checkout.
        // Start the 24-hour issue window instead.
        const issueWindowEnds = new Date();
        issueWindowEnds.setHours(issueWindowEnds.getHours() + 24);

        await db.updateLessonStatus(input.lessonId, "completed", {
          studentConfirmedAt: new Date(),
          completedAt: new Date(),
          issueWindowEndsAt: issueWindowEnds,
          // DO NOT set payoutAt — payout happens after issue window
        });

        // Create review if provided. Also flip visibility on both reviews
        // if the coach has already submitted theirs.
        if (input.rating) {
          await db.createReview({
            lessonId: input.lessonId,
            reviewerId: ctx.user.id,
            revieweeId: lesson.coachId,
            reviewerType: 'student',
            rating: input.rating,
            comment: input.comment || '',
          });
          const counterpart = await db.getCounterpartReview(input.lessonId, "student");
          if (counterpart) {
            await db.setReviewsVisibleForLesson(input.lessonId);
          }
        }

        // Award XP to student
        await db.updateStudentXp(ctx.user.id, 50);

        return { success: true };
      }),

    // Raise issue (student) — within 24-hour issue window after completion
    // Pauses coach payout and marks lesson as disputed for admin resolution.
    raiseIssue: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        reason: z.string().min(1, "Please describe the issue"),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        // Can only raise issues on completed lessons (during issue window)
        if (lesson.status !== "completed") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Issues can only be raised for completed lessons" });
        }
        // Check 24-hour issue window
        if (lesson.issueWindowEndsAt && new Date() > lesson.issueWindowEndsAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "The 24-hour issue window has expired",
          });
        }

        // Mark as disputed — payout is paused until admin resolves
        await db.updateLessonStatus(input.lessonId, "disputed", {
          cancellationReason: input.reason,
        });

        // Notify admin/owner about the dispute
        try {
          const student = await db.getUserById(ctx.user.id);
          await notifyOwner({
            title: `Lesson Dispute: #${input.lessonId}`,
            content: `Student ${student?.name || ctx.user.id} raised an issue for lesson #${input.lessonId}: ${input.reason}`,
          });
        } catch (err) {
          console.error(`[raiseIssue] Failed to notify owner for lesson ${input.lessonId}:`, err);
        }

        return { success: true };
      }),

    // LEGACY: Request refund (within 48-hour window) — kept for backward compatibility
    // S30-3: DISABLED — requestRefund is a legacy endpoint that allowed students to refund
    // lessons in 'released' status. However, 'released' means the coach payout has already been
    // transferred via Stripe. Refunding after a completed transfer requires a Stripe transfer
    // reversal, which is not yet implemented. This endpoint is disabled to prevent double-settlement.
    //
    // For pre-completion issues: use lesson.raiseIssue (starts a dispute before payout).
    // For post-payout refunds: an admin must perform a manual transfer reversal in Stripe Dashboard,
    // then use admin.disputes.refundStudent.
    requestRefund: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        // S30-3: Block all requests — released lessons have a completed Stripe transfer.
        // Post-payout refunds require a transfer reversal, which is not yet implemented.
        // Students with issues should use raiseIssue before the payout window closes.
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Post-payout refunds are not available through this endpoint. " +
            "If you experienced an issue with your lesson, please contact support. " +
            "For disputes before payout, use the 'Report an Issue' option on your lesson.",
        });
      }),
  }),

  // ============ REVIEW OPERATIONS ============
  review: router({
    /**
     * Submit a review for a lesson. Validates:
     *   - the lesson is in a completion state (completed/released)
     *   - the current user was a participant
     *   - the user hasn't already submitted
     * Once both parties have reviewed, both reviews become visible.
     */
    submit: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional(),
        knowledgeRating: z.number().int().min(1).max(5).optional(),
        communicationRating: z.number().int().min(1).max(5).optional(),
        preparednessRating: z.number().int().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }

        const isStudent = lesson.studentId === ctx.user.id;
        const isCoach = lesson.coachId === ctx.user.id;
        if (!isStudent && !isCoach) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        if (!["completed", "released"].includes(lesson.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Lesson is not completed yet",
          });
        }

        const existing = await db.getReviewByLessonAndReviewer(input.lessonId, ctx.user.id);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already reviewed this lesson",
          });
        }

        const reviewerType: "student" | "coach" = isStudent ? "student" : "coach";
        const revieweeId = isStudent ? lesson.coachId : lesson.studentId;

        await db.createReview({
          lessonId: input.lessonId,
          reviewerId: ctx.user.id,
          revieweeId,
          reviewerType,
          rating: input.rating,
          comment: input.comment || "",
          knowledgeRating: input.knowledgeRating,
          communicationRating: input.communicationRating,
          preparednessRating: input.preparednessRating,
        });

        // If the counterpart has already submitted, make both visible.
        const counterpart = await db.getCounterpartReview(input.lessonId, reviewerType);
        if (counterpart) {
          await db.setReviewsVisibleForLesson(input.lessonId);
        }

        return { success: true, bothSubmitted: !!counterpart };
      }),

    /**
     * Return completed lessons where the current user has not yet left a review.
     * Includes the other party's name so the UI can prompt meaningfully.
     */
    getPending: protectedProcedure.query(async ({ ctx }) => {
      const [asStudent, asCoach] = await Promise.all([
        db.getLessonsByStudent(ctx.user.id, 100),
        db.getLessonsByCoach(ctx.user.id, 100),
      ]);

      const completedLessons = [...asStudent, ...asCoach].filter((l: any) =>
        ["completed", "released"].includes(l.status)
      );

      const pending: any[] = [];
      for (const lesson of completedLessons) {
        const existing = await db.getReviewByLessonAndReviewer(lesson.id, ctx.user.id);
        if (existing) continue;
        const otherUserId = lesson.studentId === ctx.user.id ? lesson.coachId : lesson.studentId;
        const otherUser = await db.getUserById(otherUserId);
        pending.push({
          lessonId: lesson.id,
          scheduledAt: lesson.scheduledAt,
          durationMinutes: lesson.durationMinutes,
          otherPartyName: otherUser?.name || "Unknown",
          reviewingAs: lesson.studentId === ctx.user.id ? "student" : "coach",
        });
      }

      return pending;
    }),

    /**
     * Public: visible reviews for a coach (both-sides-submitted only).
     * Reuses existing getReviewsByCoach helper which already filters on isVisible.
     */
    getForCoach: publicProcedure
      .input(z.object({
        coachId: z.number(),
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ input }) => {
        return await db.getReviewsByCoach(input.coachId, input.limit);
      }),
  }),

  // ============ IN-APP MESSAGING ============
  messages: router({
    /**
     * Send a message on a specific lesson. Requires the sender to be the
     * student or coach for that lesson.
     */
    send: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
        content: z.string().min(1).max(4000),
        contentType: z.enum(["text", "pgn"]).default("text"),
      }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id && lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        return await db.createMessage({
          lessonId: input.lessonId,
          senderId: ctx.user.id,
          content: input.content,
          contentType: input.contentType,
        });
      }),

    /**
     * Get the message thread for a lesson. Also marks the counterpart's
     * messages as read for the current user as a side effect.
     */
    getForLesson: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id && lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        // Fire-and-forget read marker — don't block the response on it.
        db.markLessonMessagesRead(input.lessonId, ctx.user.id).catch(err =>
          console.error("[messages.getForLesson] markRead failed:", err)
        );
        return await db.getMessagesForLesson(input.lessonId);
      }),

    /**
     * Explicit mark-as-read (used if the user revisits a tab).
     */
    markRead: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id && lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }
        await db.markLessonMessagesRead(input.lessonId, ctx.user.id);
        return { success: true };
      }),

    /**
     * Unread counts per lesson for the current user, keyed by lessonId.
     * Client passes the list of lessonIds visible on the dashboard.
     */
    getUnreadCounts: protectedProcedure
      .input(z.object({ lessonIds: z.array(z.number()).max(200) }))
      .query(async ({ ctx, input }) => {
        const counts = await db.getUnreadMessageCountsForUser(ctx.user.id, input.lessonIds);
        // Serialize Map -> plain object for tRPC
        const result: Record<number, number> = {};
        counts.forEach((v, k) => { result[k] = v; });
        return result;
      }),
  }),

  // ============ GROUP LESSONS (Sprint 10) ============
  // Minimal backend scaffolding — organizer creates a group lesson, others
  // join via an invite token. Full UI + payment-split checkout flow is a
  // future phase per BUILD_PLAN.md. Uses raw SQL via db.execute for
  // consistency with the rest of the lesson read path.
  groupLesson: router({
    /**
     * Create a group lesson and return its invite token.
     * Only the organizer's price share is committed up-front — other
     * participants pay when they join.
     */
    create: protectedProcedure
      .input(z.object({
        coachId: z.number(),
        scheduledAt: z.date().refine((d) => d > new Date(), {
          message: "Group lesson must be scheduled in the future",
        }),
        durationMinutes: z.number().min(30).max(240).default(60),
        maxParticipants: z.number().min(2).max(10),
        topic: z.string().optional(),
        timezone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.coachId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot organize a group lesson with yourself" });
        }
        const coachProfile = await db.getCoachProfileByUserId(input.coachId);
        if (!coachProfile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
        }

        const hourlyRate = coachProfile.hourlyRateCents || 5000;
        const totalAmountCents = Math.round((hourlyRate * input.durationMinutes) / 60);
        const perParticipantCents = Math.ceil(totalAmountCents / input.maxParticipants);
        const breakdown = calculateLessonBreakdown({
          lessonPriceCents: totalAmountCents,
          tier: coachProfile.pricingTier,
        });
        const commissionCents = breakdown.platformFeeCents;
        const coachPayoutCents = breakdown.coachPayoutCents;

        const crypto = await import("crypto");
        const inviteToken = crypto.randomBytes(24).toString("hex");

        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const { sql } = await import("drizzle-orm");
        const result: any = await database.execute(sql`
          INSERT INTO group_lessons (
            coachId, organizerId, scheduledAt, durationMinutes, timezone,
            topic, maxParticipants, totalAmountCents, perParticipantCents,
            commissionCents, coachPayoutCents, inviteToken, status
          ) VALUES (
            ${input.coachId}, ${ctx.user.id}, ${input.scheduledAt}, ${input.durationMinutes}, ${input.timezone || null},
            ${input.topic || null}, ${input.maxParticipants}, ${totalAmountCents}, ${perParticipantCents},
            ${commissionCents}, ${coachPayoutCents}, ${inviteToken}, 'forming'
          )
        `);
        const groupLessonId = Number(result[0]?.insertId);

        // Organizer is automatically a participant.
        await database.execute(sql`
          INSERT INTO group_lesson_participants (groupLessonId, studentId)
          VALUES (${groupLessonId}, ${ctx.user.id})
        `);

        return { success: true, groupLessonId, inviteToken, perParticipantCents };
      }),

    /** Get a group lesson by invite token (public — used on join page). */
    getByInviteToken: publicProcedure
      .input(z.object({ inviteToken: z.string().min(10).max(64) }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { sql } = await import("drizzle-orm");
        const result: any = await database.execute(sql`
          SELECT * FROM group_lessons WHERE inviteToken = ${input.inviteToken} LIMIT 1
        `);
        const rows = result[0];
        if (!rows || rows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Group lesson not found" });
        }
        return rows[0];
      }),

    /**
     * Join a group lesson as a participant using the invite token.
     * Returns the participant row; actual payment happens via a separate
     * checkout flow (future phase).
     */
    join: protectedProcedure
      .input(z.object({ inviteToken: z.string().min(10).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { sql } = await import("drizzle-orm");

        const lookup: any = await database.execute(sql`
          SELECT * FROM group_lessons WHERE inviteToken = ${input.inviteToken} LIMIT 1
        `);
        const lesson = lookup[0]?.[0];
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Group lesson not found" });
        }
        if (lesson.status !== "forming") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Group lesson is no longer accepting participants" });
        }

        // Check capacity
        const countResult: any = await database.execute(sql`
          SELECT COUNT(*) AS c FROM group_lesson_participants
          WHERE groupLessonId = ${lesson.id} AND dropped = 0
        `);
        const current = Number(countResult[0]?.[0]?.c ?? 0);
        if (current >= lesson.maxParticipants) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Group lesson is full" });
        }

        // Prevent duplicate join
        const existingResult: any = await database.execute(sql`
          SELECT id FROM group_lesson_participants
          WHERE groupLessonId = ${lesson.id} AND studentId = ${ctx.user.id} AND dropped = 0
        `);
        if (existingResult[0]?.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Already joined this group lesson" });
        }

        await database.execute(sql`
          INSERT INTO group_lesson_participants (groupLessonId, studentId)
          VALUES (${lesson.id}, ${ctx.user.id})
        `);

        return { success: true, groupLessonId: lesson.id, perParticipantCents: lesson.perParticipantCents };
      }),
  }),

  // ============ CONTENT MONETIZATION (Sprint 11 — future phase) ============
  // Minimal backend scaffold for pay-per-view content. Full upload flow,
  // subscription tiers, and content library UI are deferred per
  // BUILD_PLAN.md (Phase 4). This commit establishes the schema + the
  // list/get/purchase endpoints so those features can be built
  // incrementally without schema churn.
  content: router({
    /** Public: list published content, optionally filtered by coach. */
    list: publicProcedure
      .input(z.object({
        coachId: z.number().optional(),
        kind: z.enum(["course", "video", "pdf", "pgn", "bundle"]).optional(),
        limit: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) return [];
        const { sql } = await import("drizzle-orm");

        const coachFilter = input?.coachId ? sql`AND coachId = ${input.coachId}` : sql``;
        const kindFilter = input?.kind ? sql`AND kind = ${input.kind}` : sql``;
        const limit = input?.limit ?? 20;

        const result: any = await database.execute(sql`
          SELECT id, coachId, title, description, kind, thumbnailUrl,
                 priceCents, currency, previewContent, publishedAt
          FROM content_items
          WHERE published = 1
            ${coachFilter}
            ${kindFilter}
          ORDER BY publishedAt DESC
          LIMIT ${limit}
        `);
        return (result[0] || []) as any[];
      }),

    /**
     * Get a single content item. Returns the preview by default; the
     * unlocked payload (storageKey -> presigned URL) is only included
     * if the caller has purchased or owns the content.
     */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { sql } = await import("drizzle-orm");

        const itemResult: any = await database.execute(sql`
          SELECT * FROM content_items WHERE id = ${input.id} AND published = 1 LIMIT 1
        `);
        const item = itemResult[0]?.[0];
        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
        }

        // Check if the current user has unlocked it
        let unlocked = item.priceCents === 0 || ctx.user?.id === item.coachId;
        if (!unlocked && ctx.user?.id) {
          const purchaseResult: any = await database.execute(sql`
            SELECT id FROM content_purchases
            WHERE contentItemId = ${item.id} AND userId = ${ctx.user.id}
            LIMIT 1
          `);
          unlocked = (purchaseResult[0]?.length ?? 0) > 0;
        }

        // Only expose the raw storage key to unlocked users; otherwise
        // return the preview only.
        const { storageKey, ...publicFields } = item as any;
        return {
          ...publicFields,
          unlocked,
          storageKey: unlocked ? storageKey : undefined,
        };
      }),

    /**
     * Mark content as purchased for the current user. Stripe checkout is
     * expected to have completed before calling this — the actual payment
     * flow will be wired up when the checkout endpoint lands.
     */
    recordPurchase: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        stripePaymentIntentId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { sql } = await import("drizzle-orm");

        // Idempotency — don't double-insert if the user already owns it
        const existingResult: any = await database.execute(sql`
          SELECT id FROM content_purchases
          WHERE contentItemId = ${input.contentItemId} AND userId = ${ctx.user.id}
          LIMIT 1
        `);
        if ((existingResult[0]?.length ?? 0) > 0) {
          return { success: true, alreadyOwned: true };
        }

        // P1-2 + R2-3: Verify the PaymentIntent with Stripe before recording the purchase.
        // Do NOT trust client-supplied amount or status.
        const { stripe } = await import("./stripe");
        let paymentIntent;
        try {
          paymentIntent = await stripe.paymentIntents.retrieve(input.stripePaymentIntentId);
        } catch (err) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid payment intent ID" });
        }

        // Verify payment succeeded
        if (paymentIntent.status !== "succeeded") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment has not succeeded" });
        }

        // R2-3: HARD-require metadata fields — missing metadata = reject (not soft check)
        const metaUserId = paymentIntent.metadata?.user_id;
        const metaContentId = paymentIntent.metadata?.content_item_id;
        const metaType = paymentIntent.metadata?.type;

        if (!metaUserId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PaymentIntent missing required metadata: user_id" });
        }
        if (metaUserId !== String(ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Payment does not belong to this user" });
        }
        if (!metaContentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PaymentIntent missing required metadata: content_item_id" });
        }
        if (metaContentId !== String(input.contentItemId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Payment does not match this content item" });
        }
        if (!metaType || metaType !== "content_purchase") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "PaymentIntent missing or invalid metadata: type (must be 'content_purchase')" });
        }

        // R2-3: Verify amount and currency against the content_items table
        const contentItemResult: any = await database.execute(sql`
          SELECT priceCents, currency FROM content_items
          WHERE id = ${input.contentItemId}
          LIMIT 1
        `);
        const contentItem = contentItemResult[0]?.[0];
        if (!contentItem) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        }
        const expectedCurrency = (contentItem.currency || "USD").toLowerCase();
        const actualCurrency = (paymentIntent.currency || "").toLowerCase();
        if (paymentIntent.amount !== contentItem.priceCents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment amount mismatch: expected ${contentItem.priceCents}, got ${paymentIntent.amount}`,
          });
        }
        if (actualCurrency !== expectedCurrency) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment currency mismatch: expected ${expectedCurrency}, got ${actualCurrency}`,
          });
        }

        // R2-3: Insert with DB unique constraint handling for idempotency.
        // The schema now has a unique index on stripePaymentIntentId.
        // A duplicate key error means this payment was already recorded — treat as idempotent success.
        const amountPaidCents = paymentIntent.amount;
        try {
          await database.execute(sql`
            INSERT INTO content_purchases
              (contentItemId, userId, unlockMethod, amountPaidCents, stripePaymentIntentId)
            VALUES
              (${input.contentItemId}, ${ctx.user.id}, 'purchase', ${amountPaidCents}, ${input.stripePaymentIntentId})
          `);
        } catch (insertErr: any) {
          // MySQL duplicate entry error code: ER_DUP_ENTRY (1062)
          if (insertErr?.errno === 1062 || insertErr?.code === 'ER_DUP_ENTRY') {
            return { success: true, alreadyOwned: true };
          }
          throw insertErr;
        }
        return { success: true, alreadyOwned: false };
      }),
  }),

  // ============ PAYMENT OPERATIONS ============
  payment: router({
    // Create checkout session for a lesson
    createCheckout: protectedProcedure
      .input(z.object({
        lessonId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Always fetch from DB — never trust client-supplied pricing data
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        // Payment-first model: checkout is allowed only from pending_payment.
        // Student pays upfront; coach is notified only after payment_collected.
        if (lesson.status !== "pending_payment") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot create checkout: lesson is in '${lesson.status}' state (must be 'pending_payment')`,
          });
        }

        // R5-2: Idempotency guard with race-safe session creation.
        // Handle existing stripeCheckoutSessionId by value:
        //   - "__pending__": another request is creating a session right now
        //   - real session ID: check Stripe status (open/complete/expired)
        // R6-2: Track the fresh attempt value after clearing expired/invalid sessions.
        // This ensures the idempotency key uses the incremented value, not the stale in-memory one.
        let freshAttempt: number | null = null;

        if (lesson.stripeCheckoutSessionId) {
          // R5-2: If the slot contains "__pending__", another request is in-flight.
          // Do NOT call Stripe retrieve, do NOT clear. Return CONFLICT immediately.
          if (lesson.stripeCheckoutSessionId === "__pending__") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Checkout is already being created for this lesson. Please try again shortly.",
            });
          }

          // R7-2: Store the expected session ID for conditional atomic clear.
          const expectedSessionId = lesson.stripeCheckoutSessionId!;
          let shouldClear = false;

          try {
            const existingSession = await stripeService.retrieveCheckoutSession(expectedSessionId);
            if (existingSession.status === "open") {
              // Session is still payable — return it instead of creating a new one
              return { url: existingSession.url };
            }
            if (existingSession.status === "complete") {
              // Payment completed but webhook hasn't processed yet.
              // Do NOT clear — the webhook will handle the transition.
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Payment is already processing for this lesson. Please wait for confirmation.",
              });
            }
            // Session is expired — safe to conditionally clear
            shouldClear = true;
          } catch (err) {
            // Re-throw TRPCErrors (our own errors above)
            if (err instanceof TRPCError) throw err;
            // Distinguish resource-not-found from transient errors
            const stripeErr = err as any;
            const isResourceMissing =
              stripeErr?.type === "StripeInvalidRequestError" ||
              stripeErr?.statusCode === 404 ||
              stripeErr?.code === "resource_missing";
            if (isResourceMissing) {
              // Session definitively does not exist in Stripe — safe to conditionally clear
              shouldClear = true;
            } else {
              // Transient error (network, rate limit, auth, 5xx) — do NOT clear the live session
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Unable to verify checkout status. Please try again shortly.",
              });
            }
          }

          if (shouldClear) {
            // R7-2: Conditional atomic clear — only clears if session ID still matches.
            // If another request already cleared it and claimed __pending__, this returns cleared=false.
            const clearResult = await db.clearLessonCheckoutSessionIfMatches(lesson.id, expectedSessionId);
            if (!clearResult.cleared) {
              // Another request already cleared/replaced the session — re-read and respond
              const refreshed = await db.getLessonById(lesson.id);
              if (refreshed?.stripeCheckoutSessionId === "__pending__") {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "Another checkout is being created for this lesson. Please try again shortly.",
                });
              }
              if (refreshed?.stripeCheckoutSessionId) {
                // Another request already created a new session — try to return it
                try {
                  const newSession = await stripeService.retrieveCheckoutSession(refreshed.stripeCheckoutSessionId);
                  if (newSession.status === "open") {
                    return { url: newSession.url };
                  }
                } catch { /* fall through */ }
              }
              throw new TRPCError({
                code: "CONFLICT",
                message: "Another checkout is being created for this lesson. Please try again shortly.",
              });
            }
            freshAttempt = clearResult.checkoutAttempt;
          }
        }

        // R4-2: Atomic compare-and-set to prevent concurrent session creation.
        // Only set stripeCheckoutSessionId if it's currently NULL (no other request won the race).
        const claimed = await db.claimLessonCheckoutSlot(lesson.id);
        if (!claimed) {
          // Another concurrent request already claimed the slot.
          // Re-read the lesson to return the session that won the race.
          const updatedLesson = await db.getLessonById(lesson.id);
          if (updatedLesson?.stripeCheckoutSessionId && updatedLesson.stripeCheckoutSessionId !== "__pending__") {
            try {
              const raceWinnerSession = await stripeService.retrieveCheckoutSession(updatedLesson.stripeCheckoutSessionId);
              if (raceWinnerSession.status === "open") {
                return { url: raceWinnerSession.url };
              }
            } catch { /* fall through to error */ }
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: "Another checkout is being created for this lesson. Please try again.",
          });
        }

        try {
          // Get coach info
          const coach = await db.getUserById(lesson.coachId);
          if (!coach?.stripeConnectAccountId) {
            // Release the slot since we can't proceed
            await db.clearLessonCheckoutSession(lesson.id);
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Coach has not completed payment setup",
            });
          }

          const student = await db.getUserById(ctx.user.id);
          // Use VITE_FRONTEND_URL which works in both dev and production
          const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000";

          // Look up coach's pricing tier so checkout uses tier-based fee.
          const coachProfile = await db.getCoachProfileByUserId(lesson.coachId);

          // R6-2: Use the fresh attempt value if we cleared an expired/invalid session,
          // otherwise use the in-memory value (which is still current for first-time checkouts).
          const attempt = freshAttempt ?? (lesson.checkoutAttempt ?? 0);
          const session = await stripeService.createLessonCheckoutSession({
            lessonPriceCents: lesson.amountCents,
            currency: lesson.currency || "USD",
            lessonId: lesson.id,
            studentId: ctx.user.id,
            studentEmail: student?.email || "",
            coachName: coach.name || "Coach",
            coachConnectAccountId: coach.stripeConnectAccountId,
            coachPricingTier: coachProfile?.pricingTier,
            successUrl: `${baseUrl}/lessons/${lesson.id}?payment=success`,
            cancelUrl: `${baseUrl}/lessons/${lesson.id}?payment=cancelled`,
            idempotencyKey: `lesson_checkout_${lesson.id}_v${attempt}`,
          });

          // Persist the actual session ID (overwrite the placeholder)
          await db.setLessonCheckoutSession(lesson.id, session.id);

          return { url: session.url };
        } catch (err) {
          // If session creation fails, release the slot
          if (!(err instanceof TRPCError)) {
            await db.clearLessonCheckoutSession(lesson.id);
          }
          throw err;
        }
      }),
  }),

  // ============ ADMIN OPERATIONS ============
  admin: router({
    // List all coach applications
    applications: router({
      list: protectedProcedure
        .input(z.object({
          status: z.enum(["pending", "under_review", "approved", "rejected", "withdrawn"]).optional(),
        }).optional())
        .use(({ ctx, next }) => {
          // Admin authorization middleware
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .query(async ({ input }) => {
          return await db.getCoachApplications(input?.status);
        }),

      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .query(async ({ input }) => {
          const application = await db.getCoachApplicationById(input.id);
          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found",
            });
          }
          return application;
        }),

      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "under_review", "approved", "rejected", "withdrawn"]),
          reviewNotes: z.string().optional(),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async ({ ctx, input }) => {
          await db.updateCoachApplicationStatus(
            input.id,
            input.status,
            ctx.user.id,
            input.reviewNotes
          );
          return { success: true };
        }),

      approve: protectedProcedure
        .input(z.object({
          id: z.number(),
          reviewNotes: z.string().optional(),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async ({ ctx, input }) => {
          // Get application details
          const application = await db.getCoachApplicationById(input.id);
          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found",
            });
          }

          // Check if already approved
          if (application.status === "approved") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Application already approved",
            });
          }

          // TODO: Create user account if doesn't exist
          // TODO: Create coach profile
          // TODO: Send approval email

          // Update application status
          await db.updateCoachApplicationStatus(
            input.id,
            "approved",
            ctx.user.id,
            input.reviewNotes
          );

          return { success: true };
        }),

      reject: protectedProcedure
        .input(z.object({
          id: z.number(),
          reviewNotes: z.string().min(10, "Please provide a reason for rejection"),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async ({ ctx, input }) => {
          // Get application details
          const application = await db.getCoachApplicationById(input.id);
          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found",
            });
          }

          // TODO: Send rejection email with feedback

          // Update application status
          await db.updateCoachApplicationStatus(
            input.id,
            "rejected",
            ctx.user.id,
            input.reviewNotes
          );

          return { success: true };
        }),

      stats: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .query(async () => {
          return await db.getCoachApplicationStats();
        }),
    }),
    
    // Nurture email management
    emails: router({
      // Trigger nurture email batch manually
      sendNurtureBatch: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async () => {
          const result = await sendNurtureEmails();
          return result;
        }),
      
      // Send test nurture email
      sendTestEmail: protectedProcedure
        .input(z.object({
          emailNumber: z.number().min(1).max(5),
          testEmail: z.string().email(),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async ({ input }) => {
          const result = await sendNurtureEmailsManual(
            input.emailNumber as 1 | 2 | 3 | 4 | 5,
            input.testEmail
          );
          return result;
        }),
      
      // Resend welcome emails to all subscribers
      resendWelcome: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async () => {
          const result = await resendWelcomeEmails();
          return result;
        }),
      
      // Broadcast test email to all subscribers
      broadcastTest: protectedProcedure
        .input(z.object({
          subject: z.string().min(1),
          message: z.string().min(1),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .mutation(async ({ input }) => {
          const entries = await db.getAllWaitlistEntries();
          const activeSubscribers = entries.filter(e => !e.unsubscribed);
          
          let successCount = 0;
          let failCount = 0;
          
          for (const entry of activeSubscribers) {
            try {
              const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${input.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                ${input.subject}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${entry.name || entry.email.split('@')[0]},
              </p>
              
              <div style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                ${input.message.replace(/\n/g, '<br>')}
              </div>
              
              <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Best regards,<br>
                The BooGMe Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(entry.email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
              `;
              
              const result = await sendEmail({
                to: entry.email,
                subject: input.subject,
                html: emailHtml,
              });
              
              if (result.success) {
                successCount++;
              } else {
                failCount++;
              }
            } catch (error) {
              console.error(`[Broadcast] Failed to send to ${entry.email}:`, error);
              failCount++;
            }
          }
          
          return {
            success: true,
            totalSubscribers: activeSubscribers.length,
            successCount,
            failCount,
          };
        }),
    }),

    // ============ DISPUTE RESOLUTION & PAYOUT MANAGEMENT ============
    disputes: router({
      // List disputed lessons for admin review
      list: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return next({ ctx });
        })
        .query(async () => {
          return await db.getLessonsByStatus("disputed");
        }),

      // List completed lessons ready for payout release (issue window expired, no dispute)
      pendingPayouts: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return next({ ctx });
        })
        .query(async () => {
          return await db.getCompletedLessonsReadyForPayout();
        }),

      // Release coach payout — transfers funds from platform to coach's connected account.
      //
      // For 'completed' lessons: enforces issueWindowEndsAt <= now (window must have expired).
      // For 'disputed' lessons: admin override is allowed (explicit decision after review).
      // Atomic CAS prevents double-transfer under concurrent calls.
      releasePayout: protectedProcedure
        .input(z.object({
          lessonId: z.number(),
          adminOverrideReason: z.string().optional(), // required for disputed lessons
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return next({ ctx });
        })
        .mutation(async ({ input }) => {
          const lesson = await db.getLessonById(input.lessonId);
          if (!lesson) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
          }
          // Only completed or disputed lessons can be paid out
          if (lesson.status !== "completed" && lesson.status !== "disputed") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson is not in a payable state" });
          }
          if (!lesson.stripePaymentIntentId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No payment recorded for this lesson" });
          }
          // S31-3: Explicit sentinel checks before the real-transfer-ID idempotency path.
          // __pending_refund__: an admin refund is in-flight — payout must not proceed.
          if (lesson.stripeTransferId === '__pending_refund__') {
            throw new TRPCError({ code: "CONFLICT", message: "A refund is currently in progress for this lesson. Payout cannot proceed until the refund is resolved." });
          }
          // __pending_payout__: another releasePayout call is in-flight.
          if (lesson.stripeTransferId === '__pending_payout__') {
            throw new TRPCError({ code: "CONFLICT", message: "Payout is already in progress. Please try again in a moment." });
          }
          // Idempotent: if already released with a real transfer ID, return success.
          // Only real Stripe transfer IDs (not sentinels) reach this branch.
          if (lesson.stripeTransferId) {
            return { success: true, transferId: lesson.stripeTransferId, alreadyReleased: true };
          }

          // For completed lessons: enforce that the issue window has actually expired.
          // For disputed lessons: admin override is allowed but requires an explicit reason.
          if (lesson.status === "completed") {
            if (!lesson.issueWindowEndsAt) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Lesson has no issue window set — cannot safely release payout",
              });
            }
            if (new Date() < lesson.issueWindowEndsAt) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: `Issue window has not expired yet. Payout available after ${lesson.issueWindowEndsAt.toISOString()}.`,
              });
            }
          } else if (lesson.status === "disputed") {
            // Admin override for disputed lessons requires an explicit reason
            if (!input.adminOverrideReason?.trim()) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Admin override reason is required for disputed lessons",
              });
            }
          }

          // Look up coach's connected account
          const coach = await db.getUserById(lesson.coachId);
          if (!coach?.stripeConnectAccountId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Coach does not have a connected Stripe account" });
          }

          // Atomic CAS — claim the payout slot before touching Stripe.
          // If two concurrent calls race here, only one will win.
          const claimed = await db.claimLessonPayoutSlot(input.lessonId);
          if (!claimed) {
            throw new TRPCError({ code: "CONFLICT", message: "Payout already claimed by a concurrent request. Please refresh and try again." });
          }

          // Transfer coach payout to their connected account.
          // Use a deterministic idempotency key so Stripe deduplicates retries.
          const idempotencyKey = `lesson_payout_${lesson.id}`;
          const result = await transferToCoach({
            accountId: coach.stripeConnectAccountId,
            amountCents: lesson.coachPayoutCents,
            currency: lesson.currency || "usd",
            description: `Payout for lesson #${lesson.id}`,
            idempotencyKey,
            metadata: {
              lessonId: lesson.id.toString(),
              coachId: lesson.coachId.toString(),
              studentId: lesson.studentId.toString(),
              ...(input.adminOverrideReason ? { adminOverrideReason: input.adminOverrideReason } : {}),
            },
          });

          if (!result.success) {
            // Release the slot so admin can retry
            await db.releaseLessonPayoutSlot(input.lessonId);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Transfer failed: ${result.error}` });
          }

          // Finalize: replace placeholder with real transfer ID and mark released
          await db.finalizeLessonPayout(input.lessonId, result.transferId!);

          return { success: true, transferId: result.transferId };
        }),

      // Admin: full refund to student (for disputed lessons)
      refundStudent: protectedProcedure
        .input(z.object({
          lessonId: z.number(),
          amountCents: z.number().optional(), // undefined = full refund
          reason: z.string().optional(),
        }))
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return next({ ctx });  
        })
        .mutation(async ({ input }) => {
          const lesson = await db.getLessonById(input.lessonId);
          if (!lesson) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
          }
          if (lesson.status !== "disputed" && lesson.status !== "completed") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson is not in a refundable state" });
          }
          if (!lesson.stripePaymentIntentId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No payment recorded for this lesson" });
          }

          // S30-1: Atomic settlement claim — prevent refund+payout double-settlement.
          // claimLessonRefundSlot atomically sets stripeTransferId = '__pending_refund__'
          // WHERE stripeTransferId IS NULL, so it loses to any concurrent payout claim.
          // S31-4: Also store the intended refund amount so recovery can reconstruct it after a crash.
          const refundAmountCentsForClaim = input.amountCents ?? lesson.amountCents;
          const claimed = await db.claimLessonRefundSlot(input.lessonId, refundAmountCentsForClaim);
          if (!claimed) {
            // Lost the race — either a payout is in-flight or already completed.
            // Re-read to give a precise error message.
            const fresh = await db.getLessonById(input.lessonId);
            if (fresh?.stripeTransferId && fresh.stripeTransferId !== '__pending_refund__') {
              if (fresh.stripeTransferId === '__pending_payout__') {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "A payout transfer is currently in progress for this lesson. Wait for it to complete before issuing a refund.",
                });
              }
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: `Payout already released (transfer ${fresh.stripeTransferId}). Refunding after a completed payout requires a manual transfer reversal in the Stripe dashboard.`,
              });
            }
            throw new TRPCError({
              code: "CONFLICT",
              message: "Could not claim refund slot — concurrent settlement in progress. Please retry.",
            });
          }

          const refundAmountCents = refundAmountCentsForClaim;
          const idempotencyKey = `lesson_admin_refund_${input.lessonId}_${refundAmountCents}`;

          try {
            // Refund the student (idempotency key deduplicates retries)
            await stripeService.createRefund(
              lesson.stripePaymentIntentId,
              refundAmountCents === lesson.amountCents ? undefined : refundAmountCents,
              "requested_by_customer",
              idempotencyKey
            );
          } catch (stripeErr: any) {
            // Release the claim so admin can retry
            await db.releaseAdminRefundClaim(input.lessonId);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Stripe refund failed: ${stripeErr?.message ?? 'unknown error'}. The refund slot has been released — please retry.`,
            });
          }

          await db.finalizeAdminRefund(
            input.lessonId,
            refundAmountCents,
            input.reason || "Admin refund"
          );

          return { success: true, refundAmountCents };
        }),
    }),
    
    // Waitlist management
    waitlist: router({
      // Get all waitlist entries
      list: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin access required",
            });
          }
          return next({ ctx });
        })
        .query(async () => {
          return await db.getAllWaitlistEntries();
        }),
    }),
  }),

  // ============ BOOKING OPERATIONS ============
  booking: router({
    // Get coach availability
    getCoachAvailability: publicProcedure
      .input(z.object({
        coachId: z.number(),
        startDate: z.string(), // ISO date string
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        const { getCoachAvailability } = await import("./bookingService");
        return await getCoachAvailability(
          input.coachId,
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),

    // Create a booking
    createBooking: protectedProcedure
      .input(z.object({
        coachId: z.number(),
        scheduledAt: z.string(), // ISO datetime string
        durationMinutes: z.number(),
        timezone: z.string(),
        topic: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createBooking } = await import("./bookingService");
        const booking = await createBooking({
          studentId: ctx.user.id,
          coachId: input.coachId,
          scheduledAt: new Date(input.scheduledAt),
          durationMinutes: input.durationMinutes,
          timezone: input.timezone,
          topic: input.topic,
          notes: input.notes,
        });
        return booking;
      }),

    // Get student's bookings
    getMyBookings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLessonsByStudent(ctx.user.id);
    }),

    // Get coach's bookings
    getCoachBookings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLessonsByCoach(ctx.user.id);
    }),

    // Get booking by ID
    getBookingById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.id);
        if (!lesson) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Booking not found",
          });
        }
        // Verify user is student or coach
        if (lesson.studentId !== ctx.user.id && lesson.coachId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized to view this booking",
          });
        }
        
        // Get coach name
        const coach = await db.getUserById(lesson.coachId);
        
        return {
          ...lesson,
          coachName: coach?.name || "Coach",
        };
      }),

    // Calculate pricing for a lesson
    calculatePricing: publicProcedure
      .input(z.object({
        coachId: z.number(),
        durationMinutes: z.number(),
      }))
      .query(async ({ input }) => {
        const { calculateLessonPricing } = await import("./bookingService");
        return await calculateLessonPricing(input.coachId, input.durationMinutes);
      }),
  }),

  // ============ GAMIFICATION ============
  gamification: router({
    // Get all achievements
    allAchievements: publicProcedure.query(async () => {
      return await db.getAllAchievements();
    }),

    // Get leaderboard (placeholder)
    leaderboard: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async () => {
        // In production, implement actual leaderboard query
        return [];
      }),
  }),
});

export type AppRouter = typeof appRouter;
