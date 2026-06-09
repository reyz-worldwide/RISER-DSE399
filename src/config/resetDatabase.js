const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'riser_db';

(async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await connection.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  console.log(`MySQL database reset completed: ${DB_NAME}`);
  console.log('Start the application again. The setup screen will create the first admin account.');
})().catch((error) => {
  console.error('Database reset failed:', error.message);
  process.exit(1);
});
