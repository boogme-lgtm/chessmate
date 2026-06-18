import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const statements = [
  // 3 new columns on content_requests
  `ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS deadline24hReminderSentAt TIMESTAMP NULL`,
  `ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS deadline1hReminderSentAt TIMESTAMP NULL`,
  `ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS overdueNotifiedAt TIMESTAMP NULL`,
  // Add "overdue" to content_requests.status enum
  `ALTER TABLE content_requests MODIFY COLUMN status ENUM('queued','quoted','pending_payment','payment_collected','in_progress','delivered','cancelled','overdue') NOT NULL DEFAULT 'queued'`,
  // Add 5 new notification types to notifications.type enum
  `ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'new_subscriber',
    'new_content_request',
    'new_message',
    'lesson_booked',
    'lesson_confirmed',
    'lesson_cancelled',
    'lesson_completed',
    'new_review',
    'content_delivered',
    'content_request_quoted',
    'content_request_declined',
    'content_request_accepted',
    'content_request_payment_collected',
    'content_request_deadline_24h',
    'content_request_deadline_1h',
    'content_request_overdue',
    'content_request_deadline_extended',
    'content_request_cancelled_overdue'
  ) NOT NULL`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.slice(0, 60));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.message?.includes("Duplicate column")) {
      console.log("SKIP (already exists):", sql.slice(0, 60));
    } else {
      console.error("ERR:", err.message, "\nSQL:", sql.slice(0, 80));
    }
  }
}

await conn.end();
console.log("Done.");
