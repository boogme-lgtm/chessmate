import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check the specific student account used in the E2E test booking (lesson 270001, student 990004)
const [rows] = await conn.execute(
  'SELECT id, name, email, openId FROM users WHERE id = 990004'
);
console.log('Student account used in test booking (id=990004):');
console.log(JSON.stringify(rows[0], null, 2));

// Check waitlist columns
const [wlCols] = await conn.execute('SHOW COLUMNS FROM waitlist');
console.log('\nWaitlist columns:', wlCols.map(c => c.Field).join(', '));

// Check if there's a waitlist entry for this email
const [wl] = await conn.execute(
  "SELECT * FROM waitlist WHERE email LIKE '%saintlouis%' LIMIT 5"
);
console.log('\nWaitlist entries with saintlouis email:');
console.log(JSON.stringify(wl, null, 2));

// Check the lesson itself
const [lessons] = await conn.execute(
  'SELECT id, studentId, coachId, status, stripeCheckoutSessionId, createdAt FROM lessons WHERE id = 270001'
);
console.log('\nLesson 270001 details:');
console.log(JSON.stringify(lessons[0], null, 2));

await conn.end();
