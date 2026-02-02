/**
 * Coach Dashboard - Earnings, Lessons, and Stripe Onboarding
 * Swiss Modern design with burgundy accents
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function CoachDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  // Fetch coach earnings data
  const { data: earnings, isLoading: earningsLoading } = trpc.coach.getEarnings.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Fetch coach lessons
  const { data: lessons, isLoading: lessonsLoading } = trpc.lesson.coachLessons.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated }
  );

  // Start Stripe onboarding mutation
  const startOnboarding = trpc.coach.startOnboarding.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("Opening Stripe onboarding in a new tab...");
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
              onClick={() => window.location.href = getLoginUrl()}
            >
              Log In
            </Button>
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
              <h1 className="text-xl font-semibold">Coach Dashboard</h1>
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

            {/* Recent Lessons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-burgundy" />
                  Recent Lessons
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessons && lessons.length > 0 ? (
                  <div className="space-y-4">
                    {lessons.map((lesson) => (
                      <div 
                        key={lesson.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-stone dark:bg-secondary/30"
                      >
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
                        <div className="text-right">
                          <div className="font-semibold text-burgundy">
                            {formatCurrency(lesson.coachPayoutCents || 0)}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                            lesson.status === "released" 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : lesson.status === "completed"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {lesson.status}
                          </div>
                        </div>
                      </div>
                    ))}
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
