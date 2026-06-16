# S-BROWSE-1: Coach Marketplace Page — Exotic Redesign

**Sprint goal:** Transform `/coaches` from a plain card grid into a premium sports-talent marketplace that instantly signals which coaches have strong profiles vs. sparse ones.

**File to rewrite:** `client/src/pages/CoachBrowse.tsx` (207 lines → ~450 lines)
**No backend changes.** All data comes from `trpc.coach.listActive.useQuery()`.

---

## Design Direction

Dark background (`bg-background`, `#0a0a0a`). Orange accent (`hsl(24, 100%, 45%)`) for highlights only. Bold editorial typography — large names, tight spacing. Sharp edges — no rounded card borders (use `rounded-sm` at most). Think Transfermarkt meets a high-end coaching platform.

---

## Page Structure

### 1. Hero bar (full-width, compact)
- Headline: `"Find Your Chess Coach"` — large, bold, left-aligned
- Subline: `"Vetted coaches. Escrow-protected payments. Pay after the lesson."` — muted, smaller
- Right side: filter pills — `All` · `GM/IM` · `Under $100` · `Openings` · `Endgames` · `Tactics` — clicking filters visible cards client-side
- Coach count badge: `"X coaches available"` — small, muted, updates with filters

### 2. Sort bar (thin row below hero)
- `Sort by:` — `Top Rated` (default) · `Price: Low to High` · `Most Lessons` · `Newest`
- Right side: Grid view / List view toggle (icon buttons)

### 3. Coach cards — two layouts

#### Grid view (default, 2-column desktop, 1-column mobile)
Each card is a **horizontal split**: left third = photo/avatar, right two-thirds = info. NOT a vertical stack.

**Left panel:**
- Coach photo (`profilePhotoUrl ?? avatarUrl`) — fills left panel, `object-cover`, no border radius
- Colored overlay at bottom of photo: title badge (GM/IM/FM etc.) in orange on dark — large and prominent
- If no photo: dark panel with large initials centered

**Right panel:**
- Name — large, bold, white
- FIDE rating — `"2506 FIDE"` with small trophy icon, orange text (omit if not set)
- One-line bio excerpt — max 80 chars, muted, italic — from `users.bio` (omit if empty)
- **Profile completeness signal** — horizontal row of 4 dots: Photo · Bio · Video · Availability — filled orange if present, grey if missing. This is the key "at a glance" signal.
- Specialties — 2–3 pill badges max (from `JSON.parse(profile.specialties)`)
- Stats row — `★ 4.9` · `12 lessons` · `8 students` — compact, inline
- Price — `$150/hr` — large, right-aligned, white
- CTA — `"View Profile →"` — text link style, orange, right-aligned. No big button.

#### List view (single column, toggle)
- Wider layout, same data but more horizontal breathing room
- Show up to 5 specialties, full first sentence of bio (up to 120 chars)

### 4. Profile strength visual treatment
This is the most important new concept:

- **Full profile** (photo + bio + video + isAvailable): card has a faint orange left border (2px `border-l-2 border-orange-600`) and 4 filled orange dots
- **Partial profile** (photo + bio, missing video or availability): 2–3 filled dots, no border accent
- **Sparse profile** (no photo, no bio): card rendered at `opacity-75` — subtle "not ready yet" signal without being harsh

**Completeness scoring (frontend only, no extra queries):**
```ts
const completeness = {
  photo: !!(profile.profilePhotoUrl || user.avatarUrl),
  bio: (user.bio?.length ?? 0) > 20,
  video: !!profile.videoIntroUrl,
  availability: profile.isAvailable === true,
};
const score = Object.values(completeness).filter(Boolean).length; // 0–4
```

### 5. Empty state
Full-width centered panel: `"No coaches match your filters"` with a reset filters button. Not a card.

### 6. Loading skeleton
Match the new horizontal card layout — left panel shimmer + right panel lines.

---

## Data available per coach card (from `listActive`)
```ts
// users
id, name, avatarUrl, bio

// coach_profiles
title, fideRating, hourlyRateCents, averageRating, totalLessons, totalStudents,
specialties (JSON string → string[]), languages (JSON string → string[]),
teachingStyle, experienceYears, isAvailable, profilePhotoUrl, videoIntroUrl
```

---

## Filtering logic (client-side, no new procedures)
```ts
// Filter functions
const filters = {
  "GM/IM": (c) => ["GM", "IM"].includes(c.coach_profiles.title),
  "Under $100": (c) => (c.coach_profiles.hourlyRateCents ?? 0) < 10000,
  "Openings": (c) => parseSpecialties(c).includes("Openings"),
  "Endgames": (c) => parseSpecialties(c).includes("Endgames"),
  "Tactics": (c) => parseSpecialties(c).includes("Tactics"),
};

// Sort functions
const sorts = {
  "Top Rated": (a, b) => parseFloat(b.coach_profiles.averageRating) - parseFloat(a.coach_profiles.averageRating),
  "Price: Low to High": (a, b) => (a.coach_profiles.hourlyRateCents ?? 0) - (b.coach_profiles.hourlyRateCents ?? 0),
  "Most Lessons": (a, b) => (b.coach_profiles.totalLessons ?? 0) - (a.coach_profiles.totalLessons ?? 0),
  "Newest": (a, b) => b.users.id - a.users.id,
};
```

---

## Navigation
Keep the existing nav header (back arrow + BooGMe logo). Do not add a full nav bar — this page is accessed from the homepage.

---

## Tests
3 new tests in `server/sprint-browse1.test.ts`:
1. `coach.listActive` returns coaches ordered by `averageRating` desc
2. `coach.listActive` respects `limit` and `offset` pagination inputs
3. `coach.listActive` only returns coaches where `profileActive: true` AND `isAvailable: true`

**Target: 454 total tests.**

---

## Checklist
- [ ] `CoachBrowse.tsx` rewritten with horizontal card layout
- [ ] Profile completeness dots (4-dot row per card)
- [ ] Orange left border on full-profile cards
- [ ] Opacity-75 on sparse-profile cards
- [ ] Filter pills (client-side, 6 options)
- [ ] Sort bar (4 options)
- [ ] Grid/list view toggle
- [ ] Loading skeleton matches new layout
- [ ] Empty state with reset button
- [ ] 3 new tests, 454 total pass
- [ ] `tsc --noEmit` clean
- [ ] `pnpm build` clean
