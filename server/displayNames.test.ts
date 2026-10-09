/**
 * Sprint 3: a blank or whitespace-only name must never overwrite (or create)
 * an account name, on any path that writes users.name. Router boundaries;
 * the database layer is covered in userNameWrites.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db");
vi.mock("./auth");
vi.mock("./emailService");
vi.mock("./nurtureEmailScheduler");
vi.mock("./resendWelcomeEmails");

import * as db from "./db";
import * as auth from "./auth";
import * as emailService from "./emailService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const student = { id: 1, role: "user", userType: "student", openId: "s", name: "Stu", email: "s@e.com" };
const coach = { id: 42, role: "user", userType: "coach", openId: "c", name: "Coach", email: "c@e.com" };

function caller(user: any) {
  return appRouter.createCaller({
    user, req: { protocol: "https", headers: {} } as any, res: { setHeader: vi.fn() } as any,
  } as TrpcContext);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.updateUserProfile).mockResolvedValue(undefined);
  vi.mocked(db.updateCoachProfile).mockResolvedValue(undefined);
});

describe("user.updateProfile", () => {
  it.each(["", " ", "   ", "\t\n "])("treats the blank name %j as no change", async name => {
    await caller(student).user.updateProfile({ name, bio: "hi" });
    expect(db.updateUserProfile).toHaveBeenCalledWith(1, expect.objectContaining({ name: undefined, bio: "hi" }));
  });
  it("trims a real name before storing it", async () => {
    await caller(student).user.updateProfile({ name: "  Ann Lee  " });
    expect(db.updateUserProfile).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Ann Lee" }));
  });
  it("measures the length limit after trimming", async () => {
    await caller(student).user.updateProfile({ name: `  ${"a".repeat(100)}  ` });
    expect(db.updateUserProfile).toHaveBeenCalledWith(1, expect.objectContaining({ name: "a".repeat(100) }));
    await expect(caller(student).user.updateProfile({ name: "a".repeat(101) })).rejects.toThrow();
  });
});

describe("coach.updateProfile", () => {
  // Sprint 3 (intended change): "" used to be rejected by min(2) even though
  // the handler's guard meant blank = no change. It is now no change.
  it.each(["", "  ", "\n"])("treats the blank name %j as no change", async name => {
    await caller(coach).coach.updateProfile({ name, bio: "hi" });
    expect(db.updateUserProfile).toHaveBeenCalledWith(42, expect.objectContaining({ name: undefined, bio: "hi" }));
  });
  it("trims a real name and still requires two characters", async () => {
    await caller(coach).coach.updateProfile({ name: "  Bo  " });
    expect(db.updateUserProfile).toHaveBeenCalledWith(42, expect.objectContaining({ name: "Bo" }));
    await expect(caller(coach).coach.updateProfile({ name: "  B  " })).rejects.toThrow("at least 2 characters");
  });
});

describe("auth.register", () => {
  it.each(["", "   ", "\t"])("rejects the blank name %j before creating an account", async name => {
    await expect(caller(null).auth.register({ email: "new@example.com", password: "Passw0rdX", name }))
      .rejects.toThrow("Name is required");
    expect(auth.registerUser).not.toHaveBeenCalled();
  });
  it("stores the trimmed name", async () => {
    vi.mocked(auth.registerUser).mockResolvedValue({ success: true, userId: 9 });
    await caller(null).auth.register({ email: "new@example.com", password: "Passw0rdX", name: "  Ann  " });
    expect(auth.registerUser).toHaveBeenCalledWith({ email: "new@example.com", password: "Passw0rdX", name: "Ann" });
  });
});

describe("waitlist.join", () => {
  beforeEach(() => {
    vi.mocked(db.addToWaitlist).mockResolvedValue({ success: true } as any);
    vi.mocked(emailService.sendEmail).mockResolvedValue({ success: false } as any);
  });
  it("stores no name and greets by email prefix when the name is blank", async () => {
    await caller(null).waitlist.join({ email: "pat@example.com", name: "   " });
    expect(db.addToWaitlist).toHaveBeenCalledWith(expect.objectContaining({ name: undefined }));
    expect(emailService.getWaitlistConfirmationEmail).toHaveBeenCalledWith("pat", "student", "pat@example.com");
  });
  it("trims a real name", async () => {
    await caller(null).waitlist.join({ email: "pat@example.com", name: " Pat " });
    expect(db.addToWaitlist).toHaveBeenCalledWith(expect.objectContaining({ name: "Pat" }));
    expect(emailService.getWaitlistConfirmationEmail).toHaveBeenCalledWith("Pat", "student", "pat@example.com");
  });
});
