const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             process.env.DB_PORT     || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'inveso_trading',
  socketPath: process.env.MYSQL_SOCKET || "/tmp/mysql.sock",
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0
});

async function initializeDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      mobile VARCHAR(15),
      initial_balance DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
      current_balance DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`CREATE TABLE IF NOT EXISTS portfolio (
      portfolio_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      company_name VARCHAR(255),
      exchange VARCHAR(10) DEFAULT 'NSE',
      quantity INT NOT NULL,
      avg_price DECIMAL(15,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_symbol (user_id, symbol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`CREATE TABLE IF NOT EXISTS orders (
      order_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      company_name VARCHAR(255),
      transaction_type ENUM('BUY','SELL') NOT NULL,
      order_type ENUM('MARKET','LIMIT') NOT NULL DEFAULT 'MARKET',
      quantity INT NOT NULL,
      price DECIMAL(15,2) NOT NULL,
      total_value DECIMAL(15,2) NOT NULL,
      order_status VARCHAR(20) DEFAULT 'COMPLETED',
      product_type VARCHAR(10) DEFAULT 'CNC',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`CREATE TABLE IF NOT EXISTS watchlist (
      watchlist_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      company_name VARCHAR(255),
      exchange VARCHAR(10) DEFAULT 'NSE',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_wl (user_id, symbol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`CREATE TABLE IF NOT EXISTS options_portfolio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(100) NOT NULL,
      option_type ENUM('CE','PE') NOT NULL,
      strike_price DECIMAL(15,2) NOT NULL,
      expiry_date DATE NOT NULL,
      lot_size INT NOT NULL DEFAULT 1,
      quantity INT NOT NULL,
      avg_price DECIMAL(15,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.query(`CREATE TABLE IF NOT EXISTS options_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(100) NOT NULL,
      option_type ENUM('CE','PE') NOT NULL,
      strike_price DECIMAL(15,2) NOT NULL,
      expiry_date DATE NOT NULL,
      lot_size INT NOT NULL DEFAULT 1,
      transaction_type ENUM('BUY','SELL') NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(15,2) NOT NULL,
      total_value DECIMAL(15,2) NOT NULL,
      order_status VARCHAR(20) DEFAULT 'COMPLETED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    console.log('✅ All MySQL tables ready');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initializeDatabase };
