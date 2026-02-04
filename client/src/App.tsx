import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Coaches from "./pages/Coaches";
import CoachDashboard from "./pages/CoachDashboard";
import CoachApplicationPage from "./pages/CoachApplicationPage";
import AdminApplications from "./pages/AdminApplications";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/coaches"} component={Coaches} />
      <Route path={"/coach/apply"} component={CoachApplicationPage} />
      <Route path={"/coach/dashboard"} component={CoachDashboard} />
      <Route path={"/admin/applications"} component={AdminApplications} />
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
