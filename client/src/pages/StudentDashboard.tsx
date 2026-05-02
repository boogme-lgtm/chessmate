import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format, isPast, isFuture, differenceInHours, differenceInMinutes, differenceInSeconds, isAfter } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ReviewDialog from "@/components/ReviewDialog";
import MessageThread from "@/components/MessageThread";
import { Star, MessageCircle, ArrowLeft } from "lucide-react";

/**
 * Student Dashboard — Upcoming and past lessons with live countdown timers
 * and a proper cancellation confirmation dialog with refund breakdown.
 */
export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

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
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/40">
          <div className="container py-6 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold">My Lessons</h1>
                <Badge variant="secondary" className="text-sm font-medium">
                  Student Dashboard
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Manage your upcoming and past chess lessons
              </p>
            </div>
          </div>
        </div>

        <StudentDashboardContent user={user} />
      </div>
    </DashboardLayout>
  );
}

/**
 * Body content for the student dashboard — queries + lesson lists.
 * Extracted so the unified /dashboard page can render it alongside the
 * coach dashboard body under a single header with a role switcher.
 */
export function StudentDashboardContent({ user }: { user: any }) {
  const [, setLocation] = useLocation();

  const { data: lessons, isLoading } = trpc.lesson.myLessons.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const lessonIds = (lessons || []).map((l: any) => l.id);
  const { data: unreadCounts } = trpc.messages.getUnreadCounts.useQuery(
    { lessonIds },
    { enabled: lessonIds.length > 0, refetchInterval: 30000 }
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const upcomingLessons = lessons?.filter((l: any) =>
    isFuture(new Date(l.scheduledAt)) && !["cancelled", "completed", "declined", "refunded", "released", "disputed"].includes(l.status)
  ) || [];

  const pastLessons = lessons?.filter((l: any) =>
    isPast(new Date(l.scheduledAt)) || l.status === "completed" || l.status === "cancelled"
  ) || [];

  const unreadForLesson = (lessonId: number) =>
    (unreadCounts as Record<number, number> | undefined)?.[lessonId] || 0;

  return (
    <div className="container py-8 space-y-6">
      <PendingReviewsCard />
      <span className="eyebrow">01 — Your lessons</span>
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingLessons.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastLessons.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingLessons.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-1">No upcoming lessons</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Browse our coaches and book your first chess lesson to get started
                </p>
                <Button onClick={() => setLocation("/coaches")}>
                  Browse Coaches
                </Button>
              </CardContent>
            </Card>
          ) : (
            upcomingLessons.map((lesson: any) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                unreadCount={unreadForLesson(lesson.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {pastLessons.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-1">No past lessons</h3>
                <p className="text-sm text-muted-foreground">
                  Your completed lessons will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            pastLessons.map((lesson: any) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                isPast
                unreadCount={unreadForLesson(lesson.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface CancellationDialogProps {
  open: boolean;
  onClose: () => void;
  lesson: any;
  onConfirm: () => void;
  isPending: boolean;
}

function CancellationDialog({ open, onClose, lesson, onConfirm, isPending }: CancellationDialogProps) {
  const hoursUntil = differenceInHours(new Date(lesson.scheduledAt), new Date());
  const amountDollars = (lesson.amountCents / 100).toFixed(2);

  let refundPercent = 0;
  let refundDollars = "0.00";
  let refundLabel = "";
  let refundColor = "text-red-500";
  let policyNote = "";

  if (hoursUntil >= 48) {
    refundPercent = 100;
    refundDollars = amountDollars;
    refundLabel = "Full Refund";
    refundColor = "text-green-500";
    policyNote = "You're cancelling more than 48 hours in advance — you'll receive a full refund.";
  } else if (hoursUntil >= 24) {
    refundPercent = 50;
    refundDollars = ((lesson.amountCents * 0.5) / 100).toFixed(2);
    refundLabel = "50% Refund";
    refundColor = "text-yellow-500";
    policyNote = "You're cancelling between 24–48 hours before the lesson — you'll receive a 50% refund.";
  } else {
    refundPercent = 0;
    refundDollars = "0.00";
    refundLabel = "No Refund";
    refundColor = "text-red-500";
    policyNote = "You're cancelling within 24 hours of the lesson — no refund will be issued per our cancellation policy.";
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
            <span className="font-medium">{format(new Date(lesson.scheduledAt), "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">{format(new Date(lesson.scheduledAt), "h:mm a")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">{lesson.durationMinutes} minutes</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Amount Paid</span>
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
              <span className="text-sm text-muted-foreground">Refund Policy</span>
              <Badge
                variant="outline"
                className={`${refundColor} border-current font-semibold`}
              >
                {refundLabel}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">You will receive</span>
              <span className={`text-xl font-bold ${refundColor}`}>${refundDollars}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
              {policyNote}
            </p>
          </div>
        </div>

        {/* Policy reminder */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Cancellation Policy:</p>
          <p>• More than 48 hours before lesson → 100% refund</p>
          <p>• 24–48 hours before lesson → 50% refund</p>
          <p>• Less than 24 hours before lesson → No refund</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Keep My Lesson
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : `Yes, Cancel & Get $${refundDollars} Back`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Countdown Timer
// ─────────────────────────────────────────────────────────────────────────────

function useCountdown(targetDate: Date) {
  const getSecondsLeft = useCallback(() =>
    Math.max(0, differenceInSeconds(targetDate, new Date())), [targetDate]);

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
  const { days, hours, minutes, seconds, secondsLeft } = useCountdown(scheduledAt);

  if (secondsLeft <= 0) return null;

  const hoursTotal = differenceInHours(scheduledAt, new Date());

  // Within 24 hours — red warning (no refund window)
  if (hoursTotal < 24) {
    return (
      <div className="mt-4 p-3 bg-red-950/30 border border-red-800/50 rounded-md">
        <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
          <Timer className="h-4 w-4" />
          Lesson starting in {hours}h {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
        </div>
        <p className="text-xs text-red-400/80">
          Cancellation window has closed — no refund available
        </p>
      </div>
    );
  }

  // 24–48 hours — yellow warning (partial refund window)
  if (hoursTotal < 48) {
    const refundDeadlineHours = hoursTotal - 24;
    return (
      <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-800/50 rounded-md">
        <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-1">
          <AlertCircle className="h-4 w-4" />
          {days > 0 ? `${days}d ` : ""}{hours % 24}h {String(minutes).padStart(2, "0")}m until lesson
        </div>
        <p className="text-xs text-yellow-400/80">
          Cancel now for a 50% refund · Full refund window closed {Math.round(refundDeadlineHours)}h ago
        </p>
      </div>
    );
  }

  // More than 48 hours — green (full refund available)
  const fullRefundDeadline = new Date(scheduledAt.getTime() - 48 * 60 * 60 * 1000);
  const hoursToDeadline = differenceInHours(fullRefundDeadline, new Date());

  return (
    <div className="mt-4 p-3 bg-green-950/20 border border-green-800/40 rounded-md">
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-1">
        <CheckCircle2 className="h-4 w-4" />
        {days > 0 ? `${days}d ` : ""}{hours % 24}h {String(minutes).padStart(2, "0")}m until lesson
      </div>
      <p className="text-xs text-green-400/80">
        Full refund available · Deadline in {hoursToDeadline}h
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson Card
// ─────────────────────────────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: any;
  isPast?: boolean;
  unreadCount?: number;
}

function LessonCard({ lesson, isPast = false, unreadCount = 0 }: LessonCardProps) {
  const [, setLocation] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showMessageThread, setShowMessageThread] = useState(false);
  const [showRaiseIssueDialog, setShowRaiseIssueDialog] = useState(false);
  const [issueReason, setIssueReason] = useState("");
  const utils = trpc.useUtils();

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

  // ── Confirm Lesson Complete ──────────────────────────────────────────────
  const confirmCompletion = trpc.lesson.confirmCompletion.useMutation({
    onSuccess: () => {
      toast.success(
        "Lesson marked complete. The 24-hour issue window has started — coach payout is released after the window closes."
      );
      utils.lesson.myLessons.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Raise Issue ──────────────────────────────────────────────────────────
  const raiseIssueMutation = trpc.lesson.raiseIssue.useMutation({
    onSuccess: () => {
      toast.success("Issue raised. An admin will review your case.");
      setShowRaiseIssueDialog(false);
      setIssueReason("");
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

  const getStatusBadge = () => {
    switch (lesson.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Cancelled
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge variant="secondary" className="gap-1 bg-gray-600 text-white">
            <Timer className="h-3 w-3" /> Awaiting Payment
          </Badge>
        );
      case "payment_collected":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-600 text-white">
            <Timer className="h-3 w-3" /> Paid — Awaiting Coach Confirmation
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1 bg-blue-600">
            <CheckCircle2 className="h-3 w-3" /> Confirmed
          </Badge>
        );
      case "disputed":
        return (
          <Badge variant="secondary" className="gap-1 bg-orange-600 text-white">
            <AlertTriangle className="h-3 w-3" /> Under Review
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="secondary" className="gap-1 bg-purple-600 text-white">
            <DollarSign className="h-3 w-3" /> Refunded
          </Badge>
        );
      case "released":
        return (
          <Badge variant="default" className="gap-1 bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" /> Declined by Coach
          </Badge>
        );
      case "no_show":
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" /> No Show
          </Badge>
        );
      default:
        return null;
    }
  };

  const hoursUntilLesson = differenceInHours(new Date(lesson.scheduledAt), new Date());
  const canCancel =
    !isPast &&
    hoursUntilLesson > 0 &&
    ["pending_payment", "payment_collected", "confirmed"].includes(lesson.status);

  // ── Confirm Lesson Complete eligibility ──────────────────────────────────
  // Show only when: status === "confirmed" AND now >= scheduledAt + durationMinutes + 15 min grace
  const lessonEndWithGrace = new Date(
    new Date(lesson.scheduledAt).getTime() +
      (lesson.durationMinutes ?? 60) * 60 * 1000 +
      15 * 60 * 1000
  );
  const canConfirmComplete =
    lesson.status === "confirmed" && isAfter(new Date(), lessonEndWithGrace);

  // ── Issue window state ───────────────────────────────────────────────────
  const issueWindowEndsAt = lesson.issueWindowEndsAt
    ? new Date(lesson.issueWindowEndsAt)
    : null;
  const issueWindowActive =
    lesson.status === "completed" &&
    issueWindowEndsAt !== null &&
    isAfter(issueWindowEndsAt, new Date());
  const issueWindowExpired =
    lesson.status === "completed" &&
    issueWindowEndsAt !== null &&
    !isAfter(issueWindowEndsAt, new Date());

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors border-l-2 border-l-ember">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-lg font-semibold">
                  Lesson with Coach #{lesson.coachId}
                </h3>
                {getStatusBadge()}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(lesson.scheduledAt), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(lesson.scheduledAt), "h:mm a")} · {lesson.durationMinutes} min
                  </span>
                </div>
                {lesson.topic && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                    <span className="font-medium">Topic:</span>
                    <span>{lesson.topic}</span>
                  </div>
                )}
              </div>

              {/* Live countdown timer */}
              {!isPast && lesson.status !== "cancelled" && lesson.status !== "declined" && (
                <CountdownBanner
                  scheduledAt={new Date(lesson.scheduledAt)}
                  status={lesson.status}
                />
              )}

              {/* Issue window banner — shown for completed lessons */}
              {issueWindowActive && issueWindowEndsAt && (
                <div
                  data-testid="issue-window-banner"
                  className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-50/60 dark:bg-yellow-950/20 px-3 py-2 text-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-yellow-800 dark:text-yellow-300">
                      24-hour issue window open
                    </span>
                    <span className="text-muted-foreground">
                      {" — "}
                      Coach payout is released after the window closes on{" "}
                      <span className="font-medium">
                        {format(issueWindowEndsAt, "MMM d 'at' h:mm a")}
                      </span>.
                    </span>
                  </div>
                </div>
              )}
              {issueWindowExpired && (
                <div
                  data-testid="issue-window-expired-banner"
                  className="mt-3 flex items-start gap-2 rounded-md border border-green-500/40 bg-green-50/60 dark:bg-green-950/20 px-3 py-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">
                    Issue window closed — coach payout has been released.
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {lesson.meetingLink && !isPast && (
                  <Button size="sm" className="gap-2" asChild>
                    <a href={lesson.meetingLink} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4" />
                      Join Video Call
                    </a>
                  </Button>
                )}

                {/* Student needs to pay (payment-first model) */}
                {lesson.status === "pending_payment" && !isPast && (
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={createCheckout.isPending}
                    onClick={() => createCheckout.mutate({ lessonId: lesson.id })}
                  >
                    <DollarSign className="h-4 w-4" />
                    {createCheckout.isPending ? "Redirecting…" : "Pay Now"}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 relative"
                  onClick={() => setShowMessageThread(true)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Messages
                  {unreadCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <Ban className="h-4 w-4" />
                    Cancel Lesson
                  </Button>
                )}

                {/* Confirm Lesson Complete — only after lesson end + 15 min grace */}
                {canConfirmComplete && (
                  <Button
                    data-testid="confirm-complete-btn"
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={confirmCompletion.isPending}
                    onClick={() => confirmCompletion.mutate({ lessonId: lesson.id })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {confirmCompletion.isPending ? "Confirming…" : "Confirm Lesson Complete"}
                  </Button>
                )}

                {/* Raise Issue — only during the 24-hour issue window */}
                {issueWindowActive && (
                  <Button
                    data-testid="raise-issue-btn"
                    size="sm"
                    variant="outline"
                    className="gap-2 text-orange-600 border-orange-400 hover:text-orange-700"
                    onClick={() => setShowRaiseIssueDialog(true)}
                  >
                    <Flag className="h-4 w-4" />
                    Raise Issue
                  </Button>
                )}
              </div>
            </div>

            <div className="text-right ml-4">
              <div className="text-2xl font-bold font-mono tabular-nums">
                ${(lesson.amountCents / 100).toFixed(2)}
              </div>
              {!isPast && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setLocation(`/coach/${lesson.coachId}`)}
                >
                  View Coach
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
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

      {/* Raise Issue dialog */}
      <Dialog
        open={showRaiseIssueDialog}
        onOpenChange={(v) => {
          if (!v) {
            setShowRaiseIssueDialog(false);
            setIssueReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-500" />
              Raise an Issue
            </DialogTitle>
            <DialogDescription>
              Describe the problem with this lesson. An admin will review your
              case and contact both parties. Coach payout will be paused until
              the issue is resolved.
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
            <textarea
              data-testid="issue-reason-input"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Please describe what went wrong with this lesson…"
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRaiseIssueDialog(false);
                setIssueReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!issueReason.trim() || raiseIssueMutation.isPending}
              onClick={() =>
                raiseIssueMutation.mutate({
                  lessonId: lesson.id,
                  reason: issueReason.trim(),
                })
              }
            >
              <Flag className="h-4 w-4" />
              {raiseIssueMutation.isPending ? "Submitting…" : "Submit Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MessageThread
        open={showMessageThread}
        onOpenChange={setShowMessageThread}
        lessonId={lesson.id}
        otherPartyName={`Coach #${lesson.coachId}`}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container py-8">
      <Skeleton className="h-12 w-64 mb-8" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending Reviews Card — prompts the user to review completed lessons
// ─────────────────────────────────────────────────────────────────────────────

function PendingReviewsCard() {
  const { data: pending, isLoading } = trpc.review.getPending.useQuery();
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    name: string;
    reviewingAs: "student" | "coach";
  } | null>(null);

  // Show only student-role reviews here; coach-role reviews belong on the
  // coach dashboard and would be confusing on the student view.
  const studentPending = (pending || []).filter((r: any) => r.reviewingAs === "student");

  if (isLoading || studentPending.length === 0) return null;

  return (
    <>
      <Card className="border-yellow-600/40 bg-yellow-50/50 dark:bg-yellow-950/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Star className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold">
                Pending Reviews ({studentPending.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                You have completed lessons waiting for a review. Both sides stay
                private until both parties submit.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {studentPending.map((p: any) => (
              <div
                key={p.lessonId}
                className="flex items-center justify-between p-3 rounded-md border border-border/60"
              >
                <div>
                  <div className="font-medium text-sm">
                    Lesson with {p.otherPartyName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(p.scheduledAt), "MMMM d, yyyy")} ·{" "}
                    {p.durationMinutes} min
                  </div>
                </div>
                <Button
                  size="sm"
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
