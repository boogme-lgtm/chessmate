import { describe, expect, it, vi } from "vitest";
import { previewEnvironment } from "../test/preview-fixture";
import { explicitAppEnvironment, loadPreviewConfig } from "./_core/previewPolicy";
import { verifyPreviewDatabase } from "./_core/previewDatabase";
import { startBackgroundJobs } from "./_core/backgroundJobs";
import manifest from "../preview/schema-manifest.json";

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
    "prod", "Prod", "pRod", "prOd", "proD", "PRod", "PrOd", "ProD",
    "pROd", "pRoD", "prOD", "PROd", "PRoD", "PrOD", "pROD", "PROD",
  ])(
    "accepts the production shorthand %s without enabling preview",
    APP_ENV => {
      for (const NODE_ENV of [undefined, "development", "production"]) {
        expect(loadPreviewConfig({ APP_ENV, NODE_ENV })).toBeUndefined();
      }
    },
  );
  it.each([undefined, "development", "production"])(
    "preserves canonical non-preview mode %s",
    APP_ENV => {
      for (const NODE_ENV of [undefined, "development", "production"]) {
        expect(loadPreviewConfig({ APP_ENV, NODE_ENV })).toBeUndefined();
      }
    },
  );
  it.each(["development", "production"])(
    "keeps explicit preview validation with NODE_ENV=%s",
    NODE_ENV => {
      expect(loadPreviewConfig({ ...previewEnvironment(), NODE_ENV })?.instanceId).toBe("qa1");
      expect(() => loadPreviewConfig({ ...previewEnvironment(), NODE_ENV, STRIPE_SECRET_KEY: "synthetic-key" }))
        .toThrow("Remove STRIPE_SECRET_KEY");
    },
  );
  // Sprint 3 (intended change): cosmetic production/development spellings used
  // to throw at import time and crash a live deployment at boot.
  it.each([
    "PRODUCTION", "Production", " production ", "production\n", "\tProduction\t",
    " prod", "prod ", " PROD ", "prod\n",
  ])("normalizes the production spelling %j and never enables preview", APP_ENV => {
    for (const NODE_ENV of [undefined, "development", "production"]) {
      // Even with every preview setting present, production stays production.
      expect(loadPreviewConfig({ ...previewEnvironment(), APP_ENV, NODE_ENV })).toBeUndefined();
      expect(explicitAppEnvironment(APP_ENV)).toBe("production");
    }
  });
  it.each(["DEVELOPMENT", "Development", " development ", "development\n"])(
    "normalizes the development spelling %j",
    APP_ENV => {
      expect(loadPreviewConfig({ ...previewEnvironment(), APP_ENV, NODE_ENV: "production" })).toBeUndefined();
      expect(explicitAppEnvironment(APP_ENV)).toBe("development");
    },
  );
  it.each(["PREVIEW", "Preview", " preview", "preview ", "preview\n", "\tpreview"])(
    "fails closed for the non-canonical preview spelling %j instead of guessing a mode",
    APP_ENV => {
      // Neither silently isolated (the build compares the raw value) nor
      // silently production: preview must be selected exactly.
      for (const env of [previewEnvironment(), { ...previewEnvironment(), STRIPE_SECRET_KEY: "synthetic-key" }, {}]) {
        expect(() => loadPreviewConfig({ ...env, APP_ENV, NODE_ENV: "production" }))
          .toThrow('APP_ENV must be exactly "preview"');
      }
    },
  );
  it.each(["", " ", "staging", "preveiw", "prd", "dev", "productionn", "test", "pre view"])(
    "still rejects unrelated APP_ENV=%j",
    APP_ENV => {
      expect(() => loadPreviewConfig({ ...previewEnvironment(), APP_ENV, NODE_ENV: "development" }))
        .toThrow("APP_ENV must be preview, production or development");
    },
  );
  it("reports an unset APP_ENV as no explicit selection", () => {
    expect(explicitAppEnvironment(undefined)).toBeUndefined();
    expect(explicitAppEnvironment("preview")).toBe("preview");
  });
  it.each(["BACKGROUND_JOBS_ENABLED", "AUTO_RELEASE_PAYOUTS_ENABLED"])(
    "keeps %s off in preview for every true spelling and accepts any false spelling",
    flag => {
      for (const value of ["true", "TRUE", "1", "yes", " On "]) {
        expect(() => loadPreviewConfig({ ...previewEnvironment(), [flag]: value })).toThrow(`${flag} must be false in preview`);
      }
      for (const value of ["", "maybe", "enabled"]) {
        expect(() => loadPreviewConfig({ ...previewEnvironment(), [flag]: value })).toThrow(`${flag} must be true or false`);
      }
      for (const value of ["false", "FALSE", "0", "no", " off "]) {
        expect(loadPreviewConfig({ ...previewEnvironment(), [flag]: value })?.instanceId).toBe("qa1");
      }
    },
  );
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
  it.each(["wrong database", "missing marker", "wrong marker", "stale baseline", "missing baseline", "driver error"])("refuses %s before application access", async failure => {
    const query = vi.fn().mockResolvedValueOnce([[{ name: failure === "wrong database" ? "production" : config.databaseName }]])
      .mockResolvedValueOnce([failure === "missing marker" ? [] : [{
        instance_id: failure === "wrong marker" ? "other" : config.instanceId,
        baseline_sha256: failure === "stale baseline" ? "0".repeat(64)
          : failure === "missing baseline" ? undefined : manifest.sqlSha256,
      }]]);
    if (failure === "driver error") query.mockReset().mockRejectedValue(new Error("sensitive driver connection data"));
    const end = vi.fn().mockResolvedValue(undefined);
    await expect(verifyPreviewDatabase(config, "unit", vi.fn().mockResolvedValue({ query, end })))
      .rejects.toThrow("Preview database identity check failed");
    expect(query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true);
    expect(end).toHaveBeenCalledOnce();
  });
  it("accepts exactly the dedicated database, instance and reviewed baseline", async () => {
    const query = vi.fn().mockResolvedValueOnce([[{ name: config.databaseName }]])
      .mockResolvedValueOnce([[{ instance_id: config.instanceId, baseline_sha256: manifest.sqlSha256 }]]);
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
