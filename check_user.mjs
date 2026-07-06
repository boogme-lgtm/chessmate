import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT id, email, emailVerified, loginMethod, (password IS NOT NULL) as hasPassword FROM users WHERE email = "teststudent@boogme.com"'
);
console.log(rows[0]);
await conn.end();
