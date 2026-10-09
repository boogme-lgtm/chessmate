/**
 * Sprint 3: the database writes that set users.name normalize it, so a blank
 * value can never erase or create an account name whatever the caller passes
 * (OAuth sync, profile edits, coach provisioning, registration).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["insert", "values", "onDuplicateKeyUpdate", "update", "set", "where", "select", "from", "limit"]) {
    chain[method] = vi.fn();
  }
  return chain;
});
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fixture }));
vi.mock("./email", () => ({ sendEmail: vi.fn() }));

import { provisionCoachFromApplication, updateUserProfile, upsertUser } from "./db";
import { registerUser } from "./auth";
import { sendEmail } from "./email";

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of Object.values(fixture)) method.mockReturnValue(fixture);
  fixture.onDuplicateKeyUpdate.mockResolvedValue(undefined);
  fixture.limit.mockResolvedValue([]);
});

describe("updateUserProfile", () => {
  it.each(["", "   ", "\n\t"])("never writes the blank name %j", async name => {
    await updateUserProfile(1, { name, bio: "Endgames" });
    expect(fixture.set).toHaveBeenCalledWith({ bio: "Endgames" });
  });
  it("does not issue an empty UPDATE when nothing is left to change", async () => {
    await updateUserProfile(1, { name: "  " });
    await updateUserProfile(1, {});
    expect(fixture.update).not.toHaveBeenCalled();
  });
  it("stores a trimmed name and still clears other fields with an empty string", async () => {
    await updateUserProfile(1, { name: "  Ann  ", bio: "" });
    expect(fixture.set).toHaveBeenCalledWith({ name: "Ann", bio: "" });
  });
});

describe("upsertUser (OAuth sign-in sync)", () => {
  const base = { openId: "oauth-1", email: "a@example.com", lastSignedIn: new Date("2026-10-01T00:00:00Z") };
  it.each([null, "", "   "])("keeps the existing name when the provider returns %j", async name => {
    await upsertUser({ ...base, name });
    const [values] = fixture.values.mock.calls[0];
    const [{ set }] = fixture.onDuplicateKeyUpdate.mock.calls[0];
    expect(values).not.toHaveProperty("name");
    expect(set).not.toHaveProperty("name");
  });
  it("stores a provider name trimmed", async () => {
    await upsertUser({ ...base, name: "  Ann Lee " });
    expect(fixture.values.mock.calls[0][0].name).toBe("Ann Lee");
    expect(fixture.onDuplicateKeyUpdate.mock.calls[0][0].set.name).toBe("Ann Lee");
  });
});

describe("provisionCoachFromApplication", () => {
  const application = {
    id: 5, email: "coach@example.com", fullName: "  Coach Cris  ", country: "US", timezone: null,
    chessTitle: "FM", currentRating: 2300, hourlyRateCents: 8000, specializations: "[]", languages: "[]",
    lessonFormats: "[]", availability: "{}", yearsExperience: "10", profilePhotoUrl: null, videoIntroUrl: null,
  };
  const creds = { hashedPassword: "hash", resetToken: "token", resetExpires: new Date() };

  it.each([
    ["  Coach Cris  ", "Coach Cris"],
    ["    ", null],
  ])("provisions the applicant name %j as %j", async (fullName, expected) => {
    fixture.values.mockResolvedValueOnce([{ insertId: 10 }]).mockResolvedValueOnce([{ insertId: 20 }]);
    await provisionCoachFromApplication({ ...application, fullName }, creds);
    expect(fixture.values.mock.calls[0][0]).toMatchObject({ email: "coach@example.com", name: expected });
  });
});

describe("registerUser", () => {
  it("refuses a blank name before touching the database or sending email", async () => {
    expect(await registerUser({ email: "x@example.com", password: "Passw0rdX", name: "   " }))
      .toEqual({ success: false, error: "Name is required" });
    expect(fixture.select).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("stores the trimmed name and escapes it in the verification email", async () => {
    fixture.values.mockResolvedValueOnce([{ insertId: 3 }]);
    await registerUser({ email: "x@example.com", password: "Passw0rdX", name: "  <b>Ann</b>  " });
    expect(fixture.values.mock.calls[0][0].name).toBe("<b>Ann</b>");
    const { html } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(html).toContain("Hi &lt;b&gt;Ann&lt;/b&gt;,");
    expect(html).not.toContain("<b>Ann</b>");
  });
});
