/**
 * Coach Dashboard - Earnings, Lessons, and Stripe Onboarding
 * Swiss Modern design with burgundy accents
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Star,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Timer,
  XCircle,
  Ban,
  MessageCircle,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import MessageThread from "@/components/MessageThread";
import ReviewDialog from "@/components/ReviewDialog";
import { format } from "date-fns";

export default function CoachDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  // Fetch coach profile to check onboarding status
  const { data: profileData } = trpc.coach.getMyProfile.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const onboardingIncomplete = profileData?.profile && !profileData.profile.onboardingCompleted;

  // Fetch coach earnings data
  const { data: earnings, isLoading: earningsLoading } = trpc.coach.getEarnings.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Fetch coach lessons
  const { data: lessons, isLoading: lessonsLoading, refetch: refetchLessons } = trpc.lesson.coachLessons.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated }
  );

  // Unread message counts for all visible lessons
  const lessonIds = (lessons || []).map((l: any) => l.id);
  const { data: unreadCounts } = trpc.messages.getUnreadCounts.useQuery(
    { lessonIds },
    { enabled: lessonIds.length > 0, refetchInterval: 30000 }
  );

  // Pending reviews
  const { data: pendingReviews } = trpc.review.getPending.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Start Stripe onboarding mutation
  const startOnboarding = trpc.coach.startOnboarding.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("Failed to start onboarding. Please try again.");
    },
  });

  // Get Stripe dashboard link
  const getDashboardLink = trpc.coach.getDashboardLink.useQuery(undefined, {
    enabled: isAuthenticated && earnings?.stripeOnboarded,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-burgundy" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">
              Please log in to access your coach dashboard.
            </p>
            <Button
              className="bg-burgundy hover:bg-burgundy/90 text-white"
              onClick={() => window.location.href = "/sign-in"}
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.userType !== "coach" && user?.userType !== "both") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              This page is only available to coaches.
            </p>
            <Link href="/">
              <Button className="bg-burgundy hover:bg-burgundy/90 text-white">
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = earningsLoading || lessonsLoading;

  // Format currency from cents
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-stone dark:bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold">Coach Dashboard</h1>
                <Badge variant="secondary" className="text-xs font-medium">
                  Coach
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Welcome back, {user?.name || "Coach"}
              </p>
            </div>
          </div>
          
          {earnings?.stripeOnboarded && getDashboardLink.data?.url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(getDashboardLink.data?.url, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Stripe Dashboard
            </Button>
          )}
        </div>
      </header>

      <main className="container py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-burgundy" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Complete Profile Banner */}
            {onboardingIncomplete && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Star className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Complete Your Coach Profile</h3>
                      <p className="text-muted-foreground mb-4">
                        Finish setting up your profile so students can find and book you.
                        Set your availability, pricing, and credentials.
                      </p>
                      <Link href="/coach/onboarding">
                        <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                          <Zap className="w-4 h-4" />
                          Continue Setup
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stripe Onboarding Alert */}
            {earnings?.needsOnboarding && (
              <Card className="border-burgundy/50 bg-burgundy/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-burgundy/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-burgundy" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        Complete Your Payment Setup
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Congratulations! You've reached the $100 earnings threshold. 
                        Complete your Stripe setup to receive payouts for your lessons.
                      </p>
                      <Button
                        className="bg-burgundy hover:bg-burgundy/90 text-white"
                        onClick={() => startOnboarding.mutate()}
                        disabled={startOnboarding.isPending}
                      >
                        {startOnboarding.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Set Up Payments
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Earnings Overview */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Earned</span>
                    <DollarSign className="w-4 h-4 text-burgundy" />
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(earnings?.totalEarningsCents || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <Clock className="w-4 h-4 text-terracotta" />
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(earnings?.pendingEarningsCents || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Lessons</span>
                    <Calendar className="w-4 h-4 text-burgundy" />
                  </div>
                  <div className="text-2xl font-bold">
                    {lessons?.length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Payout Status</span>
                    {earnings?.stripeOnboarded ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div className="text-lg font-semibold">
                    {earnings?.stripeOnboarded ? "Active" : "Pending Setup"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress to Threshold (if not yet reached) */}
            {!earnings?.hasReachedThreshold && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-burgundy" />
                    Progress to Payout Threshold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(earnings?.combinedEarningsCents || 0)} earned
                      </span>
                      <span className="font-medium">
                        {formatCurrency(earnings?.thresholdCents || 10000)} threshold
                      </span>
                    </div>
                    <Progress 
                      value={earnings?.percentToThreshold || 0} 
                      className="h-3"
                    />
                    <p className="text-sm text-muted-foreground">
                      Once you reach $100 in earnings, you'll be prompted to set up your 
                      payment details to receive payouts. Until then, your earnings are 
                      safely held in escrow.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Confirmations */}
            {lessons && lessons.filter((l: any) => l.status === "pending_confirmation").length > 0 && (
              <Card className="border-yellow-600/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Timer className="w-5 h-5 text-yellow-600" />
                    Pending Booking Confirmations ({lessons.filter((l: any) => l.status === "pending_confirmation").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lessons.filter((l: any) => l.status === "pending_confirmation").map((lesson: any) => (
                      <PendingLessonCard
                        key={lesson.id}
                        lesson={lesson}
                        formatCurrency={formatCurrency}
                        onActionComplete={() => refetchLessons()}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Reviews */}
            {pendingReviews && pendingReviews.length > 0 && (
              <CoachPendingReviewsCard reviews={pendingReviews} />
            )}

            {/* Recent Lessons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-burgundy" />
                  All Lessons
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessons && lessons.length > 0 ? (
                  <div className="space-y-4">
                    {lessons.map((lesson: any) => {
                      const unread = (unreadCounts as Record<number, number> | undefined)?.[lesson.id] || 0;
                      const getStatusBadge = () => {
                        switch (lesson.status) {
                          case "completed":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </div>
                            );
                          case "confirmed":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Confirmed
                              </div>
                            );
                          case "pending_confirmation":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                <Timer className="w-3 h-3" />
                                Pending
                              </div>
                            );
                          case "cancelled":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <XCircle className="w-3 h-3" />
                                Cancelled
                              </div>
                            );
                          case "declined":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <Ban className="w-3 h-3" />
                                Declined
                              </div>
                            );
                          case "no_show":
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                                <XCircle className="w-3 h-3" />
                                No Show
                              </div>
                            );
                          default:
                            return (
                              <div className="text-xs px-2 py-0.5 rounded-full inline-block bg-muted text-muted-foreground">
                                {lesson.status}
                              </div>
                            );
                        }
                      };

                      return (
                        <CoachLessonRow
                          key={lesson.id}
                          lesson={lesson}
                          unreadCount={unread}
                          formatCurrency={formatCurrency}
                          getStatusBadge={getStatusBadge}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No lessons yet. Start teaching to see your earnings here!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function PendingLessonCard({ lesson, formatCurrency, onActionComplete }: {
  lesson: any;
  formatCurrency: (cents: number) => string;
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
    <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-yellow-200 dark:border-yellow-900">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <Users className="w-5 h-5 text-yellow-600" />
        </div>
        <div className="flex-1">
          <div className="font-medium">
            {lesson.topic || "Chess Lesson"} • Student #{lesson.studentId}
          </div>
          <div className="text-sm text-muted-foreground">
            {lesson.durationMinutes} min • {new Date(lesson.scheduledAt).toLocaleDateString()} at {new Date(lesson.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm font-semibold text-burgundy mt-1">
            {formatCurrency(lesson.coachPayoutCents || 0)} (your payout)
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          disabled={confirmMutation.isPending || declineMutation.isPending}
          onClick={() => confirmMutation.mutate({ lessonId: lesson.id })}
        >
          <ThumbsUp className="w-4 h-4" />
          {confirmMutation.isPending ? "Confirming..." : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
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

/**
 * Individual lesson row with a Messages button + unread badge.
 */
function CoachLessonRow({ lesson, unreadCount, formatCurrency, getStatusBadge }: {
  lesson: any;
  unreadCount: number;
  formatCurrency: (cents: number) => string;
  getStatusBadge: () => React.ReactNode;
}) {
  const [showMessages, setShowMessages] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg bg-stone dark:bg-secondary/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-burgundy/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-burgundy" />
          </div>
          <div>
            <div className="font-medium">
              {lesson.topic || "Chess Lesson"}
            </div>
            <div className="text-sm text-muted-foreground">
              {lesson.durationMinutes} min • {new Date(lesson.scheduledAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 relative"
            onClick={() => setShowMessages(true)}
          >
            <MessageCircle className="w-4 h-4" />
            Messages
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </Button>
          <div className="text-right">
            <div className="font-semibold text-burgundy">
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
        otherPartyName={`Student #${lesson.studentId}`}
      />
    </>
  );
}

/**
 * Pending reviews card for coaches — prompts to review students after
 * completed lessons. Mirrors the student-side PendingReviewsCard.
 */
function CoachPendingReviewsCard({ reviews }: { reviews: any[] }) {
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    name: string;
    reviewingAs: "student" | "coach";
  } | null>(null);

  return (
    <>
      <Card className="border-yellow-600/40 bg-yellow-50/50 dark:bg-yellow-950/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Star className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold">
                Pending Reviews ({reviews.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Review your students after completed lessons. Both reviews are private until both sides submit.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {reviews.map((p: any) => (
              <div
                key={p.lessonId}
                className="flex items-center justify-between p-3 rounded-md border border-border/60"
              >
                <div>
                  <div className="font-medium text-sm">
                    Lesson with {p.otherPartyName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(p.scheduledAt), "MMMM d, yyyy")} · {p.durationMinutes} min
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
