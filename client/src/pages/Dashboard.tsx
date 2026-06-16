/**
 * Unified Dashboard — S-DASH-1 redesign.
 * Uses DashShell sidebar chrome. Role switcher lives in the sidebar for both-role users.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashShell from "@/components/DashShell";
import { StudentDashboardContent } from "./StudentDashboard";
import { CoachDashboardContent } from "./CoachDashboard";

type DashboardView = "student" | "coach";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const userType = (user as any)?.userType as "student" | "coach" | "both" | undefined;
  const isCoachOnly = userType === "coach";
  const hasBothRoles = userType === "both";

  const [activeView, setActiveView] = useState<DashboardView>(
    isCoachOnly ? "coach" : "student"
  );
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    if (isCoachOnly) setActiveView("coach");
  }, [isCoachOnly]);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/");
  }, [authLoading, user, setLocation]);

  if (authLoading || !user) return null;

  return (
    <DashShell
      role={activeView}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onRoleChange={hasBothRoles ? setActiveView : undefined}
    >
      {activeView === "coach" ? (
        <CoachDashboardContent user={user} />
      ) : (
        <StudentDashboardContent user={user} />
      )}
    </DashShell>
  );
}
