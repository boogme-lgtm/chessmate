import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Ban,
  Timer,
  AlertTriangle,
  DollarSign,
  Flag,
  ShieldCheck,
  Star,
  MessageCircle,
  ArrowLeft,
  X,
  BookOpen,
  FileText,
  FileBox,
  Package,
  Download,
} from "lucide-react";
import {
  format,
  isPast,
  isFuture,
  differenceInHours,
  differenceInSeconds,
  formatDistanceToNow,
} from "date-fns";
import {
  getLessonEndWithGrace,
  canConfirmLessonComplete,
  getIssueWindowState,
} from "@shared/lessonTimeHelpers";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import ReviewDialog from "@/components/ReviewDialog";
import MessageThread from "@/components/MessageThread";
import DashShell from "@/components/DashShell";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInMinutes } from "date-fns";

/**
 * StudentDashboard (S-DASH-1 redesign)
 *
 * Default export: standalone /student route wrapped in DashShell.
 * Named export `StudentDashboardContent`: used by the unified Dashboard.tsx
 * inside its own DashShell.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Default export — standalone /student route
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
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
      role="student"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      <StudentDashboardContent user={user} />
    </DashShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANCELLED_STATUSES = ["cancelled", "declined", "refunded"];

// ─────────────────────────────────────────────────────────────────────────────
// StudentDashboardContent — the 7-module body
// ─────────────────────────────────────────────────────────────────────────────

export function StudentDashboardContent({ user }: { user: any }) {
  const [, setLocation] = useLocation();

  // ── Lessons query ──────────────────────────────────────────────────────────
  const { data: lessons, isLoading } = trpc.lesson.myLessons.useQuery(
    { limit: 50 },
    {
      enabled: !!user,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchInterval: (query) => {
        const data = query.state.data as any[] | undefined;
        const hasTransient = (data || []).some(
          (l) =>
            l.status === "pending_payment" || l.status === "payment_collected",
        );
        return hasTransient ? 8000 : false;
      },
    },
  );

  const lessonIds = (lessons || []).map((l: any) => l.id);
  const { data: unreadCounts } = trpc.messages.getUnreadCounts.useQuery(
    { lessonIds },
    { enabled: lessonIds.length > 0, refetchInterval: 30000 },
  );

  // ── Content requests ───────────────────────────────────────────────────────
  const { data: contentRequests } =
    trpc.contentRequest.listForStudent.useQuery(undefined, {
      enabled: !!user,
    });

  // ── Subscription coaches (for expanded content request access) ─────────────
  const { data: subscriptionCoaches } =
    trpc.coachSubscription.mySubscriptions.useQuery(undefined, {
      enabled: !!user,
    });

  // ── Student profile (for rating) ──────────────────────────────────────────
  const { data: studentProfile } = trpc.student.getProfile.useQuery(
    undefined,
    { enabled: !!user },
  );

  // ── Owned content (for the new-student gate) — dedup'd with the Library
  // module's identical query by React Query, so no extra network request. ──────
  const { data: ownedContent } = trpc.content.listOwned.useQuery(undefined, {
    enabled: !!user,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Derive lesson lists ────────────────────────────────────────────────────
  const upcomingLessons =
    lessons?.filter(
      (l: any) =>
        isFuture(new Date(l.scheduledAt)) &&
        ![
          "cancelled",
          "completed",
          "declined",
          "refunded",
          "released",
          "disputed",
        ].includes(l.status),
    ) || [];

  const allPastLessons = (
    lessons?.filter(
      (l: any) =>
        isPast(new Date(l.scheduledAt)) ||
        l.status === "completed" ||
        l.status === "cancelled",
    ) || []
  ).sort((a: any, b: any) => {
    const aCancelled = CANCELLED_STATUSES.includes(a.status) ? 1 : 0;
    const bCancelled = CANCELLED_STATUSES.includes(b.status) ? 1 : 0;
    if (aCancelled !== bCancelled) return aCancelled - bCancelled;
    return (
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  });

  const nextLesson = upcomingLessons[0] || null;

  const unreadForLesson = (lessonId: number) =>
    (unreadCounts as Record<number, number> | undefined)?.[lessonId] || 0;

  // ── Messages preview — latest per lesson (up to 3) ─────────────────────────
  const lessonsWithMessages = (lessons || [])
    .filter(
      (l: any) =>
        !CANCELLED_STATUSES.includes(l.status) && l.status !== "declined",
    )
    .slice(0, 10);

  // ── Eligible coaches: from lessons + active subscriptions ───────────────────
  const studentCoaches: { id: number; name: string }[] = (() => {
    const map = new Map<number, { id: number; name: string }>();
    (lessons || []).forEach((l: any) => {
      if (!map.has(l.coachId)) {
        map.set(l.coachId, { id: l.coachId, name: l.coachName || `Coach #${l.coachId}` });
      }
    });
    (subscriptionCoaches || []).forEach((s: any) => {
      if (!map.has(s.coachId)) {
        map.set(s.coachId, { id: s.coachId, name: s.coachName || `Coach #${s.coachId}` });
      }
    });
    return Array.from(map.values());
  })();

  // ── Progress data — synthetic sparkline from student profile ──────────────
  const currentRating = (studentProfile as any)?.currentRating ?? null;

  // Brand-new student: no lessons, no content requests, no subscriptions.
  // Show one unified getting-started panel instead of fragmented empty cards.
  // Gate on the secondary queries having resolved so the panel never flashes
  // for a returning student while their data is still loading.
  const isNewStudent =
    contentRequests !== undefined &&
    subscriptionCoaches !== undefined &&
    ownedContent !== undefined &&
    (lessons || []).length === 0 &&
    contentRequests.length === 0 &&
    subscriptionCoaches.length === 0 &&
    (ownedContent as any[]).length === 0;

  return (
    <div className="space-y-8">
      {/* ── GETTING STARTED (new students only) ───────────────────────────── */}
      {isNewStudent && (
        <section>
          <Card className="bg-ink-raised border-ember/30 rounded-sm">
            <CardContent className="p-6 sm:p-8">
              <span className="eyebrow mb-3 block text-ember">Welcome to BooGMe</span>
              <h2 className="text-xl font-semibold text-bone mb-2">
                Let's find your coach
              </h2>
              <p className="text-sm text-bone-muted mb-6 max-w-lg">
                You're all set up. Here's how to get started on your chess
                journey:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { n: "1", t: "Browse coaches", d: "Filter by rating, price, and specialty to find your match." },
                  { n: "2", t: "Book a lesson", d: "Pick a time and pay securely — your payment is held in escrow until the lesson's done." },
                  { n: "3", t: "Track progress", d: "Your lessons, content, and rating all live here on your dashboard." },
                ].map((s) => (
                  <div
                    key={s.n}
                    className="rounded-sm border border-border/20 bg-ink/40 p-4"
                  >
                    <div className="w-7 h-7 rounded-sm bg-ember/20 text-ember flex items-center justify-center text-sm font-bold mb-2">
                      {s.n}
                    </div>
                    <p className="text-sm font-medium text-bone mb-1">{s.t}</p>
                    <p className="text-xs text-bone-muted leading-relaxed">
                      {s.d}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                className="bg-ember hover:bg-ember/90 text-white rounded-sm"
                onClick={() => setLocation("/coaches")}
              >
                Browse coaches
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── MODULE 1: YOUR NEXT LESSON ─────────────────────────────────────── */}
      <section id="overview">
        <span className="eyebrow mb-3 block">01 — Your next lesson</span>
        {nextLesson ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: next lesson card (2/3) */}
            <div className="lg:col-span-2">
              <NextLessonCard
                lesson={nextLesson}
                unreadCount={unreadForLesson(nextLesson.id)}
              />
            </div>
            {/* Right: latest coach message preview (1/3) */}
            <div className="lg:col-span-1">
              <CoachMessagePreview lesson={nextLesson} />
            </div>
          </div>
        ) : isNewStudent ? null : (
          <Card className="bg-ink-raised border-border/20 rounded-sm">
            <CardContent className="py-16 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-bone-muted/30" />
              <h3 className="text-lg font-medium text-bone mb-1">
                No upcoming lessons
              </h3>
              <p className="text-sm text-bone-muted mb-6 max-w-sm mx-auto">
                Browse our coaches and book your first chess lesson to get
                started
              </p>
              <Button
                className="bg-ember hover:bg-ember/90 text-white rounded-sm"
                onClick={() => setLocation("/coaches")}
              >
                Browse Coaches
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── MODULE 2: LESSONS (full history) ───────────────────────────────── */}
      <section id="lessons">
        <span className="eyebrow mb-3 block">02 — Lessons</span>
        <LessonHistorySection lessons={lessons || []} />
      </section>

      {/* ── MODULE 3: MESSAGES ─────────────────────────────────────────────── */}
      <section id="messages">
        <span className="eyebrow mb-3 block">03 — Messages</span>
        <MessagesModule
          lessons={lessonsWithMessages}
          unreadCounts={unreadCounts}
        />
      </section>

      {/* ── MODULE 4: CONTENT REQUESTS ─────────────────────────────────────── */}
      <section id="content-requests">
        <span className="eyebrow mb-3 block">04 — Content requests</span>
        <ContentRequestsModule contentRequests={contentRequests} coaches={studentCoaches} />
      </section>

      {/* ── MODULE 5: CONTENT LIBRARY ──────────────────────────────────────── */}
      <section id="content-library">
        <span className="eyebrow mb-3 block">05 — Library</span>
        <ContentLibraryModule coaches={studentCoaches} />
      </section>

      {/* ── MODULE 6: PROGRESS ─────────────────────────────────────────────── */}
      <section id="progress">
        <span className="eyebrow mb-3 block">06 — Progress</span>
        <ProgressModule currentRating={currentRating} studentProfile={studentProfile} />
      </section>

      {/* ── PENDING REVIEWS (conditional, no eyebrow number) ────────────────── */}
      <PendingReviewsSection />

      {/* ── MODULE 7: BILLING ──────────────────────────────────────────────── */}
      <section id="billing">
        <span className="eyebrow mb-3 block">07 — Billing</span>
        <Card className="bg-ink-raised border-border/20 rounded-sm">
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-bone mb-2">
              Manage Billing
            </h3>
            <p className="text-sm text-bone-muted mb-4">
              View payment history, update your payment method, and manage
              subscriptions.
            </p>
            <Button
              variant="outline"
              className="rounded-sm border-border/40 text-bone-muted hover:text-bone"
              onClick={() => toast.info("Billing management: coming soon")}
            >
              Manage Billing
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Countdown Timer
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

interface CountdownBannerProps {
  scheduledAt: Date;
  status: string;
}

function CountdownBanner({ scheduledAt, status }: CountdownBannerProps) {
  const { days, hours, minutes, seconds, secondsLeft } =
    useCountdown(scheduledAt);

  if (secondsLeft <= 0) return null;

  const withinFinalHour = secondsLeft < 3600;

  if (withinFinalHour) {
    return (
      <div className="mt-4 p-3 bg-red-950/30 border border-red-800/50 rounded-sm">
        <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
          <Timer className="h-4 w-4" />
          <span className="font-mono tabular-nums">
            Lesson starting in {hours}h {String(minutes).padStart(2, "0")}m{" "}
            {String(seconds).padStart(2, "0")}s
          </span>
        </div>
        <p className="text-xs text-red-400/80">
          Cancellation window has closed — no refund available
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-green-950/20 border border-green-800/40 rounded-sm">
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-mono tabular-nums">
          {days > 0 ? `${days}d ` : ""}
          {hours % 24}h {String(minutes).padStart(2, "0")}m until lesson
        </span>
      </div>
      <p className="text-xs text-green-400/80">
        Full refund available · Cancel more than 1 hour before the lesson
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation Dialog (unchanged logic)
// ─────────────────────────────────────────────────────────────────────────────

interface CancellationDialogProps {
  open: boolean;
  onClose: () => void;
  lesson: any;
  onConfirm: () => void;
  isPending: boolean;
}

function CancellationDialog({
  open,
  onClose,
  lesson,
  onConfirm,
  isPending,
}: CancellationDialogProps) {
  const minutesUntil = differenceInMinutes(
    new Date(lesson.scheduledAt),
    new Date(),
  );
  const amountDollars = (lesson.amountCents / 100).toFixed(2);
  const wasPaid = !!lesson.stripePaymentIntentId;

  let refundDollars = "0.00";
  let refundLabel = "No Refund";
  let refundColor = "text-red-500";
  let policyNote = "";

  if (!wasPaid) {
    refundLabel = "Free Cancellation";
    refundColor = "text-green-500";
    policyNote =
      "This lesson hasn't been paid for yet, so cancelling is free — there's nothing to refund.";
  } else if (minutesUntil > 60) {
    refundDollars = amountDollars;
    refundLabel = "Full Refund";
    refundColor = "text-green-500";
    policyNote =
      "You're cancelling more than 1 hour before the lesson — you'll receive a full refund.";
  } else {
    refundLabel = "No Refund";
    refundColor = "text-red-500";
    policyNote =
      "You're cancelling within 1 hour of the lesson — no refund will be issued per our cancellation policy.";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Cancel This Lesson?
          </DialogTitle>
          <DialogDescription>
            Please review the refund details before confirming.
          </DialogDescription>
        </DialogHeader>

        {/* Lesson summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">
              {format(new Date(lesson.scheduledAt), "EEEE, MMMM d, yyyy")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">
              {format(new Date(lesson.scheduledAt), "h:mm a")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">
              {lesson.durationMinutes} minutes
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">
              {wasPaid ? "Amount Paid" : "Amount (unpaid)"}
            </span>
            <span className="font-semibold">${amountDollars}</span>
          </div>
        </div>

        {/* Refund breakdown */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Refund Breakdown</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Refund Policy
              </span>
              <Badge
                variant="outline"
                className={`${refundColor} border-current font-semibold`}
              >
                {refundLabel}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                You will receive
              </span>
              <span className={`text-xl font-bold ${refundColor}`}>
                ${refundDollars}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
              {policyNote}
            </p>
          </div>
        </div>

        {/* Policy reminder */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Cancellation Policy:</p>
          <p>• More than 1 hour before lesson → Full refund</p>
          <p>• Within 1 hour of lesson → No refund</p>
          <p>• Unpaid lessons → Always free to cancel</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Keep My Lesson
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending
              ? "Cancelling..."
              : `Yes, Cancel & Get $${refundDollars} Back`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson Detail Dialog (tip flow)
// ─────────────────────────────────────────────────────────────────────────────

function LessonDetailDialog({
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
  const { data: tipData, refetch: refetchTip } =
    trpc.tip.getForLesson.useQuery(
      { lessonId: lesson.id },
      { enabled: open },
    );
  const [showTipForm, setShowTipForm] = useState(false);
  const [retryingTip, setRetryingTip] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const tipMutation = trpc.tip.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
      refetchTip();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleTip = (amountCents: number) => {
    tipMutation.mutate({ lessonId: lesson.id, tipAmountCents: amountCents });
  };

  const hasTipped = !!tipData?.tip;
  const tipStatus = tipData?.tip?.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lesson Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coach</span>
              <span className="font-medium">
                {lesson.coachName || `Coach #${lesson.coachId}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {format(new Date(lesson.scheduledAt), "MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {format(new Date(lesson.scheduledAt), "h:mm a")} ·{" "}
                {lesson.durationMinutes} min
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                ${(lesson.amountCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{lesson.status}</span>
            </div>
          </div>

          {/* Reviews */}
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
                You haven't reviewed this lesson yet.
              </p>
            )}

            {reviewData?.counterpartReview ? (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Coach's review</span>
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

          {/* Tip section */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Tip your coach</h4>
            {hasTipped && tipStatus === "transferred" ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Tip of $
                {((tipData.tip?.amountCents || 0) / 100).toFixed(2)} sent
              </div>
            ) : hasTipped && tipStatus === "paid" ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4 text-amber-500" />
                Tip of $
                {((tipData.tip?.amountCents || 0) / 100).toFixed(2)}{" "}
                processing…
              </div>
            ) : hasTipped && tipStatus === "pending" ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                Tip checkout in progress — complete payment in the other tab
              </div>
            ) : hasTipped && tipStatus === "failed" && !retryingTip ? (
              <div className="space-y-1">
                <div className="text-sm text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Tip failed
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRetryingTip(true);
                    setShowTipForm(true);
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : showTipForm ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {[500, 1000, 2000].map((cents) => (
                    <Button
                      key={cents}
                      size="sm"
                      variant="outline"
                      disabled={tipMutation.isPending}
                      onClick={() => handleTip(cents)}
                    >
                      ${cents / 100}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    placeholder="Custom $"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={
                      !customAmount ||
                      Number(customAmount) < 1 ||
                      Number(customAmount) > 500 ||
                      tipMutation.isPending
                    }
                    onClick={() =>
                      handleTip(Math.round(Number(customAmount) * 100))
                    }
                  >
                    {tipMutation.isPending ? "Redirecting…" : "Tip"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setShowTipForm(true)}
              >
                <DollarSign className="h-4 w-4" />
                Leave a Tip
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: NextLessonCard — the hero card
// ─────────────────────────────────────────────────────────────────────────────

interface NextLessonCardProps {
  lesson: any;
  unreadCount: number;
}

function NextLessonCard({ lesson, unreadCount }: NextLessonCardProps) {
  const [, setLocation] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showMessageThread, setShowMessageThread] = useState(false);
  const [showRaiseIssueDialog, setShowRaiseIssueDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [issueCategory, setIssueCategory] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const utils = trpc.useUtils();

  // ── Live clock — refreshes every 30 s so time-gated UI auto-updates ─────
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const cancelMutation = trpc.lesson.cancel.useMutation({
    onSuccess: (data) => {
      const msg =
        data.refundPercentage === 100
          ? "Lesson cancelled. Full refund issued."
          : data.refundPercentage > 0
            ? `Lesson cancelled. ${data.refundPercentage}% refund issued.`
            : "Lesson cancelled. No refund (within 24-hour window).";
      toast.success(msg);
      setShowCancelDialog(false);
      utils.lesson.myLessons.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowCancelDialog(false);
    },
  });

  const confirmCompletion = trpc.lesson.confirmCompletion.useMutation({
    onSuccess: () => {
      toast.success(
        "Lesson marked complete. The 24-hour issue window has started — coach payout is released after the window closes.",
      );
      utils.lesson.myLessons.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const raiseIssueMutation = trpc.lesson.raiseIssue.useMutation({
    onSuccess: (data: any) => {
      if (data.policyGated) {
        toast.success(
          "Feedback submitted. Quality alone is not eligible for a refund per our policy.",
        );
      } else {
        toast.success("Issue raised. An admin will review your case.");
      }
      setShowRaiseIssueDialog(false);
      setIssueCategory("");
      setIssueDescription("");
      utils.lesson.myLessons.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createCheckout = trpc.payment.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to start payment");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // ── All time-gated state is derived from `now` (updated every 30 s) ─────
  const hoursUntilLesson = differenceInHours(
    new Date(lesson.scheduledAt),
    now,
  );
  const canCancel =
    hoursUntilLesson > 0 &&
    ["pending_payment", "payment_collected", "confirmed"].includes(
      lesson.status,
    );

  const canConfirmComplete = canConfirmLessonComplete(lesson, now);
  const issueWindowStatus = getIssueWindowState(lesson, now);
  const issueWindowActive = issueWindowStatus === "active";
  const issueWindowExpired = issueWindowStatus === "expired";
  const issueWindowEndsAt = lesson.issueWindowEndsAt
    ? new Date(lesson.issueWindowEndsAt)
    : null;

  // Join button: show when meetingUrl is set and within 15 min or started
  const secondsUntilLesson = differenceInSeconds(
    new Date(lesson.scheduledAt),
    now,
  );
  const showJoinButton =
    lesson.meetingUrl && (secondsUntilLesson <= 900 || secondsUntilLesson <= 0);

  const escrowDollars = (lesson.amountCents / 100).toFixed(2);

  return (
    <>
      <Card className="bg-ink-raised border-border/20 rounded-sm relative">
        <CardContent className="p-6">
          {/* Cancel icon — top-right corner */}
          {canCancel && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="absolute top-4 right-4 text-bone-muted hover:text-red-400 transition-colors"
              aria-label="Cancel lesson"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Escrow pill */}
          {lesson.stripePaymentIntentId && (
            <Badge className="mb-3 bg-amber-600/20 text-amber-400 border-amber-600/40 rounded-sm font-mono tabular-nums text-xs">
              ${escrowDollars} IN ESCROW
            </Badge>
          )}

          {/* Topic */}
          <h2 className="text-2xl font-bold text-bone mb-1">
            {lesson.topic || `Lesson with ${lesson.coachName || `Coach #${lesson.coachId}`}`}
          </h2>

          {/* Notes */}
          {lesson.notes && (
            <p className="text-sm text-bone-muted line-clamp-3 mb-3">
              {lesson.notes}
            </p>
          )}

          {/* Date/time + live countdown */}
          <div className="flex items-center gap-4 text-sm text-bone-muted mb-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {format(new Date(lesson.scheduledAt), "EEEE, MMMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {format(new Date(lesson.scheduledAt), "h:mm a")} ·{" "}
              {lesson.durationMinutes} min
            </span>
          </div>

          {/* Live countdown timer */}
          {lesson.status !== "cancelled" && lesson.status !== "declined" && (
            <CountdownBanner
              scheduledAt={new Date(lesson.scheduledAt)}
              status={lesson.status}
            />
          )}

          {/* Issue window banners */}
          {issueWindowActive && issueWindowEndsAt && (
            <div
              data-testid="issue-window-banner"
              className="mt-3 flex items-start gap-2 rounded-sm border border-yellow-500/40 bg-yellow-950/20 px-3 py-2 text-sm"
            >
              <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-yellow-300">
                  24-hour issue window open
                </span>
                <span className="text-bone-muted">
                  {" — "}
                  Coach payout is released after the window closes on{" "}
                  <span className="font-medium">
                    {format(issueWindowEndsAt, "MMM d 'at' h:mm a")}
                  </span>
                  .
                </span>
              </div>
            </div>
          )}
          {issueWindowExpired && (
            <div
              data-testid="issue-window-expired-banner"
              className="mt-3 flex items-start gap-2 rounded-sm border border-green-500/40 bg-green-950/20 px-3 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <span className="text-bone-muted">
                Issue window closed — coach payout is eligible for release.
              </span>
            </div>
          )}
          {lesson.status === "released" && (
            <div
              data-testid="payout-released-banner"
              className="mt-3 flex items-start gap-2 rounded-sm border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-bone-muted">
                Coach payout has been released.
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* JOIN LESSON */}
            {showJoinButton && (
              <Button
                size="sm"
                className="gap-2 bg-ember hover:bg-ember/90 text-white rounded-sm"
                asChild
              >
                <a
                  href={lesson.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="h-4 w-4" />
                  Join Lesson
                </a>
              </Button>
            )}

            {/* RESCHEDULE */}
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-bone-muted hover:text-bone rounded-sm"
              onClick={() =>
                toast.info("To reschedule, contact your coach via Messages")
              }
            >
              Reschedule
            </Button>

            {/* Pay Now */}
            {lesson.status === "pending_payment" && (
              <Button
                size="sm"
                className="gap-2 bg-ember hover:bg-ember/90 text-white rounded-sm"
                disabled={createCheckout.isPending}
                onClick={() => createCheckout.mutate({ lessonId: lesson.id })}
              >
                <DollarSign className="h-4 w-4" />
                {createCheckout.isPending ? "Redirecting…" : "Pay Now"}
              </Button>
            )}

            {/* Messages */}
            <Button
              size="sm"
              variant="outline"
              className="gap-2 relative rounded-sm border-border/40 text-bone-muted hover:text-bone"
              onClick={() => setShowMessageThread(true)}
            >
              <MessageCircle className="h-4 w-4" />
              Messages
              {unreadCount > 0 && (
                <span className="ml-1 rounded-sm bg-ember text-white text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* Confirm Lesson Complete */}
            {canConfirmComplete && (
              <Button
                data-testid="confirm-complete-btn"
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-sm"
                disabled={confirmCompletion.isPending}
                onClick={() =>
                  confirmCompletion.mutate({ lessonId: lesson.id })
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmCompletion.isPending
                  ? "Confirming…"
                  : "Confirm Lesson Complete"}
              </Button>
            )}

            {/* View Details — for completed/released lessons */}
            {["completed", "released"].includes(lesson.status) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 rounded-sm border-border/40 text-bone-muted hover:text-bone"
                onClick={() => setShowDetailDialog(true)}
              >
                <ChevronRight className="h-4 w-4" />
                View Details
              </Button>
            )}

            {/* Raise Issue */}
            {issueWindowActive && (
              <Button
                data-testid="raise-issue-btn"
                size="sm"
                variant="outline"
                className="gap-2 text-orange-600 border-orange-400 hover:text-orange-700 rounded-sm"
                onClick={() => setShowRaiseIssueDialog(true)}
              >
                <Flag className="h-4 w-4" />
                Raise Issue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancellation confirmation dialog */}
      {showCancelDialog && (
        <CancellationDialog
          open={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          lesson={lesson}
          onConfirm={() => cancelMutation.mutate({ lessonId: lesson.id })}
          isPending={cancelMutation.isPending}
        />
      )}

      {/* Raise Issue dialog — S-REF-1 categorized intake */}
      <RaiseIssueDialog
        open={showRaiseIssueDialog}
        onOpenChange={(v) => {
          if (!v) {
            setShowRaiseIssueDialog(false);
            setIssueCategory("");
            setIssueDescription("");
          }
        }}
        lesson={lesson}
        issueCategory={issueCategory}
        setIssueCategory={setIssueCategory}
        issueDescription={issueDescription}
        setIssueDescription={setIssueDescription}
        issueWindowEndsAt={issueWindowEndsAt}
        raiseIssueMutation={raiseIssueMutation}
        onClose={() => {
          setShowRaiseIssueDialog(false);
          setIssueCategory("");
          setIssueDescription("");
        }}
      />

      <MessageThread
        open={showMessageThread}
        onOpenChange={setShowMessageThread}
        lessonId={lesson.id}
        otherPartyName={lesson.coachName || `Coach #${lesson.coachId}`}
      />

      {showDetailDialog && (
        <LessonDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          lesson={lesson}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Raise Issue Dialog — S-REF-1 categorized intake
// ─────────────────────────────────────────────────────────────────────────────

function RaiseIssueDialog({
  open,
  onOpenChange,
  lesson,
  issueCategory,
  setIssueCategory,
  issueDescription,
  setIssueDescription,
  issueWindowEndsAt,
  raiseIssueMutation,
  onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lesson: any;
  issueCategory: string;
  setIssueCategory: (v: string) => void;
  issueDescription: string;
  setIssueDescription: (v: string) => void;
  issueWindowEndsAt: Date | null;
  raiseIssueMutation: any;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            Raise an Issue
          </DialogTitle>
          <DialogDescription>
            Select the type of issue and describe what happened. Coach payout is
            paused while the issue is under review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Lesson date</span>
              <span className="font-medium">
                {format(new Date(lesson.scheduledAt), "MMMM d, yyyy")}
              </span>
            </div>
            {issueWindowEndsAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Window closes</span>
                <span className="font-medium text-orange-600">
                  {format(issueWindowEndsAt, "MMM d 'at' h:mm a")}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What happened?</label>
            {[
              {
                value: "coach_no_show",
                label: "Coach didn't show up",
                hint: "The lesson never started because your coach didn't join.",
              },
              {
                value: "coach_late_or_short",
                label: "Coach was late or cut lesson short",
                hint: "Coach joined >15 min late, or the lesson ended materially early.",
              },
              {
                value: "technical_failure",
                label: "Technical failure",
                hint: "A platform or connection issue prevented the lesson.",
              },
              {
                value: "not_as_described",
                label: "Not as described",
                hint: "The lesson was materially different from the coach's profile.",
              },
              {
                value: "quality",
                label: "Quality / didn't find it useful",
                hint: "Note: Subjective dissatisfaction is not eligible for a refund. You may still submit this as feedback.",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${issueCategory === opt.value ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20" : "border-border/60 hover:border-border"}`}
              >
                <input
                  type="radio"
                  name="issueCategory"
                  value={opt.value}
                  checked={issueCategory === opt.value}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {opt.hint}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {issueCategory && (
            <div>
              <label className="text-sm font-medium">
                {issueCategory === "quality"
                  ? "Feedback for the coach (optional)"
                  : "Describe what happened (required, min 20 characters)"}
              </label>
              <textarea
                data-testid="issue-reason-input"
                className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder={
                  issueCategory === "quality"
                    ? "Optional feedback…"
                    : "Please describe what went wrong (min 20 characters)…"
                }
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            disabled={
              !issueCategory ||
              (issueCategory !== "quality" &&
                issueCategory !== "coach_no_show" &&
                issueDescription.trim().length < 20) ||
              raiseIssueMutation.isPending
            }
            onClick={() =>
              raiseIssueMutation.mutate({
                lessonId: lesson.id,
                category: issueCategory as any,
                description: issueDescription.trim() || undefined,
              })
            }
          >
            <Flag className="h-4 w-4" />
            {raiseIssueMutation.isPending
              ? "Submitting…"
              : issueCategory === "quality"
                ? "Submit Feedback"
                : "Submit Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach Message Preview — right panel of hero
// ─────────────────────────────────────────────────────────────────────────────

function CoachMessagePreview({ lesson }: { lesson: any }) {
  const [showMessageThread, setShowMessageThread] = useState(false);
  const { data: messages } = trpc.messages.getForLesson.useQuery(
    { lessonId: lesson.id },
    { enabled: !!lesson.id },
  );

  const coachName = lesson.coachName || `Coach #${lesson.coachId}`;
  const initials = (() => {
    const parts = coachName.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  })();

  // Find the latest message from the coach (not from current user perspective)
  const coachMessages = (messages || []).filter(
    (m: any) => m.senderId === lesson.coachId,
  );
  const latestCoachMsg = coachMessages[coachMessages.length - 1] || null;

  return (
    <>
      <Card className="bg-ink-raised border-border/20 rounded-sm h-full">
        <CardContent className="p-5 flex flex-col h-full">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted mb-3">
            Latest from coach
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-sm bg-ember/20 text-ember text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-bone truncate">
                {coachName}
              </div>
              <div className="text-xs text-bone-muted">Your coach</div>
            </div>
          </div>

          {latestCoachMsg ? (
            <div className="flex-1">
              <p className="text-sm text-bone-muted italic line-clamp-3 mb-2">
                "{latestCoachMsg.content}"
              </p>
              <span className="text-xs text-bone-muted font-mono tabular-nums">
                {formatDistanceToNow(new Date(latestCoachMsg.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-sm text-bone-muted italic">
                No messages yet — start the conversation!
              </p>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-2 rounded-sm border-ember/40 text-ember hover:text-ember/80 w-full"
            onClick={() => setShowMessageThread(true)}
          >
            <MessageCircle className="h-4 w-4" />
            Reply
          </Button>
        </CardContent>
      </Card>

      <MessageThread
        open={showMessageThread}
        onOpenChange={setShowMessageThread}
        lessonId={lesson.id}
        otherPartyName={coachName}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: Content Requests
// ─────────────────────────────────────────────────────────────────────────────

function ContentRequestsModule({
  contentRequests,
  coaches,
}: {
  contentRequests: any;
  coaches: { id: number; name: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const acceptQuote = trpc.contentRequest.acceptQuote.useMutation({
    onSuccess: () => {
      toast.success("Quote accepted! Proceeding to payment...");
      utils.contentRequest.listForStudent.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectQuote = trpc.contentRequest.rejectQuote.useMutation({
    onSuccess: () => {
      toast.success("Quote rejected. Your coach can revise and re-quote.");
      utils.contentRequest.listForStudent.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createCheckout = trpc.contentRequest.createCheckout.useMutation({
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const proposeDeadlineExtension = trpc.contentRequest.proposeDeadlineExtension.useMutation({
    onSuccess: () => {
      toast.success("New deadline proposed — the request is back in progress.");
      utils.contentRequest.listForStudent.invalidate();
      setExtendDialogReqId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelOverdue = trpc.contentRequest.cancelOverdue.useMutation({
    onSuccess: () => {
      toast.success("Request cancelled and refund initiated.");
      utils.contentRequest.listForStudent.invalidate();
      setCancelDialogReqId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [extendDialogReqId, setExtendDialogReqId] = useState<number | null>(null);
  const [cancelDialogReqId, setCancelDialogReqId] = useState<number | null>(null);
  const [newDeadlineInput, setNewDeadlineInput] = useState("");

  const handleAcceptAndPay = async (requestId: number) => {
    try {
      await acceptQuote.mutateAsync({ requestId });
      const result = await createCheckout.mutateAsync({ requestId });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // Errors handled by individual mutation error handlers
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "quoted":
        return (
          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/40 rounded-sm text-xs">
            Quote Ready
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/40 rounded-sm text-xs">
            Payment Needed
          </Badge>
        );
      case "payment_collected":
        return (
          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 rounded-sm text-xs">
            Paid
          </Badge>
        );
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
      case "overdue":
        return (
          <Badge className="bg-red-600/20 text-red-400 border-red-600/40 rounded-sm text-xs">
            Overdue
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-600/20 text-red-400 border-red-600/40 rounded-sm text-xs">
            Declined
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

  const requests = contentRequests || [];

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-bone">
            Content Requests
          </h3>
          <Button
            size="sm"
            className="gap-1 bg-ember hover:bg-ember/90 text-white rounded-sm text-xs"
            onClick={() => {
              if (coaches.length === 0) {
                // No lesson or subscription coaches yet — send them to browse
                window.location.href = "/coaches";
                return;
              }
              setDialogOpen(true);
            }}
          >
            + New Request
          </Button>
        </div>

        <NewContentRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          coaches={coaches}
        />

        {requests.length === 0 ? (
          <p className="text-sm text-bone-muted">
            No content requests yet. Request custom lessons, analysis, or
            training material from your coach.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((req: any) => (
              <div
                key={req.id}
                className="py-2.5 px-3 border border-border/20 rounded-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {statusBadge(req.status)}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-bone truncate">
                        {req.title}
                      </div>
                      <div className="text-xs text-bone-muted">
                        {req.coachName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className="text-sm font-mono tabular-nums text-bone-muted">
                      {req.amountCents > 0 ? `$${(req.amountCents / 100).toFixed(2)}` : ""}
                      {req.dueDate && (
                        <> · Due {format(new Date(req.dueDate), "MMM d")}</>
                      )}
                    </span>
                    {req.status === "quoted" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-ember hover:bg-ember/90 text-white rounded-sm text-xs h-7"
                          disabled={acceptQuote.isPending || createCheckout.isPending}
                          onClick={() => handleAcceptAndPay(req.id)}
                        >
                          {acceptQuote.isPending || createCheckout.isPending ? "Processing..." : "ACCEPT & PAY"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-sm text-xs h-7"
                          disabled={rejectQuote.isPending}
                          onClick={() => rejectQuote.mutate({ requestId: req.id })}
                        >
                          REJECT
                        </Button>
                      </>
                    )}
                    {req.status === "pending_payment" && (
                      <Button
                        size="sm"
                        className="bg-ember hover:bg-ember/90 text-white rounded-sm text-xs h-7"
                        disabled={createCheckout.isPending}
                        onClick={() => createCheckout.mutate({ requestId: req.id })}
                      >
                        COMPLETE PAYMENT
                      </Button>
                    )}
                    {req.status === "payment_collected" && (
                      <span className="text-xs text-emerald-400">Payment received — coach will begin soon</span>
                    )}
                    {req.status === "in_progress" && (
                      <span className="text-xs text-amber-400">In progress</span>
                    )}
                    {req.status === "delivered" && (
                      <span className="text-xs text-emerald-400">Delivered — contact support within 48h for issues</span>
                    )}
                    {req.status === "overdue" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-xs h-7"
                          onClick={() => {
                            setNewDeadlineInput("");
                            setExtendDialogReqId(req.id);
                          }}
                        >
                          PROPOSE NEW DEADLINE
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-sm text-xs h-7"
                          onClick={() => setCancelDialogReqId(req.id)}
                        >
                          CANCEL & REFUND
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {req.status === "quoted" && req.coachNote && (
                  <div className="mt-2 pt-2 border-t border-border/20 text-xs text-bone-muted italic">
                    Coach note: {req.coachNote}
                  </div>
                )}
                {req.status === "cancelled" && req.coachNote && (
                  <div className="mt-2 pt-2 border-t border-border/20 text-xs text-bone-muted italic">
                    Coach: {req.coachNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* S-CONTENT-3: Propose New Deadline Dialog */}
        <Dialog open={extendDialogReqId !== null} onOpenChange={(open) => !open && setExtendDialogReqId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Propose New Deadline</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm text-bone-muted block mb-2">New due date</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-ink border border-border/30 rounded-sm text-bone text-sm"
                value={newDeadlineInput}
                onChange={(e) => setNewDeadlineInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setExtendDialogReqId(null)}>Cancel</Button>
              <Button
                className="bg-ember hover:bg-ember/90 text-white"
                disabled={!newDeadlineInput || proposeDeadlineExtension.isPending}
                onClick={() => {
                  if (extendDialogReqId && newDeadlineInput) {
                    proposeDeadlineExtension.mutate({
                      requestId: extendDialogReqId,
                      newDueDate: new Date(newDeadlineInput + "T23:59:59Z").toISOString(),
                    });
                  }
                }}
              >
                {proposeDeadlineExtension.isPending ? "Submitting..." : "Propose Deadline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* S-CONTENT-3: Cancel & Refund Confirmation Dialog */}
        <Dialog open={cancelDialogReqId !== null} onOpenChange={(open) => !open && setCancelDialogReqId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel & Request Refund</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-bone-muted py-4">
              Are you sure you want to cancel this overdue content request? A full refund will be initiated.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelDialogReqId(null)}>Keep Request</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={cancelOverdue.isPending}
                onClick={() => {
                  if (cancelDialogReqId) {
                    cancelOverdue.mutate({ requestId: cancelDialogReqId });
                  }
                }}
              >
                {cancelOverdue.isPending ? "Cancelling..." : "Cancel & Refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function NewContentRequestDialog({
  open,
  onOpenChange,
  coaches,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coaches: { id: number; name: string }[];
}) {
  const utils = trpc.useUtils();
  const [coachId, setCoachId] = useState<number | null>(coaches[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Keep the default coach in sync once coaches load.
  useEffect(() => {
    if (coachId === null && coaches[0]) setCoachId(coaches[0].id);
  }, [coaches, coachId]);

  const createMutation = trpc.contentRequest.create.useMutation({
    onSuccess: () => {
      toast.success("Request sent to your coach.");
      utils.contentRequest.listForStudent.invalidate();
      setTitle("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const canSubmit = coachId !== null && title.trim().length >= 3 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-ink-raised border-border/40 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone">Request content from your coach</DialogTitle>
          <DialogDescription className="text-bone-muted">
            Ask for a specific video, analysis, or training material. Your coach will price and deliver it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {coaches.length > 1 && (
            <div>
              <label className="text-xs text-bone-muted mb-1 block">Coach</label>
              <select
                value={coachId ?? ""}
                onChange={(e) => setCoachId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-bone-muted mb-1 block">What do you need? (required)</label>
            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Caro-Kann Advance variation — Black"
              className="w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50"
            />
          </div>
          <div>
            <label className="text-xs text-bone-muted mb-1 block">Details (optional)</label>
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any context — games to review, positions to cover, etc."
              className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50 resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-sm border-border/40 text-bone-muted hover:text-bone"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-ember hover:bg-ember/90 text-white rounded-sm"
            disabled={!canSubmit}
            onClick={() =>
              createMutation.mutate({
                coachId: coachId!,
                title: title.trim(),
                description: description.trim() || undefined,
              })
            }
          >
            {createMutation.isPending ? "Sending…" : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE: Lesson History (full list)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Awaiting Payment", cls: "bg-zinc-600/20 text-zinc-300 border-zinc-600/40" },
  payment_collected: { label: "Paid — Awaiting Coach", cls: "bg-amber-600/20 text-amber-400 border-amber-600/40" },
  confirmed: { label: "Confirmed", cls: "bg-blue-600/20 text-blue-400 border-blue-600/40" },
  completed: { label: "Completed", cls: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40" },
  released: { label: "Complete", cls: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40" },
  disputed: { label: "Under Review", cls: "bg-orange-600/20 text-orange-400 border-orange-600/40" },
  cancelled: { label: "Cancelled", cls: "bg-red-600/20 text-red-400 border-red-600/40" },
  declined: { label: "Declined", cls: "bg-red-600/20 text-red-400 border-red-600/40" },
  refunded: { label: "Refunded", cls: "bg-purple-600/20 text-purple-400 border-purple-600/40" },
};

function LessonHistorySection({ lessons }: { lessons: any[] }) {
  const [, setLocation] = useLocation();
  const [showCancelled, setShowCancelled] = useState(false);

  const sorted = [...lessons].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );
  const cancelledCount = sorted.filter((l) => CANCELLED_STATUSES.includes(l.status)).length;
  const visible = showCancelled ? sorted : sorted.filter((l) => !CANCELLED_STATUSES.includes(l.status));

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-bone-muted mb-3">
              No lessons yet. Book your first lesson to get started.
            </p>
            <Button
              variant="outline"
              className="border-ember/40 text-ember hover:bg-ember/10 rounded-sm"
              onClick={() => setLocation("/coaches")}
            >
              Browse coaches
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.15em] uppercase text-bone-muted border-b border-border/20">
                    <th className="py-2 pr-4 font-bold">Date</th>
                    <th className="py-2 pr-4 font-bold">Coach</th>
                    <th className="py-2 pr-4 font-bold">Duration</th>
                    <th className="py-2 pr-4 font-bold">Status</th>
                    <th className="py-2 font-bold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => {
                    const s = STATUS_LABELS[l.status] || { label: l.status, cls: "bg-zinc-600/20 text-zinc-300 border-zinc-600/40" };
                    return (
                      <tr key={l.id} className="border-b border-border/10 last:border-0">
                        <td className="py-2.5 pr-4 text-bone">{format(new Date(l.scheduledAt), "MMM d, yyyy · h:mm a")}</td>
                        <td className="py-2.5 pr-4 text-bone">{l.coachName || `Coach #${l.coachId}`}</td>
                        <td className="py-2.5 pr-4 text-bone-muted font-mono tabular-nums">{l.durationMinutes || 60}m</td>
                        <td className="py-2.5 pr-4">
                          <Badge className={`${s.cls} rounded-sm text-xs`}>{s.label}</Badge>
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-bone">
                          ${((l.amountCents || 0) / 100).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {cancelledCount > 0 && (
              <button
                onClick={() => setShowCancelled((v) => !v)}
                className="mt-3 text-xs text-bone-muted hover:text-bone transition-colors"
              >
                {showCancelled ? "Hide" : "Show"} cancelled ({cancelledCount})
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: Messages
// ─────────────────────────────────────────────────────────────────────────────

function MessagesModule({
  lessons,
  unreadCounts,
}: {
  lessons: any[];
  unreadCounts: any;
}) {
  const [, setLocation] = useLocation();
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openCoachName, setOpenCoachName] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Compact inbox preview (3) — "View all" expands to the full list.
  const previewLessons = expanded ? lessons : lessons.slice(0, 3);

  return (
    <>
      <Card className="bg-ink-raised border-border/20 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-bone">Messages</h3>
            {lessons.length > 3 && (
              <button
                className="text-xs text-ember hover:text-ember/80 transition-colors"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : `View all (${lessons.length})`}
              </button>
            )}
          </div>

          {previewLessons.length === 0 ? (
            <div>
              <p className="text-sm text-bone-muted mb-3">
                No conversations yet. Messages with your coach appear here once
                you book a lesson.
              </p>
              <button
                className="text-xs text-ember hover:text-ember/80 transition-colors"
                onClick={() => setLocation("/coaches")}
              >
                Find a coach →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {previewLessons.map((lesson: any) => {
                const unread =
                  (
                    unreadCounts as Record<number, number> | undefined
                  )?.[lesson.id] || 0;
                const coachName =
                  lesson.coachName || `Coach #${lesson.coachId}`;
                return (
                  <MessagePreviewRow
                    key={lesson.id}
                    lesson={lesson}
                    coachName={coachName}
                    unread={unread}
                    onOpen={() => {
                      setOpenLessonId(lesson.id);
                      setOpenCoachName(coachName);
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
              setOpenCoachName("");
            }
          }}
          lessonId={openLessonId}
          otherPartyName={openCoachName}
        />
      )}
    </>
  );
}

function MessagePreviewRow({
  lesson,
  coachName,
  unread,
  onOpen,
}: {
  lesson: any;
  coachName: string;
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
        {unread > 0 && (
          <div className="w-2 h-2 rounded-full bg-ember" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-bone truncate">
          {coachName}
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
// MODULE 4: Content Library (stub)
// ─────────────────────────────────────────────────────────────────────────────

const LIBRARY_KIND_ICONS: Record<string, typeof Video> = {
  video: Video,
  pdf: FileText,
  pgn: FileBox,
  course: Package,
  bundle: Package,
};

function ContentLibraryModule({ coaches }: { coaches: { id: number; name: string }[] }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.content.listOwned.useQuery();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = async (id: number) => {
    setDownloadingId(id);
    try {
      const { url } = await utils.client.content.getDownloadUrl.query({ id });
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err?.message || "Failed to get download link");
    } finally {
      setDownloadingId(null);
    }
  };

  const primaryCoachId = coaches[0]?.id ?? null;
  const library = (items as any[]) || [];

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-bone">Content Library</h3>
          <button
            className="text-xs text-ember hover:text-ember/80 transition-colors"
            onClick={() => {
              if (primaryCoachId) {
                setLocation(`/coach/${primaryCoachId}`);
              } else {
                setLocation("/coaches");
              }
            }}
          >
            Browse Store
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-bone-muted">Loading…</div>
        ) : library.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-bone-muted/30" />
            <p className="text-sm font-medium text-bone mb-1">Your library is empty</p>
            <p className="text-xs text-bone-muted max-w-xs mx-auto">
              Purchase content from your coach's storefront to build your personal
              chess library.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/20 border border-border/20 rounded-sm">
            {library.map((item) => {
              const Icon = LIBRARY_KIND_ICONS[item.kind] || FileText;
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-5 h-5 text-ember shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-bone truncate">{item.title}</p>
                    <p className="text-xs text-bone-muted">
                      from {item.coachName || "your coach"} · {item.kind}
                    </p>
                  </div>
                  <button
                    className="text-ember hover:text-ember/80 p-1 disabled:opacity-50"
                    disabled={downloadingId === item.id}
                    onClick={() => handleDownload(item.id)}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: Progress
// ─────────────────────────────────────────────────────────────────────────────

function ProgressModule({
  currentRating,
  studentProfile,
}: {
  currentRating: number | null;
  studentProfile: any;
}) {
  const utils = trpc.useUtils();
  const [showRatingInput, setShowRatingInput] = useState(false);
  const [ratingInput, setRatingInput] = useState("");
  const [showEditPlatforms, setShowEditPlatforms] = useState(false);

  const { data: liveRatings, isLoading: ratingsLoading } =
    trpc.student.fetchLiveRatings.useQuery(undefined, {
      enabled:
        !!studentProfile?.chesscomUsername || !!studentProfile?.lichessUsername,
      staleTime: 5 * 60 * 1000,
    });
  const updateRatingMutation = trpc.student.updateRating.useMutation({
    onSuccess: () => {
      toast.success("Rating saved.");
      utils.student.getProfile.invalidate();
      setShowRatingInput(false);
      setRatingInput("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveRating = () => {
    const value = parseInt(ratingInput, 10);
    if (isNaN(value) || value < 100 || value > 3200) {
      toast.error("Enter a rating between 100 and 3200.");
      return;
    }
    updateRatingMutation.mutate({ currentRating: value });
  };

  // Synthetic sparkline: 8 data points ending at currentRating
  const rating = currentRating ?? 1200;
  const sparkData = Array.from({ length: 8 }, (_, i) => {
    const base = rating - 80 + i * 10;
    const jitter = Math.sin(i * 1.5) * 15;
    return Math.round(base + jitter);
  });
  // Ensure last point is the actual rating
  sparkData[sparkData.length - 1] = rating;

  const startRating = sparkData[0];
  const delta = rating - startRating;

  // SVG sparkline dimensions
  const W = 240;
  const H = 60;
  const min = Math.min(...sparkData);
  const max = Math.max(...sparkData);
  const range = max - min || 1;

  const points = sparkData
    .map((v, i) => {
      const x = (i / (sparkData.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card className="bg-ink-raised border-border/20 rounded-sm">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-bone mb-4">
          Rating Progress
        </h3>
        <div className="flex items-end gap-8">
          <div>
            <div className="text-3xl font-bold font-mono tabular-nums text-bone">
              {rating}
            </div>
            <div
              className={`text-sm font-mono tabular-nums ${delta >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {delta >= 0 ? "+" : ""}
              {delta} from start
            </div>
          </div>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="text-ember"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* End dot */}
            {(() => {
              const lastX = W;
              const lastY =
                H - ((sparkData[sparkData.length - 1] - min) / range) * H;
              return (
                <circle
                  cx={lastX}
                  cy={lastY}
                  r="3"
                  fill="currentColor"
                />
              );
            })()}
          </svg>
        </div>

        {/* ── Chess Platforms ──────────────────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-border/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted">
              Chess Platforms
            </span>
            <button
              onClick={() => setShowEditPlatforms(true)}
              className="text-xs text-ember hover:text-ember/80 underline underline-offset-2"
            >
              Edit Platforms
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Chess.com */}
            <div className="rounded-sm border border-border/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm font-medium text-bone truncate">
                  {studentProfile?.chesscomUsername || "Link account"}
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-bone-muted">
                {studentProfile?.chesscomUsername ? (
                  ratingsLoading ? (
                    <span className="text-ember">…</span>
                  ) : (
                    <>
                      {liveRatings?.chesscom?.rapid ?? "—"} /{" "}
                      {liveRatings?.chesscom?.blitz ?? "—"} /{" "}
                      {liveRatings?.chesscom?.bullet ?? "—"}
                    </>
                  )
                ) : (
                  "Rapid / Blitz / Bullet"
                )}
              </div>
            </div>

            {/* Lichess */}
            <div className="rounded-sm border border-border/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                <span className="text-sm font-medium text-bone truncate">
                  {studentProfile?.lichessUsername || "Link account"}
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-bone-muted">
                {studentProfile?.lichessUsername ? (
                  ratingsLoading ? (
                    <span className="text-ember">…</span>
                  ) : (
                    <>
                      {liveRatings?.lichess?.rapid ?? "—"} /{" "}
                      {liveRatings?.lichess?.blitz ?? "—"} /{" "}
                      {liveRatings?.lichess?.classical ?? "—"}
                    </>
                  )
                ) : (
                  "Rapid / Blitz / Classical"
                )}
              </div>
            </div>

            {/* FIDE */}
            <div className="rounded-sm border border-border/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm font-medium text-bone truncate">
                  {studentProfile?.fideId || "Add FIDE ID"}
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-bone-muted">
                {studentProfile?.fideId ? (
                  <>
                    {currentRating ?? "—"}
                    <span className="block text-[10px] not-italic text-bone-muted/70 font-sans">
                      Your manually-entered rating
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>

        {currentRating === null && (
          <div className="mt-3 flex items-center gap-2">
            {showRatingInput ? (
              <>
                <input
                  type="number"
                  min={100}
                  max={3200}
                  placeholder="e.g. 1200"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  autoFocus
                  className="w-24 px-2 py-1 text-sm bg-background border border-border/40 rounded-sm text-bone font-mono"
                />
                <button
                  onClick={handleSaveRating}
                  disabled={updateRatingMutation.isPending}
                  className="px-2 py-1 text-xs bg-ember text-white rounded-sm hover:bg-ember/90 disabled:opacity-50"
                >
                  {updateRatingMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setShowRatingInput(false);
                    setRatingInput("");
                  }}
                  className="text-xs text-bone-muted hover:text-bone"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowRatingInput(true)}
                className="text-xs text-ember hover:text-ember/80 underline underline-offset-2"
              >
                Set your rating to track progress over time →
              </button>
            )}
          </div>
        )}
      </CardContent>

      <EditPlatformsDialog
        open={showEditPlatforms}
        onOpenChange={setShowEditPlatforms}
        studentProfile={studentProfile}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Chess Platforms Dialog
// ─────────────────────────────────────────────────────────────────────────────

function EditPlatformsDialog({
  open,
  onOpenChange,
  studentProfile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentProfile: any;
}) {
  const utils = trpc.useUtils();
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [lichessUsername, setLichessUsername] = useState("");
  const [fideId, setFideId] = useState("");

  // Pre-fill from profile whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setChesscomUsername(studentProfile?.chesscomUsername ?? "");
      setLichessUsername(studentProfile?.lichessUsername ?? "");
      setFideId(studentProfile?.fideId ?? "");
    }
  }, [open, studentProfile]);

  const updateMutation = trpc.student.updateChessProfiles.useMutation({
    onSuccess: () => {
      toast.success("Chess platforms updated.");
      utils.student.getProfile.invalidate();
      utils.student.fetchLiveRatings.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    updateMutation.mutate({
      chesscomUsername: chesscomUsername.trim() || undefined,
      lichessUsername: lichessUsername.trim() || undefined,
      fideId: fideId.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-ink-raised border-border/40 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone">Edit chess platforms</DialogTitle>
          <DialogDescription className="text-bone-muted">
            Link your accounts to show live ratings on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-bone-muted mb-1 block">
              Chess.com username
            </label>
            <input
              type="text"
              value={chesscomUsername}
              onChange={(e) => setChesscomUsername(e.target.value)}
              placeholder="e.g. magnuscarlsen"
              className="w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50"
            />
          </div>
          <div>
            <label className="text-xs text-bone-muted mb-1 block">
              Lichess username
            </label>
            <input
              type="text"
              value={lichessUsername}
              onChange={(e) => setLichessUsername(e.target.value)}
              placeholder="e.g. DrNykterstein"
              className="w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50"
            />
          </div>
          <div>
            <label className="text-xs text-bone-muted mb-1 block">FIDE ID</label>
            <input
              type="text"
              value={fideId}
              onChange={(e) => setFideId(e.target.value)}
              placeholder="e.g. 1503014"
              className="w-full px-3 py-2 text-sm bg-background border border-border/40 rounded-sm text-bone placeholder:text-bone-muted/50"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-sm border-border/40 text-bone-muted hover:text-bone"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-ember hover:bg-ember/90 text-white rounded-sm"
            disabled={updateMutation.isPending}
            onClick={handleSubmit}
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: Pending Reviews (conditional)
// ─────────────────────────────────────────────────────────────────────────────

function PendingReviewsSection() {
  const { data: pending, isLoading } = trpc.review.getPending.useQuery();
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    name: string;
    reviewingAs: "student" | "coach";
  } | null>(null);

  const studentPending = (pending || []).filter(
    (r: any) => r.reviewingAs === "student",
  );

  if (isLoading || studentPending.length === 0) return null;

  return (
    <section id="pending-reviews">
      <span className="eyebrow mb-3 block">07 — Pending reviews</span>
      <Card className="bg-ink-raised border-amber-600/30 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Star className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-bone">
                Pending Reviews ({studentPending.length})
              </h3>
              <p className="text-sm text-bone-muted">
                You have completed lessons waiting for a review. Both sides
                stay private until both parties submit.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {studentPending.map((p: any) => (
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
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingReviewsCard — backward-compat export
// ─────────────────────────────────────────────────────────────────────────────

function PendingReviewsCard() {
  const { data: pending, isLoading } = trpc.review.getPending.useQuery();
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    name: string;
    reviewingAs: "student" | "coach";
  } | null>(null);

  const studentPending = (pending || []).filter(
    (r: any) => r.reviewingAs === "student",
  );

  if (isLoading || studentPending.length === 0) return null;

  return (
    <>
      <Card className="bg-ink-raised border-amber-600/30 rounded-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Star className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-bone">
                Pending Reviews ({studentPending.length})
              </h3>
              <p className="text-sm text-bone-muted">
                You have completed lessons waiting for a review. Both sides
                stay private until both parties submit.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {studentPending.map((p: any) => (
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
