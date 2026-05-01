const Redis = require('ioredis');
const config = require('../config');

let redis = null;

/**
 * Initialize Redis connection with automatic reconnection.
 */
function initRedis(retries = 10) {
  return new Promise((resolve, reject) => {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      retryStrategy(times) {
        if (times > retries) return null;
        return Math.min(times * 500, 3000);
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
      resolve();
    });

    redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    // Resolve after timeout even if not connected (non-blocking)
    setTimeout(() => resolve(), 5000);
  });
}

function getRedis() {
  return redis;
}

/**
 * Update the cached dashboard state in Redis.
 */
async function updateDashboardCache(stats) {
  if (!redis) return;
  try {
    await redis.set('dashboard:stats', JSON.stringify(stats), 'EX', 30);
  } catch (err) {
    console.error('[Redis] Cache update failed:', err.message);
  }
}

/**
 * Get cached dashboard state from Redis.
 */
async function getDashboardCache() {
  if (!redis) return null;
  try {
    const data = await redis.get('dashboard:stats');
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[Redis] Cache read failed:', err.message);
    return null;
  }
}

module.exports = { initRedis, getRedis, updateDashboardCache, getDashboardCache };
