/**
 * Sprint 3 regression: the coach application admin notification and the
 * approval email interpolated applicant-controlled fields without escaping.
 * These tests drive the real procedure and templates (only delivery is
 * mocked), so any future unescaped interpolation — in the template or inline
 * at the call site — fails here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db");
vi.mock("./aiVettingService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");
vi.mock("./emailService", async importOriginal => ({
  ...(await importOriginal<typeof import("./emailService")>()),
  sendEmail: vi.fn(),
}));

import * as db from "./db";
import { vetCoachApplication } from "./aiVettingService";
import { sendEmail } from "./emailService";
import { appRouter, approveCoachApplication } from "./routers";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";

const HOSTILE = `<img src=x onerror="alert(1)"></p><a href="https://evil.example">Verify</a>`;
const ESCAPED = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;/p&gt;&lt;a href=&quot;https://evil.example&quot;&gt;Verify&lt;/a&gt;";

function application(overrides: Record<string, unknown> = {}) {
  return {
    fullName: HOSTILE, email: "applicant+tag@example.com", phone: "1", country: "US", city: "Austin",
    timezone: "America/Chicago", chessTitle: HOSTILE, currentRating: 2300, ratingOrg: "FIDE",
    yearsExperience: "10", achievements: "a".repeat(100), specializations: ["Openings", "Endgames", "Tactics"],
    targetLevels: ["beginner"], teachingPhilosophy: "t".repeat(200), hourlyRate: 60, availability: { mon: true },
    lessonFormats: ["online"], languages: ["en"], bio: "b".repeat(500), whyBoogme: "w".repeat(200),
    sampleLesson: "s".repeat(300), backgroundCheckConsent: true, termsAgreed: true,
    ...overrides,
  };
}

const publicCaller = () => appRouter.createCaller({
  user: null, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any,
} as TrpcContext);

function adminNotification() {
  const call = vi.mocked(sendEmail).mock.calls.find(([message]) => message.to === ENV.adminEmail);
  expect(call).toBeDefined();
  return call![0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ success: true, id: "unit" } as any);
  vi.mocked(db.getCoachApplicationByEmail).mockResolvedValue(undefined as any);
  vi.mocked(db.createCoachApplication).mockResolvedValue({ id: 77 } as any);
  vi.mocked(vetCoachApplication).mockResolvedValue({
    approved: false, recommendation: "REVIEW", confidenceScore: 61, humanReviewReason: "unit",
  } as any);
});

describe("coach application admin notification", () => {
  it("renders every applicant-controlled field as text", async () => {
    await publicCaller().coachApplication.submit(application() as any);
    const { html, subject } = adminNotification();
    expect(html).toContain(`<strong>Name:</strong> ${ESCAPED}`);
    expect(html).toContain(`<strong>Chess Title:</strong> ${ESCAPED}`);
    expect(html).toContain("<strong>Email:</strong> applicant+tag@example.com");
    expect(html).toContain("<strong>FIDE Rating:</strong> 2300");
    expect(html).toContain("<strong>AI Vetting:</strong> under_review (score: 61)");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain(`href="https://evil.example"`);
    expect(html).not.toMatch(/&amp;(lt|gt|quot|amp);/);
    // Subjects are plain text; sendEmail itself strips line breaks (emailSafety.test.ts).
    expect(subject).toBe(`New Coach Application: ${HOSTILE}`);
  });

  it("keeps the documented fallbacks for a missing title or rating", async () => {
    await publicCaller().coachApplication.submit(application({ fullName: "Ann Lee", chessTitle: "" }) as any);
    const { html } = adminNotification();
    expect(html).toContain("<strong>Chess Title:</strong> None");
    expect(html).toContain("<strong>Name:</strong> Ann Lee");
  });

  it("trims the applicant name and rejects a blank one before any side effect", async () => {
    await publicCaller().coachApplication.submit(application({ fullName: "  Ann Lee  " }) as any);
    expect(db.createCoachApplication).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Ann Lee" }));
    vi.clearAllMocks();
    await expect(publicCaller().coachApplication.submit(application({ fullName: "     " }) as any)).rejects.toThrow();
    expect(db.createCoachApplication).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("coach approval email", () => {
  it("escapes the stored applicant name", async () => {
    vi.mocked(db.getCoachApplicationById).mockResolvedValue({
      id: 1, email: "coach@example.com", fullName: HOSTILE, coachProfileId: null,
    } as any);
    vi.mocked(db.provisionCoachFromApplication).mockResolvedValue({ userId: 10, coachProfileId: 20, isNewUser: true });
    await approveCoachApplication(1);
    const { html } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(html).toContain(`Welcome to BooGMe, ${ESCAPED}!`);
    expect(html).not.toContain("<img src=x");
    expect(html).toMatch(/href="[^"]*\/reset-password\?token=[0-9a-f]{64}"/);
  });
});
