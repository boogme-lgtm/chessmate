/**
 * Duplicate-key detection under drizzle 0.45, which wraps every mysql2 error
 * in a DrizzleQueryError (driver error on `.cause`). The db-level cases run the
 * real drizzle query builder against a stub mysql2 client that rejects with a
 * genuine-shaped ER_DUP_ENTRY error, so drizzle performs the wrapping itself.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";

const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }));

vi.mock("drizzle-orm/mysql2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm/mysql2")>();
  return { ...actual, drizzle: () => actual.drizzle({ client: client as any }) };
});

import { isDuplicateKeyError } from "./dbErrors";
import { addToWaitlist, recordContentPurchase, subscribeToCoach } from "./db";

function mysqlError(errno: number, code: string, message: string) {
  return Object.assign(new Error(message), { errno, code, sqlMessage: message });
}
const duplicate = () => mysqlError(1062, "ER_DUP_ENTRY", "Duplicate entry 'x' for key 'uq'");
const deadlock = () => mysqlError(1213, "ER_LOCK_DEADLOCK", "Deadlock found when trying to get lock");

/** mysql2 resolves [rows | ResultSetHeader, fields]. */
const ok = (result: unknown) => [result, []];

beforeEach(() => {
  client.query.mockReset();
});

describe("isDuplicateKeyError", () => {
  it("matches a bare mysql2 duplicate-entry error", () => {
    expect(isDuplicateKeyError(duplicate())).toBe(true);
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
  });

  it("matches the driver error inside drizzle's DrizzleQueryError wrapper", () => {
    const wrapped = new DrizzleQueryError("insert into `waitlist` ...", ["a@b.co"], duplicate());
    expect((wrapped as any).errno).toBeUndefined();
    expect(isDuplicateKeyError(wrapped)).toBe(true);
  });

  it("does not match other database errors, wrapped or not", () => {
    expect(isDuplicateKeyError(deadlock())).toBe(false);
    expect(isDuplicateKeyError(new DrizzleQueryError("insert ...", [], deadlock()))).toBe(false);
  });

  it("ignores message text, which includes query params", () => {
    const wrapped = new DrizzleQueryError("insert ...", ["duplicate@example.com"], deadlock());
    expect(wrapped.message).toContain("duplicate");
    expect(isDuplicateKeyError(wrapped)).toBe(false);
    expect(isDuplicateKeyError(new Error("Duplicate entry"))).toBe(false);
  });

  it("handles non-objects and cyclic cause chains", () => {
    expect(isDuplicateKeyError(undefined)).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError("ER_DUP_ENTRY")).toBe(false);
    const a: any = new Error("a");
    const b: any = new Error("b");
    a.cause = b;
    b.cause = a;
    expect(isDuplicateKeyError(a)).toBe(false);
  });
});

describe("db helpers see duplicates through drizzle's wrapping", () => {
  it("addToWaitlist reports an already-listed email instead of throwing", async () => {
    client.query.mockRejectedValueOnce(duplicate());
    await expect(addToWaitlist({ email: "dup@example.com", userType: "student" } as any)).resolves.toEqual({
      success: false,
      error: "This email is already on the waitlist",
    });
  });

  it("addToWaitlist still rethrows other failures, even when the email says 'duplicate'", async () => {
    client.query.mockRejectedValueOnce(deadlock());
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(addToWaitlist({ email: "duplicate@example.com", userType: "student" } as any)).rejects.toBeInstanceOf(
      DrizzleQueryError,
    );
    error.mockRestore();
  });

  it("subscribeToCoach resolves a concurrent-subscribe race by reactivating the existing row", async () => {
    const now = new Date();
    client.query
      .mockResolvedValueOnce(ok([])) // no existing subscription yet
      .mockRejectedValueOnce(duplicate()) // a concurrent request inserted first
      .mockResolvedValueOnce(ok([[42, 5, 9, "cancelled", 0, null, null, now, now]])) // refetch (rows as arrays)
      .mockResolvedValueOnce(ok({ affectedRows: 1 })); // reactivate
    await expect(subscribeToCoach(5, 9, 1500)).resolves.toBe(42);
    expect(client.query).toHaveBeenCalledTimes(4);
  });

  it("subscribeToCoach rethrows non-duplicate insert failures", async () => {
    client.query.mockResolvedValueOnce(ok([])).mockRejectedValueOnce(deadlock());
    await expect(subscribeToCoach(5, 9, 1500)).rejects.toBeInstanceOf(DrizzleQueryError);
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("recordContentPurchase classifies a retried PaymentIntent as a same-PI duplicate", async () => {
    client.query
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce(ok([{ stripePaymentIntentId: "pi_same" }]));
    await expect(
      recordContentPurchase({ contentItemId: 3, userId: 4, amountPaidCents: 999, stripePaymentIntentId: "pi_same" }),
    ).resolves.toBe("duplicate_same_pi");
  });

  it("recordContentPurchase flags a second PaymentIntent for an owned item so it can be refunded", async () => {
    client.query
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce(ok([{ stripePaymentIntentId: "pi_first" }]));
    await expect(
      recordContentPurchase({ contentItemId: 3, userId: 4, amountPaidCents: 999, stripePaymentIntentId: "pi_second" }),
    ).resolves.toBe("duplicate_other_pi");
  });
});
