import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load DATABASE_URL from the environment (injected by the Manus webdev runtime)
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(url);
const [rows] = await conn.execute(
  'SELECT id, name, email, role FROM users ORDER BY id LIMIT 20'
);
console.log('Users in database:');
console.table(rows);

// Also check lessons to find the student who booked
const [lessons] = await conn.execute(
  `SELECT l.id, l.student_id, l.coach_id, l.status, u_s.email as student_email, u_c.email as coach_email
   FROM lessons l
   LEFT JOIN users u_s ON u_s.id = l.student_id
   LEFT JOIN users u_c ON u_c.id = l.coach_id
   ORDER BY l.id DESC LIMIT 5`
);
console.log('\nRecent lessons with student/coach emails:');
console.table(lessons);

await conn.end();
