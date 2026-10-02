import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previewEnvironment } from "../test/preview-fixture";

describe("environment initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VITE_APP_ID", "synthetic-managed-app");
    vi.stubEnv("JWT_SECRET", "synthetic-managed-jwt-for-tests-only");
    vi.stubEnv("DATABASE_URL", "mysql://unit:unit@127.0.0.1:9/synthetic_managed");
    vi.stubEnv("STRIPE_SECRET_KEY", "synthetic-provider-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(["development", "production"])(
    "treats inherited PROD exactly as production with effective NODE_ENV=%s",
    async NODE_ENV => {
      vi.stubEnv("NODE_ENV", NODE_ENV);
      vi.stubEnv("APP_ENV", "production");
      const canonical = (await import("./_core/env")).ENV;
      vi.resetModules();
      vi.stubEnv("APP_ENV", "PROD");
      const alias = (await import("./_core/env")).ENV;

      expect(alias).toEqual(canonical);
      expect(alias.preview).toBeUndefined();
      expect(alias.isProduction).toBe(NODE_ENV === "production");
      expect(alias.allowOAuthLoopback).toBe(false);
      expect(alias.databaseUrl).toBe("mysql://unit:unit@127.0.0.1:9/synthetic_managed");
      expect(alias.stripeSecretKey).toBe("synthetic-provider-key");
    },
  );

  it("allows OAuth loopback only in explicit development", async () => {
    vi.stubEnv("APP_ENV", "development");
    expect((await import("./_core/env")).ENV.allowOAuthLoopback).toBe(true);
  });

  it.each(["production", "PROD"])("still requires application settings with APP_ENV=%s", async APP_ENV => {
    vi.stubEnv("APP_ENV", APP_ENV);
    vi.stubEnv("VITE_APP_ID", "");
    await expect(import("./_core/env")).rejects.toThrow("Missing required environment variable: VITE_APP_ID");
  });

  it.each(["preveiw", "PRODUCTION", " PROD "])("fails closed before reading required settings for %j", async APP_ENV => {
    vi.stubEnv("APP_ENV", APP_ENV);
    vi.stubEnv("VITE_APP_ID", "");
    await expect(import("./_core/env")).rejects.toThrow("APP_ENV must be preview, production or development");
  });

  it("fails closed for incomplete preview before reading required settings", async () => {
    vi.stubEnv("APP_ENV", "preview");
    vi.stubEnv("PREVIEW_INSTANCE_ID", undefined);
    vi.stubEnv("VITE_APP_ID", "");
    await expect(import("./_core/env")).rejects.toThrow("Preview requires a valid PREVIEW_INSTANCE_ID");
  });

  it("still rejects provider credentials during explicit preview initialization", async () => {
    for (const [name, value] of Object.entries(previewEnvironment())) vi.stubEnv(name, value);
    vi.stubEnv("NODE_ENV", "development");
    await expect(import("./_core/env")).rejects.toThrow("Remove STRIPE_SECRET_KEY");
  });
});
