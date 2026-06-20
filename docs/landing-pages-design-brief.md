# Design Brief — Coach & Student Landing Pages

**For:** Claude Design (claude.ai/design), built on the synced BooGMe component kit.
**Goal:** Two dedicated, persona-focused landing pages — one **student**, one **coach** — that convert first-time visitors and feel **indistinguishable from the existing `Home.tsx`** in voice, aesthetic, and layout.

> **Canonical source of truth: `client/src/pages/Home.tsx`.** A deep analysis found the codebase contains *two* design dialects. `Home.tsx` is the current "Editorial Cream + Ember" system. `Coaches.tsx` (`/for-coaches`) is a **legacy "Palantir" dialect** that is off-system in copy (Title Case, exclamation points), visuals (uses the *undefined, no-op* `.palantir-card`, off-token colors, old motion easing), and layout (centered shadcn cards). **Match Home.tsx. Do NOT mimic Coaches.tsx** — the new coach page should pull that page *onto* the house style.

---

## 1. Voice & tone (match exactly)

Modern, sleek, straight to the point. Confident, precise, a little literary — a serious chess publication, not a SaaS template. Sell by naming the pain and stating concrete facts, never by hype.

**Rules:**
1. **Sentence case everywhere** — headlines, buttons, eyebrows, all of it. Only `BooGMe` and proper nouns capitalize. (No Title Case — that's the legacy dialect.)
2. **No exclamation points** in headline/body copy. Restraint is the brand. (Toasts are the only exception, and not on landing pages.)
3. **Short, declarative, fragment-friendly.** Stack 2–3 sentence fragments with hard periods.
4. **The triad is the signature rhythm** — three short beats building to a payoff: `20 questions. 8 minutes. One perfect match.`
5. **Em-dashes carry longer sentences** — pivot on `—`, not semicolons/commas.
6. **Concrete nouns and numbers over adjectives.** `Send a stranger $60 on Venmo`, `From $38 per lesson`, `0% platform fee until $100` — not "affordable," "seamless," "world-class."
7. **Name the ugly status quo by name** — Venmo, Discord recs, a YouTube channel, ad spend, "the big sites take a cut."
8. **POV:** "you/your" to the reader; "we" for the company; "I" only in the founder's voice (GM Cristian Chirila).
9. **Chess-literate, never gatekeeping** — use real terms (FIDE, endgames, openings, Lichess), then say why they matter in plain words.
10. **Numbered mono eyebrows** above each section: `01 — pay after you learn`, `02 — the problem`, …
11. **Trust microcopy joined with ` · `**: `No signup · No card required`.
12. **CTAs are verb-first imperatives**; inline/secondary CTAs take a trailing ` →`.
13. **Honest, anti-hype, pre-launch-aware.** The codebase literally mandates "no fabricated metrics, no fake testimonials." Honor it.

**Verbatim exemplars to echo (from the live site):**
- Hero H1 style: `Pay your coach after the lesson.`
- Hero lede style (serif): *"AI matches you to a vetted coach in 8 minutes. Money sits in escrow until you've actually learned something. From $38 per lesson."*
- Eyebrows: `01 — pay after you learn`, `03 — how it works`, `05 — for coaches`
- Triad headline: `20 questions. 8 minutes. One perfect match.`
- CTAs: `Find your coach`, `Take the 8-minute quiz`, `Start the quiz →`, `Book a trial lesson →`, `Apply as a founding coach →`
- Trust lines: `No signup · No card required`, `You won't be charged until the lesson ends`
- Founder voice: *"I've coached at the highest level. I built this for everyone below it."*

**DON'T:** Title Case; exclamation points; invented metrics/testimonials; adjective piles; long comma-spliced paragraphs; jokey/hypey tone; burying the price or the escrow protection.

---

## 2. Visual language (match exactly)

Flat, hairline, editorial. **No glows, no gradients on CTAs, no drop shadows.** Structure is drawn with thin rules and `gap-px` dividers, not heavy cards. Generous whitespace. Restrained ember accent.

**Color tokens** (CSS custom properties; Tailwind v4, **no `tailwind.config`** — utilities resolve from CSS vars. Dark is the default theme):
| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#0F1419` | base page bg (dark sections) |
| `--color-ink-deep` | `#151B22` | deep surface |
| `--color-ink-raised` | `#1A2230` | raised cards/mockups |
| `--color-bone` (`#F4EFE6`) / cream `#F5F1E4` | text on dark |
| `--color-bone-muted` `#7A8290` (and one-off `#A89F8A` for body on dark) | secondary text |
| `--color-ember` | `#E8633A` | the single accent — primary CTAs, active states, the match-score number, 22% selection tint. Use sparingly. |
| `--color-cream` `#F5F1E4` / `--color-cream-deep` `#EFEAD8` | light-section backgrounds |
| semantic `safe/signal/match` | green/gold/iris | **meaning only**, never decorative |

**Typography:**
- **Display/body:** Inter. **Light (300) is the heaviest display weight** — `font-thin`/`font-extralight`/`font-light` all render at 300; never use bold for big headlines. Negative tracking tightens as size grows.
  - `h1`: `clamp(40px,7vw,92px)`, 300, `-0.025em`, line-height 0.96
  - `h2`: `clamp(32px,5vw,56px)`, 300, `-0.02em`, line-height 1.05
- **Serif (Source Serif 4):** the `.lede` intro paragraph (`clamp(17px,1.6vw,20px)`, 78% foreground) and italic pull-quotes.
- **Mono (JetBrains Mono):** `.eyebrow` (11px, uppercase, 0.14em), `.mono-label` (10px, 0.16em), and `.stat-number` (300, tabular, tight).

**Signature classes (use these; quoted defs available in `index.css`/`styles/glass.css`):**
- `.eyebrow` / `.mono-label` — numbered/section kickers.
- `.lede` — serif intro paragraph.
- `.stat-number` — large figures.
- `.editorial-card` / `.surface-flat` — flat hairline card (`background:--surface; border:1px --line; radius:8px`; hover = quiet border-brighten). **Do NOT use `.palantir-card` — it has no CSS and does nothing.**
- `.btn-editorial-primary` — flat ember fill, 1px primary border, radius 8px, weight 500, hover `opacity .92`, active `translateY(1px)`. (This is the primary CTA on Home.)
- `.btn-editorial-ghost` — transparent, hairline border, hover border→foreground + 5% wash.
- `.editorial-input(.with-icon)` — transparent, hairline, focus → primary border + 4% tint (no glow).
- `.editorial-pill` — bordered mono uppercase chip (radius 999px).
- `.mesh-bg` / `.mesh-bg-animated` — three soft blurred radial ember/iris blobs over the page bg, drifting on 22–28s loops. **Reserve for the hero and the closing/waitlist sections only.**
- `.precision-grid` — faint 80px editorial grid with a radial edge mask (optional decorative overlay).

**Radii:** 8px base (`--radius`), 4px (`rounded-sm`) for small chips/mockups. Tight, never pill-shaped (except `.editorial-pill`).

**Motion (use Home's canonical tokens verbatim):**
```ts
const fadeIn = { hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.2,0.7,0.2,1] } } };
const staggerContainer = { hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
```
Pattern: each section is `<motion.div initial="hidden" whileInView="visible" viewport={{once:true,margin:"-100px"}} variants={staggerContainer}>` with children `variants={fadeIn}`. The **hero** uses `animate="visible"` (fires on load). Honor `prefers-reduced-motion` (the system disables mesh/shimmer/reveal under it).

---

## 3. Layout system & section archetypes

- **Container:** `.container` (max-width 1400px, gutters 24→32→64px) wraps every section's inner content.
- **Vertical rhythm:** full sections `.section` (`py-24 md:py-32 lg:py-40`); dark sections use the tighter `py-20 md:py-28`. Heroes `min-h-[85vh]`. This escalating padding is what creates the airy, sleek feel.
- **The page spine = alternating backgrounds:** mesh hero → light/cream strip → **dark ink** section → light section → dark → … → mesh waitlist → light → cream closing → dark footer. Alternation is the rhythm; lean on it.
- **Responsive collapse:** every grid is `grid-cols-1` at base, expanding at `sm`/`md`/`lg`. Two-column heroes/sections collapse below `lg`; `lg:sticky` headline rails unpin on mobile; CTA rows `flex-col → sm:flex-row`; nav links hide behind a `md:hidden` hamburger.

**Archetypes to build from (canonical = Home):**
1. **Two-column mesh hero** — `mesh-bg mesh-bg-animated min-h-[85vh]`, `grid lg:grid-cols-[1fr_auto]`; left = eyebrow → thin `h1` → serif lede → CTA row (`.btn-editorial-primary` + `→`, then `.mono-label`) → inline stat strip; right = a product mockup. `animate="visible"`.
2. **Inline stat bar** — `grid grid-cols-2 sm:grid-cols-4 gap-px border-t border-b border-border`; cells `bg-background py-6 px-4` with `.stat-number text-3xl font-light` + `.mono-label`.
3. **Dark sticky-headline two-column** — `py-20 md:py-28` on `var(--color-ink)` w/ cream text; `grid lg:grid-cols-[1fr_1.2fr]`; left copy `lg:sticky lg:top-32` with ember eyebrow + `h2`; right = numbered list (`border-t` hairlines `rgba(245,241,228,0.12)`) or a bordered mockup.
4. **Hairline feature grid** — header `grid md:grid-cols-[1fr_380px] items-end`; then `grid sm:grid-cols-2 lg:grid-cols-4 border-t border-border`, cells `p-6 md:p-8` with `lg:border-l`/`border-t` dividers, each = mono number + lucide icon (`w-4 h-4 strokeWidth={1.5}`) → `h3` → `text-sm muted`.
5. **Filled card grid** — `grid md:grid-cols-2 lg:grid-cols-3 gap-6` of `.editorial-card p-6 space-y-4` (icon + title + body); optional `featured` card inverts to cream fill.
6. **Step sequence** — `max-w-3xl mx-auto space-y-8`, each step `flex items-start gap-6`: circular icon badge (`w-12 h-12 rounded-full bg-primary/10 border border-primary/20`) + mono number + title + body.
7. **Interactive widget card** — a bordered card with live controls (e.g. the earnings calculator's sliders) + a result region + primary CTA; pull real figures from `@shared/pricing`.
8. **Pull-quote / belief block** — `max-w-[980px] mx-auto text-center`, eyebrow → `font-serif italic text-[28px] md:text-[36px]` → attribution.
9. **Narrow founding/waitlist card** — on `mesh-bg mesh-bg-animated section`, `max-w-[520px]` `.editorial-card` with `.editorial-input.with-icon` + radios + full-width `.btn-editorial-primary` (Loader2 when pending). Wire to tRPC `waitlist.join`.
10. **Closing CTA** — `py-32 text-center` on `bg-[var(--color-cream)] dark:bg-[var(--color-ink-raised)]`, two stacked `text-5xl md:text-[64px] font-light` headlines (second `text-primary`) + one `.btn-editorial-primary →`.
11. **Footer** — dark, `grid md:grid-cols-[1fr_auto]`, mono uppercase column headers, hairline top rule + copyright row.

---

## 4. STUDENT landing page

**Audience:** an adult improver (~800–2000) deciding if real coaching is worth it. **One job:** get them to **find a coach**.
**Primary CTA:** `Find your coach` → `/coaches`. **Secondary:** `Create an account` → `/register`.
> The match quiz exists but currently dead-ends (S2 is a separate sprint). You may include a `Take the 8-minute quiz →` entry, but for now wire it to `/coaches`. Don't make the quiz the only path.

**Section flow (archetype → content):**
1. **Hero** (arch 1) — eyebrow `01 — pay after you learn`; H1 `Pay your coach after the lesson.`; serif lede about AI match in 8 min + escrow + `From $38 per lesson`; primary `Find your coach` + `.mono-label` `No signup · No card required`; right = a coach-match or escrow mockup.
2. **Inline stat bar** (arch 2) — real product facts as stats: `0%` *platform fee until $100*, `1h` *cancellation window*, `8min` *match assessment*, `escrow` *until you've learned*. (These are real, not social-proof — fine to use.)
3. **The problem** (arch 3, dark) — eyebrow `02 — the problem`; `Chess coaching is broken in three ways.`; three numbered beats (pay-first-and-hope; pick-blind; coaches lose a cut and leave).
4. **How it works** (arch 4) — eyebrow `03 — how it works`; 3–4 cells: escrow-held payment; find a vetted coach; book a lesson; track your progress.
5. **Why it's protected** (arch 5 or 6) — feature the **escrow + dispute/refund** trust story; this is the #1 conversion lever — `You won't be charged until the lesson ends.`
6. **What you get beyond lessons** (arch 5) — content library + custom content requests (commission analysis/training) + progress tracking (rating, chess.com/Lichess).
7. **Coach preview strip** (arch 5, optional) — a few example coach cards linking to `/coaches` to make supply tangible.
8. **Belief / founder quote** (arch 8) — the "coaching shouldn't end when the lesson does" principle.
9. **Founding cohort capture** (arch 9, secondary) — keep the brand's founding-class email capture, clearly framed as optional ("Not ready to book? Join the founding class"). Not the primary path.
10. **Closing CTA** (arch 10) — restate `Find your coach`.
11. **Footer** (arch 11) with a cross-link: `Are you a coach? →`.

---

## 5. COACH landing page

**Audience:** a strong player / coach (often titled, 2000+) weighing BooGMe vs. elsewhere — cares about earnings, control, reliable payouts. **One job:** start the self-serve onboarding.
**Primary CTA:** `Apply as a founding coach →` / `Start earning` → `/coach/onboarding` (the ~8-min self-serve wizard; no approval gate).

**Section flow:**
1. **Hero** (arch 1) — eyebrow `01 — keep more of what you earn`; H1 (Home-voice, sentence case) e.g. `Coach chess. Keep more of what you earn.`; serif lede: `No payment details until you earn $100. AI-matched students. Escrow protection for both sides.`; primary `Start earning →` + `.mono-label` `Set your rate · Go live in minutes`; right = the coach-dashboard mockup (reuse Home's `CoachDashboardPreview` styling).
2. **Earnings calculator** (arch 7) — keep this (it's the coach hook), **rebuilt to the editorial system** (hairline card, ember `.stat-number`, sliders) and pulling fees from `@shared/pricing`. Place it high.
3. **Why coach here** (arch 5) — set your rate / keep more (pricing tiers); **earn-first** (go live now, connect payouts later); secure escrow payouts; sell content beyond the lesson hour.
4. **How it works** (arch 4 or 6) — build your profile → set rate & availability → go live & get booked → get paid.
5. **More than lessons** (arch 5) — the storefront (courses/videos/PGN/bundles), student-only content, paid custom requests, tips, subscriptions, referrals.
6. **FAQ** (arch 6 styling, sentence-case questions) — fees, payouts, requirements, when/how you get paid, exclusivity. Reuse the real FAQ content, rewritten to Home voice (sentence case, no exclamations).
7. **Founder credibility** (arch 8) — GM Cristian Chirila's first-person note.
8. **Closing CTA** (arch 10) — `Start earning today →` → `/coach/onboarding`.
9. **Footer** (arch 11) with cross-link: `Looking for a coach? →`.

---

## 6. Honesty guardrails & content policy

- **No dead-end CTAs.** Every button points at a real route — student: `/coaches`, `/register`, `/sign-in`; coach: `/coach/onboarding`, `/sign-in`. The quiz routes to `/coaches` until S2 ships.
- **No fabricated metrics or testimonials** (the codebase mandates this). Social-proof numbers (coach count, lessons delivered) and testimonials must be **clearly-marked placeholders** — e.g. a visibly templated card labeled *"[Placeholder — testimonial pending launch]"* — never invented quotes or fake counts. *Real* product facts (`0% until $100`, `from $38`, `8 minutes`, `1h cancellation`, escrow) are fine to state.
- **Positioning:** primary CTAs drive the **live** flows; retain a founding/waitlist email capture as a clearly **secondary** section so the pages still feel like Home without being dead-ends. (Flag for owner: confirm if you'd rather drop the waitlist entirely.)
- **Don't invent features** (no "schedule a demo," app-store badges, integrations we don't have).

---

## 7. Deliverable & integration

Two full, responsive pages (Student, Coach) built from the synced BooGMe kit and tokens, in the Home.tsx editorial system. I'll then integrate them as real routes (student → `/` or `/for-students`; coach → replacing the legacy `/for-coaches`), wire every CTA to the routes above, swap placeholder social-proof for clearly-marked placeholders, then verify (tsc + build + tests) and Opus-review before ship.
