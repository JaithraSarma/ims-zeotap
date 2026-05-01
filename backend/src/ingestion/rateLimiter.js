const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiter middleware for the signal ingestion API.
 * Prevents cascading failures by capping incoming requests.
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */
const signalRateLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: config.ingestion.rateLimitMax,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: 'Too many signals. Rate limit exceeded.',
    retryAfter: '1 second',
  },
  keyGenerator: () => 'global', // Global rate limit (not per-IP)
});

module.exports = { signalRateLimiter };
