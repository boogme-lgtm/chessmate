import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { backgroundJobsEnabled, startBackgroundJobs } from "./_core/backgroundJobs";
import { parseBooleanSetting } from "./_core/envFlags";

describe("background jobs on a second application instance", () => {
  it.each(["false", "FALSE", "False", "0", "no", "NO", " off ", "false\n"])(
    "does not import or start the scheduler when explicitly disabled (%j)",
    async setting => {
      const load = vi.fn();
      expect(await startBackgroundJobs(setting, load)).toBe(false);
      expect(load).not.toHaveBeenCalled();
    },
  );

  // Sprint 3 (intended change): "TRUE", "1" and "yes" used to throw after the
  // server was already listening, crash-looping production.
  it.each([undefined, "true", "TRUE", "True", "1", "yes", "Yes", " on ", "true\n"])(
    "preserves startup when enabled (%j)",
    async setting => {
      const startReminderScheduler = vi.fn();
      const load = vi.fn().mockResolvedValue({ startReminderScheduler });
      expect(await startBackgroundJobs(setting, load)).toBe(true);
      expect(load).toHaveBeenCalledOnce();
      expect(startReminderScheduler).toHaveBeenCalledOnce();
    },
  );

  it.each(["", " ", "2", "-1", "ture", "maybe", "enabled", "y", "t"])(
    "rejects genuinely unrecognized configuration (%j) with a clear message",
    async setting => {
      const load = vi.fn();
      await expect(startBackgroundJobs(setting, load)).rejects.toThrow(
        "BACKGROUND_JOBS_ENABLED must be true or false when set (1/0, yes/no and on/off are also accepted)",
      );
      expect(() => backgroundJobsEnabled(setting, undefined)).toThrow("BACKGROUND_JOBS_ENABLED must be true or false");
      expect(load).not.toHaveBeenCalled();
    },
  );

  it("keeps the managed-production default when unset", () => {
    expect(backgroundJobsEnabled(undefined, undefined)).toBe(true);
    expect(backgroundJobsEnabled(undefined, "PRODUCTION")).toBe(true);
  });

  it("keeps jobs off in preview for every false spelling and refuses every true spelling", async () => {
    for (const setting of [undefined, "false", "FALSE", "0", "no", "off"]) {
      const load = vi.fn();
      expect(backgroundJobsEnabled(setting, "preview")).toBe(false);
      expect(await startBackgroundJobs(setting, load, "preview")).toBe(false);
      expect(load).not.toHaveBeenCalled();
    }
    for (const setting of ["true", "TRUE", "1", "yes", "on"]) {
      const load = vi.fn();
      expect(() => backgroundJobsEnabled(setting, "preview")).toThrow("BACKGROUND_JOBS_ENABLED must be false in preview");
      await expect(startBackgroundJobs(setting, load, "preview")).rejects.toThrow("must be false in preview");
      expect(load).not.toHaveBeenCalled();
    }
  });

  it("does not echo the configured value in its error", () => {
    expect(() => parseBooleanSetting("SOME_FLAG", "do-not-print-this")).toThrow("SOME_FLAG must be true or false");
    try { parseBooleanSetting("SOME_FLAG", "do-not-print-this"); }
    catch (error) { expect(String(error)).not.toContain("do-not-print-this"); }
  });

  it("validates the flag before the server starts listening", () => {
    // A bad value must fail the deploy, not crash a serving process into a
    // restart loop: startServer validates first and starts the jobs last.
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("async function startServer()"));
    const validated = body.indexOf("backgroundJobsEnabled();");
    const listening = body.indexOf("server.listen(");
    const started = body.indexOf("await startBackgroundJobs();");
    expect(validated).toBeGreaterThan(-1);
    expect(validated).toBeLessThan(listening);
    expect(listening).toBeLessThan(started);
  });
});
