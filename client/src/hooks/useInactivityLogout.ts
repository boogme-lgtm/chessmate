import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 minutes before logout

/**
 * Auto-logs out the user after INACTIVITY_TIMEOUT_MS of no activity.
 * Activity is tracked via mousemove, keydown, click, scroll, and touchstart.
 *
 * @param isAuthenticated - Only activates when the user is logged in
 * @param logout - The logout function from useAuth()
 * @param onWarning - Optional callback fired 2 minutes before logout (e.g., to show a toast)
 */
export function useInactivityLogout(
  isAuthenticated: boolean,
  logout: () => Promise<void>,
  onWarning?: () => void
) {
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
  }, []);

  const scheduleLogout = useCallback(() => {
    clearTimers();

    if (!isAuthenticated) return;

    // Warning timer — fires 2 minutes before logout
    if (onWarning) {
      warningTimerRef.current = setTimeout(() => {
        onWarning();
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
    }

    // Logout timer
    logoutTimerRef.current = setTimeout(async () => {
      await logout();
      // Redirect to sign-in after auto-logout
      window.location.href = "/sign-in";
    }, INACTIVITY_TIMEOUT_MS);
  }, [isAuthenticated, logout, onWarning, clearTimers]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    scheduleLogout();
  }, [scheduleLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    // Start the timer on mount
    scheduleLogout();

    // Activity events that reset the inactivity timer
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    // Throttle resets to at most once every 30 seconds to avoid excessive timer churn
    let throttleHandle: ReturnType<typeof setTimeout> | null = null;
    const handleActivity = () => {
      if (throttleHandle) return;
      throttleHandle = setTimeout(() => {
        throttleHandle = null;
        resetTimer();
      }, 30_000);
    };

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      if (throttleHandle) clearTimeout(throttleHandle);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [isAuthenticated, scheduleLogout, resetTimer, clearTimers]);
}
