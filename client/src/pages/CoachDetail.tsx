import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star, 
  Clock, 
  Globe, 
  Award, 
  BookOpen, 
  Shield,
  ChevronLeft,
  Calendar
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import BookingModal from "@/components/BookingModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Coach Detail Page - Shows coach profile and booking CTA
 * Simple, clean layout focusing on trust and credentials
 */
export default function CoachDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const coachId = parseInt(params.id || "0");
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const { user } = useAuth();

  const handleBookLesson = () => {
    if (!user) {
      // Redirect to sign-in page with return URL (user can navigate to register from there)
      setLocation(`/sign-in?redirect=/coach/${coachId}`);
      return;
    }
    setBookingModalOpen(true);
  };

  const { data: coach, isLoading } = trpc.coach.getById.useQuery({ id: coachId });
  const { data: reviews } = trpc.coach.getReviews.useQuery({ coachId, limit: 5 });

  // Fetch Lichess stats if coach has a lichessUsername
  const lichessUsername = coach?.profile?.lichessUsername;
  const { data: lichessProfile } = trpc.lichess.getProfile.useQuery(
    { username: lichessUsername! },
    { enabled: !!lichessUsername }
  );

  useDocumentTitle(coach?.name ? `${coach.name} · Chess Coach · BooGMe` : "Chess Coach · BooGMe");

  if (isLoading) {
    return <CoachDetailSkeleton />;
  }

  if (!coach) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Coach Not Found</h1>
        <Button onClick={() => setLocation("/coaches")}>
          Browse All Coaches
        </Button>
      </div>
    );
  }

  const profile = coach.profile;
  const hourlyRate = profile?.hourlyRateCents 
    ? (profile.hourlyRateCents / 100).toFixed(0) 
    : "50";
  
  const rating = profile?.averageRating
    ? parseFloat(profile.averageRating as string).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Back Navigation */}
      <div className="border-b border-border/40">
        <div className="container py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/coaches")}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Coaches
          </Button>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2/3 */}
          <div className="lg:col-span-2 space-y-8">
            {/* Coach Header */}
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-4xl font-semibold mb-2">{coach.name}</h1>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    {profile?.title && profile.title !== "none" && (
                      <Badge variant="secondary" className="text-sm">
                        {profile.title}
                      </Badge>
                    )}
                    {profile?.fideRating && (
                      <span className="flex items-center gap-1">
                        <Award className="h-4 w-4" />
                        {profile.fideRating} FIDE
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {rating ? (
                    <>
                      <div className="flex items-center gap-1 text-yellow-500 mb-1">
                        <Star className="h-5 w-5 fill-current" />
                        <span className="text-2xl font-semibold text-foreground">{rating}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profile?.totalReviews || 0} reviews
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">New coach</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-semibold">{profile?.totalLessons || 0}</div>
                      <div className="text-sm text-muted-foreground">Lessons</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Globe className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-semibold">{profile?.totalStudents || 0}</div>
                      <div className="text-sm text-muted-foreground">Students</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-semibold">{profile?.experienceYears || 5}+</div>
                      <div className="text-sm text-muted-foreground">Years</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Specialties */}
            {profile?.specialties && (
              <Card>
                <CardHeader>
                  <CardTitle>Specializations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(() => { try { return JSON.parse(profile.specialties as string); } catch { return []; } })().map((specialty: string) => (
                      <Badge key={specialty} variant="secondary">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Teaching Style */}
            {profile?.teachingStyle && (
              <Card>
                <CardHeader>
                  <CardTitle>Teaching Approach</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-sm">
                    {profile.teachingStyle.charAt(0).toUpperCase() + profile.teachingStyle.slice(1)} Learning
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Lichess Verified Stats */}
            {lichessProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Lichess Profile
                    <Badge variant="outline" className="text-xs ml-auto">Verified</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {lichessProfile.ratings.rapid && (
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{lichessProfile.ratings.rapid}</div>
                        <div className="text-xs text-muted-foreground">Rapid</div>
                      </div>
                    )}
                    {lichessProfile.ratings.blitz && (
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{lichessProfile.ratings.blitz}</div>
                        <div className="text-xs text-muted-foreground">Blitz</div>
                      </div>
                    )}
                    {lichessProfile.ratings.classical && (
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{lichessProfile.ratings.classical}</div>
                        <div className="text-xs text-muted-foreground">Classical</div>
                      </div>
                    )}
                    {lichessProfile.ratings.totalGames && (
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{lichessProfile.ratings.totalGames.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Games</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <a
                      href={`https://lichess.org/@/${lichessProfile.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      View on Lichess
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {reviews && reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-border/40 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "fill-yellow-500 text-yellow-500"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Booking Card - Right 1/3 (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card className="border-2">
                <CardHeader>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1">${hourlyRate}</div>
                    <div className="text-sm text-muted-foreground">per hour</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={handleBookLesson}
                  >
                    <Calendar className="h-5 w-5" />
                    Book a Lesson
                  </Button>

                  {/* Payment Protection Badge */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Shield className="h-5 w-5 text-green-600" />
                    <div className="text-sm">
                      <div className="font-medium">Payment Protection</div>
                      <div className="text-muted-foreground">Pay only after your lesson</div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-2 text-sm text-muted-foreground pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>60-minute sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Online via video call</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Flexible scheduling</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        coach={coach}
      />

      <Footer />
    </div>
  );
}

function CoachDetailSkeleton() {
  return (
    <div className="container py-12">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
          <Skeleton className="h-48" />
        </div>
        <div className="lg:col-span-1">
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
