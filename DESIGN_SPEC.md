# BooGMe Design Spec — Concept B: Glass Grandmaster

**Purpose**: Complete visual redesign implementing the "Glass Grandmaster" direction — Apple Vision Pro-inspired glassmorphism, gradient mesh backgrounds, frosted panels, 3D depth, and warm ambient light. This spec is designed for Claude Code to execute autonomously.

**Critical rule**: Do NOT touch business logic, tRPC routes, database schema, or any backend code. This is CSS/Tailwind/component-level visual changes only. Do not break any existing functionality.

---

## Logo Assets

Use these exact URLs throughout:

```
LOGO_TRANSPARENT (SVG, use on all backgrounds):
https://d2xsxph8kpxj0f.cloudfront.net/310519663188415081/Xkyng35xnYFybYAdmyVo96/boogme-logo-transparent_1ab89b8a.svg

LOGO_ORIGINAL (PNG, dark background, for OG/social):
https://d2xsxph8kpxj0f.cloudfront.net/310519663188415081/Xkyng35xnYFybYAdmyVo96/boogme-logo-current_e2bef41f.png
```

### Logo usage rules:
- **Nav bar**: Transparent SVG, height 32px, horizontal knight+wordmark
- **Hero / splash**: Transparent SVG, height 48-64px, centered, inside glass pill or with ambient glow
- **Footer**: Transparent SVG, height 24px, opacity 0.5
- **Loading screen**: Transparent SVG, height 64px, centered, with subtle pulse animation
- **Favicon**: Crop to knight silhouette only, 32x32, burgundy (#722F37) background
- **OG image (1200x630)**: Original PNG centered on #0A0A12 background with tagline "The chess coaching marketplace"
- **Never** stretch, recolor, or add effects directly to the logo SVG. All effects (glow, glass) go on a container behind or around it.

---

## Phase 1: Color System

### Remove all existing cyberpunk colors:
Search entire `client/src/` for and replace:
- `#00F5FF` / cyan → replace with `#722F37` (burgundy) or contextual color
- `#FF00FF` / magenta → replace with `#C27A4A` (terracotta) or contextual color
- `#00FF88` / matrix green → replace with `#2D5A4A` (forest)
- All Tailwind `text-cyan-*`, `bg-cyan-*`, `text-fuchsia-*`, `bg-fuchsia-*` classes
- All `box-shadow` and `text-shadow` with neon/glow colors
- All `filter: drop-shadow` with bright values
- All references to `#0A0A0F` background → replace with `#0A0A12`

### New palette (add to Tailwind config):

```js
// tailwind.config.ts — extend theme.colors
colors: {
  // Primary
  burgundy: {
    DEFAULT: '#722F37',
    light: '#8B3A43',
    dark: '#5A252C',
    muted: '#D4A0A6',
    subtle: 'rgba(114, 47, 55, 0.08)',
    glow: 'rgba(114, 47, 55, 0.25)',
  },
  // Secondary
  terracotta: {
    DEFAULT: '#C27A4A',
    light: '#D08B5C',
    muted: '#F0E6D3',
    subtle: 'rgba(194, 122, 74, 0.08)',
    glow: 'rgba(194, 122, 74, 0.2)',
  },
  // Glass system
  glass: {
    bg: 'rgba(255, 255, 255, 0.04)',
    'bg-hover': 'rgba(255, 255, 255, 0.06)',
    'bg-active': 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.08)',
    'border-hover': 'rgba(255, 255, 255, 0.12)',
    'border-active': 'rgba(255, 255, 255, 0.16)',
  },
  // Neutrals
  obsidian: '#0A0A12',
  charcoal: '#111114',
  'warm-white': '#FAF8F5',
  stone: '#E8E4DF',
  slate: '#6B6B6B',
  // Accent
  gold: { DEFAULT: '#B8860B', muted: '#D4AA2B', subtle: 'rgba(184, 134, 11, 0.1)' },
  forest: { DEFAULT: '#2D5A4A', light: '#3A7260', muted: '#7BB5A0', subtle: 'rgba(45, 90, 74, 0.08)' },
  // Gradient system
  iris: { DEFAULT: '#7B68EE', glow: 'rgba(123, 104, 238, 0.15)' },
}
```

### CSS custom properties (add to global CSS):

```css
:root {
  /* Glass Grandmaster core */
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-bg-hover: rgba(255, 255, 255, 0.06);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-border-hover: rgba(255, 255, 255, 0.12);
  --glass-blur: 16px;
  --glass-blur-heavy: 24px;

  /* Gradient mesh colors (for background blobs) */
  --mesh-burgundy: rgba(114, 47, 55, 0.25);
  --mesh-iris: rgba(123, 104, 238, 0.15);
  --mesh-terracotta: rgba(194, 122, 74, 0.12);
  --mesh-forest: rgba(45, 90, 74, 0.1);

  /* Page backgrounds */
  --page-bg: #0A0A12;
  --surface: #111114;
  --surface-elevated: #1A1A1E;
}
```

---

## Phase 2: Glass Utility Classes

Create a utility CSS file (e.g., `client/src/styles/glass.css`) and import it in your main stylesheet:

```css
/* Glass panels */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 0.5px solid var(--glass-border);
}

.glass:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}

.glass-heavy {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(var(--glass-blur-heavy));
  -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}

/* Gradient mesh background (apply to page sections) */
.mesh-bg {
  position: relative;
  background: var(--page-bg);
  overflow: hidden;
}

.mesh-bg::before,
.mesh-bg::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}

.mesh-bg::before {
  top: -30%;
  left: -15%;
  width: 60%;
  height: 60%;
  background: radial-gradient(circle, var(--mesh-burgundy), transparent 70%);
}

.mesh-bg::after {
  bottom: -25%;
  right: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle, var(--mesh-iris), transparent 70%);
}

/* Third mesh blob (use a nested div with class .mesh-accent) */
.mesh-accent {
  position: absolute;
  top: 15%;
  right: 15%;
  width: 35%;
  height: 35%;
  background: radial-gradient(circle, var(--mesh-terracotta), transparent 70%);
  filter: blur(60px);
  pointer-events: none;
}

/* Glass card with ambient corner glow */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 0.5px solid var(--glass-border);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.glass-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
}

/* Ambient glow inside a glass card (top-right corner) */
.glass-card .card-glow {
  position: absolute;
  top: -15px;
  right: -15px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  filter: blur(20px);
  pointer-events: none;
}

/* Glass badge/pill */
.glass-badge {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

/* Glass stat card */
.glass-stat {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 0.5px solid var(--glass-border);
  border-radius: 14px;
  padding: 16px;
  text-align: center;
}

/* Subtle gradient text */
.gradient-text {
  background: linear-gradient(135deg, #C27A4A, #7B68EE);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glass input */
.glass-input {
  background: rgba(255, 255, 255, 0.04);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  color: #FAF8F5;
  font-size: 14px;
  transition: all 0.2s ease;
}

.glass-input:focus {
  outline: none;
  border-color: #722F37;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 3px rgba(114, 47, 55, 0.15);
}

.glass-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}
```

---

## Phase 3: Typography

### Font stack:
- Primary: `Inter` (already in use — keep it)
- Mono: `JetBrains Mono` or system monospace for stats/ratings
- Ensure Inter is loaded with weights: 300, 400, 500

### Heading styles (override in global CSS):

```css
h1, .h1 {
  font-size: 48px;
  font-weight: 300;
  letter-spacing: -2px;
  line-height: 1.08;
  color: #FAF8F5;
}

h2, .h2 {
  font-size: 36px;
  font-weight: 300;
  letter-spacing: -1.5px;
  line-height: 1.12;
  color: #FAF8F5;
}

h3, .h3 {
  font-size: 24px;
  font-weight: 400;
  letter-spacing: -0.5px;
  color: #FAF8F5;
}

h4, .h4 {
  font-size: 18px;
  font-weight: 500;
  color: #FAF8F5;
}

/* Section labels */
.section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.25);
  font-weight: 500;
}

/* Body text on dark */
.body-muted {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.45);
}

/* Stats / monospace numbers */
.stat-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 400;
}
```

### Rules:
- Maximum font-weight anywhere on site: 500. Kill all 600/700 on headlines.
- Headlines always weight 300 (light)
- Body text color on dark backgrounds: `rgba(255, 255, 255, 0.45)` — NOT pure white
- Primary text (names, labels): `#FAF8F5`
- Secondary text: `rgba(255, 255, 255, 0.35)`

---

## Phase 4: Remove Cyberpunk Effects

Search all files in `client/src/` and remove/replace:

1. **Glowing grids**: Delete any CSS that creates a pulsing grid background (repeating-linear-gradient with cyan/magenta)
2. **Glitch keyframes**: Delete any `@keyframes` with clip-path jitter or transform glitch effects
3. **Particle systems**: Delete any `<canvas>` particle animations
4. **Neon box-shadows**: Replace `box-shadow: 0 0 Npx #00F5FF` → remove entirely or replace with `box-shadow: 0 4px 16px rgba(114, 47, 55, 0.2)` for buttons
5. **Pulsing animations**: Delete keyframes that pulse neon opacity
6. **Spring animations with bounce**: Replace Framer Motion `type: "spring", stiffness: 300+` with `duration: 0.4, ease: "easeOut"`
7. **Text-shadow glow**: Delete all `text-shadow` with neon colors

---

## Phase 5: Component Restyling

### 5a: Navigation Bar

```
Layout: Fixed top, full width
Background: rgba(10, 10, 18, 0.8) + backdrop-filter: blur(20px)
Border bottom: 0.5px solid rgba(255, 255, 255, 0.06)
Height: ~60px
Padding: 0 24px (mobile: 0 16px)

Left: Logo (transparent SVG, height 32px)
Center/Right: Nav links
  - Font: 13px, weight 400, color rgba(255,255,255,0.5)
  - Hover: color #FAF8F5, transition 200ms
  - Active: color #FAF8F5, font-weight 500

Sign in button:
  - background: rgba(255,255,255,0.08)
  - backdrop-filter: blur(10px)
  - border: 0.5px solid rgba(255,255,255,0.1)
  - border-radius: 8px
  - color: #FAF8F5
  - padding: 6px 16px
  - font-size: 13px
  - hover: background rgba(255,255,255,0.12)

Mobile hamburger:
  - Icon color: #FAF8F5
  - Menu: full-screen overlay, background rgba(10,10,18,0.95) + blur(20px)
  - Links: 24px, weight 300, stacked vertically, 16px gap
```

### 5b: Hero Section

```
Container: full width, min-height 85vh, class "mesh-bg"
  - Include .mesh-accent div for third gradient blob

Content: centered, max-width 600px

Badge (above headline):
  - class "glass-badge"
  - Text: "Founding members — limited spots"

Headline:
  - h1, weight 300, color #FAF8F5
  - Accent phrase uses class "gradient-text" (terracotta → iris gradient)
  - Example: "Find the coach who <span class='gradient-text'>elevates your game.</span>"

Subheadline:
  - 15px, color rgba(255,255,255,0.4), max-width 400px, centered

CTA buttons:
  Primary:
    - background: linear-gradient(135deg, #722F37, #8B3A43)
    - color: #FAF8F5
    - padding: 12px 28px
    - border-radius: 10px
    - font-size: 14px, weight 500
    - box-shadow: 0 4px 20px rgba(114, 47, 55, 0.35)
    - hover: box-shadow 0 6px 28px rgba(114, 47, 55, 0.45), translateY(-1px)
    - active: scale(0.98)
  Secondary:
    - class "glass" + rounded-xl
    - color: rgba(255,255,255,0.8)
    - padding: 12px 28px

Stat cards below CTAs (row of 3):
  - class "glass-stat"
  - Label: 10px uppercase, letter-spacing 1px, color rgba(255,255,255,0.3)
  - Number: 24px, weight 300, class "stat-number"
  - Stats to show:
    * "Avg rating gain" → "+127"
    * "Match accuracy" → "94%"
    * "Coaches keep" → "85%+" (in terracotta color)

Scroll indicator at bottom:
  - Small chevron-down icon, color rgba(255,255,255,0.15)
  - Subtle float animation (translateY 0→4px→0, 2s, infinite)
```

### 5c: Coach Cards

```
Container: class "glass-card"
Border-radius: 16px
Padding: 18px

Corner glow: .card-glow div inside card
  - GM cards: background rgba(114,47,55,0.2) (burgundy glow)
  - IM cards: background rgba(194,122,74,0.2) (terracotta glow)
  - FM cards: background rgba(123,104,238,0.15) (iris glow)
  - Other: background rgba(45,90,74,0.15) (forest glow)

Avatar:
  - 40px × 40px, border-radius 12px
  - Background: linear-gradient based on title
    * GM: linear-gradient(135deg, #722F37, #8B3A43)
    * IM: linear-gradient(135deg, #C27A4A, #D08B5C)
    * FM: linear-gradient(135deg, #2D5A4A, #3A7260)
    * NM/Other: linear-gradient(135deg, #444, #555)
  - Text: title abbreviation, 11px, weight 500, #FAF8F5

Name: 14px, weight 500, color #FAF8F5
Subtitle: 11px, color rgba(255,255,255,0.35) ("Grandmaster · FIDE 2540")

Specialization tags:
  - font-size: 10px
  - background: rgba(255,255,255,0.06)
  - color: rgba(255,255,255,0.5)
  - border-radius: 8px
  - padding: 3px 8px

Price: 14px, weight 500, color #FAF8F5
  - "/hr" suffix: 11px, color rgba(255,255,255,0.3)

Rating: 11px, color #B8860B (gold)

Hover: translateY(-3px), border-color rgba(255,255,255,0.15), transition 300ms
```

### 5d: Value Proposition Section

```
Layout: class "mesh-bg" section with different mesh colors (use --mesh-forest and --mesh-terracotta)

Two-column glass panel:
  - class "glass-heavy"
  - border-radius: 20px
  - padding: 28px
  - Grid: 2 columns with 24px gap

Left column (Students):
  - Section label: "For students" (class "section-label")
  - Headline: "Improve faster with the right coach" (18px, weight 400, #FAF8F5)
  - Body: Description text (class "body-muted")
  - Key points (no bullets — just stacked text with gold accent dots):
    * "AI matches your playing style and goals"
    * "Payments held in escrow until satisfied"
    * "Review coaches before you commit"

Right column (Coaches):
  - Section label: "For coaches"
  - Headline: "Build your business, keep your earnings"
  - Body + key points same treatment
```

### 5e: How It Works Section

```
4-step horizontal flow

Each step: glass-stat card with:
  - Step number in a 32px circle:
    * Step 1: linear-gradient(135deg, #722F37, #8B3A43) bg
    * Step 2: linear-gradient(135deg, #C27A4A, #D08B5C) bg
    * Step 3: linear-gradient(135deg, #2D5A4A, #3A7260) bg
    * Step 4: linear-gradient(135deg, #B8860B, #D4AA2B) bg
  - Title: 13px, weight 500, #FAF8F5
  - Subtitle: 11px, rgba(255,255,255,0.35)

Steps:
  1. "Pick a time" / "Real availability"
  2. "Coach confirms" / "Within 24 hours"
  3. "Pay securely" / "Escrow protected"
  4. "Learn & review" / "Rate your experience"

Connector line between steps:
  - 0.5px dashed, rgba(255,255,255,0.08)
  - Hidden on mobile (steps stack vertically)
```

### 5f: Featured Coach Spotlight

```
A large glass-heavy card showcasing a single coach editorially.

Layout: horizontal flex, gap 24px
Left: Large avatar (80px × 80px, rounded-2xl, gradient bg)
Right: 
  - Label: "Featured coach" (10px uppercase, letter-spacing 1.5px, color #B8860B)
  - Name: 20px, weight 400, #FAF8F5
  - Quote: 13px italic, rgba(255,255,255,0.35), max 2 lines
  - Stats row: "FIDE 2540 · 12 years teaching · 4.9 rating" (11px, rgba(255,255,255,0.25), rating in gold)

Background: linear-gradient(135deg, rgba(184,134,11,0.06), rgba(114,47,55,0.04))
Border: 0.5px solid rgba(255,255,255,0.06)
```

### 5g: Browse by Specialty Section

```
Grid of 4-6 category cards

Each card:
  - class "glass-card" but with tinted background matching the category:
    * Openings: rgba(114,47,55,0.1), border rgba(114,47,55,0.12)
    * Tactics: rgba(194,122,74,0.08), border rgba(194,122,74,0.1)
    * Endgames: rgba(45,90,74,0.08), border rgba(45,90,74,0.1)
    * Strategy: rgba(184,134,11,0.06), border rgba(184,134,11,0.08)
  - Icon: Simple SVG icon (geometric, not detailed), matching tint color
  - Title: 12px, weight 500, matching tint color
  - Count: 10px, rgba(255,255,255,0.25) ("14 coaches")

Section header: flex between "Browse by specialty" (section-label) and "See all →" (11px, #B8860B)
```

### 5h: Waitlist / CTA Section

```
class "mesh-bg" with stronger mesh colors

Centered glass-heavy card, max-width 480px:
  - Headline: "Join the founding class" (h2)
  - Subtext: body-muted, 2 lines max
  - Email input: class "glass-input", full width
  - Submit button: Primary CTA style (gradient burgundy)
  - Below: "No spam. Unsubscribe anytime." (10px, rgba(255,255,255,0.2))
```

### 5i: Footer

```
Background: #0A0A12
Border-top: 0.5px solid rgba(255,255,255,0.04)
Padding: 48px 24px

Logo: Transparent SVG, height 24px, opacity 0.4
  - Below logo: tagline "The chess coaching marketplace" (11px, rgba(255,255,255,0.2))

Link columns (flex row, gap 48px):
  - Column headers: 11px uppercase, letter-spacing 1px, rgba(255,255,255,0.25)
  - Links: 13px, rgba(255,255,255,0.35), hover rgba(255,255,255,0.6)
  
  Columns:
    Platform: Browse Coaches, For Coaches, Pricing, AI Matching
    Company: About, Blog, Careers
    Legal: Privacy Policy, Terms of Service, Refund Policy
    Connect: Twitter, Discord, Email

Bottom bar:
  - "© 2026 BooGMe. All rights reserved." (11px, rgba(255,255,255,0.15))
```

### 5j: Buttons (global)

```
Primary:
  background: linear-gradient(135deg, #722F37, #8B3A43)
  color: #FAF8F5
  border-radius: 10px
  font-weight: 500
  box-shadow: 0 4px 16px rgba(114,47,55,0.3)
  hover: shadow grows, translateY(-1px)
  active: scale(0.98)

Secondary:
  class "glass"
  color: rgba(255,255,255,0.8)
  border-radius: 10px
  hover: glass-bg-hover, border-hover

Accent (terracotta):
  background: linear-gradient(135deg, #C27A4A, #D08B5C)
  color: #FAF8F5
  box-shadow: 0 4px 16px rgba(194,122,74,0.25)

Gold (waitlist/premium):
  background: linear-gradient(135deg, #B8860B, #D4AA2B)
  color: #0A0A12
  box-shadow: 0 4px 16px rgba(184,134,11,0.3)

Danger:
  background: linear-gradient(135deg, #DC2626, #EF4444)
  color: #FAF8F5

Ghost:
  background: transparent
  color: rgba(255,255,255,0.5)
  hover: color #FAF8F5

All buttons: transition-all 200ms, border-radius 10px
```

### 5k: Modals/Dialogs

```
Backdrop: rgba(10, 10, 18, 0.7) + backdrop-filter: blur(8px)

Modal panel:
  class "glass-heavy"
  border-radius: 20px
  padding: 28px
  max-width: 480px (or 640px for booking/assessment)
  
  Entrance animation (Framer Motion):
    initial: { opacity: 0, scale: 0.95, y: 10 }
    animate: { opacity: 1, scale: 1, y: 0 }
    transition: { duration: 0.25, ease: "easeOut" }

Close button: top-right, 32px glass circle, X icon, rgba(255,255,255,0.4)
```

### 5l: Badges and Status Tags

```
Glass badge: class "glass-badge" (defined in Phase 2)

Status-specific:
  Pending: background rgba(194,122,74,0.1), color #D08B5C, border rgba(194,122,74,0.15)
  Confirmed: background rgba(45,90,74,0.1), color #7BB5A0, border rgba(45,90,74,0.15)
  Completed: background rgba(255,255,255,0.04), color rgba(255,255,255,0.4)
  Cancelled: background rgba(220,38,38,0.08), color #F87171, border rgba(220,38,38,0.1)
  Premium: background rgba(184,134,11,0.08), color #D4AA2B, border rgba(184,134,11,0.1)

All: border-radius 8px, font-size 11px, padding 3px 10px, font-weight 500
```

---

## Phase 6: Page-Specific Updates

### Homepage
- Wrap entire page in dark background (#0A0A12)
- Hero: mesh-bg with glass badge, gradient headline, glass stat cards (see 5b)
- Featured coaches: Row of 3 glass-card coach cards (see 5c)
- Value prop: Two-column glass panel (see 5d)
- How it works: 4-step glass flow (see 5e)
- Coach spotlight: Editorial feature card (see 5f)
- Browse specialties: Category grid (see 5g)
- Waitlist CTA: Glass form card (see 5h)
- Footer (see 5i)

### /coaches page
- Hero: mesh-bg, headline "Build your coaching business", coach-oriented copy
- Earnings calculator: Glass-heavy card
  - Slider track: rgba(255,255,255,0.06)
  - Slider thumb: linear-gradient(135deg, #722F37, #8B3A43)
  - Result numbers: 24px, stat-number class, #FAF8F5
- FAQ: Glass accordion cards, Radix Accordion
- Waitlist form: Same as homepage treatment

### Coach browse page
- Filter bar: glass panel, horizontal, with glass-input selects and sliders
- Coach grid: 2-3 columns of glass-card coach cards
- No results: Friendly message on glass card

### Coach detail page
- Large header: mesh-bg with large avatar, name, credentials
- Bio: glass-heavy card with body text
- Availability calendar: glass-card styling on the date picker
- Reviews: Star ratings in gold, review text in body-muted
- Booking CTA: Primary button (gradient burgundy), sticky on mobile

### Student dashboard
- Background: #0A0A12 (solid, no mesh — dashboards stay clean)
- Welcome card: glass-heavy, "Welcome back, [name]"
- Lesson cards: glass-card with status badges
- Pending reviews: glass-card with burgundy "Leave Review" button
- Message thread: glass-heavy dialog

### Coach dashboard
- Same glass treatment as student dashboard
- Pending confirmations: glass-cards with Accept (forest gradient) / Decline (red) buttons
- Earnings: glass-stat metric cards with monospace numbers

### Auth pages (Sign in, Register)
- Full page: mesh-bg
- Centered glass-heavy card, max-width 400px
- Logo (transparent SVG, 48px) above the form
- Inputs: glass-input class
- Primary CTA: gradient burgundy button
- Google OAuth: glass button with white Google icon
- Links: 13px, rgba(255,255,255,0.35)

### Assessment questionnaire modal
- Full-screen glass overlay
- Progress bar: thin (3px), gradient burgundy→terracotta fill
- Question cards: glass panels
- Options: glass-card hover state for selection
- AI analysis animation: Keep the typing effect but style it with gradient-text on the result

### Legal pages (/privacy, /terms)
- Background: #0A0A12
- Content: max-width 680px, centered, glass-heavy card wrapping the text
- Body: 15px, line-height 1.8, rgba(255,255,255,0.6)
- Headings: standard h2/h3 in #FAF8F5

---

## Phase 7: Animation System

### Allowed animations:

```css
/* Page section entrance (Framer Motion) */
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, ease: "easeOut" }}

/* Stagger children */
staggerChildren: 0.08

/* Card hover */
.glass-card { transition: all 0.3s ease; }
.glass-card:hover { transform: translateY(-3px); }

/* Button hover */
transition: all 0.2s ease;
hover: translateY(-1px), shadow grows
active: scale(0.98)

/* Scroll indicator float */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
animation: float 2s ease-in-out infinite;

/* Loading logo pulse (for splash screen only) */
@keyframes logoPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
animation: logoPulse 2s ease-in-out infinite;

/* Gradient mesh slow drift (very subtle, for hero bg) */
@keyframes meshDrift {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(10px, -5px); }
  66% { transform: translate(-5px, 8px); }
}
animation: meshDrift 20s ease-in-out infinite;
/* Apply to the ::before and ::after gradient blobs */
```

### Forbidden:
- Glitch/jitter effects
- Particle systems
- Neon pulse on box-shadow
- Spring physics with visible bounce (stiffness > 200)
- Any animation longer than 1s (except meshDrift and float)
- Background grid animations
- Typewriter effects (except AI analysis section)

---

## Phase 8: Mobile Considerations

### Glass performance:
- `backdrop-filter: blur()` is expensive on mobile
- For devices that can't handle it, add a fallback:
```css
@supports not (backdrop-filter: blur(16px)) {
  .glass, .glass-heavy, .glass-card, .glass-stat, .glass-badge {
    background: rgba(20, 20, 30, 0.9);
  }
}
```

### Responsive breakpoints:
- Mobile (<640px): Stack all grids to 1 column, nav becomes hamburger, hero text 32px, stat cards stack
- Tablet (640-1024px): 2-column grids, hero text 40px
- Desktop (>1024px): Full 3-column grids, hero text 48px

### Touch targets:
- All interactive elements: minimum 44px × 44px
- Buttons: minimum padding 12px 20px
- Nav links in mobile menu: 48px height, full-width tap target

---

## Execution Order

1. **Phase 1**: Color system — update Tailwind config, global CSS variables
2. **Phase 2**: Glass utility classes — create glass.css, import it
3. **Phase 4**: Remove cyberpunk effects — clean slate
4. **Phase 3**: Typography — heading styles, font weights
5. **Phase 5a-5b**: Nav + Hero — the first impression
6. **Phase 5c-5g**: Coach cards, value prop, how it works, spotlight, browse
7. **Phase 5h-5l**: Waitlist, footer, buttons, modals, badges
8. **Phase 6**: Page-specific updates (homepage → coaches → dashboards → auth → legal)
9. **Phase 7**: Animation pass
10. **Phase 8**: Mobile fallbacks and responsive polish

After each phase: `pnpm check` and `pnpm build`. Commit with `glass-N: [description]`.

---

## Reference

**The vibe**: Apple Vision Pro meets a members-only chess club. Every surface has depth. Light bleeds through frosted panels. The gradient mesh background slowly drifts, alive and breathing. Glass cards float above the surface. Your BOOGME knight logo, clean and white, sits confidently on top of it all.

**Performance rule**: If `backdrop-filter` causes dropped frames on a test device, reduce blur radius or fall back to solid backgrounds. Beautiful is useless if it stutters.
