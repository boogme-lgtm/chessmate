/**
 * Unified Dashboard — S-DASH-1 redesign.
 * Uses DashShell sidebar chrome. Role switcher lives in the sidebar for both-role users.
 *
 * Supports ?role=coach|student query param so notification clicks can force the
 * correct dashboard side for "both" accounts without a separate route.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashShell from "@/components/DashShell";
import { StudentDashboardContent } from "./StudentDashboard";
import { CoachDashboardContent } from "./CoachDashboard";

type DashboardView = "student" | "coach";

function getUrlRole(): DashboardView | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("role");
  return v === "coach" || v === "student" ? v : null;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const userType = (user as any)?.userType as "student" | "coach" | "both" | undefined;
  const isCoachOnly = userType === "coach";
  const hasBothRoles = userType === "both";

  // Initialise view: honour ?role= param first, then fall back to userType default
  const urlRole = getUrlRole();
  const [activeView, setActiveView] = useState<DashboardView>(
    isCoachOnly ? "coach" : (urlRole === "coach" ? "coach" : "student")
  );
  const [activeSection, setActiveSection] = useState("overview");

  // Re-apply once auth resolves (handles the async load case for "both" accounts)
  useEffect(() => {
    if (isCoachOnly) { setActiveView("coach"); return; }
    const role = getUrlRole();
    if (role) setActiveView(role);
  }, [isCoachOnly, userType]);

  // Strip ?role from the URL after applying it so the back button works naturally
  useEffect(() => {
    if (getUrlRole()) {
      const params = new URLSearchParams(window.location.search);
      params.delete("role");
      const qs = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, "", `/dashboard${qs}${window.location.hash}`);
    }
  }, []);

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
