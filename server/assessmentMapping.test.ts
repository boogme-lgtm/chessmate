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
});
