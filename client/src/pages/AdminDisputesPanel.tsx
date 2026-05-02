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

import { useState } from "react";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps tRPC error codes / messages to human-readable admin copy.
 * Exported for unit testing.
 */
export function formatAdminActionError(message: string): string {
  if (message.includes("issue window") && message.includes("not yet expired")) {
    return "The 24-hour issue window has not expired yet. Wait until the window closes before releasing payout.";
  }
  if (message.includes("issue window") && message.includes("expired")) {
    return "The issue window has already expired.";
  }
  if (message.includes("override reason") || message.includes("adminOverrideReason")) {
    return "An override reason is required for disputed lessons.";
  }
  if (message.includes("payout transfer is currently in progress")) {
    return "A payout transfer is already in progress for this lesson. Wait for it to complete before issuing a refund.";
  }
  if (message.includes("Payout already released")) {
    return "Payout has already been released for this lesson. Post-payout refunds require a manual transfer reversal in the Stripe dashboard.";
  }
  if (message.includes("refund slot") || message.includes("concurrent settlement")) {
    return "A concurrent settlement is in progress. Please wait a moment and retry.";
  }
  if (message.includes("already been refunded") || message.includes("refund already")) {
    return "A refund has already been issued for this lesson.";
  }
  if (message.includes("No payment recorded")) {
    return "No payment is recorded for this lesson — nothing to refund.";
  }
  if (message.includes("not in a refundable state")) {
    return "This lesson is not in a refundable state (must be disputed or completed).";
  }
  if (message.includes("Lesson not found")) {
    return "Lesson not found. It may have been deleted.";
  }
  if (message.includes("Admin access required") || message.includes("FORBIDDEN")) {
    return "Admin access required. You do not have permission to perform this action.";
  }
  // Fallback: return the raw message
  return message;
}

// ─── Admin Nav ────────────────────────────────────────────────────────────────

function AdminNav({ active }: { active: "applications" | "waitlist" | "disputes" }) {
  const links = [
    { href: "/admin/applications", label: "Applications", key: "applications" },
    { href: "/admin/waitlist", label: "Waitlist", key: "waitlist" },
    { href: "/admin/disputes", label: "Disputes & Payouts", key: "disputes" },
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

interface LessonTableRowProps {
  lesson: any;
  isDisputed: boolean;
  onAction: (action: LessonRowAction) => void;
  isPendingRelease: boolean;
  isPendingRefund: boolean;
}

function LessonTableRow({
  lesson,
  isDisputed,
  onAction,
  isPendingRelease,
  isPendingRefund,
}: LessonTableRowProps) {
  const issueWindowEndsAt = lesson.issueWindowEndsAt
    ? new Date(lesson.issueWindowEndsAt)
    : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">#{lesson.id}</td>
      <td className="py-3 px-4 text-sm">
        <div className="font-medium">Student #{lesson.studentId}</div>
        <div className="text-xs text-muted-foreground">Coach #{lesson.coachId}</div>
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
                          (sum: number, l: any) => sum + (l.amountCents ?? 0),
                          0
                        ) / 100
                      ).toFixed(0)}`}
                </div>
                <div className="text-xs text-muted-foreground">Pending Payout</div>
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="disputed">
          <TabsList className="mb-4">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchPayouts()}
                  className="gap-2 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
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
    </div>
  );
}
