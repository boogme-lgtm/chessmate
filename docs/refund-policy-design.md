# Refund & Dispute Policy — Design Plan (S-REF)

Status: **DESIGN / PROPOSAL** · Author: Claude · Date: 2026-06-15
Owner decisions captured: 24h window · tiered (coach→admin) resolution · coach
no-show fast-track · **anti-abuse is the primary constraint**.

---

## 1. Guiding principle

> **Refunds are exception-based and evidence-gated, never self-serve.**
> The default outcome of every completed lesson is *the coach gets paid.* A
> refund is the rare exception that requires a **strong, categorized reason**
> that warrants investigation. Subjective dissatisfaction ("I didn't find it
> useful") is explicitly **not** refundable — the coach delivered the service.

This directly answers the owner's concern: a loose policy gets gamed and bleeds
the platform + coaches. We hold the line by (a) forcing a category + evidence at
intake, (b) putting the coach in the loop first, (c) reserving cash refunds for
**objective service failures**, and (d) tracking serial refunders.

---

## 2. What already exists (do not rebuild)

The escrow + window machinery is solid and stays:

- **Auto-complete** (`reminderScheduler.autoCompletePastLessons`): `confirmed`/`paid`
  → `completed` at `lesson_end + 1h grace`, sets `issueWindowEndsAt = now + 24h`.
  Coach is paid even if the student never confirms — no ghost-student gap.
- **24h issue window** opens at completion; `lesson.raiseIssue` → `disputed`.
- **Auto-release** (`autoReleasePayouts`, 30-min cron, env-gated): pays the coach
  once the window expires. `disputed` lessons are excluded from
  `getCompletedLessonsReadyForPayout` (status must be `completed`), so **raising
  an issue already pauses payout** — good.
- **Refund execution**: pre-payout `createRefund` (reverses the charge, no platform
  balance needed); post-payout reverse-transfer-then-refund path; all crash-
  recoverable via `recoverStuckPendingStates`.
- **Admin disputes panel** + `admin.disputes.*` (refund / release / post-payout).

### The gaps we are fixing
1. `raiseIssue` takes a **single free-text reason**, no category, no evidence →
   un-triageable and trivially gamed.
2. **Admin-only** resolution → every issue lands on the owner; doesn't scale.
3. **No coach voice** before money moves.
4. **No objective no-show path** (the one clear-cut, high-trust case).
5. **No abuse tracking** on serial-refunder students.

---

## 3. Refund reason taxonomy (the "strong reasons")

Intake forces the student to pick exactly one category. Each has a fixed policy:

| Category | Objective? | Default handling | Evidence |
|---|---|---|---|
| `coach_no_show` — coach never joined / lesson didn't happen | ✅ | **Fast-track**: coach has 24h to rebut with proof; no rebuttal → **full refund** | optional note |
| `coach_late_or_short` — >15 min late or materially shorter | ✅ | Coach responds; admin sets partial/full if upheld | time details |
| `technical_failure` — platform/connection prevented the lesson | ◑ | Investigate; typically full refund or re-schedule | required description |
| `not_as_described` — materially different/misrepresented vs listing | ◑ | Investigate; refund if upheld | required description |
| `quality` — "wasn't useful / didn't like it" | ❌ | **Not refundable by policy.** Surfaced to coach as feedback only; coach *may* refund at their discretion | n/a |

**Anti-gaming core:** `quality` is the gameable category and it is **excluded
from refunds** up front, in the UI copy and in the server policy. Only objective
service failures move money.

---

## 4. Tiered resolution flow

```
Student raises issue (within 24h window)
  │  must pick category + write description (min length); payout already paused
  ▼
Stage 1 — COACH RESPONSE (24h SLA)
  ├─ Accept → refund issued per category (full/partial). Done.
  ├─ Contest (+ coach's account/evidence) → escalate to admin.
  └─ No response in 24h:
        • coach_no_show  → AUTO full refund (objective; silence = no rebuttal)
        • all others     → escalate to admin (silence ≠ auto-cost for subjective)
  ▼
Stage 2 — ADMIN DECISION (24h target SLA)
  ├─ Uphold  → full/partial refund (reuses admin.disputes refund paths)
  └─ Deny    → release payout to coach; dispute closed; counts toward student abuse score
```

Timing keeps the owner's "decide quickly" requirement: worst case ~72h
(24h raise window already elapsed at completion + 24h coach + 24h admin), but the
common objective case (no-show, coach accepts) resolves same-day.

---

## 5. Coach no-show fast-track (the one trust feature)

A dedicated, prominent **"Coach didn't show up"** action, separate from the
generic issue button, because it is the clearest, highest-trust case:

- Student reports no-show → lesson `disputed`, payout paused, dispute row with
  category `coach_no_show`.
- Coach notified immediately; **24h to rebut** (attendance proof / note).
- No rebuttal → **automatic full refund**. Rebuttal → admin (with both sides).
- **Abuse guard:** a student's no-show-claim rate is tracked; repeated claims
  (esp. later contested) flag the account for manual review and suppress future
  auto-refunds.

---

## 6. Anti-gaming mechanisms (the heart of this design)

1. **Mandatory category + description** at intake; vague/empty rejected server-side.
2. **Subjective quality is non-refundable** by policy (UI + server).
3. **Coach-in-the-loop before money moves** for every category except no-show-with-silence.
4. **Per-student abuse score** (computed): dispute rate, refund rate, denied-dispute
   count over trailing N lessons. Thresholds →
   (a) require admin review for all their disputes, (b) disable any future
   no-questions paths, (c) flag for possible suspension.
5. **Evidence trail**: every dispute stores category, descriptions, both parties'
   statements, evidence URLs, decision, actor, timestamps — full audit history.
6. **One dispute per lesson; no re-open** after a terminal resolution.
7. **Coach protection**: contested + denied disputes never affect coach stats;
   admin is final arbiter.
8. **Rate limiting** on raise-issue to prevent spam.

---

## 7. Data model

New `lesson_disputes` table (cleaner than overloading `lessons.status` + a single
reason string, and gives us history + audit):

```ts
lessonDisputes = mysqlTable("lesson_disputes", {
  id, lessonId (FK, unique — one per lesson),
  raisedBy,                       // studentId
  category: enum(coach_no_show, coach_late_or_short, technical_failure,
                 not_as_described, quality),
  description: text,              // required for non-no-show
  evidenceUrls: text (json),      // optional
  status: enum(open, coach_responded, escalated, resolved),
  coachResponse: text, coachRespondedAt: timestamp,
  coachAction: enum(accept, contest) | null,
  resolution: enum(refund_full, refund_partial, denied) | null,
  refundAmountCents: int | null,
  resolvedBy: enum(coach, admin, system) | null, resolvedAt: timestamp,
  createdAt, updatedAt,
});
```

`lessons.status = 'disputed'` stays the gate that pauses payout (already wired).
The dispute row carries the rich state. Abuse score is computed on read from
`lesson_disputes` history (no extra column needed initially).

---

## 8. Phased implementation plan

**Phase 1 — Categorized intake + policy gate** (backend + student UI)
- `lesson_disputes` table + migration.
- Replace `raiseIssue(reason)` with `raiseIssue({category, description, evidence?})`;
  reject `quality` from the refund path (record as feedback only); enforce
  required description for investigatory categories; keep the existing
  `disputed`-pauses-payout behavior.
- Student UI: category picker + guidance copy ("quality alone isn't refundable").
- Tests: each category routes correctly; quality is non-refundable; window enforced.

**Phase 2 — Tiered coach response**
- Coach notification + respond UI (Accept refund / Contest + statement).
- Auto-escalation timers in the scheduler: coach-silence → no-show auto-refund or
  admin escalation per §4.
- Tests: accept→refund, contest→escalate, silence branches, SLAs.

**Phase 3 — Coach no-show fast-track**
- Dedicated student action + coach rebuttal flow; auto-refund on silence.
- Abuse guard counters.

**Phase 4 — Admin resolution upgrades**
- AdminDisputesPanel: show category, both statements, evidence; decision actions
  reuse `admin.disputes` refund/release; SLA surfacing; student abuse flags.

**Phase 5 — Anti-abuse + polish**
- Per-student abuse score + thresholds; dispute history for both roles;
  transactional emails at each stage; full audit trail.

---

## 9. Open questions for the owner
- Abuse thresholds (e.g., "≥3 disputes or ≥40% refund rate in last 10 lessons →
  manual-review-only")? Start conservative, tune from data.
- Partial-refund policy for `coach_late_or_short` — flat 50%, or admin-discretion?
- Do coaches get a "free makeup lesson" option later as a non-cash resolution?
  (Deferred — not selected now, but the schema's `resolution` enum can extend.)
