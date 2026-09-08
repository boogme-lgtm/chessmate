import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { baselineStatements, initializeEmptyPreview } from "../scripts/preview-bootstrap";
import { loadPreviewConfig } from "./_core/previewPolicy";
import { previewEnvironment } from "../test/preview-fixture";

const config = loadPreviewConfig(previewEnvironment())!;
const baseline = readFileSync(new URL("../preview/schema.sql", import.meta.url), "utf8");

function resources(database = config.databaseName, tables: object[] = [], objects: object[] = []) {
  return {
    connection: { query: vi.fn().mockResolvedValueOnce([[{ name: database }]])
      .mockResolvedValueOnce([tables]).mockResolvedValue([]), execute: vi.fn().mockResolvedValue([]) },
    storage: { send: vi.fn().mockResolvedValue({ Contents: objects, KeyCount: objects.length }) },
  };
}

describe("explicit preview-only bootstrap", () => {
  it("has a current reviewed CREATE-only baseline with no production migration edits", () => {
    const manifest = JSON.parse(readFileSync(new URL("../preview/schema-manifest.json", import.meta.url), "utf8"));
    const source = readFileSync(new URL("../drizzle/schema.ts", import.meta.url));
    expect(manifest.sourceSha256).toBe(createHash("sha256").update(source).digest("hex"));
    expect(manifest.sqlSha256).toBe(createHash("sha256").update(baseline).digest("hex"));
    expect(baselineStatements(baseline)).toHaveLength(28);
  });
  it.each(["production database", "existing database", "existing bucket"])("does not write to %s", async failure => {
    const { connection, storage } = resources(
      failure === "production database" ? "Xkyng35xnYFybYAdmyVo96" : config.databaseName,
      failure === "existing database" ? [{ Tables_in_preview: "users" }] : [],
      failure === "existing bucket" ? [{ Key: "existing-file" }] : [],
    );
    await expect(initializeEmptyPreview(config, connection, storage, baseline)).rejects.toThrow();
    expect(connection.query.mock.calls.every(([sql]) => sql.startsWith("SELECT") || sql === "SHOW TABLES")).toBe(true);
    expect(connection.execute).not.toHaveBeenCalled();
    expect(storage.send.mock.calls.every(([command]) => command instanceof ListObjectsV2Command)).toBe(true);
  });
  it("writes identity markers only after verifying both empty resources and creating the baseline", async () => {
    const { connection, storage } = resources();
    await initializeEmptyPreview(config, connection, storage, baseline);
    expect(storage.send.mock.invocationCallOrder[0]).toBeLessThan(connection.query.mock.invocationCallOrder[2]);
    expect(connection.query).toHaveBeenCalledTimes(31); // two reads, 28 app tables, guard table
    expect(connection.execute.mock.calls[0][1][0]).toBe(config.instanceId);
    const marker = storage.send.mock.calls[1][0] as PutObjectCommand;
    expect(marker.input).toMatchObject({ Bucket: config.storage.bucket, Key: "boogme_preview_guard.json" });
  });
  it("does not mark a partially initialized database as ready", async () => {
    const { connection, storage } = resources();
    connection.query.mockReset().mockResolvedValueOnce([[{ name: config.databaseName }]])
      .mockResolvedValueOnce([[]]).mockRejectedValueOnce(new Error("DDL failed"));
    await expect(initializeEmptyPreview(config, connection, storage, baseline)).rejects.toThrow("DDL failed");
    expect(connection.execute).not.toHaveBeenCalled();
    expect(storage.send).toHaveBeenCalledOnce();
  });
});
