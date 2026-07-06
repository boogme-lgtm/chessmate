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
  Calendar,
  ExternalLink,
  Video,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import BookingModal from "@/components/BookingModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const TEACHING_STYLE_DESCRIPTIONS: Record<string, string> = {
  visual: "Uses diagrams, board annotations, and visual patterns",
  interactive: "Hands-on, puzzle-solving, and live game analysis",
  analytical: "Deep positional analysis and opening preparation",
  competitive: "Tournament preparation and competitive mindset",
};

function parseJsonArray(value: unknown): any[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatReviewerName(name: string | null | undefined): string {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

/** Derive the price for a given duration from the hourly rate. */
function durationPrice(hourlyRateCents: number, durationMinutes: number): string {
  return `$${Math.round((hourlyRateCents / 60) * durationMinutes / 100)}`;
}

/** Turn a YouTube/Vimeo URL into an embeddable URL, or null if unrecognised. */
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo: vimeo.com/ID
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * Coach Detail Page — full, conversion-optimised public coach profile.
 */
export default function CoachDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const coachId = parseInt(params.id || "0");
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const { user } = useAuth();

  const handleBookLesson = () => {
    if (!user) {
      setLocation(`/sign-in?redirect=/coach/${coachId}`);
      return;
    }
    setBookingModalOpen(true);
  };

  const utils = trpc.useUtils();
  const [checkoutPending, setCheckoutPending] = useState<number | null>(null);

  const { data: coach, isLoading } = trpc.coach.getById.useQuery({ id: coachId });
  const { data: reviews } = trpc.coach.getReviews.useQuery({ coachId, limit: 5 });
  const { data: storeItems, isLoading: storeLoading } = trpc.content.list.useQuery(
    { coachId, limit: 20 },
    { enabled: coachId > 0 }
  );

  const lichessUsername = coach?.profile?.lichessUsername;
  const { data: lichessProfile } = trpc.lichess.getProfile.useQuery(
    { username: lichessUsername! },
    { enabled: !!lichessUsername }
  );

  const { data: availability, isLoading: availabilityLoading } = trpc.coach.getAvailability.useQuery(
    {
      coachId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { enabled: coachId > 0 }
  );

  // Subscription data
  const { data: subSettings } = trpc.coachSubscription.getSettings.useQuery(
    { coachId },
    { enabled: coachId > 0 }
  );
  const { data: isSubscribed, refetch: refetchSub, isLoading: subLoading } = trpc.coachSubscription.isSubscribed.useQuery(
    { coachId },
    { enabled: !!user && coachId > 0 }
  );
  const subscribeMutation = trpc.coachSubscription.subscribe.useMutation({
    onSuccess: () => { toast.success("Subscribed!"); refetchSub(); },
    onError: (err) => toast.error(err.message),
  });
  const unsubscribeMutation = trpc.coachSubscription.cancel.useMutation({
    onSuccess: () => { toast.success("Unsubscribed"); refetchSub(); },
    onError: (err) => toast.error(err.message),
  });

  useDocumentTitle(coach?.name ? `${coach.name} · Chess Coach · BooGMe` : "Chess Coach · BooGMe");

  if (isLoading) {
    return <CoachDetailSkeleton />;
  }

  if (!coach) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Coach Not Found</h1>
        <Button onClick={() => setLocation("/coaches")}>Browse All Coaches</Button>
      </div>
    );
  }

  const profile = coach.profile;
  const hourlyRateCents = profile?.hourlyRateCents ?? 5000;
  const hourlyRate = (hourlyRateCents / 100).toFixed(0);

  const rating = profile?.averageRating
    ? parseFloat(profile.averageRating as string).toFixed(1)
    : null;

  const photoUrl = profile?.profilePhotoUrl ?? coach.avatarUrl ?? null;
  const specialties = parseJsonArray(profile?.specialties);
  const languages = parseJsonArray(profile?.languages);
  const lessonDurations: number[] = (() => {
    const parsed = parseJsonArray(profile?.lessonDurations).filter((n) => typeof n === "number");
    return parsed.length > 0 ? parsed : [60];
  })();
  const schedule: Record<string, { enabled?: boolean }> = (availability?.schedule as any) || {};
  const minAdvanceHours = availability?.minAdvanceHours ?? 24;
  const coachTimezone = (coach as any).timezone ?? (profile as any)?.timezone ?? null;
  const isAvailable = profile?.isAvailable !== false;
  const videoEmbed = profile?.videoIntroUrl ? getVideoEmbedUrl(profile.videoIntroUrl as string) : null;

  const bio = coach.bio as string | null;
  const bioIsLong = !!bio && bio.length > 300;
  const bioDisplay = bio && bioIsLong && !bioExpanded ? bio.slice(0, 300).trimEnd() + "…" : bio;

  return (
    <div className="min-h-screen bg-background">
      {/* Back Navigation */}
      <div className="border-b border-border/40">
        <div className="container py-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/coaches")} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Coaches
          </Button>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2/3 */}
          <div className="lg:col-span-2 space-y-8">
            {/* Coach Hero Header */}
            <div>
              <div className="flex items-start gap-6 mb-6">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={coach.name ?? "Coach"}
                    className="h-24 w-24 rounded-full object-cover border border-border/60 shrink-0"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground shrink-0">
                    {getInitials(coach.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-semibold mb-2">{coach.name}</h1>
                      <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                        {profile?.title && profile.title !== "none" && (
                          <Badge variant="secondary" className="text-sm">{profile.title}</Badge>
                        )}
                        {profile?.fideRating && (
                          <span className="flex items-center gap-1 text-sm">
                            <Award className="h-4 w-4" />
                            {profile.fideRating} FIDE
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {rating ? (
                        <>
                          <div className="flex items-center gap-1 text-yellow-500 mb-0.5 justify-end">
                            <Star className="h-5 w-5 fill-current" />
                            <span className="text-2xl font-semibold text-foreground">{rating}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{profile?.totalReviews || 0} reviews</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">New coach</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {bioDisplay && (
                <div className="mb-6">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{bioDisplay}</p>
                  {bioIsLong && (
                    <button
                      onClick={() => setBioExpanded((v) => !v)}
                      className="mt-1 text-sm text-foreground/80 hover:text-foreground underline"
                    >
                      {bioExpanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className={`grid gap-4 ${profile?.fideRating ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
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
                {profile?.fideRating && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Award className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-2xl font-semibold">{profile.fideRating}</div>
                        <div className="text-sm text-muted-foreground">FIDE Rating</div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Specializations + Languages */}
            {(specialties.length > 0 || languages.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Specializations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {specialties.map((specialty: string) => (
                        <Badge key={specialty} variant="secondary">{specialty}</Badge>
                      ))}
                    </div>
                  )}
                  {languages.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Languages</div>
                      <div className="flex flex-wrap gap-2">
                        {languages.map((lang: string) => (
                          <Badge key={lang} variant="outline">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Teaching Approach */}
            {profile?.teachingStyle && (
              <Card>
                <CardHeader>
                  <CardTitle>Teaching Approach</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Badge variant="outline" className="text-sm mb-2">
                      {profile.teachingStyle.charAt(0).toUpperCase() + profile.teachingStyle.slice(1)} Learning
                    </Badge>
                    {TEACHING_STYLE_DESCRIPTIONS[profile.teachingStyle] && (
                      <p className="text-sm text-muted-foreground">
                        {TEACHING_STYLE_DESCRIPTIONS[profile.teachingStyle]}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Lesson durations</div>
                    <div className="flex flex-wrap gap-2">
                      {lessonDurations.map((d) => (
                        <Badge key={d} variant="secondary" className="text-sm">
                          {d} min · {durationPrice(hourlyRateCents, d)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Availability Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availabilityLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-2 text-center">
                      {DAYS.map((day) => {
                        const enabled = !!schedule[day.key]?.enabled;
                        return (
                          <div key={day.key}>
                            <div className="text-xs text-muted-foreground mb-2">{day.label}</div>
                            <div
                              className={`mx-auto h-3 w-3 rounded-full ${
                                enabled ? "bg-green-500" : "bg-muted-foreground/20"
                              }`}
                              title={enabled ? "Available" : "Not available"}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      {coachTimezone ? `Schedules in ${coachTimezone}. ` : ""}
                      Book at least {minAdvanceHours}h in advance.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Online Presence */}
            {(lichessProfile || profile?.chesscomUsername) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Online Presence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lichessProfile && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Lichess</span>
                        <Badge variant="outline" className="text-xs">Verified</Badge>
                      </div>
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
                      <div className="mt-3">
                        <a
                          href={`https://lichess.org/@/${lichessProfile.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                        >
                          View on Lichess <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                  {profile?.chesscomUsername && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-4">
                      <span className="text-sm">
                        <span className="text-muted-foreground">Chess.com: </span>
                        <span className="font-medium">@{profile.chesscomUsername}</span>
                      </span>
                      <a
                        href={`https://www.chess.com/member/${profile.chesscomUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                      >
                        View profile <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Video Introduction */}
            {profile?.videoIntroUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Video Introduction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {videoEmbed ? (
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        src={videoEmbed}
                        title={`${coach.name} introduction`}
                        className="absolute inset-0 h-full w-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={profile.videoIntroUrl as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Watch introduction <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Store */}
            {(storeLoading || (storeItems && storeItems.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Store
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {storeLoading ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(storeItems || []).map((item: any) => (
                        <StoreItemRow
                          key={item.id}
                          item={item}
                          user={user}
                          coachId={coachId}
                          checkoutPending={checkoutPending}
                          setCheckoutPending={setCheckoutPending}
                          utils={utils}
                          setLocation={setLocation}
                        />
                      ))}
                    </div>
                  )}
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
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b border-border/40 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium">{formatReviewerName(review.reviewerName)}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mb-2">{review.comment}</p>
                      )}
                      {(review.knowledgeRating || review.communicationRating || review.preparednessRating) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {review.knowledgeRating && (
                            <span className="flex items-center gap-1">
                              Knowledge
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {review.knowledgeRating}
                            </span>
                          )}
                          {review.communicationRating && (
                            <span className="flex items-center gap-1">
                              Communication
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {review.communicationRating}
                            </span>
                          )}
                          {review.preparednessRating && (
                            <span className="flex items-center gap-1">
                              Preparedness
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {review.preparednessRating}
                            </span>
                          )}
                        </div>
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
                    disabled={!isAvailable}
                  >
                    <Calendar className="h-5 w-5" />
                    {isAvailable ? "Book a Lesson" : "Currently unavailable"}
                  </Button>

                  {/* Subscribe/Follow button */}
                  {subSettings?.enabled && !subLoading && (
                    <div>
                      {isSubscribed ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ember font-medium">Following ✓</span>
                          <button
                            onClick={() => {
                              if (!confirm("Unsubscribe from this coach?")) return;
                              unsubscribeMutation.mutate({ coachId });
                            }}
                            disabled={unsubscribeMutation.isPending}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Unsubscribe
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => {
                            if (!user) {
                              setLocation(`/sign-in?redirect=/coach/${coachId}`);
                              return;
                            }
                            subscribeMutation.mutate({ coachId });
                          }}
                          disabled={subscribeMutation.isPending}
                        >
                          {(subSettings.monthlyPriceCents ?? 0) > 0
                            ? `Subscribe — $${((subSettings.monthlyPriceCents ?? 0) / 100).toFixed(0)}/mo`
                            : "Follow (Free)"}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Available durations + derived prices */}
                  <div className="space-y-1.5 text-sm pt-2">
                    <div className="text-muted-foreground font-medium">Available durations</div>
                    {lessonDurations.map((d) => (
                      <div key={d} className="flex items-center justify-between">
                        <span>{d} min</span>
                        <span className="font-medium">{durationPrice(hourlyRateCents, d)}</span>
                      </div>
                    ))}
                  </div>

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
                      <span>Book at least {minAdvanceHours}h in advance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Online via video call</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal open={bookingModalOpen} onOpenChange={setBookingModalOpen} coach={coach} />

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
            <div className="flex items-start gap-6 mb-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-10 w-64 mb-3" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>
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

const KIND_LABELS: Record<string, string> = {
  video: "Video",
  pdf: "PDF",
  pgn: "PGN Pack",
  course: "Course",
  bundle: "Bundle",
};

function StoreItemRow({
  item,
  user,
  coachId,
  checkoutPending,
  setCheckoutPending,
  utils,
  setLocation,
}: {
  item: any;
  user: any;
  coachId: number;
  checkoutPending: number | null;
  setCheckoutPending: (id: number | null) => void;
  utils: any;
  setLocation: (path: string) => void;
}) {
  const handleBuy = async () => {
    if (!user) {
      setLocation(`/sign-in?redirect=/coach/${coachId}`);
      return;
    }
    setCheckoutPending(item.id);
    try {
      const { url } = await utils.client.content.createStorefrontCheckout.mutate({
        contentItemId: item.id,
      });
      if (url) window.location.href = url;
      else toast.error("Checkout URL unavailable");
    } catch (err: any) {
      toast.error(err?.message || "Could not start checkout");
    } finally {
      setCheckoutPending(null);
    }
  };

  const price =
    item.priceCents > 0
      ? `$${(item.priceCents / 100).toFixed(2)}`
      : "Free";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border/70 transition-colors">
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          className="h-12 w-12 rounded object-cover shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABELS[item.kind] ?? item.kind}
          {item.description ? ` · ${item.description.slice(0, 60)}${item.description.length > 60 ? "..." : ""}` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant={item.priceCents > 0 ? "default" : "outline"}
        disabled={checkoutPending === item.id}
        onClick={handleBuy}
        className="shrink-0"
      >
        {checkoutPending === item.id ? "..." : price}
      </Button>
    </div>
  );
}
