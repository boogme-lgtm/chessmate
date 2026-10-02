// Read the original answers, not derived profile columns: mapping fills missing
// columns with defaults, which must never be presented as answers the user gave.
export function readSavedAssessment(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

const labels: Record<string, Record<string, string>> = {
  primaryGoal: { rating: "Reach a specific rating target", competitive: "Competitive success", understanding: "Deep understanding", enjoyment: "Enjoyment", coaching: "Become a coach", intellectual: "Intellectual challenge" },
  teachingArchetype: { sage: "The Chess Sage", master: "The Disciplined Master", guide: "The Supportive Guide", innovator: "The Creative Innovator", coach: "The Motivational Coach" },
  lessonFrequency: { intensive: "3+ times per week", regular: "Twice per week", weekly: "Once per week", biweekly: "Every two weeks", flexible: "As needed for tournaments/events" },
  lessonFormat: { online: "Online only", inperson: "In-person only", hybrid: "Hybrid", flexible: "Flexible" },
  credentialImportance: { gm: "Very important (Grandmaster)", titled: "Prefer titled", somewhat: "Somewhat important", teaching: "Teaching matters more", notimportant: "Not important" },
  styleIcon: { tal: "Mikhail Tal", petrosian: "Tigran Petrosian", carlsen: "Magnus Carlsen", kasparov: "Garry Kasparov", fischer: "Bobby Fischer", karpov: "Anatoly Karpov", polgar: "Judit Polgar", mixed: "Not sure / Mix of styles" },
  ratingSystem: { fide: "FIDE", lichess: "Lichess", chesscom: "Chess.com", unrated: "Unrated" },
};

function answer(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (Array.isArray(value)) {
    const strings = value.filter((v): v is string => typeof v === "string" && !!v.trim());
    return strings.length ? strings.join(", ") : null;
  }
  if (typeof value === "string" && value.trim()) {
    const choices = Object.hasOwn(labels, key) ? labels[key] : undefined;
    const label = choices && Object.hasOwn(choices, value) ? choices[value] : undefined;
    return typeof label === "string" ? label : value;
  }
  return null;
}

export function savedMatchingPreferences(raw: string | null | undefined) {
  const data = readSavedAssessment(raw);
  const rows = [
    ["Primary goal", answer(data, "primaryGoal")],
    ["Improvement areas", answer(data, "improvementAreas")],
    ["Teaching preference", answer(data, "teachingArchetype")],
    ["Playing inspiration", answer(data, "styleIcon")],
    ["Coach credentials", answer(data, "credentialImportance")],
    ["Lesson frequency", answer(data, "lessonFrequency")],
    ["Lesson format", answer(data, "lessonFormat")],
    ["Timezone", answer(data, "timezone")],
    ["Preferred times", answer(data, "availability")],
  ];
  const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  rows.push(["Rating answer", validNumber(data.rating)
    ? `${data.rating} (${answer(data, "ratingSystem") ?? "rating system not saved"})` : null]);
  rows.push(["Budget answer", validNumber(data.budgetMin) && validNumber(data.budgetMax) && data.budgetMax >= data.budgetMin
    ? `$${data.budgetMin}\u2013$${data.budgetMax} (saved range; pricing not verified)` : null]);
  return rows.map(([label, value]) => ({ label: label!, value: value ?? "Not saved" }));
}
