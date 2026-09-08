import mysql from "mysql2/promise";
import type { PreviewConfig } from "./previewPolicy";

export const PREVIEW_GUARD_TABLE = "boogme_preview_guard";

/** The marker is created only by the explicit, empty-database bootstrap. */
export async function verifyPreviewDatabase(
  config: PreviewConfig,
  databaseUrl: string,
  connect = mysql.createConnection,
): Promise<void> {
  let connection: Awaited<ReturnType<typeof connect>> | undefined;
  try {
    connection = await connect(databaseUrl);
    const [identity] = await connection.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS name");
    if (identity[0]?.name !== config.databaseName) throw new Error("Database identity mismatch");
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT instance_id FROM boogme_preview_guard WHERE singleton = 1",
    );
    if (rows.length !== 1 || rows[0].instance_id !== config.instanceId) {
      throw new Error("Preview database marker mismatch");
    }
  } catch {
    // Do not log a driver exception containing a connection string or user data.
    throw new Error("Preview database identity check failed; use the dedicated initialized preview database");
  } finally {
    await connection?.end().catch(() => undefined);
  }
}
