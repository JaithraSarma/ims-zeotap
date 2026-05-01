const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const { initPostgres } = require('./db/postgres');
const { initMongo } = require('./db/mongo');
const { initRedis } = require('./db/redis');
const { startDrainLoop, stopDrainLoop, setSocketIO } = require('./services/signalProcessor');
const metricsService = require('./services/metricsService');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const signalRoutes = require('./routes/signals');
const workItemRoutes = require('./routes/workItems');
const rcaRoutes = require('./routes/rca');
const dashboardRoutes = require('./routes/dashboard');
const healthRoutes = require('./routes/health');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/signals', signalRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/work-items', rcaRoutes); // /api/work-items/:id/rca
app.use('/api/dashboard', dashboardRoutes);
app.use('/health', healthRoutes);

// Error handler
app.use(errorHandler);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

/**
 * Initialize all services and start the server.
 */
async function start() {
  console.log('==============================================');
  console.log('  Incident Management System (IMS) Starting');
  console.log('==============================================');

  try {
    // Initialize databases (with retry logic in each)
    await Promise.all([
      initPostgres(),
      initMongo(),
      initRedis(),
    ]);

    // Wire Socket.IO to signal processor
    setSocketIO(io);

    // Start the async drain loop (ring buffer → debouncer → persistence)
    startDrainLoop();

    // Start metrics reporting (every 5 seconds)
    metricsService.start();

    // Start HTTP server
    server.listen(config.port, () => {
      console.log(`[Server] IMS running on port ${config.port}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/health`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('\n[Server] Shutting down gracefully...');
  metricsService.stop();
  stopDrainLoop();
  server.close();
  process.exit(0);
}

start();

module.exports = { app, server };
