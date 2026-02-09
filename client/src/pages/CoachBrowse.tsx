import { trpc } from "@/lib/trpc";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star, 
  Award, 
  BookOpen, 
  Globe, 
  ChevronRight,
  ArrowLeft,
  Menu
} from "lucide-react";
import { useLocation } from "wouter";

/**
 * Coach Browse Page - Students discover and select coaches
 * Simple grid layout with key coach information
 */
export default function CoachBrowse() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { data: coaches, isLoading } = trpc.coach.listActive.useQuery();

  if (isLoading) {
    return <BrowseSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" className="h-8 w-auto" />
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden md:block w-20" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Page Header */}
      <div className="border-b border-border/40">
        <div className="container py-12">
          <h1 className="text-4xl font-semibold mb-4">Find Your Perfect Coach</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Browse our vetted chess coaches. All payments protected by escrow—pay only after your lesson.
          </p>
        </div>
      </div>

      {/* Coach Grid */}
      <div className="container py-12">
        {!coaches || coaches.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <h3 className="text-xl font-semibold mb-2">No coaches available yet</h3>
              <p className="text-muted-foreground mb-6">
                We're onboarding elite coaches. Join the waitlist to be notified when they're ready!
              </p>
              <Button onClick={() => setLocation("/")}>
                Join Waitlist
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <CoachCard key={coach.users.id} coach={coach} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CoachCardProps {
  coach: any;
}

function CoachCard({ coach }: CoachCardProps) {
  const [, setLocation] = useLocation();
  const user = coach.users;
  const profile = coach.coach_profiles;

  const hourlyRate = profile?.hourlyRateCents 
    ? (profile.hourlyRateCents / 100).toFixed(0) 
    : "50";

  const rating = profile?.averageRating 
    ? parseFloat(profile.averageRating as string).toFixed(1)
    : "5.0";

  return (
    <Card className="hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer" onClick={() => setLocation(`/coach/${user.id}`)}>
      <CardContent className="p-6">
        {/* Coach Header */}
          <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold">{user.name}</h3>
            {profile?.title && profile.title !== "none" && (
              <Badge variant="secondary" className="ml-2">
                {profile.title}
              </Badge>
            )}
          </div>

          {profile?.fideRating && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Award className="h-4 w-4" />
              {profile.fideRating} FIDE
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-4 py-4 border-y border-border/40">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold">{rating}</span>
            </div>
            <div className="text-xs text-muted-foreground">Rating</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{profile?.totalLessons || 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">Lessons</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{profile?.totalStudents || 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">Students</div>
          </div>
        </div>

        {/* Specialties */}
        {profile?.specialties && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {JSON.parse(profile.specialties as string).slice(0, 3).map((specialty: string) => (
                <Badge key={specialty} variant="outline" className="text-xs">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div>
            <div className="text-2xl font-bold">${hourlyRate}</div>
            <div className="text-xs text-muted-foreground">per hour</div>
          </div>
          <Button size="sm" className="gap-1">
            View Profile
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BrowseSkeleton() {
  return (
    <div className="container py-12">
      <Skeleton className="h-12 w-96 mb-4" />
      <Skeleton className="h-6 w-full max-w-2xl mb-12" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    </div>
  );
}
