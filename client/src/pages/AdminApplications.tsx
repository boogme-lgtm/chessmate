import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCountryName } from "@shared/countries";
import { format } from "date-fns";

type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected" | "withdrawn";

export default function AdminApplications() {
  const { user, loading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const utils = trpc.useUtils();

  // Fetch applications
  const { data: applications, isLoading } = trpc.admin.applications.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter }
  );

  // Fetch stats
  const { data: stats } = trpc.admin.applications.stats.useQuery();

  // Fetch selected application details
  const { data: applicationDetails } = trpc.admin.applications.getById.useQuery(
    { id: selectedApplication! },
    { enabled: selectedApplication !== null }
  );

  // Mutations
  const approveMutation = trpc.admin.applications.approve.useMutation({
    onSuccess: () => {
      toast.success("Application approved successfully!");
      setSelectedApplication(null);
      setReviewNotes("");
      setActionType(null);
      utils.admin.applications.list.invalidate();
      utils.admin.applications.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve application");
    },
  });

  const rejectMutation = trpc.admin.applications.reject.useMutation({
    onSuccess: () => {
      toast.success("Application rejected");
      setSelectedApplication(null);
      setReviewNotes("");
      setActionType(null);
      utils.admin.applications.list.invalidate();
      utils.admin.applications.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject application");
    },
  });

  const updateStatusMutation = trpc.admin.applications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated successfully!");
      utils.admin.applications.list.invalidate();
      utils.admin.applications.stats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  // Filter applications by search query
  const filteredApplications = applications?.filter((app) => {
    const query = searchQuery.toLowerCase();
    return (
      app.fullName.toLowerCase().includes(query) ||
      app.email.toLowerCase().includes(query)
    );
  });

  const handleApprove = () => {
    if (!selectedApplication) return;
    approveMutation.mutate({
      id: selectedApplication,
      reviewNotes: reviewNotes || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedApplication || !reviewNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    rejectMutation.mutate({
      id: selectedApplication,
      reviewNotes,
    });
  };

  const handleMarkUnderReview = (id: number) => {
    updateStatusMutation.mutate({
      id,
      status: "under_review",
    });
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    const variants: Record<ApplicationStatus, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      under_review: { variant: "secondary", label: "Under Review" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      withdrawn: { variant: "outline", label: "Withdrawn" },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Authorization check
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please log in to access the admin dashboard.
            </p>
            <Button onClick={() => window.location.href = "/api/oauth/login"}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have permission to access this page. Admin privileges are required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Coach Applications</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage coach applications
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.underReview || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved (30d)</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.approvedLast30Days || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejected (30d)</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rejectedLast30Days || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ApplicationStatus | "all")}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApplications && filteredApplications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Rating</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Submitted</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr key={app.id} className="border-b hover:bg-muted/50">
                        <td className="py-4 px-4 text-sm">{app.fullName}</td>
                        <td className="py-4 px-4 text-sm">{app.email}</td>
                        <td className="py-4 px-4 text-sm">{app.chessTitle}</td>
                        <td className="py-4 px-4 text-sm">{app.currentRating}</td>
                        <td className="py-4 px-4">{getStatusBadge(app.status)}</td>
                        <td className="py-4 px-4 text-sm">
                          {format(new Date(app.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="py-4 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedApplication(app.id)}
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No applications found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Application Detail Dialog */}
      <Dialog open={selectedApplication !== null} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {applicationDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {applicationDetails.fullName}
                </DialogTitle>
                <DialogDescription>
                  {applicationDetails.email} • {getStatusBadge(applicationDetails.status)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="expertise">Expertise</TabsTrigger>
                  <TabsTrigger value="availability">Availability</TabsTrigger>
                  <TabsTrigger value="teaching">Teaching</TabsTrigger>
                  <TabsTrigger value="ai-vetting">AI Vetting</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phone:</span> {applicationDetails.phone || "N/A"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Country:</span> {getCountryName(applicationDetails.country)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">City:</span> {applicationDetails.city}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timezone:</span> {applicationDetails.timezone}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Chess Credentials</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Title:</span> {applicationDetails.chessTitle}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rating:</span> {applicationDetails.currentRating} ({applicationDetails.ratingOrg})
                      </div>
                      <div>
                        <span className="text-muted-foreground">Experience:</span> {applicationDetails.yearsExperience}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Students:</span> {applicationDetails.totalStudents || "N/A"}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="expertise" className="space-y-4">
                  {applicationDetails.certifications && (
                    <div>
                      <h3 className="font-semibold mb-2">Certifications</h3>
                      <p className="text-sm">{applicationDetails.certifications}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-2">Achievements</h3>
                    <p className="text-sm whitespace-pre-wrap">{applicationDetails.achievements}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Specializations</h3>
                    <div className="flex flex-wrap gap-2">
                      {(() => { try { return JSON.parse(applicationDetails.specializations); } catch { return []; } })().map((spec: string) => (
                        <Badge key={spec} variant="secondary">{spec}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Target Levels</h3>
                    <div className="flex flex-wrap gap-2">
                      {(() => { try { return JSON.parse(applicationDetails.targetLevels); } catch { return []; } })().map((level: string) => (
                        <Badge key={level} variant="outline">{level}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Teaching Philosophy</h3>
                    <p className="text-sm whitespace-pre-wrap">{applicationDetails.teachingPhilosophy}</p>
                  </div>
                </TabsContent>

                <TabsContent value="availability" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Hourly Rate</h3>
                    <p className="text-2xl font-bold">${(applicationDetails.hourlyRateCents / 100).toFixed(2)}/hour</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Lesson Formats</h3>
                    <div className="flex flex-wrap gap-2">
                      {(() => { try { return JSON.parse(applicationDetails.lessonFormats); } catch { return []; } })().map((fmt: string) => (
                        <Badge key={fmt} variant="secondary">{fmt}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {(() => { try { return JSON.parse(applicationDetails.languages); } catch { return []; } })().map((lang: string) => (
                        <Badge key={lang} variant="outline">{lang}</Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="teaching" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Professional Bio</h3>
                    <p className="text-sm whitespace-pre-wrap">{applicationDetails.bio}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Why BooGMe</h3>
                    <p className="text-sm whitespace-pre-wrap">{applicationDetails.whyBoogme}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Sample Lesson</h3>
                    <p className="text-sm whitespace-pre-wrap">{applicationDetails.sampleLesson}</p>
                  </div>
                </TabsContent>

                <TabsContent value="ai-vetting" className="space-y-4">
                  {applicationDetails.aiVettingScore !== null && applicationDetails.aiVettingScore !== undefined ? (
                    <>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <span className="text-2xl">{applicationDetails.autoApproved ? '✅' : '⚠️'}</span>
                          AI Vetting Result
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Confidence Score</span>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="text-3xl font-bold">{applicationDetails.aiVettingScore}/100</div>
                              <Badge variant={applicationDetails.aiVettingScore >= 85 ? 'default' : applicationDetails.aiVettingScore >= 70 ? 'secondary' : 'destructive'}>
                                {applicationDetails.aiVettingScore >= 85 ? 'High' : applicationDetails.aiVettingScore >= 70 ? 'Medium' : 'Low'}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Auto-Approved</span>
                            <div className="text-2xl font-bold mt-1">
                              {applicationDetails.autoApproved ? 'Yes ✓' : 'No'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {applicationDetails.humanReviewReason && (
                        <div>
                          <h3 className="font-semibold mb-2">Human Review Reason</h3>
                          <p className="text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                            {applicationDetails.humanReviewReason}
                          </p>
                        </div>
                      )}

                      {applicationDetails.aiVettingDetails && (() => {
                        try {
                          const details = JSON.parse(applicationDetails.aiVettingDetails);
                          return (
                            <>
                              {details.redFlags && details.redFlags.length > 0 && (
                                <div>
                                  <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">Red Flags ({details.redFlags.length})</h3>
                                  <ul className="space-y-1">
                                    {details.redFlags.map((flag: string, idx: number) => (
                                      <li key={idx} className="text-sm flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">⚠</span>
                                        <span>{flag}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {details.scoreBreakdown && (
                                <div>
                                  <h3 className="font-semibold mb-3">Score Breakdown</h3>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Credentials</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.credentialScore / 30) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.credentialScore}/30</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Teaching</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.teachingScore / 25) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.teachingScore}/25</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Professionalism</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.professionalismScore / 20) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.professionalismScore}/20</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Pricing</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.pricingScore / 10) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.pricingScore}/10</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Completion</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.completionScore / 10) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.completionScore}/10</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">Platform Fit</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-32 bg-muted rounded-full h-2">
                                          <div className="bg-primary rounded-full h-2" style={{ width: `${(details.scoreBreakdown.platformFitScore / 5) * 100}%` }}></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">{details.scoreBreakdown.platformFitScore}/5</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {details.reasoning && (
                                <div>
                                  <h3 className="font-semibold mb-2">AI Reasoning</h3>
                                  <p className="text-sm bg-muted/50 p-3 rounded">{details.reasoning}</p>
                                </div>
                              )}

                              {applicationDetails.aiVettingTimestamp && (
                                <div className="text-xs text-muted-foreground">
                                  Vetted on {format(new Date(applicationDetails.aiVettingTimestamp), "MMM d, yyyy 'at' h:mm a")}
                                </div>
                              )}
                            </>
                          );
                        } catch (e) {
                          return <p className="text-sm text-muted-foreground">Unable to parse vetting details</p>;
                        }
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No AI vetting data available for this application.</p>
                      <p className="text-sm mt-2">This application was submitted before AI vetting was implemented.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="review" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Current Status</h3>
                    {getStatusBadge(applicationDetails.status)}
                  </div>

                  {applicationDetails.reviewNotes && (
                    <div>
                      <h3 className="font-semibold mb-2">Previous Review Notes</h3>
                      <p className="text-sm whitespace-pre-wrap">{applicationDetails.reviewNotes}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-2">Review Notes</h3>
                    <Textarea
                      placeholder="Add review notes (required for rejection)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {applicationDetails.status === "pending" && (
                      <Button
                        variant="outline"
                        onClick={() => handleMarkUnderReview(applicationDetails.id)}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark as Under Review
                      </Button>
                    )}

                    {applicationDetails.status !== "approved" && (
                      <Button
                        onClick={() => {
                          setActionType("approve");
                          handleApprove();
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="gap-2"
                      >
                        {approveMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Approve Application
                          </>
                        )}
                      </Button>
                    )}

                    {applicationDetails.status !== "rejected" && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setActionType("reject");
                          handleReject();
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="gap-2"
                      >
                        {rejectMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Reject Application
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
