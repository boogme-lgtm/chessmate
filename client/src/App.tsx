import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { toast } from "sonner";
import Home from "./pages/Home";
import Coaches from "./pages/Coaches";
import CoachBrowse from "./pages/CoachBrowse";
import CoachDashboard from "./pages/CoachDashboard";
import AdminApplications from "./pages/AdminApplications";
import AdminWaitlist from "./pages/AdminWaitlist";
import AdminDisputesPanel from "./pages/AdminDisputesPanel";
import Unsubscribe from "./pages/Unsubscribe";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CoachDetail from "./pages/CoachDetail";
import StudentDashboard from "./pages/StudentDashboard";
import LessonPaymentSuccess from "./pages/LessonPaymentSuccess";
import LessonPaymentCancel from "./pages/LessonPaymentCancel";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DevDashboard from "./pages/DevDashboard";
import CoachOnboarding from "./pages/CoachOnboarding";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import ReferralLanding from "./pages/ReferralLanding";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      {/* /assessment is an alias that opens the assessment modal on the homepage. */}
      <Route path={"/assessment"} component={() => { window.location.replace("/?openAssessment=1"); return null; }} />
      <Route path={"/coaches"} component={CoachBrowse} />
      <Route path={"/for-coaches"} component={Coaches} />
      {/* /coach/apply is deprecated — the canonical coach flow is /coach/onboarding.
          CoachApplicationPage.tsx is intentionally left in place so the route can
          be restored quickly if needed. */}
      <Route path={"/coach/apply"} component={() => { window.location.replace("/coach/onboarding"); return null; }} />
      <Route path={"/coach/onboarding"} component={CoachOnboarding} />
      <Route path={"/coach/onboarding/complete"} component={() => { window.location.href = "/coach/onboarding?stripe_return=1"; return null; }} />
      <Route path={"/coach/onboarding/refresh"} component={() => { window.location.href = "/coach/onboarding?stripe_refresh=1"; return null; }} />
      <Route path={"/coach/dashboard"}>
        {() => { window.location.replace("/dashboard"); return null; }}
      </Route>
      <Route path={"/coach/:id"} component={CoachDetail} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/ref/:code"} component={ReferralLanding} />
      <Route path={"/lessons/:id"} component={LessonPaymentSuccess} />
      <Route path={"/register"} component={Register} />
      <Route path={"/sign-in"} component={SignIn} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/admin/applications"} component={AdminApplications} />
      <Route path={"/admin/waitlist"} component={AdminWaitlist} />
      <Route path={"/admin/disputes"} component={AdminDisputesPanel} />
      <Route path={"/dev-dashboard"} component={DevDashboard} />
      <Route path={"/unsubscribe"} component={Unsubscribe} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Mounts the inactivity auto-logout hook globally for authenticated users.
 * Placed inside providers so it has access to tRPC context (logout mutation).
 * Shows a 2-minute warning toast before signing the user out.
 */
function InactivityGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  useInactivityLogout(
    isAuthenticated,
    logout,
    () =>
      toast.warning("You'll be signed out in 2 minutes due to inactivity.", {
        duration: 10_000,
      })
  );
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          {/* Skip-to-content link for keyboard users. Visible on focus. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
          >
            Skip to main content
          </a>
          <Toaster />
          <InactivityGuard>
            <div id="main-content">
              <Router />
            </div>
          </InactivityGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
