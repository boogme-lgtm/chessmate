/** A second app process must not also run reminders, recovery, and settlement. */
export async function startBackgroundJobs(
  setting = process.env.BACKGROUND_JOBS_ENABLED,
  loadScheduler = () => import("../reminderScheduler"),
  environment = process.env.APP_ENV,
): Promise<boolean> {
  if (environment === "preview") {
    if (setting !== undefined && setting !== "false") {
      throw new Error("BACKGROUND_JOBS_ENABLED must be false in preview");
    }
    console.log("[Background Jobs] Disabled in isolated preview");
    return false;
  }
  if (setting === "false") {
    console.log("[Background Jobs] Disabled for this process");
    return false;
  }
  if (setting !== undefined && setting !== "true") {
    throw new Error("BACKGROUND_JOBS_ENABLED must be true or false when set");
  }
  // Preserve existing managed-production behavior when the setting is absent.
  const { startReminderScheduler } = await loadScheduler();
  startReminderScheduler();
  return true;
}
