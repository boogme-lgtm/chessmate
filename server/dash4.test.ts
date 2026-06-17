/**
 * S-DASH-4 — notification recipientRole routing + message-send wiring
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getNotificationUrl } from "@/lib/notificationRouting";

vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./_core/notification");

import * as db from "./db";
import { sendEmail } from "./emailService";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };
const lesson = { id: 7, studentId: 1, coachId: 42, status: "confirmed" };

function ctx(user: any): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getLessonById).mockResolvedValue(lesson as any);
  vi.mocked(db.createMessage).mockResolvedValue(123 as any);
  vi.mocked(db.createNotification).mockResolvedValue(1);
  vi.mocked(db.getUserById).mockImplementation(async (id) => {
    if (id === 1) return student as any;
    if (id === 42) return coach as any;
    return null;
  });
  // getDb used by the email-cooldown query — return a fake that reports no recent unread
  vi.mocked(db.getDb).mockResolvedValue({
    execute: vi.fn().mockResolvedValue([[{ cnt: 1 }]]),
  } as any);
});

describe("S-DASH-4 — messages.send recipientRole", () => {
  it("2: student → coach sets recipientRole: 'coach'", async () => {
    const caller = appRouter.createCaller(ctx(student));
    await caller.messages.send({ lessonId: 7, content: "hi coach" });
    const call = vi.mocked(db.createNotification).mock.calls.find(
      (c) => c[0].type === "new_message",
    );
    expect(call).toBeTruthy();
    expect(call![0]).toMatchObject({ userId: 42, recipientRole: "coach" });
  });

  it("3: coach → student sets recipientRole: 'student'", async () => {
    const caller = appRouter.createCaller(ctx(coach));
    await caller.messages.send({ lessonId: 7, content: "hi student" });
    const call = vi.mocked(db.createNotification).mock.calls.find(
      (c) => c[0].type === "new_message",
    );
    expect(call).toBeTruthy();
    expect(call![0]).toMatchObject({ userId: 1, recipientRole: "student" });
  });

  it("1: helper receives recipientRole + email respects 30-min cooldown", async () => {
    // cnt > 1 means an unread message from this sender already exists in the
    // last 30 min → email is suppressed, but the in-app notification still fires.
    vi.mocked(db.getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ cnt: 2 }]]),
    } as any);
    vi.mocked(sendEmail).mockResolvedValue({ success: true } as any);

    const caller = appRouter.createCaller(ctx(student));
    await caller.messages.send({ lessonId: 7, content: "second message fast" });

    // Notification always created, carrying the recipientRole.
    expect(db.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientRole: "coach" }),
    );
    // Email suppressed by the cooldown.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("1b: email IS sent when no recent unread (cnt <= 1)", async () => {
    vi.mocked(db.getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue([[{ cnt: 1 }]]),
    } as any);
    vi.mocked(sendEmail).mockResolvedValue({ success: true } as any);

    const caller = appRouter.createCaller(ctx(student));
    await caller.messages.send({ lessonId: 7, content: "first message" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("S-DASH-4 — notifications.list returns recipientRole", () => {
  it("4: list passes through the recipientRole field", async () => {
    vi.mocked(db.getNotificationsForUser).mockResolvedValue([
      { id: 1, type: "new_message", recipientRole: "student", title: "New message", body: "x", readAt: null, createdAt: new Date() },
    ] as any);
    const caller = appRouter.createCaller(ctx(student));
    const res = await caller.notifications.list({ limit: 20 });
    expect(res[0]).toHaveProperty("recipientRole", "student");
  });
});

describe("S-DASH-4 — getNotificationUrl routing", () => {
  it("5: new_message + recipientRole 'student' on a 'both' account → /dashboard?role=student#messages", () => {
    expect(getNotificationUrl("new_message", "both", "student")).toBe("/dashboard?role=student#messages");
  });

  it("new_message + recipientRole 'coach' on a 'both' account → /dashboard?role=coach#inbox", () => {
    expect(getNotificationUrl("new_message", "both", "coach")).toBe("/dashboard?role=coach#inbox");
  });

  it("new_message falls back to userType when no recipientRole", () => {
    expect(getNotificationUrl("new_message", "student")).toBe("/dashboard?role=student#messages");
    expect(getNotificationUrl("new_message", "both")).toBe("/dashboard?role=coach#inbox");
  });

  it("coach-only and student-only types ignore role entirely", () => {
    expect(getNotificationUrl("new_content_request", "student")).toBe("/dashboard?role=coach#content-requests");
    expect(getNotificationUrl("new_subscriber", "student")).toBe("/dashboard?role=coach#students");
    expect(getNotificationUrl("content_delivered", "coach")).toBe("/dashboard?role=student#content-library");
  });
});

describe("S-DASH-4b — recipientRole: 'coach' on coach-targeted notifications", () => {
  it("new_content_request notification carries recipientRole: 'coach'", async () => {
    vi.mocked(db.createContentRequest).mockResolvedValue({ insertId: 99 } as any);
    const caller = appRouter.createCaller(ctx(student));
    await caller.contentRequest.create({
      coachId: 42,
      title: "Endgame analysis video",
    });
    const call = vi.mocked(db.createNotification).mock.calls.find(
      (c) => c[0].type === "new_content_request",
    );
    expect(call).toBeTruthy();
    expect(call![0]).toMatchObject({ userId: 42, recipientRole: "coach" });
  });
});
