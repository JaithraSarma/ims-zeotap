const express = require('express');
const { queryWithRetry } = require('../db/postgres');
const { getDashboardCache } = require('../db/redis');
const { Signal } = require('../db/mongo');

const router = express.Router();

/**
 * GET /api/dashboard/stats — Get aggregated dashboard statistics.
 * Reads from Redis cache first (hot-path), falls back to PostgreSQL.
 */
router.get('/stats', async (req, res) => {
  try {
    // Try Redis cache first
    const cached = await getDashboardCache();
    if (cached) {
      return res.json({ ...cached, source: 'cache' });
    }

    // Fallback to PostgreSQL
    const result = await queryWithRetry(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'OPEN') AS open_count,
        COUNT(*) FILTER (WHERE status = 'INVESTIGATING') AS investigating_count,
        COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_count,
        COUNT(*) FILTER (WHERE severity = 'P0') AS p0_count,
        COUNT(*) FILTER (WHERE severity = 'P1') AS p1_count,
        COUNT(*) FILTER (WHERE severity = 'P2') AS p2_count,
        COUNT(*) AS total
      FROM work_items`
    );

    res.json({ ...result.rows[0], source: 'database' });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/dashboard/timeseries — Get signal count aggregated by time buckets.
 * Uses MongoDB aggregation pipeline for timeseries analysis.
 * Query params: hours (default 24), bucket_minutes (default 30)
 */
router.get('/timeseries', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const bucketMinutes = parseInt(req.query.bucket_minutes) || 30;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$timestamp',
              unit: 'minute',
              binSize: bucketMinutes,
            },
          },
          count: { $sum: 1 },
          components: { $addToSet: '$component_id' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          timestamp: '$_id',
          count: 1,
          unique_components: { $size: '$components' },
          _id: 0,
        },
      },
    ];

    const result = await Signal.aggregate(pipeline);
    res.json(result);
  } catch (err) {
    console.error('[Dashboard] Timeseries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch timeseries data' });
  }
});

module.exports = router;
