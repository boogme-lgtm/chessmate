import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(dbUrl);

const alters = [
  "ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS deadline24hReminderSentAt TIMESTAMP NULL",
  "ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS deadline1hReminderSentAt TIMESTAMP NULL",
  "ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS overdueNotifiedAt TIMESTAMP NULL",
  "ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS deadlineExtensionProposedAt TIMESTAMP NULL",
  "ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS proposedNewDueDate TIMESTAMP NULL",
];

for (const sql of alters) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.slice(0, 80));
  } catch (e) {
    console.log("SKIP:", e.message.slice(0, 80));
  }
}

await conn.end();
console.log("Done.");
