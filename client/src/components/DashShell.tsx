/**
 * DashShell — shared sidebar chrome for student/coach dashboards (S-DASH-1).
 * Replaces the generic DashboardLayout on dashboard pages only.
 */

import { ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import NotificationBell from "./NotificationBell";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Home } from "lucide-react";

// ── Sidebar nav definitions ──────────────────────────────────────────────────

const STUDENT_NAV = [
  { key: "overview", label: "Overview" },
  { key: "lessons", label: "Lessons" },
  { key: "messages", label: "Messages", badgeKey: "messages" },
  { key: "content-requests", label: "Content requests" },
  { key: "content-library", label: "Content library" },
  { key: "progress", label: "Progress" },
  { key: "billing", label: "Billing" },
] as const;

const COACH_NAV = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "All Lessons" },
  { key: "students", label: "Students" },
  { key: "inbox", label: "Inbox", badgeKey: "messages" },
  { key: "content-requests", label: "Content requests" },
  { key: "storefront", label: "Storefront" },
  { key: "earnings", label: "Earnings" },
  { key: "reviews", label: "Reviews" },
  { key: "profile", label: "Profile" },
] as const;

// ── Greeting helper ──────────────────────────────────────────────────────────

export function getGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ── Component ────────────────────────────────────────────────────────────────

interface DashShellProps {
  role: "student" | "coach";
  activeSection: string;
  onSectionChange: (section: string) => void;
  onRoleChange?: (role: "student" | "coach") => void;
  children: ReactNode;
}

export default function DashShell({
  role,
  activeSection,
  onSectionChange,
  onRoleChange,
  children,
}: DashShellProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const navItems = role === "coach" ? COACH_NAV : STUDENT_NAV;

  // Total unread messages across all lessons
  const { data: lessons } = role === "coach"
    ? trpc.lesson.coachLessons.useQuery({ limit: 50 }, { enabled: !!user })
    : trpc.lesson.myLessons.useQuery({ limit: 50 }, { enabled: !!user });

  const lessonIds = (lessons || []).map((l: any) => l.id);
  const { data: unreadCounts } = trpc.messages.getUnreadCounts.useQuery(
    { lessonIds },
    { enabled: lessonIds.length > 0, refetchInterval: 30000 }
  );
  const totalUnread = unreadCounts
    ? Object.values(unreadCounts as Record<number, number>).reduce((a, b) => a + b, 0)
    : 0;

  const firstName = user?.name?.split(" ")[0] || "there";
  const greeting = getGreeting();

  // ── Scroll-spy state ────────────────────────────────────────────────────────
  // Stable refs so the IntersectionObserver closure never goes stale and the
  // effect doesn't need to re-run (and tear down observers) on every render.
  const suppressSpyRef = useRef(false);          // true during a programmatic scroll
  const suppressTimerRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<string>(activeSection);
  const onSectionChangeRef = useRef(onSectionChange);
  useEffect(() => { onSectionChangeRef.current = onSectionChange; }, [onSectionChange]);
  // Keep lastEmitted in sync when activeSection is changed by anything other than
  // the spy itself (nav click, deep link, header buttons) so we never emit stale.
  useEffect(() => { lastEmittedRef.current = activeSection; }, [activeSection]);

  const handleNavClick = (key: string) => {
    onSectionChange(key);
    lastEmittedRef.current = key;
    // Suppress the spy until the smooth-scroll settles so it doesn't flicker
    // through intermediate sections. Cleared by `scrollend`; the timer is a
    // fallback for browsers without it. Re-arming clears any prior timer.
    suppressSpyRef.current = true;
    if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(() => {
      suppressSpyRef.current = false;
      suppressTimerRef.current = null;
    }, 1200);
    const el = document.getElementById(key);
    if (el) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  // ── Scroll-spy: highlight the section currently in the upper viewport ─────────
  useEffect(() => {
    const sectionKeys = navItems.map((item) => item.key);
    // Latest intersection state per section id.
    const state: Record<string, { intersecting: boolean; top: number }> = {};
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    const recompute = () => {
      if (suppressSpyRef.current) return;
      // Bottom-of-page: the last section may be too short to reach the band, so
      // pin it explicitly when the page is scrolled to the end.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      let best = "";
      if (atBottom) {
        best = sectionKeys[sectionKeys.length - 1] ?? "";
      } else {
        // The topmost section currently inside the detection band — i.e. the
        // one the reader is looking at. Tie-break by DOM position, not nav order.
        let bestTop = Infinity;
        for (const key of sectionKeys) {
          const s = state[key];
          if (s?.intersecting && s.top < bestTop) {
            bestTop = s.top;
            best = key;
          }
        }
      }
      if (best && best !== lastEmittedRef.current) {
        lastEmittedRef.current = best;
        onSectionChangeRef.current(best);
      }
    };

    const onIntersect: IntersectionObserverCallback = (entries) => {
      // Record state even while suppressed so it's accurate the moment the
      // programmatic scroll settles.
      for (const entry of entries) {
        state[entry.target.id] = {
          intersecting: entry.isIntersecting,
          top: entry.boundingClientRect.top,
        };
      }
      recompute();
    };

    const attach = (): boolean => {
      const els = sectionKeys
        .map((k) => document.getElementById(k))
        .filter((el): el is HTMLElement => el !== null);
      if (els.length === 0) return false;
      io = new IntersectionObserver(onIntersect, {
        // Detection band = top ~35% of the viewport.
        rootMargin: "0px 0px -65% 0px",
        threshold: [0, 1],
      });
      els.forEach((el) => io!.observe(el));
      return true;
    };

    // Dashboard content renders a loading skeleton first, so the section
    // elements may not exist yet on mount. Attach now if present; otherwise
    // wait for them to appear, then attach once and stop watching.
    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) {
          mo?.disconnect();
          mo = null;
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    // `scrollend` ends the click-suppression precisely when scrolling settles
    // (with the handleNavClick timeout as the fallback). Also re-evaluates the
    // active section at the bottom of the page where IO may not fire.
    const onScrollEnd = () => {
      if (suppressTimerRef.current !== null) {
        clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = null;
      }
      suppressSpyRef.current = false;
      recompute();
    };
    window.addEventListener("scrollend", onScrollEnd);

    return () => {
      io?.disconnect();
      mo?.disconnect();
      window.removeEventListener("scrollend", onScrollEnd);
      if (suppressTimerRef.current !== null) {
        clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = null;
      }
    };
    // navItems is a stable module constant per role; re-run only on role change.
    // onSectionChange is read via ref to avoid teardown churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const initials = (() => {
    if (!user?.name) return "?";
    const parts = user.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  })();

  const roleTag = role === "coach" ? "COACH" : "STUDENT";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-[200px] shrink-0 flex-col bg-ink-deep border-r border-border/20 sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-5 pt-5 pb-2">
          <button
            onClick={() => setLocation("/")}
            className="text-ember text-sm font-bold tracking-tight cursor-pointer hover:text-ember/80 transition-colors"
          >
            BooGMe
          </button>
          <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-bone-muted mt-0.5">
            {roleTag}
          </div>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-[10px] text-bone-muted hover:text-bone transition-colors mt-1.5"
          >
            <Home className="w-2.5 h-2.5" />
            Home
          </button>
        </div>

        {/* Role switcher (only for both-role users) */}
        {onRoleChange && (
          <div className="mx-4 mb-3 flex items-center gap-0.5 bg-background rounded-sm p-0.5">
            {(["student", "coach"] as const).map((r) => (
              <button
                key={r}
                onClick={() => onRoleChange(r)}
                className={cn(
                  "flex-1 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all rounded-sm",
                  role === r ? "bg-ember text-white" : "text-bone-muted hover:text-bone"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Nav */}
        <div className="px-4 mt-2">
          <div className="eyebrow mb-2">Menu</div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.key;
              const badge = (item as any).badgeKey === "messages" && totalUnread > 0
                ? totalUnread
                : null;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between",
                    isActive
                      ? "border-l-2 border-ember text-ember font-medium -ml-px"
                      : "text-bone-muted hover:text-bone"
                  )}
                >
                  <span>{item.label}</span>
                  {badge && (
                    <span className="bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm min-w-[18px] text-center">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account footer */}
        <div className="mt-auto px-4 py-4 border-t border-border/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-ember/20 text-ember text-[11px] font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-bone truncate">{user?.name || "User"}</div>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-bone-muted">
                {roleTag}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/settings")}
              className="text-[11px] text-bone-muted hover:text-bone transition-colors"
            >
              Settings
            </button>
            <span className="text-bone-muted/30 text-[10px]">·</span>
            <button
              onClick={logout}
              className="text-[11px] text-bone-muted hover:text-bone transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/20 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-bone-muted">
                {format(new Date(), "EEEE · MMMM d, yyyy")}
              </div>
              <h1 className="text-xl font-semibold text-bone mt-1">
                Good {greeting}, {firstName}.
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              {role === "student" ? (
                <>
                  <button
                    onClick={() => setLocation("/coaches")}
                    className="px-3 py-1.5 text-sm text-bone-muted hover:text-bone border border-border/40 rounded-sm transition-colors"
                  >
                    Find Another Coach
                  </button>
                  <button
                    onClick={() => setLocation("/coaches")}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-ember rounded-sm hover:bg-ember/90 transition-colors"
                  >
                    + Book a Lesson
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/coach/${user?.id}`);
                      toast.success("Booking link copied to clipboard");
                    }}
                    className="px-3 py-1.5 text-sm text-bone-muted hover:text-bone border border-border/40 rounded-sm transition-colors"
                  >
                    Share Booking Link
                  </button>
                  <button
                    onClick={() => {
                      onSectionChange("storefront");
                      const el = document.getElementById("storefront");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-ember rounded-sm hover:bg-ember/90 transition-colors"
                  >
                    + Upload Content
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
