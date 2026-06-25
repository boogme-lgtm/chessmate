import { describe, it, expect } from "vitest";
import { scoreCoachForStudent, rankCoachesForStudent, type CoachForMatching, type StudentForMatching } from "@shared/coachMatching";

const BASE_COACH: CoachForMatching = {
  userId: 1,
  name: "GM Elena",
  title: "GM",
  fideRating: 2500,
  specialties: JSON.stringify(["openings", "tactics", "endgames"]),
  teachingStyle: "analytical",
  hourlyRateCents: 6500,
  availabilitySchedule: JSON.stringify({ monday: { enabled: true, slots: ["evening_weekday"] } }),
  averageRating: "4.8",
  totalLessons: 120,
  totalStudents: 30,
  totalReviews: 25,
  profilePhotoUrl: "https://example.com/photo.jpg",
};

const BASE_STUDENT: StudentForMatching = {
  learningStyle: "analytical",
  improvementAreas: JSON.stringify(["openings", "tactics", "endgames"]),
  budgetMinCents: 4000,
  budgetMaxCents: 8000,
  currentRating: 1500,
  credentialImportance: "titled",
  playingStyle: "aggressive",
  assessmentData: JSON.stringify({ availability: ["evening_weekday"] }),
};

describe("scoreCoachForStudent", () => {
  it("returns a high score for a well-matched coach", () => {
    const result = scoreCoachForStudent(BASE_COACH, BASE_STUDENT);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.coachUserId).toBe(1);
    expect(result.coachName).toBe("GM Elena");
  });

  it("returns a low score for a complete mismatch", () => {
    const mismatchCoach: CoachForMatching = {
      ...BASE_COACH,
      userId: 2,
      name: "Bob",
      title: "none",
      fideRating: 1600,
      specialties: JSON.stringify(["psychology"]),
      teachingStyle: "competitive",
      hourlyRateCents: 25000,
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
    expect(result.score).toBeLessThan(30);
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
  });

  describe("rating gap", () => {
    it("optimal gap (400-800) gets full score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2000 },
        { ...BASE_STUDENT, currentRating: 1400 }
      );
      expect(result.breakdown.ratingGap).toBe(15);
    });

    it("too close (<200) gets penalized", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 1550 },
        { ...BASE_STUDENT, currentRating: 1500 }
      );
      expect(result.breakdown.ratingGap).toBe(5);
    });

    it("very large gap (>1200) gets reduced", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, fideRating: 2800 },
        { ...BASE_STUDENT, currentRating: 1000 }
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
  });

  describe("specialty overlap", () => {
    it("3 overlapping areas get max score", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["openings", "tactics", "endgames"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["openings", "tactics", "endgames"]) }
      );
      expect(result.breakdown.specialties).toBe(18);
    });

    it("zero overlap gets zero", () => {
      const result = scoreCoachForStudent(
        { ...BASE_COACH, specialties: JSON.stringify(["psychology"]) },
        { ...BASE_STUDENT, improvementAreas: JSON.stringify(["openings", "tactics"]) }
      );
      expect(result.breakdown.specialties).toBe(0);
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

  it("generates human-readable reasons", () => {
    const result = scoreCoachForStudent(BASE_COACH, BASE_STUDENT);
    for (const reason of result.reasons) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(10);
    }
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
    const ranked = rankCoachesForStudent([], BASE_STUDENT);
    expect(ranked).toEqual([]);
  });
});
