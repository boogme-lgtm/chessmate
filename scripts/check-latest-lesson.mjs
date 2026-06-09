import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get the most recent lessons for student 990004
const [lessons] = await conn.execute(
  `SELECT id, studentId, coachId, status, amountCents, stripeCheckoutSessionId, 
   stripePaymentIntentId, createdAt, updatedAt, refundWindowEndsAt, cancelledAt,
   refundAmountCents, refundPercentage
   FROM lessons 
   WHERE studentId = 990004 
   ORDER BY id DESC LIMIT 5`
);
console.log('Recent lessons for student 990004:');
lessons.forEach(l => console.log(JSON.stringify(l, null, 2)));

await conn.end();
