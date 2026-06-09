/**
 * Sprint 46 — coach dashboard data fixes
 *
 * S46-4 / S46-5: COACH_PENDING_STATUSES + buildCoachEarningsSummary
 *   (shared/coachEarnings.ts) — pure, the single source of truth used by
 *   db.getCoachPendingEarnings and db.getCoachEarningsSummary.
 * S46-1: structural check that getLessonsByCoach JOINs users for studentName.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  COACH_PENDING_STATUSES,
  buildCoachEarningsSummary,
} from "../shared/coachEarnings";

describe("Sprint 46 — coach pending statuses (S46-4)", () => {
  it("includes payment_collected, confirmed and completed", () => {
    expect(COACH_PENDING_STATUSES).toContain("payment_collected");
    expect(COACH_PENDING_STATUSES).toContain("confirmed");
    expect(COACH_PENDING_STATUSES).toContain("completed");
  });

  it("excludes terminal/settled statuses", () => {
    for (const s of ["released", "cancelled", "declined", "refunded"]) {
      expect(COACH_PENDING_STATUSES).not.toContain(s as any);
    }
  });
});

describe("Sprint 46 — earnings summary (S46-5)", () => {
  it("escrowed (pending) money drives percentToThreshold even with $0 released", () => {
    const s = buildCoachEarningsSummary(0, 13200); // $132 in escrow, nothing released
    expect(s.pendingEarningsCents).toBe(13200);
    expect(s.combinedEarningsCents).toBe(13200);
    expect(s.hasReachedThreshold).toBe(true);
    expect(s.percentToThreshold).toBe(100); // capped
  });

  it("partial progress reflects combined earnings", () => {
    const s = buildCoachEarningsSummary(0, 5000); // $50 escrowed, $100 threshold
    expect(s.percentToThreshold).toBe(50);
    expect(s.hasReachedThreshold).toBe(false);
  });

  it("combines released + pending", () => {
    const s = buildCoachEarningsSummary(3000, 4000);
    expect(s.combinedEarningsCents).toBe(7000);
    expect(s.percentToThreshold).toBe(70);
  });
});

describe("Sprint 46 — getLessonsByCoach returns studentName (S46-1)", () => {
  const src = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

  it("getLessonsByCoach LEFT JOINs users and aliases name AS studentName", () => {
    const fnIdx = src.indexOf("export async function getLessonsByCoach");
    const snippet = src.slice(fnIdx, fnIdx + 600);
    expect(snippet).toMatch(/LEFT JOIN users u ON u\.id = l\.studentId/);
    expect(snippet).toMatch(/u\.name AS studentName/);
  });
});
