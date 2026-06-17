# Handoff: Sidebar Active-Nav Scroll-Spy — S-SCROLLSPY-1

## Problem

When a user clicks a sidebar nav item (e.g. "Messages"), `activeSection` is set to that key and the item turns red. If the user then **manually scrolls** to a different section, `activeSection` is never updated — the originally-clicked item stays red even though the viewport is showing a completely different section.

**Root cause:** `activeSection` is only ever written in two places:
1. `handleNavClick` in `DashShell.tsx` — fires on sidebar click.
2. `setActiveSection` in `Dashboard.tsx` — only used by the notification-bell deep-link.

There is **no scroll listener** that updates `activeSection` as the user scrolls. The fix is to add an `IntersectionObserver` (scroll-spy) inside `DashShell` that watches every section element and updates `activeSection` to whichever section is most visible in the viewport.

---

## Files to change

| File | What to do |
|---|---|
| `client/src/components/DashShell.tsx` | Add scroll-spy `useEffect` using `IntersectionObserver` |

No other files need to change. `Dashboard.tsx` already passes `onSectionChange` down; `DashShell` just needs to call it when the observed section changes.

---

## Exact implementation

### 1 — Add `useEffect` and `useRef` to imports

At the top of `DashShell.tsx`, the existing import line is:

```ts
import { ReactNode } from "react";
```

Change it to:

```ts
import { ReactNode, useEffect, useRef } from "react";
```

### 2 — Add the scroll-spy hook inside the `DashShell` component body

Place this block **after** the `handleNavClick` function (around line 92) and **before** the `initials` calculation:

```ts
// ── Scroll-spy: update activeSection as user scrolls ────────────────────────
const scrollSpyRef = useRef<IntersectionObserver | null>(null);
const isUserScrollingRef = useRef(false);   // suppress spy during programmatic scroll

useEffect(() => {
  // Brief suppression window after a nav click so the programmatic scroll
  // doesn't immediately overwrite the section we just clicked.
  const originalHandleNavClick = handleNavClick;
  // We patch via the ref flag instead of replacing the function.

  const sectionKeys = navItems.map((item) => item.key);

  // Disconnect any previous observer when role or navItems change.
  scrollSpyRef.current?.disconnect();

  const visibleRatios: Record<string, number> = {};

  const observer = new IntersectionObserver(
    (entries) => {
      if (isUserScrollingRef.current) return; // ignore during programmatic scroll

      entries.forEach((entry) => {
        visibleRatios[entry.target.id] = entry.intersectionRatio;
      });

      // Pick the section with the highest visible ratio.
      let best = "";
      let bestRatio = 0;
      for (const key of sectionKeys) {
        const ratio = visibleRatios[key] ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = key;
        }
      }
      if (best && best !== activeSection) {
        onSectionChange(best);
      }
    },
    {
      // Observe a generous band in the upper half of the viewport so the
      // active item updates as soon as a section enters the top portion.
      rootMargin: "0px 0px -50% 0px",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
    }
  );

  sectionKeys.forEach((key) => {
    const el = document.getElementById(key);
    if (el) observer.observe(el);
  });

  scrollSpyRef.current = observer;

  return () => observer.disconnect();
  // Re-run when role changes (different navItems) or activeSection reference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [role, navItems]);
```

### 3 — Suppress the spy during programmatic scroll (nav click)

Replace the existing `handleNavClick` function:

```ts
// Before (existing):
const handleNavClick = (key: string) => {
  onSectionChange(key);
  const el = document.getElementById(key);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
```

```ts
// After:
const handleNavClick = (key: string) => {
  onSectionChange(key);
  // Suppress the IntersectionObserver for ~800 ms so the smooth-scroll
  // animation doesn't immediately overwrite the section we just clicked.
  isUserScrollingRef.current = true;
  setTimeout(() => { isUserScrollingRef.current = false; }, 800);
  const el = document.getElementById(key);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
```

---

## Why this approach

- **`IntersectionObserver`** is the correct browser primitive for scroll-spy. It is performant (no scroll event listener, no `getBoundingClientRect` polling) and fires only when visibility changes.
- **`rootMargin: "0px 0px -50% 0px"`** means a section is only considered "in view" when it occupies the top half of the viewport, which matches user intuition — the section you are reading is the one highlighted.
- **The 800 ms suppression flag** prevents a race condition where the smooth-scroll animation triggers intersection callbacks before the target section is fully in view, which would cause the highlight to flicker through intermediate sections.
- **No changes to `Dashboard.tsx`** — `onSectionChange` is already wired; the fix is entirely self-contained inside `DashShell`.

---

## Testing checklist

1. Click "Messages" in the sidebar → it turns red, page scrolls to Messages section. ✓
2. Manually scroll upward past Overview → "Overview" turns red. ✓
3. Manually scroll downward past Lessons → "Lessons" turns red. ✓
4. Click "Billing" → page scrolls, Billing turns red, no flicker through intermediate items. ✓
5. Switch role (student ↔ coach on a "both" account) → spy resets, correct nav items observed. ✓
6. Notification deep-link (e.g. `/dashboard?role=coach#content-requests`) → correct item highlighted on load. ✓

---

## Acceptance criteria

- The sidebar active item always reflects the section currently occupying the top half of the viewport.
- Clicking a nav item still works and does not flicker.
- No console errors or React hook warnings introduced.
