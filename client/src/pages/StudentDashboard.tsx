import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  Video, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  Ban,
  RefreshCw,
  Timer
} from "lucide-react";
import { format, isPast, isFuture, differenceInHours, differenceInMinutes } from "date-fns";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

/**
 * Student Dashboard - Shows upcoming and past lessons
 * Simple, clean interface for managing bookings
 */
export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: lessons, isLoading } = trpc.lesson.myLessons.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  // Redirect to home if not authenticated (must be in useEffect to avoid render-phase setState)
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  const upcomingLessons = lessons?.filter((l: any) => 
    isFuture(new Date(l.scheduledAt)) && l.status !== "cancelled"
  ) || [];

  const pastLessons = lessons?.filter((l: any) => 
    isPast(new Date(l.scheduledAt)) || l.status === "completed"
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

interface LessonCardProps {
  lesson: any;
  isPast?: boolean;
}

function LessonCard({ lesson, isPast = false }: LessonCardProps) {
  const [, setLocation] = useLocation();

  const getStatusBadge = () => {
    switch (lesson.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      case "pending_confirmation":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-600 text-white">
            <Timer className="h-3 w-3" />
            Awaiting Coach Confirmation
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1 bg-blue-600">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            Declined by Coach
          </Badge>
        );
      case "no_show":
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            No Show
          </Badge>
        );
      default:
        return null;
    }
  };

  // Calculate time until lesson and check if cancellation is allowed
  const hoursUntilLesson = differenceInHours(new Date(lesson.scheduledAt), new Date());
  const minutesUntilLesson = differenceInMinutes(new Date(lesson.scheduledAt), new Date());
  const canCancel = hoursUntilLesson >= 24 && lesson.status === "confirmed" && !isPast;
  const canReschedule = hoursUntilLesson >= 24 && lesson.status === "confirmed" && !isPast;

  const formatCountdown = () => {
    if (minutesUntilLesson < 0) return null;
    const hours = Math.floor(minutesUntilLesson / 60);
    const minutes = minutesUntilLesson % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
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

            {/* Countdown timer for cancellation deadline */}
            {!isPast && lesson.status === "confirmed" && hoursUntilLesson < 24 && hoursUntilLesson > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Cancellation deadline passed · Lesson in {formatCountdown()}
                </p>
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
              
              {canCancel && (
                <Button size="sm" variant="outline" className="gap-2">
                  <Ban className="h-4 w-4" />
                  Cancel Lesson
                </Button>
              )}
              
              {canReschedule && (
                <Button size="sm" variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reschedule
                </Button>
              )}
              
              {canCancel && (
                <p className="text-xs text-muted-foreground self-center ml-2">
                  Cancel available for {formatCountdown()}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
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
