import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as stripeService from "./stripe";
import { ENV } from "./_core/env";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
        return { success: true, message: "Successfully joined the waitlist!" };
      }),
    
    count: publicProcedure.query(async () => {
      const count = await db.getWaitlistCount();
      return { count };
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
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let accountId = user.stripeConnectAccountId;

      // Create Connect account if doesn't exist
      if (!accountId) {
        const account = await stripeService.createConnectAccount(
          user.email || "",
          user.id,
          user.country || "US"
        );
        accountId = account.id;
        await db.updateUserStripeConnectAccount(user.id, accountId, false);
      }

      // Generate onboarding link
      const baseUrl = ENV.isProduction 
        ? "https://boogme.com" 
        : "http://localhost:3000";
      
      const onboardingLink = await stripeService.createConnectOnboardingLink(
        accountId,
        `${baseUrl}/coach/onboarding/refresh`,
        `${baseUrl}/coach/onboarding/complete`
      );

      return { url: onboardingLink.url };
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
    getDashboardLink: protectedProcedure.query(async ({ ctx }) => {
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
    getEarnings: protectedProcedure.query(async ({ ctx }) => {
      const earnings = await db.getCoachEarningsSummary(ctx.user.id);
      const user = await db.getUserById(ctx.user.id);
      
      return {
        ...earnings,
        stripeOnboarded: user?.stripeConnectOnboarded || false,
        needsOnboarding: earnings.hasReachedThreshold && !user?.stripeConnectOnboarded,
      };
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
        scheduledAt: z.date(),
        durationMinutes: z.number().min(30).max(180).default(60),
        topic: z.string().optional(),
        timezone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get coach profile for pricing
        const coachProfile = await db.getCoachProfileByUserId(input.coachId);
        if (!coachProfile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coach not found" });
        }

        // Calculate pricing
        const hourlyRate = coachProfile.hourlyRateCents || 5000;
        const amountCents = Math.round((hourlyRate * input.durationMinutes) / 60);
        const commissionRate = coachProfile.commissionRate || 15;
        const commissionCents = Math.round(amountCents * (commissionRate / 100));
        const coachPayoutCents = amountCents - commissionCents;

        // Create lesson
        await db.createLesson({
          studentId: ctx.user.id,
          coachId: input.coachId,
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          topic: input.topic,
          timezone: input.timezone,
          amountCents,
          commissionCents,
          coachPayoutCents,
          status: "pending",
        });

        return { success: true };
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
    coachLessons: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getLessonsByCoach(ctx.user.id, input?.limit || 50);
      }),

    // Confirm lesson (coach)
    confirmAsCoach: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.coachId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        await db.updateLessonStatus(input.lessonId, "confirmed", {
          coachConfirmedAt: new Date(),
        });

        return { success: true };
      }),

    // Confirm completion (student) - releases payment
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

        // Capture payment (release from escrow)
        if (lesson.stripePaymentIntentId) {
          await stripeService.capturePaymentIntent(lesson.stripePaymentIntentId);
        }

        // Update lesson status
        const refundWindowEnds = new Date();
        refundWindowEnds.setHours(refundWindowEnds.getHours() + 48);

        await db.updateLessonStatus(input.lessonId, "released", {
          studentConfirmedAt: new Date(),
          completedAt: new Date(),
          refundWindowEndsAt: refundWindowEnds,
          payoutAt: new Date(),
        });

        // Create review if provided
        if (input.rating) {
          await db.createReview({
            lessonId: input.lessonId,
            studentId: ctx.user.id,
            coachId: lesson.coachId,
            rating: input.rating,
            comment: input.comment,
          });
        }

        // Award XP to student
        await db.updateStudentXp(ctx.user.id, 50);

        return { success: true };
      }),

    // Request refund (within 48-hour window)
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

        // Check refund window
        if (lesson.refundWindowEndsAt && new Date() > lesson.refundWindowEndsAt) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Refund window has expired",
          });
        }

        // Process refund
        if (lesson.stripePaymentIntentId) {
          await stripeService.createRefund(lesson.stripePaymentIntentId);
        }

        await db.updateLessonStatus(input.lessonId, "refunded");

        return { success: true };
      }),
  }),

  // ============ PAYMENT OPERATIONS ============
  payment: router({
    // Create checkout session for a lesson
    createCheckout: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        if (lesson.studentId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
        }

        // Get coach info
        const coach = await db.getUserById(lesson.coachId);
        if (!coach?.stripeConnectAccountId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Coach has not completed payment setup",
          });
        }

        const student = await db.getUserById(ctx.user.id);
        const baseUrl = ENV.isProduction
          ? "https://boogme.com"
          : "http://localhost:3000";

        const session = await stripeService.createLessonCheckoutSession({
          amountCents: lesson.amountCents,
          currency: lesson.currency || "USD",
          lessonId: lesson.id,
          studentId: ctx.user.id,
          studentEmail: student?.email || "",
          coachName: coach.name || "Coach",
          coachConnectAccountId: coach.stripeConnectAccountId,
          successUrl: `${baseUrl}/lessons/${lesson.id}?payment=success`,
          cancelUrl: `${baseUrl}/lessons/${lesson.id}?payment=cancelled`,
        });

        return { url: session.url };
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
