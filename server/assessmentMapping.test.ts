import { describe, it, expect } from "vitest";
import { mapAssessmentToProfile, type AssessmentData } from "@shared/assessmentMapping";

const FULL_ASSESSMENT: AssessmentData = {
  rating: 1450,
  ratingSystem: "lichess",
  yearsPlaying: "intermediate",
  competitiveExperience: ["otb_tournaments"],
  improvementAreas: ["openings", "tactics", "endgames"],
  primaryGoal: "rating",
  timeline: "steady",
  targetImprovement: 300,
  teachingArchetype: "sage",
  learningMethods: ["game_analysis", "puzzles"],
  feedbackStyle: 7,
  lessonPace: "deep",
  budgetMin: 40,
  budgetMax: 80,
  lessonFrequency: "weekly",
  timezone: "America/New_York",
  availability: ["evening_weekday", "morning_weekend"],
  lessonFormat: "online",
  communicationPreference: "occasional",
  motivations: ["improve_rating", "enjoy_chess"],
  techComfort: 8,
  styleIcon: "tal",
  credentialImportance: "titled",
};

describe("mapAssessmentToProfile", () => {
  it("maps a full assessment to structured profile fields", () => {
    const result = mapAssessmentToProfile(FULL_ASSESSMENT);
    expect(result.currentRating).toBe(1450);
    expect(result.targetRating).toBe(1750);
    expect(result.skillLevel).toBe("intermediate");
    expect(result.primaryGoal).toBe("rating_improvement");
    expect(result.playingStyle).toBe("aggressive");
    expect(result.learningStyle).toBe("analytical");
    expect(result.practiceSchedule).toBe("regular");
    expect(result.budgetMinCents).toBe(4000);
    expect(result.budgetMaxCents).toBe(8000);
    expect(result.credentialImportance).toBe("titled");
    expect(JSON.parse(result.improvementAreas)).toEqual(["openings", "tactics", "endgames"]);
    expect(result.assessmentVersion).toBe(1);
    expect(result.assessmentCompletedAt).toBeInstanceOf(Date);
  });

  it("preserves the raw assessment as JSON", () => {
    const result = mapAssessmentToProfile(FULL_ASSESSMENT);
    const raw = JSON.parse(result.assessmentData);
    expect(raw.rating).toBe(1450);
    expect(raw.styleIcon).toBe("tal");
    expect(raw.improvementAreas).toEqual(["openings", "tactics", "endgames"]);
  });

  describe("skillLevel boundaries", () => {
    it.each([
      [0, "beginner"], [999, "beginner"],
      [1000, "intermediate"], [1599, "intermediate"],
      [1600, "advanced"], [1999, "advanced"],
      [2000, "expert"], [2800, "expert"],
    ])("rating %i → %s", (rating, expected) => {
      const result = mapAssessmentToProfile({ ...FULL_ASSESSMENT, rating });
      expect(result.skillLevel).toBe(expected);
    });
  });

  describe("primaryGoal mapping", () => {
    it.each([
      ["rating", "rating_improvement"],
      ["competitive", "tournament_prep"],
      ["understanding", "openings"],
      ["enjoyment", "general"],
      ["coaching", "general"],
      ["intellectual", "general"],
    ])("%s → %s", (input, expected) => {
      const result = mapAssessmentToProfile({ ...FULL_ASSESSMENT, primaryGoal: input });
      expect(result.primaryGoal).toBe(expected);
    });
  });

  describe("styleIcon → playingStyle", () => {
    it.each([
      ["tal", "aggressive"], ["kasparov", "aggressive"], ["polgar", "aggressive"],
      ["carlsen", "balanced"], ["fischer", "balanced"], ["mixed", "balanced"],
      ["petrosian", "defensive"], ["karpov", "positional"],
    ])("%s → %s", (icon, expected) => {
      const result = mapAssessmentToProfile({ ...FULL_ASSESSMENT, styleIcon: icon });
      expect(result.playingStyle).toBe(expected);
    });
  });

  it("handles missing/partial data gracefully", () => {
    const result = mapAssessmentToProfile({});
    expect(result.currentRating).toBe(1200);
    expect(result.skillLevel).toBe("intermediate");
    expect(result.primaryGoal).toBe("general");
    expect(result.playingStyle).toBe("balanced");
    expect(result.budgetMinCents).toBe(5000);
    expect(result.budgetMaxCents).toBe(10000);
    expect(result.credentialImportance).toBe("somewhat");
  });

  describe("numeric coercion and clamping (defends the waitlist migration path)", () => {
    it("coerces string numerics instead of concatenating", () => {
      const result = mapAssessmentToProfile({ rating: "1450", targetImprovement: "200" } as any);
      expect(result.currentRating).toBe(1450);
      expect(result.targetRating).toBe(1650); // numeric addition, NOT "1450200"
    });

    it("falls back to defaults for non-numeric garbage", () => {
      const result = mapAssessmentToProfile({ rating: "abc", budgetMin: "lots" } as any);
      expect(result.currentRating).toBe(1200);
      expect(result.budgetMinCents).toBe(5000);
    });

    it("clamps a negative targetImprovement to 0", () => {
      const result = mapAssessmentToProfile({ rating: 1500, targetImprovement: -500 } as any);
      expect(result.targetRating).toBe(1500);
    });

    it("clamps an absurd targetImprovement to the cap", () => {
      const result = mapAssessmentToProfile({ rating: 1500, targetImprovement: 99999 } as any);
      expect(result.targetRating).toBe(3500); // 1500 + 2000 cap
    });

    it("drops a non-array improvementAreas without crashing", () => {
      const result = mapAssessmentToProfile({ improvementAreas: "tactics" } as any);
      expect(JSON.parse(result.improvementAreas)).toEqual([]);
    });
  });
});

describe("assessmentDataSchema", () => {
  it("strips unknown keys and bounds the blob", async () => {
    const { assessmentDataSchema } = await import("@shared/assessmentMapping");
    const parsed = assessmentDataSchema.parse({ rating: 1500, sneaky: "x".repeat(100000) } as any);
    expect((parsed as any).sneaky).toBeUndefined();
    expect(parsed.rating).toBe(1500);
  });

  it("coerces numeric strings at the boundary", async () => {
    const { assessmentDataSchema } = await import("@shared/assessmentMapping");
    const parsed = assessmentDataSchema.parse({ rating: "1600", budgetMin: "40" } as any);
    expect(parsed.rating).toBe(1600);
    expect(parsed.budgetMin).toBe(40);
  });

  it("rejects an over-long improvementAreas array", async () => {
    const { assessmentDataSchema } = await import("@shared/assessmentMapping");
    const result = assessmentDataSchema.safeParse({ improvementAreas: Array(50).fill("x") });
    expect(result.success).toBe(false);
  });
});
