import { describe, expect, it, vi } from "vitest";
import { previewEnvironment } from "../test/preview-fixture";
import { loadPreviewConfig } from "./_core/previewPolicy";
import { verifyPreviewDatabase } from "./_core/previewDatabase";
import { startBackgroundJobs } from "./_core/backgroundJobs";

describe("preview startup policy", () => {
  it("allows an explicit isolated configuration without shared provider keys", () => {
    expect(loadPreviewConfig(previewEnvironment())).toMatchObject({
      instanceId: "qa1", databaseName: "boogme_preview_qa1", allowLocalHttp: true,
    });
  });
  it("preserves legacy production configuration", () => {
    expect(loadPreviewConfig({ NODE_ENV: "production" })).toBeUndefined();
  });
  it.each([
    ["APP_ENV", "preveiw"], ["DATABASE_URL", "mysql://user:password@host/Xkyng35xnYFybYAdmyVo96"],
    ["DATABASE_URL", "mysql://root:password@host/boogme_preview_qa1"],
    ["DATABASE_URL", "mysql://%72oot:password@host/boogme_preview_qa1"],
    ["DATABASE_URL", "mysql://preview:password@host/boogme_preview_qa1?multipleStatements=true"],
    ["VITE_FRONTEND_URL", "https://boogme.com"], ["VITE_FRONTEND_URL", "http://public.example.com"],
    ["VITE_APP_ID", "boogme"], ["JWT_SECRET", "short"], ["BACKGROUND_JOBS_ENABLED", "true"],
    ["AUTO_RELEASE_PAYOUTS_ENABLED", "true"], ["STRIPE_SECRET_KEY", "sk_test_shared"],
    ["STRIPE_WEBHOOK_SECRET", "whsec_shared"], ["STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_shared"],
    ["RESEND_API_KEY", "re_shared"], ["BUILT_IN_FORGE_API_KEY", "shared_forge"],
    ["OAUTH_SERVER_URL", "https://shared.example.com"], ["VITE_OAUTH_PORTAL_URL", "https://shared.example.com"],
    ["PREVIEW_MAIL_URL", "https://real-mail-provider.example.com"],
    ["PREVIEW_S3_BUCKET", "production"], ["PREVIEW_S3_PUBLIC_ENDPOINT", "http://public.example.com"],
  ])("rejects unsafe or ambiguous %s", (name, value) => {
    expect(() => loadPreviewConfig({ ...previewEnvironment(), [name]: value })).toThrow();
  });
  it("does not include credentials in validation errors", () => {
    const secret = "do-not-print-this-value";
    expect(() => loadPreviewConfig({ ...previewEnvironment(), STRIPE_SECRET_KEY: secret })).toThrow("Remove STRIPE_SECRET_KEY");
    try { loadPreviewConfig({ ...previewEnvironment(), STRIPE_SECRET_KEY: secret }); }
    catch (error) { expect(String(error)).not.toContain(secret); }
  });
});

describe("database resource identity", () => {
  const config = loadPreviewConfig(previewEnvironment())!;
  it.each(["wrong database", "missing marker", "wrong marker", "driver error"])("refuses %s before application access", async failure => {
    const query = vi.fn().mockResolvedValueOnce([[{ name: failure === "wrong database" ? "production" : config.databaseName }]])
      .mockResolvedValueOnce([failure === "missing marker" ? [] : [{ instance_id: "other" }]]);
    if (failure === "driver error") query.mockReset().mockRejectedValue(new Error("sensitive driver connection data"));
    const end = vi.fn().mockResolvedValue(undefined);
    await expect(verifyPreviewDatabase(config, "unit", vi.fn().mockResolvedValue({ query, end })))
      .rejects.toThrow("Preview database identity check failed");
    expect(query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true);
    expect(end).toHaveBeenCalledOnce();
  });
  it("accepts exactly the dedicated database and matching marker", async () => {
    const query = vi.fn().mockResolvedValueOnce([[{ name: config.databaseName }]])
      .mockResolvedValueOnce([[{ instance_id: config.instanceId }]]);
    const end = vi.fn().mockResolvedValue(undefined);
    await verifyPreviewDatabase(config, "unit", vi.fn().mockResolvedValue({ query, end }));
    expect(end).toHaveBeenCalledOnce();
  });
});

describe("preview background effects", () => {
  it("never imports the scheduler when no explicit job flag exists", async () => {
    const load = vi.fn();
    expect(await startBackgroundJobs(undefined, load, "preview")).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
  it("refuses an attempt to enable the scheduler", async () => {
    const load = vi.fn();
    await expect(startBackgroundJobs("true", load, "preview")).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });
});
