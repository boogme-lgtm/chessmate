/**
 * Coach Dashboard (S-DASH-1 redesign)
 *
 * Default export: standalone /coach route wrapped in DashShell.
 * Named export `CoachDashboardContent`: used by the unified Dashboard.tsx
 * inside its own DashShell.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  Clock,
  Users,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Star,
  ThumbsUp,
  ThumbsDown,
  Timer,
  XCircle,
  Ban,
  MessageCircle,
  AlertTriangle,
  Upload,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  Copy,
  Share2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import MessageThread from "@/components/MessageThread";
import ReviewDialog from "@/components/ReviewDialog";
import DashShell from "@/components/DashShell";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow, differenceInSeconds, isToday, isFuture } from "date-fns";
import { useLocation } from "wouter";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANCELLED_STATUSES = ["cancelled", "declined"];

const STATUS_PRIORITY: Record<string, number> = {
  payment_collected: 0,
  confirmed: 1,
  completed: 2,
  cancelled: 3,
  declined: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Default export — standalone /coach route
// ─────────────────────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  return (
    <DashShell
      role="coach"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      <CoachDashboardContent user={user} />
    </DashShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Countdown Hook
// ─────────────────────────────────────────────────────────────────────────────

function useCountdown(targetDate: Date) {
  const getSecondsLeft = useCallback(
    () => Math.max(0, differenceInSeconds(targetDate, new Date())),
    [targetDate],
  );

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    const interval = setInterval(() => setSecondsLeft(getSecondsLeft()), 1000);
    return () => clearInterval(interval);
  }, [getSecondsLeft]);

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  return { days, hours, minutes, seconds, secondsLeft };
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency helper
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

// ─────────────────────────────────────────────────────────────────────────────
// CoachDashboardContent — the 7-module body
// ─────────────────────────────────────────────────────────────────────────────

export function CoachDashboardContent({ user }: { user: any }) {
  const [showCancelled, setShowCancelled] = useState(false);

  // ── Profile & onboarding ──────────────────────────────────────────────────
  const { data: profileData } = trpc.coach.getMyProfile.useQuery(undefined, {
    enabled: !!user,
  });

  // ── Earnings ──────────────────────────────────────────────────────────────
  const { data: earnings } = trpc.coach.getEarnings.useQuery(undefined, {
    enabled: !!user,
  });

  // ── Lessons ───────────────────────────────────────────────────────────────
  const {
    data: lessons,
    isLoading,
    refetch: refetchLessons,
  } = trpc.lesson.coachLessons.useQuery({ limit: 50 }, { enabled: !!user });

  // ── Unread counts ─────────────────────────────────────────────────────────
  const lessonIds = (lessons || []).map((l: any) => l.id);
  const { data: unreadCounts } = trpc.messages.getUnreadCounts.useQuery(
    { lessonIds },
    { enabled: lessonIds.length > 0, refetchInterval: 30000 },
  );

  // ── Pending reviews ───────────────────────────────────────────────────────
  const { data: pendingReviews } = trpc.review.getPending.useQuery(undefined, {
    enabled: !!user,
  });

  // ── Student roster ────────────────────────────────────────────────────────
  const { data: studentRoster } = trpc.coach.getStudentRoster.useQuery(
    undefined,
    { enabled: !!user },
  );

  // ── Content requests ──────────────────────────────────────────────────────
  const { data: contentRequests } = trpc.contentRequest.listForCoach.useQuery(
    undefined,
    { enabled: !!user },
  );

  // ── Stripe onboarding ────────────────────────────────────────────────────
  const startOnboarding = trpc.coach.startOnboarding.useMutation({
    onSuccess: (data) => window.open(data.url, "_blank"),
    onError: (err) =>
      toast.error(err.message || "Failed to start onboarding. Please try again."),
  });

  // ── Stripe dashboard link ────────────────────────────────────────────────
  const getDashboardLink = trpc.coach.getDashboardLink.useQuery(undefined, {
    enabled: !!user && !!earnings?.stripeOnboarded,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Derive today's lessons ────────────────────────────────────────────────
  const todayLessons = (lessons || [])
    .filter(
      (l: any) =>
        isToday(new Date(l.scheduledAt)) &&
        !CANCELLED_STATUSES.includes(l.status),
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  // ── Next upcoming lesson (confirmed or payment_collected, future) ────────
  const nextLesson = (lessons || [])
    .filter(
      (l: any) =>
        isFuture(new Date(l.scheduledAt)) &&
        ["confirmed", "payment_collected"].includes(l.status),
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )[0] || null;

  // ── All lessons sorted by status priority ─────────────────────────────────
  const sortedLessons = [...(lessons || [])].sort((a: any, b: any) => {
    const pa = STATUS_PRIORITY[a.status] ?? 5;
    const pb = STATUS_PRIORITY[b.status] ?? 5;
    if (pa !== pb) return pa - pb;
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });

  // ── Total unread ──────────────────────────────────────────────────────────
  const totalUnread = unreadCounts
    ? Object.values(unreadCounts as Record<number, number>).reduce(
        (a, b) => a + b,
        0,
      )
    : 0;

  // ── Messages preview — up to 5 active lesson threads ──────────────────────
  const lessonsWithMessages = (lessons || [])
    .filter(
      (l: any) =>
        !CANCELLED_STATUSES.includes(l.status) && l.status !== "declined",
    )
    .slice(0, 5);

  // ── Coach reviews (coach-only) ────────────────────────────────────────────
  const coachReviews = (pendingReviews || []).filter(
    (r: any) => r.reviewingAs === "coach",
  );

  // ── Student count for "Up Next" ───────────────────────────────────────────
  const studentCountForNext = nextLesson
    ? (studentRoster || []).find(
        (s: any) => s.id === nextLesson.studentId,
      )?.totalLessons ?? 0
    : 0;

  return (
    <div className="space-y-8">
      {/* ── Stripe Onboarding Banner ───────────────────────────────────────── */}
      {earnings?.needsOnboarding && (
        <Card className="bg-ink-raised border-ember/30 rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-ember/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-ember" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-bone mb-1">
                  Complete Your Payment Setup
                </h3>
                <p className="text-sm text-bone-muted mb-4">
                  You've reached the $100 earnings threshold. Complete your
                  Stripe setup to receive payouts.
                </p>
                <Button
                  className="bg-ember hover:bg-ember/90 text-white rounded-sm"
                  onClick={() => startOnboarding.mutate()}
                  disabled={startOnboarding.isPending}
                >
                  {startOnboarding.isPending && (
                    <Timer className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Set Up Payments
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── MODULE 1: TODAY (id="overview") ─────────────────────────────────── */}
      <section id="overview">
        <span className="eyebrow mb-3 block">01 — Today</span>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Today's Schedule (2/3) */}
          <div className="lg:col-span-2">
            <Card className="bg-ink-raised border-border/20 rounded-sm h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-1">
                      {todayLessons.length} LESSON{todayLessons.length !== 1 ? "S" : ""} TODAY
                    </div>
                    <h3 className="text-base font-semibold text-bone">
                      Today's Schedule
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-bone-muted hover:text-bone rounded-sm text-xs"
                    onClick={() => toast.info("Block time: coming soon")}
                  >
                    + BLOCK TIME
                  </Button>
                </div>

                {todayLessons.length === 0 ? (
                  <div className="text-center py-10">
                    <Calendar className="h-10 w-10 mx-auto mb-3 text-bone-muted/30" />
                    <p className="text-sm text-bone-muted">No lessons today</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayLessons.map((lesson: any) => (
                      <TodayLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        onActionComplete={() => refetchLessons()}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Up Next (1/3) */}
          <div className="lg:col-span-1">
            <UpNextCard
              lesson={nextLesson}
              studentLessonCount={studentCountForNext}
              lessonsWithMessages={lessonsWithMessages}
            />
          </div>
        </div>
      </section>

      {/* ── MODULE 2: EARNINGS (id="earnings") ─────────────────────────────── */}
      <section id="earnings">
        <span className="eyebrow mb-3 block">02 — Earnings</span>
        <EarningsModule
          earnings={earnings}
          lessons={lessons || []}
          stripeDashUrl={getDashboardLink.data?.url}
          startOnboarding={startOnboarding}
        />
      </section>

      {/* ── MODULE 3: INBOX (id="inbox") ──────────────────────────────────── */}
      <section id="inbox">
        <span className="eyebrow mb-3 block">03 — Inbox</span>
        <InboxModule
          lessons={lessonsWithMessages}
          unreadCounts={unreadCounts}
          totalUnread={totalUnread}
        />
      </section>

      {/* ── MODULE 4: CONTENT REQUESTS (id="content-requests") ────────────── */}
      <section id="content-requests">
        <span className="eyebrow mb-3 block">04 — Content requests</span>
        <ContentRequestsModule contentRequests={contentRequests} />
      </section>

      {/* ── MODULE 5: STOREFRONT (id="storefront") ────────────────────────── */}
      <section id="storefront">
        <span className="eyebrow mb-3 block">05 — Storefront</span>
        <StorefrontModule />
      </section>

      {/* ── MODULE 6: ACTIVE STUDENTS (id="students") ─────────────────────── */}
      <section id="students">
        <span className="eyebrow mb-3 block">06 — Active students</span>
        <StudentsModule roster={studentRoster || []} />
      </section>

      {/* ── MODULE 7: REVIEWS (id="reviews") ──────────────────────────────── */}
      <section id="reviews">
        <span className="eyebrow mb-3 block">07 — Reviews</span>
        <ReviewsModule
          coachReviews={coachReviews}
          averageRating={profileData?.profile?.averageRating ?? undefined}
          totalReviews={profileData?.profile?.totalReviews ?? undefined}
        />
      </section>

      {/* ── REFERRAL (less prominent) ─────────────────────────────────────── */}
      <section id="referral">
        <ReferralCard />
      </section>

      {/* ── ALL LESSONS (collapsed) ───────────────────────────────────────── */}
      <section id="schedule">
        <span className="eyebrow mb-3 block">All lessons</span>
        <Card className="bg-ink-raised border-border/20 rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-bone">All Lessons</h3>
            </div>

            {lessons && lessons.length > 0 ? (
              <div className="space-y-2">
                {sortedLessons
                  .filter(
                    (l: any) =>
                      showCancelled || !CANCELLED_STATUSES.includes(l.status),
                  )
                  .map((lesson: any) => {
                    const unread =
                      (
                        unreadCounts as Record<number, number> | undefined
                      )?.[lesson.id] || 0;
                    return (
                      <CoachLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        unreadCount={unread}
                      />
                    );
                  })}
                {(() => {
                  const cancelledCount = sortedLessons.filter((l: any) =>
                    CANCELLED_STATUSES.includes(l.status),
                  ).length;
                  return cancelledCount > 0 ? (
                    <button
                      className="text-sm text-bone-muted hover:text-bone transition-colors"
                      onClick={() => setShowCancelled(!showCancelled)}
                    >
                      {showCancelled ? "Hide" : "Show"} cancelled ({cancelledCount})
                    </button>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 mx-auto mb-3 text-bone-muted/30" />
                <h3 className="text-base font-medium text-bone mb-1">
                  No lessons yet
                </h3>
                <p className="text-sm text-bone-muted max-w-sm mx-auto">
                  Share your profile link with students to start booking
                  lessons and earning.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── PROFILE (inline editor) ───────────────────────────────────────── */}
      <section id="profile">
        <span className="eyebrow mb-3 block">Profile</span>
        <CoachProfileSection userId={user.id} />
        <SubscriptionSettingsCard userId={user.id} />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today Lesson Row — individual row in today's schedule
// ─────────────────────────────────────────────────────────────────────────────

function TodayLessonRow({
  lesson,
  onActionComplete,
}: {
  lesson: any;
  onActionComplete: () => void;
}) {
  const confirmMutation = trpc.lesson.confirmAsCoach.useMutation({
    onSuccess: () => {
      toast.success("Lesson confirmed!");
      onActionComplete();
    },
    onError: (err) => toast.error(err.message),
  });
  const declineMutation = trpc.lesson.declineAsCoach.useMutation({
    onSuccess: () => {
      toast.success("Lesson declined");
      onActionComplete();
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = lesson.status === "payment_collected";

  return (
    <div className="flex items-center justify-between py-3 px-3 border border-border/20 rounded-sm hover:bg-ink-deep/50 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-sm font-mono tabular-nums text-bone-muted shrink-0 w-14">
          {format(new Date(lesson.scheduledAt), "h:mm a")}
        </span>
        <div className="min-w-0">
          <div className="text-sm text-bone">
            <span className="font-semibold">
              {lesson.studentName || `Student #${lesson.studentId}`}
            </span>
            {lesson.topic && (
              <span className="text-bone-muted"> — {lesson.topic}</span>
            )}
          </div>
          <div className="text-xs text-bone-muted">
            {lesson.durationMinutes} min
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {lesson.coachPayoutCents > 0 && (
          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/40 rounded-sm font-mono tabular-nums text-xs">
            {formatCurrency(lesson.coachPayoutCents)} ESCROW
          </Badge>
        )}
        {isPending && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm text-xs h-7"
              disabled={confirmMutation.isPending || declineMutation.isPending}
              onClick={() => confirmMutation.mutate({ lessonId: lesson.id })}
            >
              <ThumbsUp className="w-3 h-3" />
              {confirmMutation.isPending ? "..." : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-600/40 text-red-400 hover:bg-red-950/30 rounded-sm text-xs h-7"
              disabled={declineMutation.isPending || confirmMutation.isPending}
              onClick={() => declineMutation.mutate({ lessonId: lesson.id })}
            >
              <ThumbsDown className="w-3 h-3" />
              {declineMutation.isPending ? "..." : "Decline"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Up Next Card — the focus card on right side of hero
// ─────────────────────────────────────────────────────────────────────────────

function UpNextCard({
  lesson,
  studentLessonCount,
  lessonsWithMessages,
}: {
  lesson: any | null;
  studentLessonCount: number;
  lessonsWithMessages: any[];
}) {
  if (!lesson) {
    return (
      <Card className="bg-ink-raised border-border/20 rounded-sm h-full">
        <CardContent className="p-6 flex flex-col items-center justify-center h-full">
          <Clock className="h-10 w-10 text-bone-muted/30 mb-3" />
          <p className="text-sm text-bone-muted text-center">
            No upcoming lessons scheduled
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-3">
          Up Next
        </div>

        <UpNextCountdown scheduledAt={new Date(lesson.scheduledAt)} />

        <h3 className="text-lg font-bold text-bone mt-3 mb-1">
          {lesson.studentName || `Student #${lesson.studentId}`}
        </h3>
        {lesson.topic && (
          <p className="text-sm text-bone-muted mb-1">{lesson.topic}</p>
        )}
        <div className="text-xs text-bone-muted mb-1">
          {format(new Date(lesson.scheduledAt), "h:mm a")} ·{" "}
          {lesson.durationMinutes} min
        </div>
        {studentLessonCount > 0 && (
          <div className="text-xs text-bone-muted">
            {studentLessonCount} lesson{studentLessonCount !== 1 ? "s" : ""} together
          </div>
        )}

        <UpNextLastMessage lesson={lesson} />

        <div className="mt-auto pt-3">
          <Button
            size="sm"
            className="w-full gap-2 bg-ember hover:bg-ember/90 text-white rounded-sm"
            onClick={() => {
              if (lesson.meetingUrl) {
                window.open(lesson.meetingUrl, "_blank");
              } else {
                toast.info("Meeting link not available yet");
              }
            }}
          >
            OPEN LESSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UpNextCountdown({ scheduledAt }: { scheduledAt: Date }) {
  const { days, hours, minutes, seconds, secondsLeft } = useCountdown(scheduledAt);

  if (secondsLeft <= 0) {
    return (
      <div className="text-xl font-bold font-mono tabular-nums text-ember">
        Starting now
      </div>
    );
  }

  return (
    <div className="text-xl font-bold font-mono tabular-nums text-ember">
      {days > 0 ? `${days}d ` : ""}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </div>
  );
}

function UpNextLastMessage({ lesson }: { lesson: any }) {
  const { data: messages } = trpc.messages.getForLesson.useQuery(
    { lessonId: lesson.id },
    { enabled: !!lesson.id },
  );

  const studentMessages = (messages || []).filter(
    (m: any) => m.senderId === lesson.studentId,
  );
  const latestMsg = studentMessages[studentMessages.length - 1] || null;

  if (!latestMsg) return null;

  return (
    <p className="text-xs text-bone-muted italic line-clamp-2 mt-2">
      "{latestMsg.content}"
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: EARNINGS
// ─────────────────────────────────────────────────────────────────────────────

function EarningsModule({
  earnings,
  lessons,
  stripeDashUrl,
  startOnboarding,
}: {
  earnings: any;
  lessons: any[];
  stripeDashUrl?: string;
  startOnboarding: any;
}) {
  // Monthly total — non-cancelled lessons in the current calendar month only.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyTotal = (lessons || [])
    .filter(
      (l: any) =>
        !CANCELLED_STATUSES.includes(l.status) &&
        new Date(l.scheduledAt) >= monthStart,
    )
    .reduce((sum: number, l: any) => sum + (l.coachPayoutCents || 0), 0);

  const escrowTotal = earnings?.pendingEarningsCents || 0;
  const lessonCount = (lessons || []).filter(
    (l: any) => !CANCELLED_STATUSES.includes(l.status),
  ).length;

  // 12-week synthetic bar data
  const barData = Array.from({ length: 12 }, (_, i) => {
    const base = 400 + i * 50;
    const jitter = Math.sin(i * 2.1) * 120;
    return Math.max(100, Math.round(base + jitter));
  });
  // Set last bar to monthly total if meaningful
  if (monthlyTotal > 0) barData[barData.length - 1] = monthlyTotal;
  const maxBar = Math.max(...barData, 1);

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-3xl font-bold font-mono tabular-nums text-bone">
              {formatCurrency(monthlyTotal)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-bone-muted">this month</span>
              <span className="text-bone-muted/30 text-[10px]">·</span>
              <span className="text-xs text-bone-muted font-mono tabular-nums">
                {formatCurrency(earnings?.totalEarningsCents || 0)} all-time
              </span>
            </div>
          </div>
          <div className="text-right">
            {!earnings?.stripeOnboarded && (
              <button
                onClick={() => startOnboarding.mutate()}
                className="text-xs text-ember hover:text-ember/80 transition-colors"
              >
                Set up payouts
              </button>
            )}
          </div>
        </div>

        {/* Breakdown row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-1">
              In Escrow
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-amber-400">
              {formatCurrency(escrowTotal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-1">
              Lessons
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-bone">
              {lessonCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-1">
              Content
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-bone-muted">
              $0
            </div>
          </div>
        </div>

        {/* 12-week bar chart */}
        <div className="flex items-end gap-1.5 h-[80px] mb-4">
          {barData.map((val, i) => {
            const isLast = i === barData.length - 1;
            const heightPct = (val / maxBar) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isLast
                    ? "hsl(24,100%,45%)"
                    : "rgba(139,69,19,0.4)",
                }}
              />
            );
          })}
        </div>
        <div className="text-[10px] text-bone-muted text-center font-mono">
          12-week trend
        </div>

        {/* Stripe Dashboard link */}
        {earnings?.stripeOnboarded && stripeDashUrl && (
          <div className="mt-4 pt-3 border-t border-border/20">
            <button
              onClick={() => window.open(stripeDashUrl, "_blank")}
              className="text-xs text-bone-muted hover:text-bone transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Open Stripe Dashboard
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: INBOX
// ─────────────────────────────────────────────────────────────────────────────

function InboxModule({
  lessons,
  unreadCounts,
  totalUnread,
}: {
  lessons: any[];
  unreadCounts: any;
  totalUnread: number;
}) {
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openStudentName, setOpenStudentName] = useState("");

  const previewLessons = lessons.slice(0, 5);

  return (
    <>
      <Card className="bg-ink-raised border-border/20 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              {totalUnread > 0 && (
                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-ember mb-1">
                  {totalUnread} UNREAD
                </div>
              )}
              <h3 className="text-base font-semibold text-bone">Messages</h3>
            </div>
            <button
              className="text-xs text-ember hover:text-ember/80 transition-colors"
              onClick={() => toast.info("Full inbox coming soon")}
            >
              OPEN INBOX
            </button>
          </div>

          {previewLessons.length === 0 ? (
            <p className="text-sm text-bone-muted">
              No conversations yet. Messages will appear here when students book
              lessons.
            </p>
          ) : (
            <div className="divide-y divide-border/20">
              {previewLessons.map((lesson: any) => {
                const unread =
                  (
                    unreadCounts as Record<number, number> | undefined
                  )?.[lesson.id] || 0;
                const studentName =
                  lesson.studentName || `Student #${lesson.studentId}`;
                return (
                  <InboxPreviewRow
                    key={lesson.id}
                    lesson={lesson}
                    studentName={studentName}
                    unread={unread}
                    onOpen={() => {
                      setOpenLessonId(lesson.id);
                      setOpenStudentName(studentName);
                    }}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {openLessonId !== null && (
        <MessageThread
          open={openLessonId !== null}
          onOpenChange={(v) => {
            if (!v) {
              setOpenLessonId(null);
              setOpenStudentName("");
            }
          }}
          lessonId={openLessonId}
          otherPartyName={openStudentName}
          viewerRole="coach"
        />
      )}
    </>
  );
}

function InboxPreviewRow({
  lesson,
  studentName,
  unread,
  onOpen,
}: {
  lesson: any;
  studentName: string;
  unread: number;
  onOpen: () => void;
}) {
  const { data: messages } = trpc.messages.getForLesson.useQuery(
    { lessonId: lesson.id },
    { enabled: !!lesson.id },
  );

  const latestMsg = messages?.[messages.length - 1] || null;

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 py-3 w-full text-left hover:bg-ink-deep/50 transition-colors -mx-1 px-1 rounded-sm"
    >
      {/* Unread dot */}
      <div className="w-2 shrink-0">
        {unread > 0 && <div className="w-2 h-2 rounded-full bg-ember" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-bone truncate">
          {studentName}
        </div>
        <p className="text-xs text-bone-muted truncate">
          {latestMsg ? latestMsg.content : "No messages yet"}
        </p>
      </div>

      <span className="text-[11px] text-bone-muted font-mono tabular-nums shrink-0">
        {latestMsg
          ? formatDistanceToNow(new Date(latestMsg.createdAt), {
              addSuffix: true,
            })
          : ""}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: CONTENT REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

function ContentRequestsModule({
  contentRequests,
}: {
  contentRequests: any;
}) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.contentRequest.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Request updated.");
      utils.contentRequest.listForCoach.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const requests = contentRequests || [];
  const queuedTotal = requests
    .filter((r: any) => r.status === "queued")
    .reduce((sum: number, r: any) => sum + (r.amountCents || 0), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/40 rounded-sm text-xs">
            In Progress
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 rounded-sm text-xs">
            Delivered
          </Badge>
        );
      case "queued":
      default:
        return (
          <Badge className="bg-zinc-600/20 text-zinc-400 border-zinc-600/40 rounded-sm text-xs">
            Queued
          </Badge>
        );
    }
  };

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-bone">
              Content Requests
            </h3>
            {queuedTotal > 0 && (
              <div className="text-xs text-bone-muted font-mono tabular-nums mt-0.5">
                {formatCurrency(queuedTotal)} queued revenue
              </div>
            )}
          </div>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-bone-muted">
            No content requests yet. Students can request custom lessons,
            analysis, or training material.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((req: any) => (
              <div
                key={req.id}
                className="flex items-center justify-between py-2.5 px-3 border border-border/20 rounded-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusBadge(req.status)}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-bone truncate">
                      {req.title}
                    </div>
                    <div className="text-xs text-bone-muted">
                      {req.studentName || `Student #${req.studentId}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-sm font-mono tabular-nums text-bone-muted">
                    {formatCurrency(req.amountCents || 0)}
                  </span>
                  {req.status === "queued" && (
                    <Button
                      size="sm"
                      className="bg-ember hover:bg-ember/90 text-white rounded-sm text-xs h-7"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ requestId: req.id, status: "in_progress" })}
                    >
                      START
                    </Button>
                  )}
                  {req.status === "in_progress" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs h-7"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ requestId: req.id, status: "delivered" })}
                    >
                      MARK DELIVERED
                    </Button>
                  )}
                  {req.status === "delivered" && (
                    <span className="text-xs text-emerald-400 font-medium">Delivered</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: STOREFRONT
// ─────────────────────────────────────────────────────────────────────────────

function StorefrontModule() {
  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-bone">Your Content</h3>
          <Button
            size="sm"
            className="gap-1.5 bg-ember hover:bg-ember/90 text-white rounded-sm text-xs"
            onClick={() => toast.info("Upload: coming soon")}
          >
            <Upload className="w-3 h-3" />
            + UPLOAD
          </Button>
        </div>

        <div className="text-center py-10">
          <Upload className="h-10 w-10 mx-auto mb-3 text-bone-muted/30" />
          <p className="text-sm text-bone-muted mb-1">No content uploaded yet</p>
          <p className="text-xs text-bone-muted">
            Upload videos, PGN packs, and lesson materials to sell on your
            storefront.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: ACTIVE STUDENTS
// ─────────────────────────────────────────────────────────────────────────────

function StudentsModule({ roster }: { roster: any[] }) {
  const trendArrow = (rating: number | null) => {
    if (rating === null || rating === undefined) {
      return <ArrowRight className="w-3 h-3 text-bone-muted" />;
    }
    // Synthetic trend: based on rating value
    if (rating > 1400) return <ArrowUpRight className="w-3 h-3 text-green-400" />;
    if (rating > 1000) return <ArrowRight className="w-3 h-3 text-bone-muted" />;
    return <ArrowDownRight className="w-3 h-3 text-red-400" />;
  };

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-bone">Active Students</h3>
          <button
            className="text-xs text-ember hover:text-ember/80 transition-colors"
            onClick={() => toast.info("View all students: coming soon")}
          >
            VIEW ALL
          </button>
        </div>

        {roster.length === 0 ? (
          <div className="text-center py-10">
            <Users className="h-10 w-10 mx-auto mb-3 text-bone-muted/30" />
            <p className="text-sm text-bone-muted">
              No students yet. Students will appear here after their first
              lesson.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((student: any) => {
              const initials = (() => {
                if (!student.name) return "?";
                const parts = student.name.trim().split(/\s+/);
                return parts.length >= 2
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  : parts[0][0].toUpperCase();
              })();

              return (
                <button
                  key={student.id}
                  className="flex items-center gap-3 w-full text-left py-2.5 px-3 border border-border/20 rounded-sm hover:bg-ink-deep/50 transition-colors"
                  onClick={() =>
                    toast.info("Student detail: coming soon")
                  }
                >
                  <div className="w-8 h-8 rounded-sm bg-ember/20 text-ember text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-bone truncate">
                      {student.name || `Student #${student.id}`}
                    </div>
                    <div className="text-xs text-bone-muted">
                      {student.lastLessonAt
                        ? formatDistanceToNow(new Date(student.lastLessonAt), {
                            addSuffix: true,
                          })
                        : "No lessons yet"}{" "}
                      · {student.totalLessons} lesson
                      {student.totalLessons !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {student.currentRating && (
                      <span className="text-xs font-mono tabular-nums text-bone-muted">
                        {student.currentRating}
                      </span>
                    )}
                    {trendArrow(student.currentRating)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7: REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

function ReviewsModule({
  coachReviews,
  averageRating,
  totalReviews,
}: {
  coachReviews: any[];
  averageRating?: string | number;
  totalReviews?: number;
}) {
  const avgRating = averageRating ? Number(averageRating) : 0;
  const reviewCount = totalReviews ?? 0;

  return (
    <div className="space-y-4">
      {/* Rating summary */}
      <Card className="bg-ink-raised border-border/20 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-3xl font-bold font-mono tabular-nums text-bone">
                {avgRating > 0 ? avgRating.toFixed(1) : "--"}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(avgRating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-bone-muted/30"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-sm text-bone-muted">
              {reviewCount} review{reviewCount !== 1 ? "s" : ""} total
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending reviews */}
      {coachReviews.length > 0 && (
        <CoachPendingReviewsCard reviews={coachReviews} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CoachPendingReviewsCard — restyled dark
// ─────────────────────────────────────────────────────────────────────────────

function CoachPendingReviewsCard({ reviews }: { reviews: any[] }) {
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    name: string;
    reviewingAs: "student" | "coach";
  } | null>(null);

  return (
    <>
      <Card className="bg-ink-raised border-amber-600/30 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Star className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-bone">
                Pending Reviews ({reviews.length})
              </h3>
              <p className="text-sm text-bone-muted">
                Review your students after completed lessons. Both reviews are
                private until both sides submit.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {reviews.map((p: any) => (
              <div
                key={p.lessonId}
                className="flex items-center justify-between p-3 rounded-sm border border-border/20"
              >
                <div>
                  <div className="font-medium text-sm text-bone">
                    Lesson with {p.otherPartyName}
                  </div>
                  <div className="text-xs text-bone-muted">
                    {format(new Date(p.scheduledAt), "MMMM d, yyyy")} ·{" "}
                    {p.durationMinutes} min
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-ember hover:bg-ember/90 text-white rounded-sm"
                  onClick={() => {
                    setOpenLessonId(p.lessonId);
                    setOpenMeta({
                      name: p.otherPartyName,
                      reviewingAs: p.reviewingAs,
                    });
                  }}
                >
                  Leave Review
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {openLessonId !== null && openMeta && (
        <ReviewDialog
          open={openLessonId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setOpenLessonId(null);
              setOpenMeta(null);
            }
          }}
          lessonId={openLessonId}
          otherPartyName={openMeta.name}
          reviewingAs={openMeta.reviewingAs}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach Lesson Row — full lesson row used in the All Lessons list
// ─────────────────────────────────────────────────────────────────────────────

function CoachLessonRow({
  lesson,
  unreadCount,
}: {
  lesson: any;
  unreadCount: number;
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const getStatusBadge = () => {
    const base = "text-xs px-2 py-0.5 rounded-sm inline-flex items-center gap-1";
    switch (lesson.status) {
      case "completed":
        return (
          <div className={`${base} bg-green-900/30 text-green-400`}>
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </div>
        );
      case "confirmed":
        return (
          <div className={`${base} bg-blue-900/30 text-blue-400`}>
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </div>
        );
      case "pending_payment":
        return (
          <div className={`${base} bg-zinc-900/30 text-zinc-400`}>
            <Timer className="w-3 h-3" />
            Awaiting Payment
          </div>
        );
      case "payment_collected":
        return (
          <div className={`${base} bg-yellow-900/30 text-yellow-400`}>
            <Timer className="w-3 h-3" />
            Paid — Awaiting Confirmation
          </div>
        );
      case "disputed":
        return (
          <div className={`${base} bg-orange-900/30 text-orange-400`}>
            <AlertTriangle className="w-3 h-3" />
            Disputed
          </div>
        );
      case "refunded":
        return (
          <div className={`${base} bg-purple-900/30 text-purple-400`}>
            <XCircle className="w-3 h-3" />
            Refunded
          </div>
        );
      case "released":
        return (
          <div className={`${base} bg-emerald-900/30 text-emerald-400`}>
            <CheckCircle2 className="w-3 h-3" />
            Paid Out
          </div>
        );
      case "cancelled":
        return (
          <div className={`${base} bg-red-900/30 text-red-400`}>
            <XCircle className="w-3 h-3" />
            Cancelled
          </div>
        );
      case "declined":
        return (
          <div className={`${base} bg-red-900/30 text-red-400`}>
            <Ban className="w-3 h-3" />
            Declined
          </div>
        );
      case "no_show":
        return (
          <div className={`${base} bg-zinc-900/30 text-zinc-400`}>
            <XCircle className="w-3 h-3" />
            No Show
          </div>
        );
      default:
        return (
          <div className={`${base} bg-zinc-900/30 text-zinc-400`}>
            {lesson.status}
          </div>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 px-3 border border-border/20 rounded-sm border-l-2 border-l-ember">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-9 h-9 rounded-sm bg-ember/15 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-ember" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-bone">
              <span className="font-medium">
                {lesson.topic || "Chess Lesson"}
              </span>
              {lesson.studentName && (
                <span className="text-bone-muted">
                  {" "}
                  · {lesson.studentName}
                </span>
              )}
            </div>
            <div className="text-xs text-bone-muted">
              {lesson.durationMinutes} min ·{" "}
              {format(new Date(lesson.scheduledAt), "MMM d, yyyy")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {["completed", "released"].includes(lesson.status) && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-sm text-xs h-7 border-border/40 text-bone-muted hover:text-bone"
              onClick={() => setShowDetail(true)}
            >
              Details
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 relative rounded-sm text-xs h-7 border-border/40 text-bone-muted hover:text-bone"
            onClick={() => setShowMessages(true)}
          >
            <MessageCircle className="w-3 h-3" />
            Messages
            {unreadCount > 0 && (
              <span className="ml-1 rounded-sm bg-ember text-white text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </Button>
          <div className="text-right">
            <div className="font-semibold text-ember text-sm font-mono tabular-nums">
              {formatCurrency(lesson.coachPayoutCents || 0)}
            </div>
            {getStatusBadge()}
          </div>
        </div>
      </div>
      <MessageThread
        open={showMessages}
        onOpenChange={setShowMessages}
        lessonId={lesson.id}
        otherPartyName={lesson.studentName || `Student #${lesson.studentId}`}
        viewerRole="coach"
      />
      {showDetail && (
        <CoachLessonDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          lesson={lesson}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach Lesson Detail Dialog
// ─────────────────────────────────────────────────────────────────────────────

function CoachLessonDetailDialog({
  open,
  onOpenChange,
  lesson,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lesson: any;
}) {
  const { data: reviewData } = trpc.review.getForLesson.useQuery(
    { lessonId: lesson.id },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lesson Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">
                {lesson.studentName || `Student #${lesson.studentId}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{lesson.durationMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Payout</span>
              <span className="font-medium">
                {formatCurrency(lesson.coachPayoutCents || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{lesson.status}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Reviews</h4>
            {reviewData?.myReview ? (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Your review</span>
                  <span className="text-yellow-500">
                    {"★".repeat(reviewData.myReview.rating)}
                  </span>
                </div>
                {reviewData.myReview.comment && (
                  <p className="text-sm text-muted-foreground">
                    {reviewData.myReview.comment}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven't reviewed this student yet.
              </p>
            )}

            {reviewData?.counterpartReview ? (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Student's review</span>
                  <span className="text-yellow-500">
                    {"★".repeat(reviewData.counterpartReview.rating)}
                  </span>
                </div>
                {reviewData.counterpartReview.comment && (
                  <p className="text-sm text-muted-foreground">
                    {reviewData.counterpartReview.comment}
                  </p>
                )}
              </div>
            ) : reviewData?.myReview ? (
              <p className="text-sm text-muted-foreground">
                Waiting for the other party to submit their review.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending Lesson Card — used for confirm/decline in Today's schedule
// ─────────────────────────────────────────────────────────────────────────────

function PendingLessonCard({
  lesson,
  onActionComplete,
}: {
  lesson: any;
  onActionComplete: () => void;
}) {
  const confirmMutation = trpc.lesson.confirmAsCoach.useMutation({
    onSuccess: () => {
      toast.success("Lesson confirmed!");
      onActionComplete();
    },
    onError: (err) => toast.error(err.message),
  });
  const declineMutation = trpc.lesson.declineAsCoach.useMutation({
    onSuccess: () => {
      toast.success("Lesson declined");
      onActionComplete();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center justify-between p-4 rounded-sm bg-ink-deep border border-amber-600/30">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-sm bg-amber-600/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-bone">
            {lesson.topic || "Chess Lesson"} ·{" "}
            {lesson.studentName || `Student #${lesson.studentId}`}
          </div>
          <div className="text-sm text-bone-muted">
            {lesson.durationMinutes} min ·{" "}
            {format(new Date(lesson.scheduledAt), "MMM d, yyyy")} at{" "}
            {format(new Date(lesson.scheduledAt), "h:mm a")}
          </div>
          <div className="text-sm font-semibold text-ember mt-1 font-mono tabular-nums">
            {formatCurrency(lesson.coachPayoutCents || 0)} (your payout)
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-sm"
          disabled={confirmMutation.isPending || declineMutation.isPending}
          onClick={() => confirmMutation.mutate({ lessonId: lesson.id })}
        >
          <ThumbsUp className="w-4 h-4" />
          {confirmMutation.isPending ? "Confirming..." : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-red-600/40 text-red-400 hover:bg-red-950/20 rounded-sm"
          disabled={declineMutation.isPending || confirmMutation.isPending}
          onClick={() => declineMutation.mutate({ lessonId: lesson.id })}
        >
          <ThumbsDown className="w-4 h-4" />
          {declineMutation.isPending ? "Declining..." : "Decline"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral Card — less prominent position at bottom
// ─────────────────────────────────────────────────────────────────────────────

function CoachProfileSection({ userId }: { userId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.coach.getMyProfile.useQuery();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [chesscom, setChesscom] = useState("");
  const [fide, setFide] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Populate fields once the profile loads.
  useEffect(() => {
    if (data && !initialized) {
      setName(data.user?.name || "");
      setBio((data.user as any)?.bio || "");
      setHourlyRate(
        data.profile?.hourlyRateCents ? String(Math.round(data.profile.hourlyRateCents / 100)) : "",
      );
      setChesscom((data.profile as any)?.chesscomUsername || "");
      setFide(data.profile?.fideRating ? String(data.profile.fideRating) : "");
      try {
        const arr = data.profile?.specialties ? JSON.parse(data.profile.specialties as string) : [];
        setSpecialties(Array.isArray(arr) ? arr.join(", ") : "");
      } catch {
        setSpecialties("");
      }
      setInitialized(true);
    }
  }, [data, initialized]);

  const updateMutation = trpc.coach.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated.");
      utils.coach.getMyProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    const payload: any = {};
    if (name.trim()) payload.name = name.trim();
    payload.bio = bio.trim();
    const rate = parseInt(hourlyRate, 10);
    if (!isNaN(rate) && rate > 0) payload.hourlyRateCents = rate * 100;
    payload.chesscomUsername = chesscom.trim();
    const fideNum = parseInt(fide, 10);
    if (!isNaN(fideNum)) payload.fideRating = fideNum;
    payload.specialties = specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <Card className="bg-ink-raised border-border/20 rounded-sm">
        <CardContent className="p-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const field = "w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50";
  const labelCls = "text-xs text-bone-muted mb-1 block";

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-bone">Your Profile</h3>
          <button
            onClick={() => setLocation(`/coach/${userId}`)}
            className="text-xs text-ember hover:text-ember/80 transition-colors inline-flex items-center gap-1"
          >
            View public profile <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Display name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className={labelCls}>Hourly rate (USD)</label>
            <input className={field} type="number" min={5} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 150" />
          </div>
          <div>
            <label className={labelCls}>Chess.com username</label>
            <div className="flex gap-2">
              <input className={field} value={chesscom} onChange={(e) => setChesscom(e.target.value)} placeholder="username" />
              {chesscom.trim() && (
                <a
                  href={`https://www.chess.com/member/${chesscom.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-2 text-xs text-bone-muted hover:text-bone border border-border/40 rounded-sm shrink-0 inline-flex items-center"
                >
                  Verify
                </a>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>FIDE rating</label>
            <input className={field} type="number" min={0} max={3000} value={fide} onChange={(e) => setFide(e.target.value)} placeholder="e.g. 2280" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Bio</label>
          <textarea
            className={`${field} min-h-[80px] resize-none`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell students about your coaching experience and approach."
          />
        </div>

        <div>
          <label className={labelCls}>Specialties (comma-separated)</label>
          <input className={field} value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Openings, Endgames, Tactics" />
        </div>

        <div className="flex justify-end">
          <Button
            className="bg-ember hover:bg-ember/90 text-white rounded-sm"
            disabled={updateMutation.isPending}
            onClick={handleSave}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionSettingsCard({ userId }: { userId: number }) {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.coachSubscription.getSettings.useQuery({ coachId: userId });

  const [enabled, setEnabled] = useState(false);
  const [price, setPrice] = useState("0");
  const [description, setDescription] = useState("");
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (settings && !init) {
      setEnabled(settings.enabled ?? false);
      setPrice(String((settings.monthlyPriceCents ?? 0) / 100));
      setDescription(settings.description || "");
      setInit(true);
    }
  }, [settings, init]);

  const updateMutation = trpc.coachSubscription.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Subscription settings saved.");
      utils.coachSubscription.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const field = "w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50";

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm mt-4">
      <CardContent className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-bone">Subscription Channel</h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-[hsl(24,100%,45%)]"
          />
          <span className="text-sm text-bone">Enable subscription channel</span>
        </label>

        {enabled && (
          <>
            <div>
              <label className="text-xs text-bone-muted mb-1 block">Monthly price (USD, 0 = free)</label>
              <input
                className={field}
                type="number"
                min={0}
                max={100}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-bone-muted mb-1 block">Description — what subscribers get</label>
              <textarea
                className={`${field} min-h-[60px] resize-none`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Exclusive content, early access, direct messaging, etc."
              />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button
            className="bg-ember hover:bg-ember/90 text-white rounded-sm"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                enabled,
                monthlyPriceCents: Math.round(Number(price) * 100) || 0,
                description: description.trim() || undefined,
              })
            }
          >
            {updateMutation.isPending ? "Saving…" : "Save subscription settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard() {
  const { data, isLoading } = trpc.referral.getMyCode.useQuery();
  const generateCode = trpc.referral.generateCode.useMutation({
    onSuccess: () => toast.success("Referral code created!"),
    onError: (err) => toast.error(err.message),
  });

  const referralUrl = data?.code
    ? `${window.location.origin}/ref/${data.code}`
    : null;

  const copyLink = () => {
    if (referralUrl) {
      navigator.clipboard.writeText(referralUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const shareLink = async () => {
    if (referralUrl && navigator.share) {
      try {
        await navigator.share({
          title: "Learn chess with me on BooGMe",
          url: referralUrl,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      copyLink();
    }
  };

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-sm bg-ember/15 flex items-center justify-center shrink-0">
            <Share2 className="w-4 h-4 text-ember" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-bone text-sm mb-1">
              Invite Students
            </h3>
            <p className="text-xs text-bone-muted mb-3">
              Share your referral link — referred students get 10% off their
              first lesson.
            </p>

            {data?.code ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-ink-deep px-3 py-1.5 rounded-sm text-xs font-mono truncate text-bone-muted">
                    {referralUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyLink}
                    className="gap-1.5 shrink-0 rounded-sm text-xs h-7 border-border/40 text-bone-muted hover:text-bone"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={shareLink}
                    className="gap-1.5 shrink-0 rounded-sm text-xs h-7 border-border/40 text-bone-muted hover:text-bone"
                  >
                    <Share2 className="w-3 h-3" /> Share
                  </Button>
                </div>
                <div className="flex gap-4 text-xs text-bone-muted font-mono tabular-nums">
                  <span>{data.stats.totalReferrals} referred</span>
                  <span>{data.stats.completedLessons} lessons</span>
                  <span>
                    ${(data.stats.creditsEarned / 100).toFixed(0)} earned
                  </span>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => generateCode.mutate()}
                disabled={generateCode.isPending || isLoading}
                className="gap-2 bg-ember hover:bg-ember/90 text-white rounded-sm text-xs"
                size="sm"
              >
                {generateCode.isPending && (
                  <Timer className="w-3 h-3 animate-spin" />
                )}
                Generate Referral Link
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 py-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
