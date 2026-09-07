import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";

/** Explicit account response. New database fields stay server-only by default. */
export function toAccountUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    loginMethod: user.loginMethod,
    role: user.role,
    userType: user.userType,
    stripeConnectOnboarded: user.stripeConnectOnboarded,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    country: user.country,
    timezone: user.timezone,
    notificationPreferences: user.notificationPreferences,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignedIn: user.lastSignedIn,
  };
}

/** A subscription never grants access to another student's conversation. */
export function assertLessonParticipant(
  lesson: { studentId: number; coachId: number },
  userId: number,
) {
  if (lesson.studentId !== userId && lesson.coachId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your lesson" });
  }
}
