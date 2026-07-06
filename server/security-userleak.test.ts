/**
 * Regression guard for the coach account-takeover leak class (fixed in the
 * security hardening pass). Three then two more DB read paths did `.select()`
 * on a users join and returned the full row — password hash, reset tokens,
 * Stripe IDs, email — to public / cross-user endpoints, chaining with the
 * public password-reset endpoints into account takeover.
 *
 * These tests codify the invariant: the public users projection must NEVER
 * intersect the sensitive-field set. If a future change adds a secret column
 * to publicUserColumns (or renames a sensitive field into it), CI fails here.
 */

import { describe, it, expect } from "vitest";
import { publicUserColumns, SENSITIVE_USER_FIELDS } from "./db";

describe("public user projection is leak-proof", () => {
  const exposed = Object.keys(publicUserColumns);

  it("exposes only an explicit allowlist of non-sensitive fields", () => {
    expect(exposed.sort()).toEqual(
      [
        "avatarUrl", "bio", "country", "createdAt", "emailVerified",
        "id", "name", "role", "timezone", "userType",
      ].sort()
    );
  });

  it("is disjoint from every sensitive field", () => {
    for (const secret of SENSITIVE_USER_FIELDS) {
      expect(exposed).not.toContain(secret);
    }
  });

  it("never exposes credentials, tokens, or payment identifiers by name", () => {
    for (const key of exposed) {
      expect(key.toLowerCase()).not.toMatch(/password|token|secret|stripe/);
    }
    // email is PII/enumeration risk — only the boolean emailVerified is allowed.
    expect(exposed).not.toContain("email");
    expect(exposed).toContain("emailVerified");
  });
});
