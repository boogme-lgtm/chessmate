import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Coaches from "./pages/Coaches";
import CoachBrowse from "./pages/CoachBrowse";
import CoachDashboard from "./pages/CoachDashboard";
import CoachApplicationPage from "./pages/CoachApplicationPage";
import AdminApplications from "./pages/AdminApplications";
import AdminWaitlist from "./pages/AdminWaitlist";
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

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/coaches"} component={CoachBrowse} />
      <Route path={"/for-coaches"} component={Coaches} />
      <Route path={"/coach/apply"} component={CoachApplicationPage} />
      <Route path={"/coach/dashboard"} component={CoachDashboard} />
      <Route path={"/coach/:id"} component={CoachDetail} />
      <Route path={"/dashboard"} component={StudentDashboard} />
      <Route path={"/lessons/:id"} component={LessonPaymentSuccess} />
      <Route path={"/register"} component={Register} />
      <Route path={"/sign-in"} component={SignIn} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/admin/applications"} component={AdminApplications} />
      <Route path={"/admin/waitlist"} component={AdminWaitlist} />
      <Route path={"/dev-dashboard"} component={DevDashboard} />
      <Route path={"/unsubscribe"} component={Unsubscribe} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
