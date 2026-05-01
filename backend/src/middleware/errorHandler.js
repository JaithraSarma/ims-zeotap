/**
 * Global error handler middleware.
 * Catches unhandled errors and returns structured JSON responses.
 */
function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.stack || err.message);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
