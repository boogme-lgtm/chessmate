/**
 * Sprint 40 regression tests — Express 5 wildcard route hygiene
 *
 * Scans every TypeScript source file under server/ (excluding node_modules)
 * and asserts that none contain a bare Express 4 wildcard route such as:
 *   app.get("*", ...)
 *   app.use("*", ...)
 *   app.post("*", ...)
 *   app.put("*", ...)
 *   app.delete("*", ...)
 *
 * Express 5 requires "/{*splat}" (or a named parameter equivalent).
 * A bare "*" string passed as the first argument to any of these methods
 * will throw at runtime under Express 5.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all .ts files under `dir`, skipping node_modules.
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Pattern that matches bare Express 4 wildcard routes, e.g.:
 *   app.get("*", ...)
 *   app.use('*', ...)
 *   router.post("*", ...)
 *
 * Does NOT match:
 *   app.get("/{*splat}", ...)   — Express 5 named wildcard (correct)
 *   app.use("/api/*", ...)      — partial path with wildcard (also Express 4, but different issue)
 *   // app.get("*", ...)        — commented-out line
 */
const BARE_WILDCARD_RE =
  /(?<!\/{2}.*)\bapp\s*\.\s*(?:get|use|post|put|delete|patch|all)\s*\(\s*["']\*["']/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("S40 — Express 5 wildcard regression scan", () => {
  const serverDir = path.resolve(__dirname);
  const tsFiles = collectTsFiles(serverDir);

  it("should find at least one TypeScript file to scan", () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it("no server .ts file outside node_modules should contain a bare app.*(\"*\") wildcard route", () => {
    const violations: string[] = [];

    for (const file of tsFiles) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        // Skip single-line comments and block-comment lines (lines starting with // or *)
        const trimmed = line.trimStart();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (BARE_WILDCARD_RE.test(line)) {
          violations.push(`${path.relative(serverDir, file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} bare Express 4 wildcard route(s) — ` +
          `update to Express 5 syntax "/{*splat}":\n` +
          violations.map((v) => `  ${v}`).join("\n")
      );
    }

    expect(violations).toHaveLength(0);
  });

  it("server/_core/vite.ts should use Express 5 wildcard syntax", () => {
    const vitePath = path.join(serverDir, "_core", "vite.ts");
    const content = readFileSync(vitePath, "utf-8");
    // Must contain the Express 5 named wildcard
    expect(content).toMatch(/\{[*]splat\}/);
    // Must NOT contain a bare "*" wildcard route
    expect(content).not.toMatch(BARE_WILDCARD_RE);
  });

  it("server/index.ts (legacy entry point) should use Express 5 wildcard syntax", () => {
    const indexPath = path.join(serverDir, "index.ts");
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toMatch(/\{[*]splat\}/);
    expect(content).not.toMatch(BARE_WILDCARD_RE);
  });
});
