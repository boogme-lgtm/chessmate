import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapAssessmentToProfile } from "@shared/assessmentMapping";
import StudentMatchingPanel, { EditSavedAnswers } from "./StudentMatchingPanel";

const { profileQuery, mutation } = vi.hoisted(() => ({
  profileQuery: { current: {} as Record<string, unknown> },
  mutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    student: {
      getProfile: { useQuery: () => profileQuery.current },
      saveQuizResults: { useMutation: mutation },
    },
    match: {
      getMatchedCoaches: { useQuery: () => ({ refetch: vi.fn(), isFetching: false, isPaused: false }) },
      generateMatches: { useMutation: mutation },
    },
    waitlist: { join: { useMutation: mutation } },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 901, userType: "student" } }) }));
vi.mock("wouter", () => ({ Link: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));

// Saved before the dashboard rating moved: the stored answer still says 1400.
const drifted = { ...mapAssessmentToProfile({ rating: 1400, ratingSystem: "lichess", lessonFormat: "online" }), currentRating: 1650 };

beforeEach(() => {
  profileQuery.current = { data: drifted, isSuccess: true, isFetching: false, isPaused: false, isPending: false, isError: false, dataUpdatedAt: 1, refetch: vi.fn() };
});

describe("saved matching preferences read the profile's current rating", () => {
  it("lists the current rating, not a stale saved answer", () => {
    const html = renderToStaticMarkup(createElement(StudentMatchingPanel));
    expect(html).toContain("1650 (Lichess)");
    expect(html).not.toContain("1400");
  });

  it("regression: the panel's edit view prefills the current rating from the profile", () => {
    const html = renderToStaticMarkup(createElement(EditSavedAnswers, { profile: drifted, onClose: () => {}, onSaved: async () => {} }));
    expect(html).toContain("Edit matching answers");
    expect(html).toMatch(/>1650</);
    expect(html).toContain("Advanced");
    expect(html).not.toContain("1400");
  });
});
