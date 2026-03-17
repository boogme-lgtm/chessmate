import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  registerUser,
  verifyEmail,
  loginUser,
  requestPasswordReset,
  resetPassword,
} from "./auth";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import { stringifySetCookie } from 'cookie/dist/index.js';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import * as db from './db';

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);

/**
 * Create a JWT session token for a user
 * Must match SDK's expected payload: {openId, appId, name}
 */
async function createSessionToken(user: { id: number; openId: string | null; name: string | null }): Promise<string> {
  // For email/password users without OAuth openId, use their database ID prefixed with 'local_'
  const openId = user.openId || `local_${user.id}`;
  
  const token = await new SignJWT({ 
    openId,
    appId: ENV.appId,
    name: user.name || ""
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(JWT_SECRET);

  return token;
}

/**
 * Set session cookie in response
 */
function setSessionCookie(res: any, token: string) {
  const cookieStr = stringifySetCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true, // Always secure since preview/production are HTTPS
    sameSite: "lax", // More permissive, works better for same-site requests
    maxAge: ONE_YEAR_MS / 1000,
    path: "/",
  });

  res.setHeader("Set-Cookie", cookieStr);
}

/**
 * Clear session cookie
 */
function clearSessionCookie(res: any) {
  const cookieStr = stringifySetCookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true, // Always secure since preview/production are HTTPS
    sameSite: "lax", // Must match setSessionCookie
    maxAge: 0,
    path: "/",
  });

  res.setHeader("Set-Cookie", cookieStr);
}

export const authRouter = router({
  /**
   * Get current user
   */
  me: publicProcedure.query(opts => opts.ctx.user),

  /**
   * Register a new user
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least one uppercase letter, one lowercase letter, and one number"
          ),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ input }) => {
      const result = await registerUser({
        email: input.email,
        password: input.password,
        name: input.name,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Registration failed",
        });
      }

      return {
        success: true,
        message:
          "Registration successful! Please check your email to verify your account.",
      };
    }),

  /**
   * Verify email with token
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await verifyEmail(input.token);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Email verification failed",
        });
      }

      // Create session for verified user
      if (result.userId) {
        const user = await db.getUserById(result.userId);
        if (user) {
          const sessionToken = await createSessionToken(user);
          setSessionCookie(ctx.res, sessionToken);
        }
      }

      return {
        success: true,
        message: "Email verified successfully! You can now sign in.",
      };
    }),

  /**
   * Login user
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await loginUser({
        email: input.email,
        password: input.password,
      });

      if (!result.success || !result.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: result.error || "Login failed",
        });
      }

      // Create session
      const sessionToken = await createSessionToken(result.user);
      setSessionCookie(ctx.res, sessionToken);

      return {
        success: true,
        user: result.user,
      };
    }),

  /**
   * Logout user
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    clearSessionCookie(ctx.res);

    return {
      success: true,
      message: "Logged out successfully",
    };
  }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
      })
    )
    .mutation(async ({ input }) => {
      await requestPasswordReset(input.email);

      return {
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least one uppercase letter, one lowercase letter, and one number"
          ),
      })
    )
    .mutation(async ({ input }) => {
      const result = await resetPassword({
        token: input.token,
        newPassword: input.newPassword,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Password reset failed",
        });
      }

      return {
        success: true,
        message: "Password reset successfully! You can now sign in.",
      };
    }),
});
