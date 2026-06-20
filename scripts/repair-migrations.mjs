import mysql from 'mysql2/promise';
import fs from 'fs';
import crypto from 'crypto';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const missing = [
  '0022_spooky_blue_shield',
  '0023_lying_wild_pack',
  '0024_futuristic_dark_phoenix',
  '0025_luxuriant_layla_miller',
  '0026_famous_blindfold',
];

for (const tag of missing) {
  const sqlContent = fs.readFileSync(`drizzle/${tag}.sql`, 'utf8');
  const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let ok = true;
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Duplicate column') || msg.includes('Duplicate key') || msg.includes('already exists')) {
        // Already applied, skip
      } else {
        console.log(`Error in ${tag}: ${msg}`);
        ok = false;
      }
    }
  }

  if (ok) {
    try {
      await conn.execute(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        [hash, Date.now()]
      );
      console.log(`Recorded migration: ${tag}`);
    } catch (e) {
      console.log(`Could not record ${tag}: ${e.message}`);
    }
  }
}

await conn.end();
console.log('Done');
