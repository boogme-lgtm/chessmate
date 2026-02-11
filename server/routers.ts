import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./authRouter";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { vetCoachApplication } from "./aiVettingService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as stripeService from "./stripe";
import { ENV } from "./_core/env";
import { Chess } from "chess.js";
import { sendEmail, getWaitlistConfirmationEmail } from "./emailService";
import { sendNurtureEmails, sendNurtureEmailsManual } from "./nurtureEmailScheduler";
import { resendWelcomeEmails } from "./resendWelcomeEmails";

export const appRouter = router({
  system: systemRouter,
  
  auth: authRouter,

  // ============ LICHESS PUZZLES ============
  puzzle: router({
    getNext: publicProcedure
      .input(z.object({
        difficulty: z.enum(["easiest", "easier", "normal", "harder", "hardest"]).optional(),
        theme: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const params = new URLSearchParams();
        if (input?.difficulty) params.append("difficulty", input.difficulty);
        if (input?.theme) params.append("angle", input.theme);
        
        const url = `https://lichess.org/api/puzzle/next${params.toString() ? `?${params.toString()}` : ''}`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to fetch puzzle from Lichess",
            });
          }
          const puzzleData = await response.json();
          
          // Parse PGN to get FEN at the puzzle start position
          const chess = new Chess();
          const moves = puzzleData.game.pgn.split(' ');
          const initialPly = puzzleData.puzzle.initialPly;
          
          // Play moves up to the puzzle start
          for (let i = 0; i < initialPly && i < moves.length; i++) {
            try {
              chess.move(moves[i]);
            } catch (e) {
              // Skip invalid moves
              console.warn(`[Lichess] Skipping invalid move: ${moves[i]}`);
            }
          }
          
          // Add FEN to the response
          return {
            ...puzzleData,
            fen: chess.fen(),
          };
        } catch (error) {
          console.error("[Lichess API] Error fetching puzzle:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch puzzle",
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
        return { ...coach, profile };
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

        // Parse availability schedule (JSON)
        const schedule = profile.availabilitySchedule 
          ? JSON.parse(profile.availabilitySchedule as string)
          : {};

        // Get existing bookings to exclude
        const bookings = await db.getLessonsByCoach(input.coachId, 100);
        const bookedSlots = bookings
          .filter(l => l.status !== "cancelled" && l.status !== "refunded")
          .map(l => l.scheduledAt);

        return {
          schedule,
          bookedSlots,
          minAdvanceHours: profile.minAdvanceHours || 24,
          maxAdvanceDays: profile.maxAdvanceDays || 30,
          bufferMinutes: profile.bufferMinutes || 15,
          lessonDurations: profile.lessonDurations 
            ? JSON.parse(profile.lessonDurations as string)
            : [60],
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
          status: "pending_confirmation",
        });

        return { success: true, lessonId: lesson.id };
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
            reviewerId: ctx.user.id,
            revieweeId: lesson.coachId,
            reviewerType: 'student',
            rating: input.rating,
            comment: input.comment || '',
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
        // Use VITE_FRONTEND_URL which works in both dev and production
        const baseUrl = process.env.VITE_FRONTEND_URL || "http://localhost:3000";

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
