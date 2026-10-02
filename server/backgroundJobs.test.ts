import { describe, expect, it, vi } from "vitest";
import { startBackgroundJobs } from "./_core/backgroundJobs";

describe("background jobs on a second application instance", () => {
  it("does not import or start the scheduler when explicitly disabled", async () => {
    const load = vi.fn();
    expect(await startBackgroundJobs("false", load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([undefined, "true"])("preserves startup when enabled (%s)", async setting => {
    const startReminderScheduler = vi.fn();
    const load = vi.fn().mockResolvedValue({ startReminderScheduler });
    expect(await startBackgroundJobs(setting, load)).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    expect(startReminderScheduler).toHaveBeenCalledOnce();
  });

  it.each(["", "0", "FALSE", "yes"])("rejects ambiguous configuration (%s)", async setting => {
    const load = vi.fn();
    await expect(startBackgroundJobs(setting, load)).rejects.toThrow("must be true or false");
    expect(load).not.toHaveBeenCalled();
  });
});
