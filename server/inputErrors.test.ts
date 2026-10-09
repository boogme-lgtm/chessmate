/**
 * Sprint 3: input validation failures reached the browser as zod's issue list
 * pretty-printed as JSON, and Register / the coach application showed that
 * verbatim. These requests go over the real wire (HTTP, httpBatchLink,
 * superjson) to the real router, as the pages send them.
 */
import type { AddressInfo } from "node:net";
import express from "express";
import superjson from "superjson";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerTrpcApi } from "./_core/trpcApi";
import { displayNameProblem } from "@shared/displayName";

vi.mock("./db");
vi.mock("./auth", async importOriginal => ({
  ...(await importOriginal<typeof import("./auth")>()),
  registerUser: vi.fn(async () => ({ success: true, userId: 1 })),
}));
import { registerUser } from "./auth";
import type { AppRouter } from "./routers";

let server: { close: () => void };
let client: ReturnType<typeof createTRPCClient<AppRouter>>;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerTrpcApi(app, { rateLimits: { strictLimit: 1000, generalLimit: 1000 } });
  const listening = app.listen(0);
  await new Promise(resolve => listening.once("listening", resolve));
  server = listening;
  const url = `http://127.0.0.1:${(listening.address() as AddressInfo).port}/api/trpc`;
  client = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url, transformer: superjson })] });
});
afterAll(() => server.close());
beforeEach(() => vi.mocked(registerUser).mockClear());

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (cause: unknown) => cause);
  expect(error).toBeInstanceOf(TRPCClientError);
  const { message, data } = error as TRPCClientError<AppRouter>;
  return { message, code: data?.code };
}

const account = { email: "new@example.com", password: "Secret123" };

function application(fullName: string) {
  return {
    fullName, email: "applicant@example.com", phone: "1", country: "US", city: "Austin",
    timezone: "America/Chicago", chessTitle: "FM", currentRating: 2300, ratingOrg: "FIDE",
    yearsExperience: "10", achievements: "a".repeat(100), specializations: ["Openings", "Endgames", "Tactics"],
    targetLevels: ["beginner"], teachingPhilosophy: "t".repeat(200), hourlyRate: 60, availability: { mon: true },
    lessonFormats: ["online"], languages: ["en"], bio: "b".repeat(500), whyBoogme: "w".repeat(200),
    sampleLesson: "s".repeat(300), backgroundCheckConsent: true, termsAgreed: true,
  };
}

describe("input validation errors over the wire", () => {
  it.each([
    ["a whitespace-only name", "   ", "Name is required"],
    ["a name over 100 characters", "n".repeat(101), "Name must be at most 100 characters"],
  ])("registration with %s reports the rule, not zod's JSON", async (_label, name, message) => {
    expect(await failure(client.auth.register.mutate({ ...account, name }))).toEqual({ message, code: "BAD_REQUEST" });
    expect(registerUser).not.toHaveBeenCalled();
  });

  it.each([
    ["a whitespace-only full name", "   ", "Full name must be at least 2 characters"],
    ["a full name over 100 characters", "n".repeat(101), "Full name must be at most 100 characters"],
  ])("a coach application with %s reports the rule, not zod's JSON", async (_label, fullName, message) => {
    expect(await failure(client.coachApplication.submit.mutate(application(fullName)))).toEqual({ message, code: "BAD_REQUEST" });
  });

  it("reports only the first of several issues, still as plain text", async () => {
    const { message } = await failure(client.auth.register.mutate({ email: "not-an-email", password: "short", name: " " }));
    expect(message).toBe("Invalid email address");
  });

  // The forms check names with the shared helper before submitting; it must
  // refuse exactly what the server refuses, with the same message.
  it.each([["   "], ["n".repeat(101)]])("Register's name check matches the server for %j", async name => {
    const { message } = await failure(client.auth.register.mutate({ ...account, name }));
    expect(displayNameProblem(name)).toBe(message);
  });

  it.each([["x"], ["n".repeat(101)]])("the coach application's name check matches the server for %j", async fullName => {
    const { message } = await failure(client.coachApplication.submit.mutate(application(fullName)));
    expect(displayNameProblem(fullName, { label: "Full name", minLength: 2 })).toBe(message);
  });

  it("accepts the names the server accepts", async () => {
    expect(displayNameProblem("  Ann Lee  ")).toBeNull();
    expect(displayNameProblem("n".repeat(100), { label: "Full name", minLength: 2 })).toBeNull();
    await expect(client.auth.register.mutate({ ...account, name: "  Ann Lee  " })).resolves.toMatchObject({ success: true });
    expect(registerUser).toHaveBeenCalledWith(expect.objectContaining({ name: "Ann Lee" }));
    expect(displayNameProblem("   ", { label: "Full name", minLength: 2 })).toBe("Full name is required");
  });

  it("leaves errors that procedures raise themselves unchanged", async () => {
    vi.mocked(registerUser).mockResolvedValueOnce({ success: false, error: "Email already registered" });
    expect(await failure(client.auth.register.mutate({ ...account, name: "Ann Lee" })))
      .toEqual({ message: "Email already registered", code: "BAD_REQUEST" });
  });
});
