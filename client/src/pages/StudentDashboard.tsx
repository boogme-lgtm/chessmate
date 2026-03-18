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
} from "lucide-react";
import { format, isPast, isFuture, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";

/**
 * Student Dashboard — Upcoming and past lessons with live countdown timers
 * and a proper cancellation confirmation dialog with refund breakdown.
 */
export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: lessons, isLoading } = trpc.lesson.myLessons.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  const upcomingLessons = lessons?.filter((l: any) =>
    isFuture(new Date(l.scheduledAt)) && l.status !== "cancelled" && l.status !== "completed"
  ) || [];

  const pastLessons = lessons?.filter((l: any) =>
    isPast(new Date(l.scheduledAt)) || l.status === "completed" || l.status === "cancelled"
  ) || [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/40">
          <div className="container py-8">
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

        <div className="container py-8">
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
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">No upcoming lessons</h3>
                    <p className="text-muted-foreground mb-6">
                      Book a lesson with a coach to get started
                    </p>
                    <Button onClick={() => setLocation("/coaches")}>
                      Browse Coaches
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                upcomingLessons.map((lesson: any) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {pastLessons.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">No past lessons</h3>
                    <p className="text-muted-foreground">
                      Your completed lessons will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pastLessons.map((lesson: any) => (
                  <LessonCard key={lesson.id} lesson={lesson} isPast />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
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
}

function LessonCard({ lesson, isPast = false }: LessonCardProps) {
  const [, setLocation] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
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
      case "pending_confirmation":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-600 text-white">
            <Timer className="h-3 w-3" /> Awaiting Coach Confirmation
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1 bg-blue-600">
            <CheckCircle2 className="h-3 w-3" /> Confirmed
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="gap-1 bg-blue-600">
            <CheckCircle2 className="h-3 w-3" /> Payment Held
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
    ["pending_confirmation", "confirmed", "paid"].includes(lesson.status);

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors">
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
              </div>
            </div>

            <div className="text-right ml-4">
              <div className="text-2xl font-semibold">
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
