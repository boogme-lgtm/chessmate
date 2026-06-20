# Design Brief — Coach & Student Landing Pages

**For:** Claude Design (claude.ai/design), built on the synced BooGMe component kit
**Goal:** Two dedicated, persona-focused landing pages — one for **students**, one for **coaches** — that convert first-time visitors, match the existing brand exactly, and route only into flows that actually exist.

---

## 0. Why this exists / current state

Today the funnel is muddled. `Home.tsx` (`/`) is a *mixed* marketing page that talks to both students and coaches at once (it has a hero, a coach-matching quiz, a coach-dashboard preview, pricing, AND a waitlist). `Coaches.tsx` (`/for-coaches`) is a coach-oriented page but is positioned as a closed "stealth waitlist."

We want to split this into **two clean, single-audience pages**, each with one obvious primary action, so a visitor immediately knows "this is for me" and what to do next.

- **Student landing** → primary action: **find a coach** (`/coaches`) / create an account (`/register`).
- **Coach landing** → primary action: **start earning** (`/coach/onboarding` — the self-serve wizard).

> Routing is finalized at integration. Likely: student landing becomes `/` (or `/for-students`), coach landing stays `/for-coaches`. Design both as standalone full pages.

---

## 1. Brand & design system (match exactly)

This is a **dark, editorial, premium** aesthetic — think a serious chess publication, not a generic SaaS template. Restraint, whitespace, and typographic hierarchy do the work; color is used sparingly.

**Color tokens (use these names/values):**
| Token | Value | Use |
|---|---|---|
| `ink-deep` | `#151B22` | page background |
| `ink-raised` | `#1A2230` | cards, raised surfaces |
| `bone` | `#F4EFE6` | primary text |
| `bone-muted` | `#7A8290` | secondary text, labels |
| `ember` | `#E8633A` | the single accent — CTAs, highlights, active states. Use sparingly; it should feel earned. |
| border | subtle `border/20`–`border/30` hairlines | dividers, card edges |

**Typography:**
- **Display/UI:** Inter (`--font-display`). Headings use a **light** weight as the heaviest display weight (300 / `font-thin`/`font-extralight` resolve to 300) — large, thin, tight tracking. This is signature: big thin headlines, not bold.
- **Serif:** Source Serif 4 (`--font-serif`) — for `.lede` paragraphs (the intro sentence under a headline) and editorial pull-quotes.
- **Eyebrow:** JetBrains Mono (`.eyebrow`) — 10px, uppercase, letter-spacing 0.16em, muted. Used as small numbered/section kickers above headings (e.g. `01 — How it works`).
- **Numbers/stats:** `.stat-number` — mono, light, tabular, tight tracking (used for prices, rating numbers, earnings).

**Signature classes / patterns to reuse:**
- `.section` / `.section-sm` — vertical rhythm for page sections.
- `.container` — max-width content column.
- `.btn-primary` — primary CTA (ember). `.btn-editorial-primary` — the editorial primary used in onboarding.
- `.palantir-card` — the card treatment used on `/for-coaches`.
- `.lede` — serif intro paragraph.
- `.eyebrow` — section kickers.
- `mesh-bg mesh-bg-animated` — the animated mesh gradient used behind heroes. Reserve for hero / closing CTA only.
- Motion: subtle `framer-motion` fade/stagger on scroll (`fadeIn`, `staggerContainer` patterns already in `Coaches.tsx`). Tasteful, not bouncy.
- `rounded-sm` corners throughout (this brand uses tight radii, not pill shapes).

**Tone of voice:** confident, precise, a little literary. Short declarative headlines. No exclamation-point hype, no "🚀 supercharge". Chess-literate but not gatekeeping.

---

## 2. STUDENT LANDING PAGE

**Audience:** an adult chess improver (rating ~800–2000) who wants real coaching, not just puzzles. They're evaluating whether this is worth their money and time.

**One job:** get them to **find/choose a coach** and create an account.

**Primary CTA:** "Find your coach" → `/coaches`. **Secondary:** "Create an account" → `/register`.
> Note: a coach-matching quiz exists but currently dead-ends (a fix is a separate sprint). You may design a "Take the 2-minute match quiz" entry, but for now its button should route to `/coaches`. Don't make the quiz the *only* path.

**What students actually get (use for value props — all of this is built and real):**
- Browse and book lessons with vetted coaches (filter by rating, price, specialty).
- **Escrow protection** — payment is held securely and only released after the lesson; disputes/refunds supported. (This is a major trust point — feature it.)
- A personal **content library** — buy courses, videos, PGN packs from coaches; download anytime.
- **Custom content requests** — commission tailored analysis or training from a coach (quote → pay → delivery), Fiverr-style.
- **Progress tracking** — rating over time, with chess.com / Lichess integration.

**Suggested section flow:**
1. **Hero** (mesh-bg): big thin headline (e.g. *"Real coaching. Real rating gains."*), a serif `.lede` subhead, primary "Find your coach" CTA + secondary "Create an account". Optionally a small trust line (e.g. "Vetted titled coaches · Secure escrow payments").
2. **Social proof bar** — ratings, # of coaches, lessons delivered (use `.stat-number`). Keep numbers honest/placeholder-flagged.
3. **The problem / why BooGMe** — short editorial block: generic tutoring vs. structured coaching with accountability.
4. **How it works (3 steps)** — numbered `.eyebrow` steps: Find your coach → Book a lesson (escrow-protected) → Track your progress.
5. **Feature highlights** — 3–4 cards: vetted coaches; escrow-protected payments; content library; progress/rating tracking.
6. **Coach preview strip** — a few example coach cards (reuse the coach-card visual from `CoachBrowse`) to make supply tangible, linking to `/coaches`.
7. **Testimonial(s)** — editorial pull-quote treatment (serif).
8. **Closing CTA** (mesh-bg) — restate "Find your coach".
9. **Footer** (shared).

---

## 3. COACH LANDING PAGE

**Audience:** a strong player / existing coach (often titled or 2000+) deciding whether to teach on BooGMe vs. elsewhere. They care about earnings, control, and getting paid reliably.

**One job:** get them to **start the self-serve onboarding** and go live.

**Primary CTA:** "Start earning" / "Become a coach" → `/coach/onboarding`. (The wizard is ~8 minutes, self-serve, no approval gate.)

**What coaches actually get (real, built features):**
- **Set your own rate** and keep more of it — pricing tiers (free / pro / elite) with different platform-fee percentages.
- **Earn-first model** — go live and start getting booked immediately; connect Stripe to withdraw whenever you're ready (not a blocker to launch).
- **Secure payouts via escrow + Stripe Connect** — students pay upfront, funds are protected, you get paid after lessons.
- **A storefront** — sell content (courses, videos, PGN packs, bundles), offer student-only material, and fulfill paid custom content requests.
- **Tips, subscriptions, and referrals** — additional income streams.
- **A real dashboard** — earnings, lessons, students, inbox, content, reviews, profile.

**Reusable existing elements worth keeping** (already on `/for-coaches`): the **earnings calculator** (interactive — rate × lessons/week → projected income; very effective) and a **how-it-works** sequence. Redesign them to the spec, don't discard them.

**Suggested section flow:**
1. **Hero** (mesh-bg): big thin headline (e.g. *"Coach chess. Keep more of what you earn."*), serif `.lede`, primary "Start earning" CTA. Trust line ("Set your rate · Get paid securely · Go live in minutes").
2. **Earnings calculator** — interactive, ember-accented, `.stat-number` for the projected figure. This is the hook for coaches; place it high.
3. **Why coach here** — 3–4 cards: set your rate / keep more; earn-first (go live now, connect payouts later); secure escrow payouts; sell content beyond 1:1 lessons.
4. **How it works (steps)** — numbered: Build your profile → Set rate & availability → Go live & get booked → Get paid.
5. **Storefront / extra income** — short section showing the content storefront + custom requests as additional revenue.
6. **FAQ** — fees, payouts, requirements, how/when you get paid (reuse/refresh existing FAQ).
7. **Closing CTA** (mesh-bg) — "Start earning today" → `/coach/onboarding`.
8. **Footer** (shared).

---

## 4. Shared requirements

- **Responsive:** mobile-first; heroes and multi-column grids collapse cleanly to single column. Test ~375px, ~768px, ~1280px.
- **Navigation:** shared top nav (logo, links, sign-in, primary CTA). The CTA in the nav should match the page's persona (student page → "Find your coach"; coach page → "Become a coach").
- **Footer:** shared, with cross-links so a coach on the student page can find the coach page and vice-versa ("Are you a coach? →").
- **Accessibility:** sufficient contrast (bone on ink passes; ember-on-ink for large text/CTAs only), focus states, semantic headings, alt text.
- **Motion:** subtle scroll-reveal (fade/stagger). Never block content on animation; respect reduced-motion.
- **No dead ends:** every CTA must point at a real, existing route — student: `/coaches`, `/register`, `/sign-in`; coach: `/coach/onboarding`, `/sign-in`. Do **not** invent flows (no "schedule a demo", no app-store badges, no features we don't have).

---

## 5. Out of scope (so the design stays honest)

- The coach-matching quiz's *results→matched-coaches* wiring (separate sprint) — design an entry point but route it to `/coaches` for now.
- Any "waitlist / stealth mode" framing — we're live and self-serve now; design for action, not waitlisting.
- Pricing-table redesign for students (students don't pay a platform subscription; they pay per lesson/content). Coach pricing *tiers* can appear on the coach page if useful.

---

## 6. Deliverable from Claude Design

Two full, responsive page designs (Student, Coach) built from the synced BooGMe components and tokens, ready for me to integrate as real routes — wiring the CTAs to the routes above, replacing placeholder stats/testimonials with real or clearly-marked-placeholder content, then verifying (tsc + build + tests) and Opus-reviewing before ship.
