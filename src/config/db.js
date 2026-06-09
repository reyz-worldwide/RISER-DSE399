const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'riser_db';

let pool;

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
}

async function getPool() {
  if (!pool) {
    await ensureDatabase();
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      multipleStatements: false
    });
  }
  return pool;
}

async function run(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return {
    insertId: result.insertId,
    affectedRows: result.affectedRows,
    lastID: result.insertId,
    changes: result.affectedRows
  };
}

async function get(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows[0];
}

async function all(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function initDatabase() {
  await ensureDatabase();
  const p = await getPool();

  await p.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('agent','manager','admin') NOT NULL DEFAULT 'agent',
    team VARCHAR(120) DEFAULT 'Alpha Growth Team',
    avatar_url VARCHAR(255),
    weekly_goal INT DEFAULT 50,
    monthly_target INT DEFAULT 200,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_date DATE NOT NULL,
    sales_count INT NOT NULL DEFAULT 0,
    customer_count INT NOT NULL DEFAULT 0,
    followups_count INT DEFAULT 0,
    hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
    mood_level TINYINT NOT NULL DEFAULT 3,
    commitment_level TINYINT DEFAULT 3,
    schedule_preference VARCHAR(50) DEFAULT 'Evening',
    customer_update TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_activities_user_date (user_id, activity_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    audience ENUM('agent','manager') NOT NULL DEFAULT 'agent',
    task TEXT NOT NULL,
    priority ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
    reason TEXT,
    status ENUM('pending','in_progress','completed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_recommendations_user_audience (user_id, audience)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    period VARCHAR(80) NOT NULL,
    sales_target INT DEFAULT 20,
    customer_target INT DEFAULT 50,
    followup_target INT DEFAULT 25,
    customer_focus TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_goals_user_period (user_id, period)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS system_settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(120) NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await p.query(`CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manager_id INT NOT NULL,
    period VARCHAR(80) NOT NULL,
    summary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_reports_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await seedSystemSettings();
}

async function seedSystemSettings() {
  const defaultSettings = [
    ['growth_weight', '30', 'Weight for sales growth calculation'],
    ['consistency_weight', '25', 'Weight for consistent activity logging'],
    ['engagement_weight', '25', 'Weight for customers and follow-ups'],
    ['leadership_weight', '20', 'Weight for mood, commitment and leadership potential'],
    ['agent_low_customer_rule', 'Increase warm prospect outreach and prioritise follow-up activity.', 'Agent recommendation rule for low customer engagement'],
    ['manager_coaching_rule', 'Review agents below target score and schedule coaching actions.', 'Manager recommendation rule for underperforming agents']
  ];

  for (const setting of defaultSettings) {
    await run(
      'INSERT INTO system_settings(`key`, value, description) VALUES(?,?,?) ON DUPLICATE KEY UPDATE value=value',
      setting
    );
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  run,
  get,
  all,
  initDatabase,
  closePool,
  dbName: DB_NAME,
  connectionInfo: { host: DB_HOST, port: DB_PORT, user: DB_USER, database: DB_NAME }
};
