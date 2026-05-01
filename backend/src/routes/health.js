const express = require('express');
const mongoose = require('mongoose');
const { pool } = require('../db/postgres');
const { getRedis } = require('../db/redis');
const { getRingBuffer } = require('../services/signalProcessor');

const router = express.Router();

/**
 * GET /health — Health check endpoint.
 * Reports the status of all dependent services and system metrics.
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
    ringBuffer: {},
  };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    health.services.postgres = { status: 'connected' };
  } catch (err) {
    health.services.postgres = { status: 'disconnected', error: err.message };
    health.status = 'degraded';
  }

  // Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    health.services.mongodb = { status: states[mongoState] || 'unknown' };
    if (mongoState !== 1) health.status = 'degraded';
  } catch (err) {
    health.services.mongodb = { status: 'error', error: err.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedis();
    if (redis && redis.status === 'ready') {
      health.services.redis = { status: 'connected' };
    } else {
      health.services.redis = { status: redis ? redis.status : 'not initialized' };
      health.status = 'degraded';
    }
  } catch (err) {
    health.services.redis = { status: 'error', error: err.message };
    health.status = 'degraded';
  }

  // Ring buffer metrics
  const rb = getRingBuffer();
  health.ringBuffer = {
    size: rb.getSize(),
    capacity: rb.capacity,
    dropped: rb.getDropped(),
    utilization: `${((rb.getSize() / rb.capacity) * 100).toFixed(1)}%`,
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
