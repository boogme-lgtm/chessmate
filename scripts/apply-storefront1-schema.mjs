/**
 * S-STOREFRONT-1 schema migration
 * Applies:
 *   1. content_items.accessType  ENUM('public','student_only','request_fulfillment') NOT NULL DEFAULT 'public'
 *   2. content_items.targetStudentId  INT NULL
 *   3. UNIQUE(contentItemId, userId) on content_purchases  (C1 race guard)
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log("S-STOREFRONT-1: applying schema migrations...");

  // 1. accessType column on content_items
  await conn.execute(`
    ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS accessType ENUM('public','student_only','request_fulfillment')
      NOT NULL DEFAULT 'public'
  `);
  console.log("  ✓ content_items.accessType added");

  // 2. targetStudentId column on content_items
  await conn.execute(`
    ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS targetStudentId INT NULL
  `);
  console.log("  ✓ content_items.targetStudentId added");

  // 3. Composite UNIQUE on content_purchases (C1 race guard)
  // Check if constraint already exists before adding
  const [rows] = await conn.execute(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'content_purchases'
      AND CONSTRAINT_NAME = 'uniq_content_purchases_item_user'
  `);
  if (rows[0].cnt === 0) {
    await conn.execute(`
      ALTER TABLE content_purchases
      ADD UNIQUE KEY uniq_content_purchases_item_user (contentItemId, userId)
    `);
    console.log("  ✓ content_purchases UNIQUE(contentItemId, userId) added");
  } else {
    console.log("  ✓ content_purchases UNIQUE already exists — skipped");
  }

  console.log("S-STOREFRONT-1: all migrations applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await conn.end();
}
