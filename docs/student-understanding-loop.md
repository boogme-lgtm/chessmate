# The Student Understanding Loop — Architecture

**Author:** Claude (June 2026)
**Status:** Design for review — foundational data-model decision
**Premise (founder):** "A fundamental loop of always digesting data, understanding the user's profile, and using that to deliver the best product. An ongoing, always-improving loop."

---

## 1. The Loop

```
        ┌──────────────────────────────────────────────────────┐
        │                 STUDENT PROFILE                       │
        │   the living digest — level, goals, style, budget,    │
        │   schedule, trajectory, affinities, what's working    │
        └───────▲──────────────────────────────────┬───────────┘
                │ DIGEST (write)                    │ ACT (read)
                │                                   ▼
    ┌───────────┴──────────┐            ┌───────────────────────────┐
    │   SIGNAL SOURCES      │            │     PRODUCT OUTPUTS        │
    │  • 20-Q assessment    │            │  • coach matching (top 3)  │
    │  • lessons taken      │            │  • content recommendations │
    │  • content bought     │            │  • personalized dashboard  │
    │  • reviews / ratings  │            │  • coach-facing insight    │
    │  • chess.com / lichess│            │  • continuous re-matching   │
    │  • progress over time │            └────────────┬──────────────┘
    └───────────▲──────────┘                         │
                │                                     │
                └─────────── FEEDBACK ◄───────────────┘
                  (did the match stick? did the content get used?
                   did the rating move? → refine the profile)
```

Three verbs, one cycle: **Digest → Act → Feedback → (digest again).** The product gets smarter every time a user does anything.

---

## 2. Current reality — the scaffolding is half-built

| Piece | State | Evidence |
|---|---|---|
| `student_profiles` table | **Exists** — skillLevel, current/target rating, chess usernames, primaryGoal, playingStyle, learningStyle, practiceSchedule, XP/streak | `schema.ts:136-164` |
| `student.saveQuizResults` procedure | **Exists but NO client caller** — wired to nothing | `routers.ts:1038-1063` |
| `coach_matches` table (`quizAnswers` + scores) | **Dead** — `createCoachMatch` has zero callers | `schema.ts:350-368`, `db.ts:861` |
| The 20-question assessment | Collects rich signals, **discards 100%** — only email → waitlist; "AI analysis" is a 6s `setTimeout` | `CoachMatchingAssessment.tsx:131-148, 1410-1414` |
| Matching algorithm | **Does not exist** — both quizzes are simulations (one returns hardcoded mock coaches) | `CoachFinderQuiz.tsx:95-132` |
| CoachBrowse personalization | **None** — sorts by averageRating, reads no params, never queries the profile | `CoachBrowse.tsx:100-106` |
| Coach-facing student insight | **Almost none** — roster selects only `currentRating`; `lesson.book` passes only a free-text `topic` | `db.ts:2691-2710`, `routers.ts:1181-1190` |
| Content discovery | **None** — content is per-coach-storefront only; no recommendations | `CoachDetail.tsx:113` |
| Chess rating history | **None** — chess.com/lichess reads are live & stateless; no snapshots, no `rating_history` | `server/lichess.ts`, `routers.ts:1125-1165` |

The matchable dimensions already align in the schema — `studentProfiles.learningStyle` (visual/interactive/analytical/competitive) is the **exact same enum** as `coachProfiles.teachingStyle`. They're simply never compared.

---

## 3. The data model for the digest

Principle: **store the structured digest for querying/matching, AND the raw signal so future digests can re-derive new fields we haven't thought of yet.** Never throw away a signal.

1. **`student_profiles` stays the canonical structured digest** (the queryable enums + ratings). Matching reads these.
2. **Add `assessmentData` (JSON) + `assessmentCompletedAt` + `assessmentVersion`** to `student_profiles` — the full raw 20-answer payload. Preserves the dimensions that don't map to enums (improvementAreas[], budgetMin/Max, availability[], motivations[], styleIcon, feedbackStyle, credentialImportance…). Re-derivable forever.
3. **Anonymous capture** (the stealth demand-capture you favored): the assessment runs on the homepage with no login. Add `assessmentData` (JSON) to the `waitlist` row so a stranger's profile is banked against their email, then **migrated into their `student_profiles` on signup**. Nothing discarded; demand captured during stealth.
4. **Fix `saveQuizResults` to UPSERT** — today `createProfile` returns early if a profile exists (`routers.ts:1051-1055`), so a profile can never be revised. The loop requires the profile to be continuously updatable.
5. **Phase 4 substrate (later):** an append-only `profile_signals` event log (type, payload, ts) + a `rating_snapshots` time series (the missing chess-rating history). The digest recomputes structured fields from accumulated signals — this is the "always improving" engine.

---

## 4. Phased plan

### Phase 1 — CAPTURE (the first writer) ← *start here*
Wire the assessment into the living profile so it stops being discarded.
- Map the 20 answers → `student_profiles` structured fields + store raw `assessmentData`.
- Authenticated user → write to their profile (UPSERT). Anonymous → bank on the waitlist row, migrate on signup.
- Keep the waitlist gate (stealth) — this is additive demand capture, not a launch change.
- **Value now, zero coaches needed.** Stops the flagship feature from throwing away every visitor.

### Phase 2 — ACT (first output): real matching
- A pure, transparent `scoreCoachForStudent(coach, profile) → {score, reasons[]}` — weighted across aligned dimensions (learningStyle↔teachingStyle, improvementAreas↔specialties, rating-level fit, budget↔rate, availability overlap, credential preference↔title). Rules first, not a black box; ML can slot behind the same interface later.
- Persist results to `coach_matches` (revive it). Route assessment → real ranked top-3; add "Best match for you" to CoachBrowse.
- Works at any supply level — with one coach (Cristian) it returns Cristian, scored honestly.

### Phase 3 — ACT (more outputs): recommendations & insight
- **Content recommendations** — rank the existing `content.list` against profile goal/level → a "Made for you" dashboard module (delivers the on-demand-content pillar we just shipped in copy).
- **Personalized dashboard** — replace the static new-student panel with profile-driven next-best-action + suggested coaches/content.
- **Coach-facing student insight** — extend `getStudentRoster` SELECT + `lesson.book` to carry goals/level/style, so coaches actually know who they're teaching → better lessons.

### Phase 4 — FEEDBACK (close the loop): outcomes refine the profile
- Ingest completed lessons, content used, reviews, and **rating snapshots over time** (the missing time series) into the `profile_signals` log.
- A recompute step updates the digest (trajectory, what's working, affinity) and re-ranks matches/recs. This is what makes it *always improving*.

---

## 5. Why this order

Each phase ships standalone value and de-risks the next:
- Phase 1 captures data immediately (works in stealth, no coaches).
- Phase 2 turns the captured data into the headline feature (real matching) — testable with one coach.
- Phase 3 spreads the profile to every surface (student + coach).
- Phase 4 makes it self-improving.

We never build a throwaway: Phase 1's data model is the same store Phase 4 keeps refining.
