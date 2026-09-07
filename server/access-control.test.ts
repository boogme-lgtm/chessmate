import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import * as db from "./db";
import { loginUser } from "./auth";
import { storagePut } from "./storage";

vi.mock("./db");
vi.mock("./auth");
vi.mock("./stripe");
vi.mock("./stripeConnect");
vi.mock("./storage");
vi.mock("./emailService");
vi.mock("./email");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

const student: User = {
  id: 1, openId: null, name: "Student", email: "student@example.test",
  password: "test-only-hash", emailVerified: true,
  emailVerificationToken: "test-verification-token", emailVerificationExpires: new Date(),
  passwordResetToken: "test-reset-token", passwordResetExpires: new Date(),
  loginMethod: "email", role: "user", userType: "student",
  stripeCustomerId: "cus_test", stripeConnectAccountId: null, stripeConnectOnboarded: false,
  avatarUrl: null, bio: null, country: "US", timezone: "America/Chicago",
  notificationPreferences: null, deletedAt: null,
  createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};
const coach: User = { ...student, id: 42, name: "Coach", userType: "coach" };
const outsider: User = { ...student, id: 99 };

function context(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { setHeader: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.markLessonMessagesRead).mockResolvedValue(undefined);
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.createMessage).mockImplementation(async (message) => ({ id: 20, ...message }) as any);
  vi.mocked(db.getMessagesForLesson).mockResolvedValue([]);
});

function expectSafeAccount(value: unknown) {
  expect(value).toMatchObject({ id: 1, email: student.email, emailVerified: true, userType: "student" });
  for (const key of [
    "password", "emailVerificationToken", "emailVerificationExpires",
    "passwordResetToken", "passwordResetExpires", "openId",
    "stripeCustomerId", "stripeConnectAccountId", "deletedAt", "futureCredential",
  ]) {
    expect(value).not.toHaveProperty(key);
  }
}

describe("account response boundaries", () => {
  it("returns null to an unauthenticated visitor", async () => {
    await expect(appRouter.createCaller(context(null)).auth.me()).resolves.toBeNull();
  });

  it("does not serialize credential fields or newly added database fields", async () => {
    const row = { ...student, futureCredential: "must-stay-server-only" };
    expectSafeAccount(await appRouter.createCaller(context(row)).auth.me());
    expect(row.password).toBe("test-only-hash");
  });

  it("uses the same safe response for the signed-in profile", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ ...student, futureCredential: "private" } as User);
    vi.mocked(db.getCoachProfileByUserId).mockResolvedValue(undefined);
    const result = await appRouter.createCaller(context(student)).coach.getMyProfile();
    expectSafeAccount(result.user);
    expect(db.getUserById).toHaveBeenCalledWith(student.id);
  });

  it("keeps login working while limiting the returned account fields", async () => {
    vi.mocked(loginUser).mockResolvedValue({ success: true, user: student });
    const ctx = context(null);
    const result = await appRouter.createCaller(ctx).auth.login({ email: student.email, password: "test-password" });
    expectSafeAccount(result.user);
    expect(ctx.res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
  });
});

describe("retired API contracts", () => {
  it.each([
    ["booking", "getCoachAvailability", { coachId: 42, startDate: "2026-09-07", endDate: "2026-09-08" }],
    ["booking", "createBooking", { coachId: 42, scheduledAt: "2026-09-08T10:00:00Z", durationMinutes: 60, timezone: "UTC" }],
    ["contentRequest", "updateStatus", { requestId: 10, status: "delivered", contentItemId: 900 }],
  ] as const)("rejects calls to %s.%s", async (group, method, input) => {
    const caller = appRouter.createCaller(context(coach)) as unknown as Record<string, Record<string, (input: unknown) => Promise<unknown>>>;
    await expect(caller[group][method](input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updateContentRequestStatus).not.toHaveBeenCalled();
    expect(db.createLesson).not.toHaveBeenCalled();
  });
});

describe.each(["payment_collected", "subscription_dm"])("%s conversation access", (status) => {
  beforeEach(() => {
    vi.mocked(db.getLessonById).mockResolvedValue({ id: 10, studentId: 1, coachId: 42, status } as any);
    // Even an active subscriber cannot enter another student's thread.
    vi.mocked(db.isUserSubscribedToCoach).mockResolvedValue(true);
  });

  it("blocks an unrelated subscriber from sending, reading, and marking messages read", async () => {
    const caller = appRouter.createCaller(context(outsider));
    await expect(caller.messages.send({ lessonId: 10, content: "Hello" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.messages.getForLesson({ lessonId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.messages.markRead({ lessonId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createMessage).not.toHaveBeenCalled();
    expect(db.createNotification).not.toHaveBeenCalled();
    expect(db.getMessagesForLesson).not.toHaveBeenCalled();
    expect(db.markLessonMessagesRead).not.toHaveBeenCalled();
  });

  it.each([student, coach])("preserves the conversation for participant $id", async (participant) => {
    const caller = appRouter.createCaller(context(participant));
    await expect(caller.messages.send({ lessonId: 10, content: "Hello" })).resolves.toMatchObject({ senderId: participant.id });
    await expect(caller.messages.getForLesson({ lessonId: 10 })).resolves.toEqual([]);
    await expect(caller.messages.markRead({ lessonId: 10 })).resolves.toEqual({ success: true });
    expect(db.markLessonMessagesRead).toHaveBeenCalledWith(10, participant.id);
  });
});

describe("request delivery ownership", () => {
  beforeEach(() => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10, studentId: 1, coachId: 42, status: "in_progress", contentItemId: 20,
    } as any);
  });

  it.each([
    ["missing file", null],
    ["another coach's file", { id: 20, coachId: 99, accessType: "request_fulfillment", storageKey: "private/other.pgn" }],
    ["a public file", { id: 20, coachId: 42, accessType: "public", storageKey: "public/file.pgn" }],
    ["a missing storage object reference", { id: 20, coachId: 42, accessType: "request_fulfillment", storageKey: "" }],
  ])("rejects %s before delivery or payout scheduling", async (_label, item) => {
    vi.mocked(db.getContentItemById).mockResolvedValue(item as any);
    await expect(appRouter.createCaller(context(coach)).contentRequest.markDelivered({ requestId: 10 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.deliverContentRequest).not.toHaveBeenCalled();
    expect(db.createNotification).not.toHaveBeenCalled();
  });

  it("rejects a request with no linked item", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10, studentId: 1, coachId: 42, status: "in_progress", contentItemId: null,
    } as any);
    await expect(appRouter.createCaller(context(coach)).contentRequest.markDelivered({ requestId: 10 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.getContentItemById).not.toHaveBeenCalled();
    expect(db.deliverContentRequest).not.toHaveBeenCalled();
  });

  it("allows an overdue request with an owned fulfillment file", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10, studentId: 1, coachId: 42, status: "overdue", contentItemId: 20,
    } as any);
    vi.mocked(db.getContentItemById).mockResolvedValue({
      id: 20, coachId: 42, accessType: "request_fulfillment", storageKey: "coach-content/42/file.pgn",
    } as any);
    await expect(appRouter.createCaller(context(coach)).contentRequest.markDelivered({ requestId: 10 }))
      .resolves.toEqual({ success: true });
    expect(db.deliverContentRequest).toHaveBeenCalledWith(10);
  });

  it("blocks uploads linked to another coach's request before writing a file", async () => {
    vi.mocked(db.getContentRequestById).mockResolvedValue({
      id: 10, studentId: 1, coachId: 99, status: "in_progress",
    } as any);
    await expect(appRouter.createCaller(context(coach)).content.create({
      title: "Lesson notes", kind: "pgn", accessType: "request_fulfillment",
      contentRequestId: 10, fileBase64: "dGVzdA==", fileName: "lesson.pgn",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
    expect(db.updateContentRequestStatus).not.toHaveBeenCalled();
  });
});
