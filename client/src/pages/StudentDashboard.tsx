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
  ChevronRight
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import { useLocation } from "wouter";

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

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  const upcomingLessons = lessons?.filter(l => 
    isFuture(new Date(l.scheduledAt)) && l.status !== "cancelled"
  ) || [];

  const pastLessons = lessons?.filter(l => 
    isPast(new Date(l.scheduledAt)) || l.status === "completed"
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="container py-8">
          <h1 className="text-3xl font-semibold mb-2">My Lessons</h1>
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
              upcomingLessons.map((lesson) => (
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
              pastLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} isPast />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
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
          <Badge variant="default" className="gap-1">
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
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending Payment
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </Badge>
        );
      default:
        return null;
    }
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

            {lesson.meetingLink && !isPast && (
              <div className="mt-4">
                <Button size="sm" className="gap-2" asChild>
                  <a href={lesson.meetingLink} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4" />
                    Join Video Call
                  </a>
                </Button>
              </div>
            )}
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
