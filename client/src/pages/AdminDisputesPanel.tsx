/**
 * AdminDisputesPanel — Sprint 37
 *
 * Two-tab admin page:
 *   1. Disputed Lessons  — status=disputed, with Release Payout / Issue Refund actions
 *   2. Payout-Ready      — completed lessons whose issue window has expired, ready for payout
 *
 * All money-movement actions pass only lessonId (and adminOverrideReason where required).
 * Final eligibility is enforced server-side.
 */

import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Banknote,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "wouter";
import { formatAdminActionError } from "@shared/adminActionErrors";

// ─── Admin Nav ────────────────────────────────────────────────────────────────

function AdminNav({ active }: { active: "applications" | "waitlist" | "disputes" | "system" }) {
  const links = [
    { href: "/admin/applications", label: "Applications", key: "applications" },
    { href: "/admin/waitlist", label: "Waitlist", key: "waitlist" },
    { href: "/admin/disputes", label: "Disputes & Payouts", key: "disputes" },
    { href: "/admin/system", label: "System", key: "system" },
  ] as const;

  return (
    <nav className="flex gap-2 mb-8 border-b border-border pb-4">
      {links.map((l) => (
        <Link key={l.key} href={l.href}>
          <span
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              active === l.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {l.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  requireReason: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
}

function ActionModal({
  open,
  onClose,
  title,
  description,
  requireReason,
  reason,
  onReasonChange,
  onConfirm,
  isPending,
  confirmLabel,
  confirmVariant = "default",
}: ActionModalProps) {
  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireReason && (
          <div className="space-y-2 py-2">
            <Label htmlFor="admin-override-reason" className="text-sm font-medium">
              Admin Override Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="admin-override-reason"
              data-testid="admin-override-reason"
              placeholder="Describe the reason for this admin action (required for disputed lessons)…"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason is logged for audit purposes.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isPending || !canConfirm}
            data-testid="action-modal-confirm"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Row ───────────────────────────────────────────────────────────────

interface LessonRowAction {
  lessonId: number;
  type: "release" | "refund";
  isDisputed: boolean;
}

interface PartyInfo {
  name: string | null;
  email: string;
}

interface LessonTableRowProps {
  lesson: any;
  isDisputed: boolean;
  onAction: (action: LessonRowAction) => void;
  isPendingRelease: boolean;
  isPendingRefund: boolean;
  student?: PartyInfo;
  coach?: PartyInfo;
}

function LessonTableRow({
  lesson,
  isDisputed,
  onAction,
  isPendingRelease,
  isPendingRefund,
  student,
  coach,
}: LessonTableRowProps) {
  const issueWindowEndsAt = lesson.issueWindowEndsAt
    ? new Date(lesson.issueWindowEndsAt)
    : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">#{lesson.id}</td>
      <td className="py-3 px-4 text-sm">
        <div className="font-medium">
          {student?.name || student?.email || `Student #${lesson.studentId}`}
        </div>
        <div className="text-xs text-muted-foreground">
          {student?.email && student?.name ? `${student.email} · ` : ""}
          <span className="font-mono">#{lesson.studentId}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Coach:{" "}
          <span className="text-foreground">
            {coach?.name || coach?.email || `#${lesson.coachId}`}
          </span>{" "}
          <span className="font-mono">#{lesson.coachId}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-sm">
        {lesson.scheduledAt
          ? format(new Date(lesson.scheduledAt), "MMM d, yyyy h:mm a")
          : "—"}
        <div className="text-xs text-muted-foreground">{lesson.durationMinutes} min</div>
      </td>
      <td className="py-3 px-4 text-sm font-semibold tabular-nums">
        ${((lesson.amountCents ?? 0) / 100).toFixed(2)}
      </td>
      <td className="py-3 px-4 text-sm max-w-[200px]">
        {isDisputed ? (
          <span className="text-orange-600 dark:text-orange-400 text-xs line-clamp-2">
            {lesson.issueReason ?? "No reason provided"}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            Window closed:{" "}
            {issueWindowEndsAt
              ? format(issueWindowEndsAt, "MMM d 'at' h:mm a")
              : "—"}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <Badge
          variant={isDisputed ? "secondary" : "default"}
          className={
            isDisputed
              ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
              : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          }
        >
          {isDisputed ? "Disputed" : "Payout-Ready"}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="gap-1 text-xs"
            disabled={isPendingRelease || isPendingRefund}
            onClick={() => onAction({ lessonId: lesson.id, type: "release", isDisputed })}
            data-testid={`release-payout-btn-${lesson.id}`}
          >
            {isPendingRelease ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Banknote className="h-3 w-3" />
            )}
            Release Payout
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs text-destructive border-destructive/40 hover:text-destructive"
            disabled={isPendingRelease || isPendingRefund}
            onClick={() => onAction({ lessonId: lesson.id, type: "refund", isDisputed })}
            data-testid={`issue-refund-btn-${lesson.id}`}
          >
            {isPendingRefund ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Issue Refund
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Empty / Error / Loading states ──────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-md bg-accent/40 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Icon className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <ShieldAlert className="h-10 w-10 text-destructive opacity-60" />
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDisputesPanel() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [pendingAction, setPendingAction] = useState<LessonRowAction | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: disputedLessons,
    isLoading: disputedLoading,
    error: disputedError,
    refetch: refetchDisputed,
  } = trpc.admin.disputes.list.useQuery(undefined, { enabled: user?.role === "admin" });

  const {
    data: payoutReadyLessons,
    isLoading: payoutLoading,
    error: payoutError,
    refetch: refetchPayouts,
  } = trpc.admin.disputes.pendingPayouts.useQuery(undefined, { enabled: user?.role === "admin" });

  // ── Resolve student/coach IDs → names ────────────────────────────────────────
  // Collect every user id referenced across both tabs, batch-fetch their
  // display info, and expose a lookup map to the rows.
  const userIds = useMemo(() => {
    const ids = new Set<number>();
    for (const l of disputedLessons ?? []) {
      if (l.studentId) ids.add(l.studentId);
      if (l.coachId) ids.add(l.coachId);
    }
    for (const l of payoutReadyLessons ?? []) {
      if (l.studentId) ids.add(l.studentId);
      if (l.coachId) ids.add(l.coachId);
    }
    return Array.from(ids);
  }, [disputedLessons, payoutReadyLessons]);

  const { data: userList } = trpc.admin.users.getByIds.useQuery(
    { ids: userIds },
    { enabled: user?.role === "admin" && userIds.length > 0 }
  );

  const userMap = useMemo(() => {
    const m = new Map<number, { name: string | null; email: string }>();
    for (const u of userList ?? []) m.set(u.id, { name: u.name, email: u.email });
    return m;
  }, [userList]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const releasePayoutMutation = trpc.admin.disputes.releasePayout.useMutation({
    onSuccess: () => {
      toast.success("Coach payout released successfully.");
      closeModal();
      utils.admin.disputes.list.invalidate();
      utils.admin.disputes.pendingPayouts.invalidate();
    },
    onError: (err) => {
      toast.error(formatAdminActionError(err.message));
    },
  });

  const refundStudentMutation = trpc.admin.disputes.refundStudent.useMutation({
    onSuccess: (data) => {
      const amount = data.refundAmountCents
        ? `$${(data.refundAmountCents / 100).toFixed(2)}`
        : "full amount";
      toast.success(`Student refund of ${amount} issued successfully.`);
      closeModal();
      utils.admin.disputes.list.invalidate();
      utils.admin.disputes.pendingPayouts.invalidate();
    },
    onError: (err) => {
      toast.error(formatAdminActionError(err.message));
    },
  });

  // Bulk release — orchestrates the existing per-lesson payout service server-side.
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const releaseAllMutation = trpc.admin.disputes.releaseAllEligible.useMutation({
    onSuccess: (res) => {
      setBulkConfirmOpen(false);
      if (res.total === 0) {
        toast.info("No eligible lessons to release.");
      } else if (res.failedCount === 0) {
        toast.success(`Released ${res.releasedCount} of ${res.total} payouts.`);
      } else {
        const detail = res.failed
          .slice(0, 5)
          .map((f) => `#${f.lessonId}: ${formatAdminActionError(f.reason)}`)
          .join("\n");
        toast.warning(
          `Released ${res.releasedCount} of ${res.total}. ${res.failedCount} failed.`,
          { description: detail + (res.failed.length > 5 ? "\n…" : ""), duration: 10000 }
        );
      }
      utils.admin.disputes.list.invalidate();
      utils.admin.disputes.pendingPayouts.invalidate();
    },
    onError: (err) => {
      toast.error(formatAdminActionError(err.message));
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openAction(action: LessonRowAction) {
    setOverrideReason("");
    setPendingAction(action);
  }

  function closeModal() {
    setPendingAction(null);
    setOverrideReason("");
  }

  function confirmAction() {
    if (!pendingAction) return;
    const { lessonId, type, isDisputed } = pendingAction;
    const reason = overrideReason.trim() || undefined;

    if (type === "release") {
      releasePayoutMutation.mutate({ lessonId, adminOverrideReason: reason });
    } else {
      refundStudentMutation.mutate({ lessonId, reason });
    }
  }

  const isMutationPending =
    releasePayoutMutation.isPending || refundStudentMutation.isPending;

  // ── Auth guards ────────────────────────────────────────────────────────────
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
            <Button onClick={() => (window.location.href = "/api/oauth/login")}>
              Log In
            </Button>
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

  // ── Modal config ───────────────────────────────────────────────────────────
  const modalConfig = pendingAction
    ? {
        release: {
          title: pendingAction.isDisputed
            ? "Release Payout — Disputed Lesson"
            : "Release Coach Payout",
          description: pendingAction.isDisputed
            ? "You are releasing the coach payout for a disputed lesson. An override reason is required. This action is irreversible."
            : `Release the coach payout for lesson #${pendingAction.lessonId}. The issue window has expired and no dispute was raised. This action is irreversible.`,
          requireReason: pendingAction.isDisputed,
          confirmLabel: "Release Payout",
          confirmVariant: "default" as const,
        },
        refund: {
          title: "Issue Student Refund",
          description: `Issue a full refund to the student for lesson #${pendingAction.lessonId}. ${
            pendingAction.isDisputed
              ? "An override reason is required for disputed lessons."
              : "Provide an optional reason for this refund."
          } This action is irreversible.`,
          requireReason: pendingAction.isDisputed,
          confirmLabel: "Issue Refund",
          confirmVariant: "destructive" as const,
        },
      }[pendingAction.type]
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Disputes &amp; Payouts</h1>
          <p className="text-muted-foreground mt-2">
            Review disputed lessons and release coach payouts or issue student refunds.
          </p>
        </div>

        {/* Admin nav */}
        <AdminNav active="disputes" />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500 shrink-0" />
              <div>
                <div className="text-2xl font-bold">
                  {disputedLoading ? "—" : (disputedLessons?.length ?? 0)}
                </div>
                <div className="text-xs text-muted-foreground">Disputed</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <div className="text-2xl font-bold">
                  {payoutLoading ? "—" : (payoutReadyLessons?.length ?? 0)}
                </div>
                <div className="text-xs text-muted-foreground">Payout-Ready</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-500 shrink-0" />
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {payoutLoading
                    ? "—"
                    : `$${(
                        (payoutReadyLessons ?? []).reduce(
                          (sum: number, l: any) => sum + (l.coachPayoutCents ?? 0),
                          0
                        ) / 100
                      ).toFixed(0)}`}
                </div>
                <div className="text-xs text-muted-foreground">Pending Payout</div>
                <div className="text-xs text-muted-foreground/60">(coach net)</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Banknote className="h-8 w-8 text-purple-500 shrink-0" />
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {disputedLoading
                    ? "—"
                    : `$${(
                        (disputedLessons ?? []).reduce(
                          (sum: number, l: any) => sum + (l.amountCents ?? 0),
                          0
                        ) / 100
                      ).toFixed(0)}`}
                </div>
                <div className="text-xs text-muted-foreground">Disputed Value</div>
                <div className="text-xs text-muted-foreground/60">(gross)</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="lesson-disputes">
          <TabsList className="mb-4">
            <TabsTrigger value="lesson-disputes" className="gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              Lesson Disputes
            </TabsTrigger>
            <TabsTrigger value="disputed" className="gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Disputed Lessons
              {(disputedLessons?.length ?? 0) > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white text-xs px-1.5">
                  {disputedLessons!.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Payout-Ready
              {(payoutReadyLessons?.length ?? 0) > 0 && (
                <Badge className="ml-1 bg-green-500 text-white text-xs px-1.5">
                  {payoutReadyLessons!.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Lesson Disputes Tab (S-REF-2) ── */}
          <TabsContent value="lesson-disputes">
            <LessonDisputesTab isAdmin={user?.role === "admin"} />
          </TabsContent>

          {/* ── Disputed Lessons Tab ── */}
          <TabsContent value="disputed">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Disputed Lessons</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchDisputed()}
                  className="gap-2 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {disputedLoading ? (
                  <TableSkeleton />
                ) : disputedError ? (
                  <ErrorState
                    message={formatAdminActionError(disputedError.message)}
                    onRetry={() => refetchDisputed()}
                  />
                ) : !disputedLessons || disputedLessons.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    message="No disputed lessons — all clear."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="py-2 px-4">ID</th>
                          <th className="py-2 px-4">Parties</th>
                          <th className="py-2 px-4">Scheduled</th>
                          <th className="py-2 px-4">Amount</th>
                          <th className="py-2 px-4">Issue Reason</th>
                          <th className="py-2 px-4">Status</th>
                          <th className="py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disputedLessons.map((lesson: any) => (
                          <LessonTableRow
                            key={lesson.id}
                            lesson={lesson}
                            isDisputed={true}
                            onAction={openAction}
                            student={userMap.get(lesson.studentId)}
                            coach={userMap.get(lesson.coachId)}
                            isPendingRelease={
                              releasePayoutMutation.isPending &&
                              pendingAction?.lessonId === lesson.id &&
                              pendingAction?.type === "release"
                            }
                            isPendingRefund={
                              refundStudentMutation.isPending &&
                              pendingAction?.lessonId === lesson.id &&
                              pendingAction?.type === "refund"
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payout-Ready Tab ── */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Payout-Ready Lessons</CardTitle>
                <div className="flex items-center gap-2">
                  {(payoutReadyLessons?.length ?? 0) > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setBulkConfirmOpen(true)}
                      disabled={releaseAllMutation.isPending}
                      className="gap-2"
                      data-testid="release-all-eligible-btn"
                    >
                      {releaseAllMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Banknote className="h-4 w-4" />
                      )}
                      Release All Eligible ({payoutReadyLessons!.length})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchPayouts()}
                    className="gap-2 text-muted-foreground"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  These lessons are completed, the 24-hour issue window has expired, and no
                  dispute was raised. They are eligible for coach payout release.
                </p>
                {payoutLoading ? (
                  <TableSkeleton />
                ) : payoutError ? (
                  <ErrorState
                    message={formatAdminActionError(payoutError.message)}
                    onRetry={() => refetchPayouts()}
                  />
                ) : !payoutReadyLessons || payoutReadyLessons.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    message="No payout-ready lessons at this time."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="py-2 px-4">ID</th>
                          <th className="py-2 px-4">Parties</th>
                          <th className="py-2 px-4">Scheduled</th>
                          <th className="py-2 px-4">Amount</th>
                          <th className="py-2 px-4">Window Closed</th>
                          <th className="py-2 px-4">Status</th>
                          <th className="py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutReadyLessons.map((lesson: any) => (
                          <LessonTableRow
                            key={lesson.id}
                            lesson={lesson}
                            isDisputed={false}
                            onAction={openAction}
                            student={userMap.get(lesson.studentId)}
                            coach={userMap.get(lesson.coachId)}
                            isPendingRelease={
                              releasePayoutMutation.isPending &&
                              pendingAction?.lessonId === lesson.id &&
                              pendingAction?.type === "release"
                            }
                            isPendingRefund={
                              refundStudentMutation.isPending &&
                              pendingAction?.lessonId === lesson.id &&
                              pendingAction?.type === "refund"
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Safety note */}
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-50/40 dark:bg-yellow-950/20 p-4 text-sm">
          <ShieldAlert className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Safety reminder: </span>
            All payout and refund eligibility is enforced server-side. The UI passes only
            lesson IDs and admin override reasons — no amounts or statuses are trusted from
            the client. Post-payout refunds require a manual transfer reversal in the{" "}
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              Stripe Dashboard <ExternalLink className="h-3 w-3" />
            </a>
            .
          </div>
        </div>
      </div>

      {/* Action confirmation modal */}
      {pendingAction && modalConfig && (
        <ActionModal
          open={true}
          onClose={closeModal}
          title={modalConfig.title}
          description={modalConfig.description}
          requireReason={modalConfig.requireReason}
          reason={overrideReason}
          onReasonChange={setOverrideReason}
          onConfirm={confirmAction}
          isPending={isMutationPending}
          confirmLabel={modalConfig.confirmLabel}
          confirmVariant={modalConfig.confirmVariant}
        />
      )}

      {/* Bulk release confirmation */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(v) => { if (!v && !releaseAllMutation.isPending) setBulkConfirmOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Release All Eligible Payouts</DialogTitle>
            <DialogDescription>
              This releases the coach payout for all {payoutReadyLessons?.length ?? 0} payout-ready
              lessons — completed lessons whose 24-hour issue window has expired with no dispute.
              Each is independently validated server-side. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkConfirmOpen(false)}
              disabled={releaseAllMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => releaseAllMutation.mutate()}
              disabled={releaseAllMutation.isPending}
              data-testid="bulk-release-confirm"
            >
              {releaseAllMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Releasing…
                </>
              ) : (
                `Release ${payoutReadyLessons?.length ?? 0} Payouts`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Lesson Disputes Tab (S-REF-2) ──────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  coach_no_show: "Coach No-Show",
  coach_late_or_short: "Late / Short",
  technical_failure: "Technical Failure",
  not_as_described: "Not As Described",
  quality: "Quality Feedback",
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500",
  coach_responded: "bg-blue-500",
  escalated: "bg-orange-500",
  resolved: "bg-green-600",
};

function LessonDisputesTab({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading, error, refetch } = trpc.admin.disputes.listLessonDisputes.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Lesson Disputes</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={formatAdminActionError(error.message)} onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={CheckCircle2} message="No lesson disputes raised." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="py-2 px-4">Dispute</th>
                  <th className="py-2 px-4">Lesson</th>
                  <th className="py-2 px-4">Student</th>
                  <th className="py-2 px-4">Category</th>
                  <th className="py-2 px-4">Description</th>
                  <th className="py-2 px-4">Amount</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Raised</th>
                  <th className="py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2 px-4 font-mono text-sm">
                      #{d.id}
                      {d.abuseFlag && (
                        <span title="High-dispute student — review carefully" className="ml-1">⚠️</span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-mono text-sm">#{d.lessonId}</td>
                    <td className="py-2 px-4 text-sm">
                      <div className="font-medium">{d.studentName || `Student #${d.raisedBy}`}</div>
                      <div className="text-xs text-muted-foreground">{d.studentEmail}</div>
                    </td>
                    <td className="py-2 px-4 text-sm">{CATEGORY_LABELS[d.category] ?? d.category}</td>
                    <td className="py-2 px-4 text-sm max-w-[220px]">
                      <span title={d.description || ""} className="line-clamp-1 text-muted-foreground">
                        {d.description
                          ? d.description.length > 80
                            ? d.description.slice(0, 80) + "…"
                            : d.description
                          : "—"}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-sm">
                      {d.lessonAmountCents != null ? `$${(d.lessonAmountCents / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 px-4">
                      <Badge className={`${DISPUTE_STATUS_COLORS[d.status] ?? "bg-muted"} text-white text-xs`}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-sm text-muted-foreground">
                      {d.createdAt ? format(new Date(d.createdAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="py-2 px-4">
                      <Button size="sm" variant="outline" onClick={() => setSelected(d)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {selected && (
        <LessonDisputeDetailDialog
          dispute={selected}
          onClose={() => setSelected(null)}
          onResolved={() => {
            setSelected(null);
            utils.admin.disputes.listLessonDisputes.invalidate();
            utils.admin.disputes.list.invalidate();
            utils.admin.disputes.pendingPayouts.invalidate();
          }}
        />
      )}
    </Card>
  );
}

function LessonDisputeDetailDialog({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: any;
  onClose: () => void;
  onResolved: () => void;
}) {
  const isResolved = dispute.status === "resolved";
  const [resolution, setResolution] = useState<"refund_full" | "refund_partial" | "denied">("refund_full");
  const [partialDollars, setPartialDollars] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const lessonAmountCents: number = dispute.lessonAmountCents ?? 0;
  const partialCents = Math.round(Number(partialDollars) * 100);
  const partialValid =
    resolution !== "refund_partial" ||
    (partialDollars !== "" && partialCents > 0 && partialCents <= lessonAmountCents);

  const resolveMutation = trpc.admin.disputes.resolveLessonDispute.useMutation({
    onSuccess: () => {
      toast.success("Dispute resolved.");
      onResolved();
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(formatAdminActionError(err.message));
    },
  });

  const evidenceUrls: string[] = (() => {
    try {
      return dispute.evidenceUrls ? JSON.parse(dispute.evidenceUrls) : [];
    } catch {
      return [];
    }
  })();

  const submit = () => {
    resolveMutation.mutate({
      disputeId: dispute.id,
      resolution,
      refundAmountCents: resolution === "refund_partial" ? partialCents : undefined,
      adminNote: adminNote.trim() || undefined,
    });
  };

  const confirmText =
    resolution === "denied"
      ? `release the held payout to the coach`
      : resolution === "refund_partial"
      ? `refund $${(partialCents / 100).toFixed(2)} to the student`
      : `refund the full $${(lessonAmountCents / 100).toFixed(2)} to the student`;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Dispute #{dispute.id} — Lesson #{dispute.lessonId}
            {dispute.abuseFlag && <span title="High-dispute student">⚠️</span>}
          </DialogTitle>
          <DialogDescription>
            {CATEGORY_LABELS[dispute.category] ?? dispute.category}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {dispute.abuseFlag && (
            <div className="rounded-md border border-red-500/40 bg-red-50/60 dark:bg-red-950/20 px-3 py-2 text-red-700 dark:text-red-300">
              ⚠️ This student has a high number of prior disputes. Review carefully before refunding.
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{dispute.studentName || `#${dispute.raisedBy}`} · {dispute.studentEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lesson amount</span>
              <span className="font-medium">${(lessonAmountCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lesson status</span>
              <span className="font-medium">{dispute.lessonStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scheduled</span>
              <span className="font-medium">
                {dispute.lessonScheduledAt ? format(new Date(dispute.lessonScheduledAt), "MMM d, yyyy") : "—"}
              </span>
            </div>
          </div>

          <div>
            <div className="font-medium mb-1">Description</div>
            <p className="text-muted-foreground whitespace-pre-wrap">{dispute.description || "(none provided)"}</p>
          </div>

          {evidenceUrls.length > 0 && (
            <div>
              <div className="font-medium mb-1">Evidence</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {evidenceUrls.map((u, i) => (
                  <li key={i}>
                    <a href={u} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{u}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-medium mb-1">Coach response</div>
            {dispute.coachResponse ? (
              <p className="text-muted-foreground">
                [{dispute.coachAction ?? "—"}] {dispute.coachResponse}
                {dispute.coachRespondedAt && (
                  <span className="block text-xs">{format(new Date(dispute.coachRespondedAt), "MMM d, yyyy h:mm a")}</span>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground">No coach response yet.</p>
            )}
          </div>

          {isResolved ? (
            <div className="rounded-md border border-green-500/40 bg-green-50/60 dark:bg-green-950/20 px-3 py-2">
              <div className="font-medium text-green-700 dark:text-green-300">Resolved: {dispute.resolution}</div>
              {dispute.refundAmountCents != null && (
                <div className="text-xs">Refund: ${(dispute.refundAmountCents / 100).toFixed(2)}</div>
              )}
              {dispute.resolvedAt && (
                <div className="text-xs">{format(new Date(dispute.resolvedAt), "MMM d, yyyy h:mm a")}</div>
              )}
              {dispute.adminNote && <div className="text-xs mt-1">Note: {dispute.adminNote}</div>}
            </div>
          ) : dispute.category === "quality" ? (
            <div className="rounded-md border border-border px-3 py-2 text-muted-foreground">
              Quality feedback is non-refundable by policy. No action required.
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="font-medium">Resolution</div>
              <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as any)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="refund_full" id="r-full" />
                  <Label htmlFor="r-full">Full refund to student</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="refund_partial" id="r-partial" />
                  <Label htmlFor="r-partial">Partial refund</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="denied" id="r-deny" />
                  <Label htmlFor="r-deny">Deny — release payout to coach</Label>
                </div>
              </RadioGroup>

              {resolution === "refund_partial" && (
                <div>
                  <Label htmlFor="partial-amount" className="text-xs">Refund amount (USD, max ${(lessonAmountCents / 100).toFixed(2)})</Label>
                  <Input
                    id="partial-amount"
                    type="number"
                    min="0.01"
                    max={(lessonAmountCents / 100).toFixed(2)}
                    step="0.01"
                    value={partialDollars}
                    onChange={(e) => setPartialDollars(e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="admin-note" className="text-xs">Admin note (optional)</Label>
                <Textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Reason for this decision…"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {!isResolved && dispute.category !== "quality" && (
          <DialogFooter className="gap-2">
            {confirming ? (
              <>
                <span className="text-sm text-muted-foreground self-center mr-auto">
                  Are you sure? This will {confirmText}.
                </span>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={resolveMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={resolveMutation.isPending}>
                  {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={!partialValid || resolveMutation.isPending}
              >
                Resolve Dispute
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
