import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadPreviewConfig, type PreviewConfig } from "../server/_core/previewPolicy";
import { STORAGE_GUARD_KEY } from "../server/_core/previewStorage";

type Connection = Pick<mysql.Connection, "query" | "execute">;
type ObjectStore = Pick<S3Client, "send">;

/** This baseline is CREATE-only. Never replay historical production migrations. */
export function baselineStatements(sql: string): string[] {
  const statements = sql.trim().split(/;\s*(?=CREATE TABLE |$)/).filter(Boolean);
  if (!statements.length || statements.some(statement => !/^CREATE TABLE `[a-z_]+` \(/.test(statement))) {
    throw new Error("Preview baseline must contain only the generated CREATE TABLE statements");
  }
  return statements;
}

/** Explicit bootstrap for two EMPTY resources. No DROP, reset, seed or reuse. */
export async function initializeEmptyPreview(
  config: PreviewConfig, connection: Connection, storage: ObjectStore, schemaSql: string,
) {
  const statements = baselineStatements(schemaSql);
  const [identity] = await connection.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS name");
  if (identity[0]?.name !== config.databaseName) throw new Error("Preview database identity mismatch");
  const [tables] = await connection.query<mysql.RowDataPacket[]>("SHOW TABLES");
  if (tables.length) throw new Error("Preview bootstrap requires an empty database; refusing reuse or reset");
  const objects = await storage.send(new ListObjectsV2Command({ Bucket: config.storage.bucket, MaxKeys: 1 }));
  if (objects.IsTruncated || (objects.Contents?.length ?? 0) > 0 || (objects.KeyCount ?? 0) > 0) {
    throw new Error("Preview bootstrap requires an empty bucket; refusing reuse or reset");
  }
  // Both resources are checked before the first write. DDL is not transactional:
  // a failure leaves an unready preview that requires operator inspection.
  for (const statement of statements) await connection.query(statement);
  await connection.query(`CREATE TABLE boogme_preview_guard (
    singleton TINYINT PRIMARY KEY, instance_id VARCHAR(24) NOT NULL,
    baseline_sha256 CHAR(64) NOT NULL, CHECK (singleton = 1)
  )`);
  await connection.execute("INSERT INTO boogme_preview_guard (singleton, instance_id, baseline_sha256) VALUES (1, ?, ?)", [
    config.instanceId, createHash("sha256").update(schemaSql).digest("hex"),
  ]);
  await storage.send(new PutObjectCommand({
    Bucket: config.storage.bucket, Key: STORAGE_GUARD_KEY,
    Body: JSON.stringify({ instanceId: config.instanceId }), ContentType: "application/json",
  }));
}

async function main() {
  if (process.argv.slice(2).join(" ") !== "--initialize-empty-preview") {
    throw new Error("Use --initialize-empty-preview only after approval of the dedicated empty resources");
  }
  const config = loadPreviewConfig(process.env);
  if (!config) throw new Error("Preview bootstrap requires APP_ENV=preview");
  const source = await readFile(new URL("../drizzle/schema.ts", import.meta.url));
  const manifest = JSON.parse(await readFile(new URL("../preview/schema-manifest.json", import.meta.url), "utf8"));
  const schemaSql = await readFile(new URL("../preview/schema.sql", import.meta.url), "utf8");
  if (createHash("sha256").update(source).digest("hex") !== manifest.sourceSha256
    || createHash("sha256").update(schemaSql).digest("hex") !== manifest.sqlSha256) {
    throw new Error("Preview baseline is stale; regenerate and review it before initialization");
  }
  const storage = new S3Client({
    endpoint: config.storage.endpoint, region: config.storage.region, forcePathStyle: true, maxAttempts: 1,
    credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
  });
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    await initializeEmptyPreview(config, connection, storage, schemaSql);
    console.log(`Initialized empty preview resources for ${config.instanceId}. No user fixtures were inserted.`);
  } finally {
    storage.destroy();
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Driver errors may include credentials. Inspect the dedicated resources
    // with their owner; do not publish raw connection errors or auto-reset them.
    console.error("Preview bootstrap did not complete. Check the reviewed configuration and dedicated empty resources; nothing will be reset automatically.");
    process.exit(1);
  });
}
