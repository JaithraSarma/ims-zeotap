const { Pool } = require('pg');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Initialize PostgreSQL schema with retry logic.
 * Retries up to 10 times with 3-second intervals to handle container startup delays.
 */
async function initPostgres(retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const schemaPath = path.join(__dirname, '..', '..', 'init.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('[PostgreSQL] Schema initialized successfully');
      return;
    } catch (err) {
      console.error(`[PostgreSQL] Init attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Execute a query with automatic retry on transient failures.
 */
async function queryWithRetry(text, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error(`[PostgreSQL] Query attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

module.exports = { pool, initPostgres, queryWithRetry };
