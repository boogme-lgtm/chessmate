import { describe, it, expect } from "vitest";
import {
  scoreCoachForStudent,
  rankCoachesForStudent,
  toCoachForMatching,
  normalizeToFide,
  parseJsonArray,
  type CoachForMatching,
  type StudentForMatching,
} from "@shared/coachMatching";

// NOTE: these fixtures deliberately use the REAL vocabulary the app produces —
// student improvement areas as full phrases ("Opening preparation"), coach
// specialties as canonical labels ("Openings"), availability as time-of-day
// labels ("Morning (9am-12pm)"), and coach schedules as { start, end } OBJECTS.
// The previous suite used the engine's internal short-codes/string-slots, which
// hid three production bugs (specialties always 0, schedule TypeError crash,
// schedule never matching). Do not "simplify" these back to short codes.

const BASE_COACH: CoachForMatching = {
  userId: 1,
  name: "GM Elena",
  title: "GM",
  fideRating: 2500,
  specialties: JSON.stringify(["Openings", "Tactics", "Endgames"]),
  teachingStyle: "analytical",
  hourlyRateCents: 6500,
  availabilitySchedule: JSON.stringify({
    monday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    saturday: { enabled: true, slots: [{ start: "10:00", end: "14:00" }] },
  }),
  averageRating: "4.8",
  totalLessons: 120,
  totalStudents: 30,
  totalReviews: 25,
  profilePhotoUrl: "https://example.com/photo.jpg",
};

const BASE_STUDENT: StudentForMatching = {
  learningStyle: "analytical",
  improvementAreas: JSON.stringify(["Opening preparation", "Tactical calculation", "Endgame technique"]),
  budgetMinCents: 4000,
  budgetMaxCents: 8000,
  currentRating: 1500,
  credentialImportance: "titled",
  playingStyle: "aggressive",
  assessmentData: JSON.stringify({ availability: ["Morning (9am-12pm)"], ratingSystem: "fide" }),
};

describe("scoreCoachForStudent", () => {
  it("returns a high score for a well-matched coach (real vocabulary)", () => {
    const result = scoreCoachForStudent(BASE_COACH, BASE_STUDENT);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.coachUserId).toBe(1);
    expect(result.coachName).toBe("GM Elena");
  });

  it("never exceeds 100 even when every dimension maxes out", () => {
    const result = scoreCoachForStudent(BASE_COACH, BASE_STUDENT);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns a low score for a complete mismatch", () => {
    const mismatchCoach: CoachForMatching = {
      ...BASE_COACH,
      userId: 2,
      name: "Bob",
      title: "none",
      fideRating: 1600,
      specialties: JSON.stringify(["Kids & Beginners"]),
      teachingStyle: "competitive",
      hourlyRateCents: 25000,
      availabilitySchedule: JSON.stringify({ tuesday: { enabled: true, slots: [{ start: "22:00", end: "23:30" }] } }),
      averageRating: "3.0",
      totalLessons: 0,
      totalReviews: 0,
    };
    const result = scoreCoachForStudent(mismatchCoach, {
      ...BASE_STUDENT,
      learningStyle: "visual",
      credentialImportance: "gm",
      budgetMaxCents: 5000,
    });
    expect(result.score).toBeLessThan(40);
  });

  // ── The regression test for the specialties bug: real phrases must reconcile
  //    to coach tags. With the old substring matcher this scored 0. ──
  describe("specialties reconciliation (phrase ↔ tag)", () => {
    it("matches 'Opening preparation' to coach specialty 'Openings'", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["Openings", "Tactics", "Endgames"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["Opening preparation", "Tactical calculation", "Endgame technique"]) }
      );
      expect(result.breakdown.specialties).toBe(18);
    });

    it("one matching phrase scores partial", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["Openings"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["Opening preparation"]) }
      );
      expect(result.breakdown.specialties).toBe(10); // 18 * 0.55 rounded
    });

    it("no shared area scores zero", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["Openings"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["Mental game / psychology"]) }
      );
      expect(result.breakdown.specialties).toBe(0);
    });

    it("still works with the canonical short-code vocabulary (backward compat)", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["openings", "tactics", "endgames"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["openings", "tactics", "endgames"]) }
      );
      expect(result.breakdown.specialties).toBe(18);
    });
  });

  // ── The regression test for the schedule crash + dead-dimension bugs. ──
  describe("schedule reconciliation (object slots, no crash)", () => {
    it("does not throw on real { start, end } object slots", () => {
      expect(() => scoreCoachForStudent(BASE_COACH, BASE_STUDENT)).not.toThrow();
    });

    it("matches a morning student to a coach whose slot covers the morning", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        assessmentData: JSON.stringify({ availability: ["Morning (9am-12pm)"], ratingSystem: "fide" }),
      });
      expect(result.breakdown.schedule).toBe(10);
    });

    it("penalizes when the student's time is outside every coach slot", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        assessmentData: JSON.stringify({ availability: ["Late night (9pm-12am)"], ratingSystem: "fide" }),
      });
      expect(result.breakdown.schedule).toBe(3); // 10 * 0.3 → no overlap
    });

    it("matches 'Weekends only' to a coach with a weekend slot", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        assessmentData: JSON.stringify({ availability: ["Weekends only"], ratingSystem: "fide" }),
      });
      expect(result.breakdown.schedule).toBe(10);
    });

    it("'Flexible' matches any coach with availability", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        assessmentData: JSON.stringify({ availability: ["Flexible"], ratingSystem: "fide" }),
      });
      expect(result.breakdown.schedule).toBe(10);
    });
  });

  describe("rating normalization across systems", () => {
    it("normalizes a lichess rating down to FIDE-equivalent before the gap", () => {
      // lichess 1700 → ~1550 FIDE; coach 2000 → gap 450 → optimal band (15).
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2000 },
        { ...BASE_STUDENT, currentRating: 1700, assessmentData: JSON.stringify({ ratingSystem: "lichess" }) }
      );
      expect(result.breakdown.ratingGap).toBe(15);
    });

    it("treats a FIDE rating as-is", () => {
      // fide 1700, coach 2000 → gap 300 → 200-400 band (0.67 → 10).
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2000 },
        { ...BASE_STUDENT, currentRating: 1700, assessmentData: JSON.stringify({ ratingSystem: "fide" }) }
      );
      expect(result.breakdown.ratingGap).toBe(10);
    });
  });

  describe("learning style ↔ teaching style", () => {
    it("exact match gets full style score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, teachingStyle: "analytical" },
        { ...BASE_STUDENT, learningStyle: "analytical" }
      );
      expect(result.breakdown.style).toBe(20);
    });
    it("compatible match gets partial score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, teachingStyle: "visual" },
        { ...BASE_STUDENT, learningStyle: "analytical" }
      );
      expect(result.breakdown.style).toBe(12);
    });
    it("full mismatch gets zero", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, teachingStyle: "competitive" },
        { ...BASE_STUDENT, learningStyle: "analytical" }
      );
      expect(result.breakdown.style).toBe(0);
    });
  });

  describe("budget scoring", () => {
    it("coach within budget gets full score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, hourlyRateCents: 6000 },
        { ...BASE_STUDENT, budgetMinCents: 4000, budgetMaxCents: 8000 }
      );
      expect(result.breakdown.budget).toBe(15);
    });
    it("coach slightly over budget gets partial", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, hourlyRateCents: 9500 },
        { ...BASE_STUDENT, budgetMinCents: 4000, budgetMaxCents: 8000 }
      );
      expect(result.breakdown.budget).toBe(8);
    });
    it("coach far over budget gets zero", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, hourlyRateCents: 20000 },
        { ...BASE_STUDENT, budgetMinCents: 4000, budgetMaxCents: 8000 }
      );
      expect(result.breakdown.budget).toBe(0);
    });
    it("a $0 (free) coach rate is honored, not treated as missing data", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, hourlyRateCents: 0 },
        { ...BASE_STUDENT, budgetMinCents: 0, budgetMaxCents: 8000 }
      );
      expect(result.breakdown.budget).toBe(15); // 0 is within [0, 8000]
    });
  });

  describe("rating gap", () => {
    it("optimal gap (400-800) gets full score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2000 },
        { ...BASE_STUDENT, currentRating: 1400, assessmentData: JSON.stringify({ ratingSystem: "fide" }) }
      );
      expect(result.breakdown.ratingGap).toBe(15);
    });
    it("too close (<200) gets penalized", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 1550 },
        { ...BASE_STUDENT, currentRating: 1500, assessmentData: JSON.stringify({ ratingSystem: "fide" }) }
      );
      expect(result.breakdown.ratingGap).toBe(5);
    });
    it("very large gap (>1200) gets reduced", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2800 },
        { ...BASE_STUDENT, currentRating: 1000, assessmentData: JSON.stringify({ ratingSystem: "fide" }) }
      );
      expect(result.breakdown.ratingGap).toBe(8);
    });
  });

  describe("credential preference", () => {
    it("student wants GM, coach is GM → full score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, title: "GM" },
        { ...BASE_STUDENT, credentialImportance: "gm" }
      );
      expect(result.breakdown.credential).toBe(10);
    });
    it("student wants GM, coach has no title → zero", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, title: "none" },
        { ...BASE_STUDENT, credentialImportance: "gm" }
      );
      expect(result.breakdown.credential).toBe(0);
    });
    it("student says notimportant → always full score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, title: "none" },
        { ...BASE_STUDENT, credentialImportance: "notimportant" }
      );
      expect(result.breakdown.credential).toBe(10);
    });
    it("legacy NULL credentialImportance → neutral, NOT full credit", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, title: "none" },
        { ...BASE_STUDENT, credentialImportance: null }
      );
      expect(result.breakdown.credential).toBe(6); // 10 * 0.6 neutral
    });
  });

  describe("reasons only surface on real data", () => {
    it("does not claim a budget match when no budget was provided", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        budgetMinCents: null,
        budgetMaxCents: null,
      });
      expect(result.reasons).not.toContain("Within your budget range");
    });
    it("does not claim a rating match when no rating was provided", () => {
      const result = scoreCoachForStudent(BASE_COACH, {
        ...BASE_STUDENT,
        currentRating: null,
      });
      expect(result.reasons).not.toContain("Right skill level to challenge and teach you");
    });
    it("surfaces genuine reasons for a strong match", () => {
      const result = scoreCoachForStudent(BASE_COACH, BASE_STUDENT);
      expect(result.reasons).toContain("Specializes in your improvement areas");
    });
  });

  it("handles missing data gracefully (no crash)", () => {
    const sparseCoach: CoachForMatching = {
      userId: 99, name: "Unknown", title: null, fideRating: null,
      specialties: null, teachingStyle: null, hourlyRateCents: null,
      availabilitySchedule: null, averageRating: null, totalLessons: null,
      totalStudents: null, totalReviews: null, profilePhotoUrl: null,
    };
    const sparseStudent: StudentForMatching = {
      learningStyle: null, improvementAreas: null, budgetMinCents: null,
      budgetMaxCents: null, currentRating: null, credentialImportance: null,
      playingStyle: null, assessmentData: null,
    };
    const result = scoreCoachForStudent(sparseCoach, sparseStudent);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("tolerates malformed (non-array) persisted improvementAreas without crashing", () => {
    const result = scoreCoachForStudent(BASE_COACH, {
      ...BASE_STUDENT,
      improvementAreas: JSON.stringify("tactics"), // a string, not an array
    });
    expect(result.breakdown.specialties).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("rankCoachesForStudent", () => {
  it("returns coaches sorted by score descending", () => {
    const coaches: CoachForMatching[] = [
      { ...BASE_COACH, userId: 1, title: "none", fideRating: 1550 },
      { ...BASE_COACH, userId: 2, title: "GM", fideRating: 2100 },
      { ...BASE_COACH, userId: 3, title: "IM", fideRating: 2300 },
    ];
    const ranked = rankCoachesForStudent(coaches, BASE_STUDENT);
    expect(ranked.length).toBe(3);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("works with a single coach", () => {
    const ranked = rankCoachesForStudent([BASE_COACH], BASE_STUDENT);
    expect(ranked.length).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("works with empty coach list", () => {
    expect(rankCoachesForStudent([], BASE_STUDENT)).toEqual([]);
  });
});

describe("normalizeToFide", () => {
  it("leaves FIDE ratings unchanged", () => {
    expect(normalizeToFide(1800, "fide")).toBe(1800);
    expect(normalizeToFide(1800, null)).toBe(1800);
  });
  it("subtracts an offset for lichess and chess.com", () => {
    expect(normalizeToFide(1800, "lichess")).toBe(1650);
    expect(normalizeToFide(1800, "chesscom")).toBe(1700);
  });
  it("clamps to a floor of 100", () => {
    expect(normalizeToFide(120, "lichess")).toBe(100);
  });
});

describe("toCoachForMatching adapter", () => {
  it("reads the Drizzle nested join shape { coach_profiles, users }", () => {
    const row = {
      coach_profiles: { userId: 7, title: "FM", specialties: JSON.stringify(["Tactics"]), hourlyRateCents: 5000 },
      users: { id: 7, name: "FM Sam" },
    };
    const c = toCoachForMatching(row);
    expect(c.userId).toBe(7);
    expect(c.name).toBe("FM Sam");
    expect(c.title).toBe("FM");
    expect(c.hourlyRateCents).toBe(5000);
  });
  it("falls back to a flat shape", () => {
    const c = toCoachForMatching({ userId: 9, name: "Flat", title: "CM" });
    expect(c.userId).toBe(9);
    expect(c.name).toBe("Flat");
    expect(c.title).toBe("CM");
  });
});

describe("parseJsonArray", () => {
  it("returns [] for null/invalid/non-array", () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray("not json")).toEqual([]);
    expect(parseJsonArray(JSON.stringify("a string"))).toEqual([]);
    expect(parseJsonArray(JSON.stringify({ a: 1 }))).toEqual([]);
  });
  it("returns the array for valid JSON arrays of strings", () => {
    expect(parseJsonArray(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
  });
});
