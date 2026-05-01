require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,

  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    database: process.env.POSTGRES_DB || 'ims',
    user: process.env.POSTGRES_USER || 'ims_user',
    password: process.env.POSTGRES_PASSWORD || 'ims_password',
  },

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/ims',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },

  ingestion: {
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
    ringBufferSize: parseInt(process.env.RING_BUFFER_SIZE, 10) || 50000,
    debounceThreshold: parseInt(process.env.DEBOUNCE_THRESHOLD, 10) || 100,
    debounceWindowMs: parseInt(process.env.DEBOUNCE_WINDOW_MS, 10) || 10000,
  },
};
