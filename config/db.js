// config/db.js
const { Pool } = require('pg');
const moment = require('moment-timezone');

const pool = new Pool({
  user: 'skretail',
  host: '13.127.25.77',
  database: 'skretaildatabase',
  password: 'Skretai4321',
  port: 5432,
});

module.exports = pool;

// Function to fetch UTC timestamp from PostgreSQL and convert to local timezone
async function fetchAndConvertTimestamp() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT updated_at FROM products' && 'SELECT createddate FROM dispatches');
    client.release();

    // Assuming your timestamp column name is 'your_timestamp_column'
    const utcTimestamp = result.rows[0].your_timestamp_column;

    // Convert UTC timestamp to device's local timezone (example: IST)
    const localDateTime = moment.utc(utcTimestamp).tz('Asia/Kolkata'); // Change 'Asia/Kolkata' to your device's timezone

    // Format local datetime as per your requirement
    const formattedDateTime = localDateTime.format('DD-MM-YYYY, HH:mm:ss');

    console.log('Local DateTime:', formattedDateTime);
  } catch (err) {
    console.error('Error fetching timestamp from PostgreSQL:', err);
  }
}

// Call the function
fetchAndConvertTimestamp();