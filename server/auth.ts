import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { sendEmail } from "./email";
import {
  getAccountVerificationEmail,
  getAccountVerifiedEmail,
  getPasswordResetEmail,
  getVerificationResendEmail,
} from "./emailService";
import { ENV } from "./_core/env";
import { normalizeDisplayName } from "@shared/displayName";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain password with a hashed password
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate token expiry timestamp
 */
export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + TOKEN_EXPIRY_HOURS);
  return expiry;
}

/**
 * Register a new user with email and password
 */
export async function registerUser(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ success: boolean; userId?: number; error?: string }> {
  // A blank name would leave the account nameless; the router validates this
  // too, but the account write is where the rule must hold.
  const name = normalizeDisplayName(params.name);
  if (!name) {
    return { success: false, error: "Name is required" };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Check if email already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "Email already registered" };
  }

  // Hash password
  const hashedPassword = await hashPassword(params.password);

  // Generate email verification token
  const verificationToken = generateToken();
  const verificationExpires = getTokenExpiry();

  // Create user
  const [newUser] = await db.insert(users).values({
    email: params.email,
    password: hashedPassword,
    name,
    loginMethod: "email",
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
    userType: "student",
    role: "user",
  });

  // Send verification email
  const verificationUrl = `${ENV.frontendUrl}/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: params.email,
    subject: "Verify your BooGMe account",
    html: getAccountVerificationEmail({ name, verificationUrl }),
  });

  return { success: true, userId: newUser.insertId };
}

/**
 * Resend the email-verification link for an unverified account. This is the
 * recovery path for the permanent-lockout hole: an unverified user can't log in
 * (blocked) and can't re-register (email exists), so without this they were stuck.
 *
 * Enumeration-safe: always resolves { success: true } regardless of whether the
 * email exists or is already verified — never reveal account state to the caller.
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: true };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Silently no-op for unknown emails, already-verified accounts, and OAuth
  // accounts (no password / email verification flow).
  if (!user || user.emailVerified || user.loginMethod !== "email") {
    return { success: true };
  }

  const verificationToken = generateToken();
  const verificationExpires = getTokenExpiry();
  await db
    .update(users)
    .set({ emailVerificationToken: verificationToken, emailVerificationExpires: verificationExpires })
    .where(eq(users.id, user.id));

  const verificationUrl = `${ENV.frontendUrl}/verify-email?token=${verificationToken}`;
  // Fire-and-forget so the response latency doesn't differ between a real
  // unverified account (which sends mail) and the no-op cases — closes the
  // timing side-channel that would otherwise leak account existence.
  void sendEmail({
    to: email,
    subject: "Verify your BooGMe account",
    html: getVerificationResendEmail({ name: user.name, verificationUrl }),
  }).catch((e) => console.error("[resendVerificationEmail] send failed:", e));

  return { success: true };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  userId?: number;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Find user with token
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid verification token" };
  }

  // Defense-in-depth: a soft-deleted account must not complete verification and
  // receive a session. Generic error — don't reveal the account was deleted.
  if (user.deletedAt) {
    return { success: false, error: "Invalid verification token" };
  }

  // Check if token expired
  if (
    !user.emailVerificationExpires ||
    user.emailVerificationExpires < new Date()
  ) {
    return { success: false, error: "Verification token expired" };
  }

  // Update user
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    })
    .where(eq(users.id, user.id));

  // Send welcome email
  await sendEmail({
    to: user.email,
    subject: "Welcome to BooGMe - Your account is verified!",
    html: getAccountVerifiedEmail({ name: user.name, browseCoachesUrl: `${ENV.frontendUrl}/coaches` }),
  });

  return { success: true, userId: user.id };
}

/**
 * Login user with email and password
 */
export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  // Soft-deleted accounts cannot log in (generic error — don't reveal deletion).
  if (user.deletedAt) {
    return { success: false, error: "Invalid email or password" };
  }

  // Check if user has a password (not OAuth user)
  if (!user.password) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Compare password
  const isValid = await comparePassword(params.password, user.password);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Check if email is verified
  if (!user.emailVerified) {
    return {
      success: false,
      error: "Please verify your email before logging in",
    };
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  // Return user without sensitive fields
  const { password, emailVerificationToken, emailVerificationExpires,
    passwordResetToken, passwordResetExpires, ...safeUser } = user;
  return { success: true, user: safeUser };
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: true }; // Don't reveal DB issues
  }

  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }

  // Generate reset token
  const resetToken = generateToken();
  const resetExpires = getTokenExpiry();

  // Update user
  await db
    .update(users)
    .set({
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    })
    .where(eq(users.id, user.id));

  // Send reset email
  const resetUrl = `${ENV.frontendUrl}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: email,
    subject: "Reset your BooGMe password",
    html: getPasswordResetEmail({ name: user.name, resetUrl }),
  });

  return { success: true };
}

/**
 * Reset password with token
 */
export async function resetPassword(params: {
  token: string;
  newPassword: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Find user with token
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, params.token))
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid reset token" };
  }

  // Check if token expired
  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return { success: false, error: "Reset token expired" };
  }

  // Hash new password
  const hashedPassword = await hashPassword(params.newPassword);

  // Update user
  await db
    .update(users)
    .set({
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    })
    .where(eq(users.id, user.id));

  return { success: true };
}
