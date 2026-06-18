import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SHOW COLUMNS FROM content_requests");
rows.forEach(r => console.log(r.Field, '|', r.Type, '| null:', r.Null, '| default:', r.Default));
await conn.end();
