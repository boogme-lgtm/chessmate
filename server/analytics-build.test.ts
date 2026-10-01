import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build, mergeConfig } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import viteConfig from "../vite.config";

const endpoint = "https://analytics.example.invalid";
const websiteId = "synthetic-website-id";
let fixture: string;

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "");
  vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "");
  vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "");
  fixture = await mkdtemp(path.join(os.tmpdir(), "boogme-analytics-"));
  const template = await readFile(
    new URL("../client/index.html", import.meta.url),
    "utf8"
  );
  await writeFile(
    path.join(fixture, "index.html"),
    template.replace("/src/main.tsx", "/entry.js")
  );
  await writeFile(
    path.join(fixture, "entry.js"),
    "document.querySelector('#root').textContent = 'Preview';"
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(fixture, { recursive: true, force: true });
});

async function builtHtml() {
  const result = await build(
    mergeConfig(viteConfig, {
      configFile: false,
      root: fixture,
      envDir: fixture,
      publicDir: false,
      logLevel: "silent",
      build: { write: false, emptyOutDir: false },
    })
  );
  const outputs = Array.isArray(result) ? result : [result];
  for (const output of outputs) {
    if (!("output" in output)) continue;
    const html = output.output.find(
      asset => asset.type === "asset" && asset.fileName === "index.html"
    );
    if (html?.type === "asset") return String(html.source);
  }
  throw new Error("Vite did not emit index.html");
}

function expectNoAnalytics(html: string) {
  expect(html).toContain('id="root"');
  expect(html).not.toContain("%VITE_ANALYTICS_");
  expect(html).not.toContain("data-website-id");
  expect(html).not.toContain("/umami");
}

function expectConfigured(html: string, base = endpoint, id = websiteId) {
  const tags =
    html.match(/<script\b[^>]*data-website-id[^>]*><\/script>/g) ?? [];
  expect(tags).toHaveLength(1);
  expect(tags[0]).toContain("defer");
  expect(tags[0]).toContain(`src="${base}/umami"`);
  expect(tags[0]).toContain(`data-website-id="${id}"`);
  expect(html).not.toContain("%VITE_ANALYTICS_");
}

describe("analytics in emitted Vite HTML", () => {
  it.each([
    ["both missing", "", ""],
    ["endpoint missing", "", websiteId],
    ["website ID missing", endpoint, ""],
    ["blank endpoint", "   ", websiteId],
    ["blank website ID", endpoint, "   "],
    ["endpoint placeholder", "%VITE_ANALYTICS_ENDPOINT%", websiteId],
    ["website ID placeholder", endpoint, "%VITE_ANALYTICS_WEBSITE_ID%"],
    ["invalid endpoint", "https://", websiteId],
    ["non-HTTP endpoint", "javascript:alert(1)", websiteId],
    ["endpoint query", `${endpoint}?tracking=yes`, websiteId],
    ["endpoint fragment", `${endpoint}#tracking`, websiteId],
    [
      "endpoint credentials",
      "https://user:password@analytics.example.invalid",
      websiteId,
    ],
  ])("omits analytics with %s", async (_name, url, id) => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", url);
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", id);
    expectNoAnalytics(await builtHtml());
  });

  it("omits analytics when both environment variables are absent", async () => {
    delete process.env.VITE_ANALYTICS_ENDPOINT;
    delete process.env.VITE_ANALYTICS_WEBSITE_ID;
    expectNoAnalytics(await builtHtml());
  });

  it.each(["", "production"])(
    "retains configured analytics with APP_ENV=%s",
    async appEnv => {
      vi.stubEnv("APP_ENV", appEnv);
      vi.stubEnv("VITE_ANALYTICS_ENDPOINT", endpoint);
      vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", websiteId);
      expectConfigured(await builtHtml());
    }
  );

  it("retains a configured same-origin endpoint", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "/analytics");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", websiteId);
    expectConfigured(await builtHtml(), "/analytics");
  });

  it("normalizes a configured endpoint's trailing slash", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", `${endpoint}/`);
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", websiteId);
    expectConfigured(await builtHtml());
  });

  it.each([false, true])(
    "never emits analytics in preview, configured=%s",
    async configured => {
      vi.stubEnv("APP_ENV", "preview");
      if (configured) {
        vi.stubEnv("VITE_ANALYTICS_ENDPOINT", endpoint);
        vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", websiteId);
      }
      expectNoAnalytics(await builtHtml());
    }
  );

  it("loads public analytics settings from the Vite environment file", async () => {
    delete process.env.VITE_ANALYTICS_ENDPOINT;
    delete process.env.VITE_ANALYTICS_WEBSITE_ID;
    await writeFile(
      path.join(fixture, ".env.production"),
      `VITE_ANALYTICS_ENDPOINT=${endpoint}\nVITE_ANALYTICS_WEBSITE_ID=${websiteId}\n`
    );
    expectConfigured(await builtHtml());
  });

  it("honors preview selected in the Vite environment file", async () => {
    delete process.env.APP_ENV;
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", endpoint);
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", websiteId);
    await writeFile(path.join(fixture, ".env.production"), "APP_ENV=preview\n");
    expectNoAnalytics(await builtHtml());
  });

  it("gives process preview selection precedence over an environment file", async () => {
    vi.stubEnv("APP_ENV", "preview");
    await writeFile(
      path.join(fixture, ".env.production"),
      `APP_ENV=production\nVITE_ANALYTICS_ENDPOINT=${endpoint}\nVITE_ANALYTICS_WEBSITE_ID=${websiteId}\n`
    );
    expectNoAnalytics(await builtHtml());
  });

  it("escapes configured website ID attributes", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", endpoint);
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", 'website" onload="unexpected');
    expectConfigured(
      await builtHtml(),
      endpoint,
      "website&quot; onload=&quot;unexpected"
    );
  });
});
