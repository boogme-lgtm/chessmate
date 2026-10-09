import { parseBooleanSetting } from "./envFlags";
import { explicitAppEnvironment } from "./previewPolicy";

/**
 * Whether this process owns the scheduled jobs (reminders, recovery,
 * settlement, payout auto-release). Exactly one production process must.
 * Unset keeps the existing managed-production default (on); preview is always
 * off. Throws a clear configuration error for an unrecognized value, so call
 * it before the server listens: a bad flag must stop the deploy, not crash a
 * server that is already serving into a restart loop.
 */
export function backgroundJobsEnabled(
  setting = process.env.BACKGROUND_JOBS_ENABLED,
  environment = process.env.APP_ENV,
): boolean {
  const enabled = parseBooleanSetting("BACKGROUND_JOBS_ENABLED", setting);
  if (explicitAppEnvironment(environment) === "preview") {
    if (enabled) throw new Error("BACKGROUND_JOBS_ENABLED must be false in preview");
    return false;
  }
  return enabled ?? true;
}

/**
 * Whether the job runner releases coach payouts automatically once a lesson's
 * issue window closes. Off unless set; parsed like BACKGROUND_JOBS_ENABLED, so
 * "TRUE" or "1" cannot leave payouts silently held, and an unrecognized value
 * throws (call it before the server listens). Preview is always off.
 */
export function autoReleasePayoutsEnabled(
  setting = process.env.AUTO_RELEASE_PAYOUTS_ENABLED,
  environment = process.env.APP_ENV,
): boolean {
  const enabled = parseBooleanSetting("AUTO_RELEASE_PAYOUTS_ENABLED", setting);
  if (explicitAppEnvironment(environment) === "preview") {
    if (enabled) throw new Error("AUTO_RELEASE_PAYOUTS_ENABLED must be false in preview");
    return false;
  }
  return enabled ?? false;
}

/** A second app process must not also run reminders, recovery, and settlement. */
export async function startBackgroundJobs(
  setting = process.env.BACKGROUND_JOBS_ENABLED,
  loadScheduler = () => import("../reminderScheduler"),
  environment = process.env.APP_ENV,
): Promise<boolean> {
  if (!backgroundJobsEnabled(setting, environment)) {
    console.log(explicitAppEnvironment(environment) === "preview"
      ? "[Background Jobs] Disabled in isolated preview"
      : "[Background Jobs] Disabled for this process");
    return false;
  }
  // Preserve existing managed-production behavior when the setting is absent.
  const { startReminderScheduler } = await loadScheduler();
  startReminderScheduler();
  return true;
}
