/**
 * Database boundaries behind coach payability: which users can ever be
 * reported as accepting payments, the free-content unlock, and the conditional
 * content-request checkout-slot clear. Runs the real drizzle query builder
 * against a stub mysql2 client that records every query.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, queries } = vi.hoisted(() => ({
  client: { query: vi.fn() },
  queries: [] as Array<{ sql: string; params: unknown[] }>,
}));

vi.mock("drizzle-orm/mysql2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm/mysql2")>();
  return {
    ...actual,
    drizzle: () =>
      actual.drizzle({
        client: client as any,
        logger: { logQuery: (sql: string, params: unknown[]) => { queries.push({ sql, params }); } },
      }),
  };
});

import {
  clearContentRequestCheckoutSessionIfMatches,
  getCoachPayoutStates,
  recordFreeContentUnlock,
} from "./db";

/** mysql2 resolves [rows | ResultSetHeader, fields]. */
function respond(result: unknown) {
  client.query.mockResolvedValue([result, []]);
}

beforeEach(() => {
  client.query.mockReset();
  queries.length = 0;
});

describe("getCoachPayoutStates", () => {
  it("only reads users that have a coach profile, so a student's Stripe state is never derived", async () => {
    respond([]);
    await getCoachPayoutStates([7, 8]);
    expect(queries).toHaveLength(1);
    const [{ sql, params }] = queries;
    expect(sql).toMatch(/inner join `coach_profiles` on `coach_profiles`\.`userId` = `users`\.`id`/i);
    expect(sql).toMatch(/where `users`\.`id` in \(\?, \?\)/i);
    expect(params).toEqual([7, 8]);
  });

  it("skips the query for an empty batch", async () => {
    expect(await getCoachPayoutStates([])).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});

describe("recordFreeContentUnlock", () => {
  it("records a zero-amount 'free' unlock without a PaymentIntent", async () => {
    respond({ affectedRows: 1 });
    expect(await recordFreeContentUnlock({ contentItemId: 101, userId: 1 })).toBe(true);
    const [{ sql, params }] = queries;
    expect(sql).toMatch(/INSERT IGNORE INTO content_purchases/);
    expect(sql).toMatch(/'free', 0/);
    expect(sql).not.toMatch(/stripePaymentIntentId/);
    expect(params).toEqual([101, 1]);
  });

  it("is a no-op for an item the user already unlocked (unique item+user key)", async () => {
    respond({ affectedRows: 0 });
    expect(await recordFreeContentUnlock({ contentItemId: 101, userId: 1 })).toBe(false);
  });
});

describe("clearContentRequestCheckoutSessionIfMatches", () => {
  it("clears the slot only while it still holds the expected session", async () => {
    respond({ affectedRows: 1 });
    expect(await clearContentRequestCheckoutSessionIfMatches(10, "cs_old")).toBe(true);
    const [{ sql, params }] = queries;
    expect(sql).toMatch(/SET stripeCheckoutSessionId = NULL/);
    expect(sql).toMatch(/WHERE id = \? AND stripeCheckoutSessionId = \?/);
    expect(params).toEqual([10, "cs_old"]);
  });

  it("reports a lost race (a concurrent request replaced the session) as not cleared", async () => {
    respond({ affectedRows: 0 });
    expect(await clearContentRequestCheckoutSessionIfMatches(10, "cs_old")).toBe(false);
  });
});
