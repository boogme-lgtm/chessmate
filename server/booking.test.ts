import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Auto-mock the entire db module so no MySQL connection is needed.
// Individual tests override specific returns via vi.mocked().
vi.mock("./db");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";

const mockUser = {
  id: 1,
  role: "user" as const,
  openId: "test-openid",
  name: "Test User",
  email: "test@example.com",
};

function createContext(user: any = mockUser): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

describe("Booking Flow API Endpoints", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("Coach Discovery Endpoints", () => {
    it("should have listActive endpoint", async () => {
      vi.mocked(db.getActiveCoaches).mockResolvedValue([]);
      const caller = appRouter.createCaller(createContext());
      const result = await caller.coach.listActive();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should have getById endpoint", async () => {
      vi.mocked(db.getUserById).mockResolvedValue(undefined);
      const caller = appRouter.createCaller(createContext());
      const result = await caller.coach.getById({ id: 99999 });
      expect(result).toBeNull();
    });

    it("should have getAvailability endpoint", async () => {
      vi.mocked(db.getCoachProfileByUserId).mockResolvedValue(undefined);
      const caller = appRouter.createCaller(createContext());
      const now = new Date();
      const startDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        caller.coach.getAvailability({
          coachId: 1,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
      ).rejects.toThrow("Coach not found");
    });
  });

  describe("Booking Endpoints", () => {
    it("should have lesson.myLessons endpoint", async () => {
      vi.mocked(db.getLessonsByStudent).mockResolvedValue([]);
      const caller = appRouter.createCaller(createContext());
      const result = await caller.lesson.myLessons({ limit: 10 });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Payment Endpoints", () => {
    it("should have payment.createCheckout endpoint", async () => {
      vi.mocked(db.getLessonById).mockResolvedValue(undefined);
      const caller = appRouter.createCaller(createContext());
      await expect(
        caller.payment.createCheckout({ lessonId: 99999 })
      ).rejects.toThrow("Lesson not found");
    });
  });

  describe("Input Validation", () => {
    it("should validate lesson duration", async () => {
      const caller = appRouter.createCaller(createContext());
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 3);

      await expect(
        caller.lesson.book({
          coachId: 2,
          scheduledAt,
          durationMinutes: 0,
          topic: "Test",
        })
      ).rejects.toThrow();
    });
  });
});
