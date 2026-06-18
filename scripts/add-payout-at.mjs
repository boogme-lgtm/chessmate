import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `content_requests` ADD COLUMN `payoutAt` timestamp NULL");
  console.log('OK: payoutAt column added');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('SKIP: payoutAt already exists');
  } else {
    console.error('ERROR:', e.message);
  }
}
await conn.end();
