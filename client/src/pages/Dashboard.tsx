/**
 * Unified Dashboard — single entry point at /dashboard that serves both
 * students and coaches. Users with userType "both" get a role switcher;
 * single-role users see only their view with no toggle.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentDashboardContent } from "./StudentDashboard";
import { CoachDashboardContent } from "./CoachDashboard";

type DashboardView = "student" | "coach";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const userType = (user as any)?.userType as "student" | "coach" | "both" | undefined;
  const hasBothRoles = userType === "both";
  const isCoachOnly = userType === "coach";

  // Coaches default to coach view; both-role users default to student view.
  const [activeView, setActiveView] = useState<DashboardView>(
    isCoachOnly ? "coach" : "student"
  );

  // If auth resolves and user is a coach-only, snap to coach view. For
  // both-role users, leave the default (student) — they can toggle.
  useEffect(() => {
    if (isCoachOnly) setActiveView("coach");
  }, [isCoachOnly]);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  if (authLoading) return null;
  if (!user) return null;

  const headerSubtitle =
    activeView === "coach"
      ? "Manage your lessons, earnings, and payouts"
      : "Manage your upcoming and past chess lessons";

  const headerBadge =
    activeView === "coach" ? "Coach Dashboard" : "Student Dashboard";

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/40">
          <div className="container py-6 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-semibold">Dashboard</h1>
                  <Badge className="bg-primary/10 text-primary border-0 text-sm font-medium">
                    {headerBadge}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{headerSubtitle}</p>
              </div>
              {hasBothRoles && (
                <RoleSwitcher active={activeView} onChange={setActiveView} />
              )}
            </div>
          </div>
        </div>

        {activeView === "coach" ? (
          <CoachDashboardContent user={user} />
        ) : (
          <StudentDashboardContent user={user} />
        )}
      </div>
    </DashboardLayout>
  );
}

function RoleSwitcher({
  active,
  onChange,
}: {
  active: DashboardView;
  onChange: (view: DashboardView) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
      <button
        onClick={() => onChange("student")}
        className={cn(
          "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
          active === "student"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Student
      </button>
      <button
        onClick={() => onChange("coach")}
        className={cn(
          "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
          active === "coach"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Coach
      </button>
    </div>
  );
}
