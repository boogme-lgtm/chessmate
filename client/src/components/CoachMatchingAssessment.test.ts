import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_STUDENT_RATING, type AssessmentData } from "@shared/assessmentMapping";
import { answerBaseline, answerQuestion, questionnaireSaveInput, sliderMax, startQuestionnaire } from "@shared/questionnaireDraft";
import { CoachMatchingAssessment } from "./CoachMatchingAssessment";

const { saves, buttons } = vi.hoisted(() => ({
  saves: [] as unknown[],
  buttons: [] as { children?: unknown; onClick?: () => unknown }[],
}));

vi.mock("@/lib/trpc", () => {
  const mutation = (calls?: unknown[]) => () => ({ mutateAsync: async (input: unknown) => { calls?.push(input); }, isPending: false });
  return {
    trpc: {
      student: { saveQuizResults: { useMutation: mutation(saves) } },
      match: { generateMatches: { useMutation: mutation() } },
      waitlist: { join: { useMutation: mutation() } },
    },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 901, userType: "student" } }) }));
// Record each button's handler so a test can press it after rendering.
vi.mock("@/components/ui/button", async () => {
  const { createElement } = await import("react");
  return { Button: (props: { children?: ReactNode; onClick?: () => unknown }) => { buttons.push(props); return createElement("button", null, props.children); } };
});

const render = (props: { mode?: "signup" | "edit"; initialData?: Partial<AssessmentData> }) =>
  renderToStaticMarkup(createElement(CoachMatchingAssessment, { onClose: () => {}, onSaved: async () => {}, ...props }));
const ratingSliderMax = (html: string) => Number(html.match(/role="slider"[^>]*aria-valuemax="(\d+)"/)![1]);

beforeEach(() => {
  saves.length = 0;
  buttons.length = 0;
});

describe("what an edit save sends", () => {
  async function pressSave(initialData: Partial<AssessmentData>) {
    render({ mode: "edit", initialData });
    await buttons.find(button => button.children === "Save answers")!.onClick!();
    return saves;
  }

  it("regression: an untouched save reports the prefilled rating and goal as where the form started", async () => {
    const initialData = { rating: 1650, ratingSystem: "lichess", targetImprovement: 0, lessonFormat: "online" };
    expect(await pressSave(initialData)).toEqual([{ assessmentData: initialData, baseline: { rating: 1650, targetImprovement: 0 } }]);
  });

  it("reports that no rating or goal was shown when none was prefilled", async () => {
    expect(await pressSave({ lessonFormat: "online" })).toEqual([{ assessmentData: { lessonFormat: "online" }, baseline: { rating: null, targetImprovement: null } }]);
  });
});

describe("questionnaire drafts", () => {
  it("regression: answers moved after the form opened still report where it started", () => {
    const started = startQuestionnaire({ rating: 1650, targetImprovement: 0, lessonFormat: "online" });
    const draft = answerQuestion(answerQuestion(started, "rating", 1800), "targetImprovement", 300);
    expect(questionnaireSaveInput(draft, draft.answers)).toEqual({
      assessmentData: { rating: 1800, targetImprovement: 300, lessonFormat: "online" },
      baseline: { rating: 1650, targetImprovement: 0 },
    });
    expect(started.answers).toEqual({ rating: 1650, targetImprovement: 0, lessonFormat: "online" });
  });

  it("an answer moved back to its starting value counts as untouched", () => {
    const draft = answerQuestion(answerQuestion(startQuestionnaire({ rating: 1650 }), "rating", 1700), "rating", 1650);
    expect(draft.answers.rating).toBe(answerBaseline(draft).rating);
  });

  it("stretches a slider to reach a starting value above its usual range, never below it", () => {
    expect(sliderMax(startQuestionnaire({ rating: 2900 }), "rating", MAX_STUDENT_RATING)).toBe(MAX_STUDENT_RATING);
    expect(sliderMax(startQuestionnaire({ rating: 3500 }), "rating", MAX_STUDENT_RATING)).toBe(3500);
    expect(sliderMax(startQuestionnaire({ targetImprovement: 900 }), "targetImprovement", 600)).toBe(900);
    expect(sliderMax(startQuestionnaire({}), "targetImprovement", 600)).toBe(600);
  });
});

describe("the rating slider", () => {
  it.each([2900, 3500])("regression: reaches a saved rating of %i, so touching it cannot lower the rating", rating => {
    const html = render({ mode: "edit", initialData: { rating } });
    expect(html).toMatch(new RegExp(`>${rating}<`));
    expect(ratingSliderMax(html)).toBeGreaterThanOrEqual(rating);
  });

  it("offers the same range as the dashboard rating input", () => {
    expect(ratingSliderMax(render({ mode: "signup" }))).toBe(MAX_STUDENT_RATING);
  });
});
