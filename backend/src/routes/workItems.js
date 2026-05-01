const express = require('express');
const { queryWithRetry } = require('../db/postgres');
const { Signal } = require('../db/mongo');
const { validateTransition } = require('../patterns/workItemState');
const { refreshDashboardCache } = require('../services/signalProcessor');

const router = express.Router();

/**
 * GET /api/work-items — List all work items with optional filters.
 * Query params: status, severity, component_id, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { status, severity, component_id, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM work_items WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status.toUpperCase());
    }
    if (severity) {
      query += ` AND severity = $${paramIdx++}`;
      params.push(severity.toUpperCase());
    }
    if (component_id) {
      query += ` AND component_id = $${paramIdx++}`;
      params.push(component_id);
    }

    // Sort by severity (P0 first) then by creation time
    query += ` ORDER BY 
      CASE severity WHEN 'P0' THEN 1 WHEN 'P1' THEN 2 WHEN 'P2' THEN 3 ELSE 4 END,
      created_at DESC`;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await queryWithRetry(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[WorkItems] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

/**
 * GET /api/work-items/:id — Get a single work item with its linked signals.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const wiResult = await queryWithRetry('SELECT * FROM work_items WHERE id = $1', [id]);
    if (wiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Get linked signals from MongoDB
    const signals = await Signal.find({ work_item_id: id })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    // Get RCA if exists
    const rcaResult = await queryWithRetry('SELECT * FROM rca_records WHERE work_item_id = $1', [id]);

    res.json({
      workItem: wiResult.rows[0],
      signals,
      rca: rcaResult.rows[0] || null,
    });
  } catch (err) {
    console.error('[WorkItems] Detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch work item details' });
  }
});

/**
 * GET /api/work-items/:id/signals — Get raw signals for a work item.
 */
router.get('/:id/signals', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    const signals = await Signal.find({ work_item_id: id })
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await Signal.countDocuments({ work_item_id: id });

    res.json({ signals, total });
  } catch (err) {
    console.error('[WorkItems] Signals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

/**
 * PATCH /api/work-items/:id/status — Transition a work item's status.
 * Uses the State Pattern for validation.
 * Body: { status: "INVESTIGATING" | "RESOLVED" | "CLOSED" }
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status: targetStatus } = req.body;

    if (!targetStatus) {
      return res.status(400).json({ error: 'status is required' });
    }

    // Get current work item
    const wiResult = await queryWithRetry('SELECT * FROM work_items WHERE id = $1', [id]);
    if (wiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    const workItem = wiResult.rows[0];
    const currentStatus = workItem.status;

    // Get RCA record if transitioning to CLOSED
    let rcaRecord = null;
    if (targetStatus === 'CLOSED') {
      const rcaResult = await queryWithRetry('SELECT * FROM rca_records WHERE work_item_id = $1', [id]);
      rcaRecord = rcaResult.rows[0] || null;
    }

    // Validate transition using State Pattern
    const validation = validateTransition(currentStatus, targetStatus.toUpperCase(), workItem, rcaRecord);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Update status
    const updateQuery = `
      UPDATE work_items SET status = $1, updated_at = NOW() WHERE id = $2
      RETURNING *`;
    const updated = await queryWithRetry(updateQuery, [targetStatus.toUpperCase(), id]);

    // If closing, store MTTR in the RCA record
    if (targetStatus.toUpperCase() === 'CLOSED' && validation.mttrSeconds) {
      await queryWithRetry(
        'UPDATE rca_records SET mttr_seconds = $1 WHERE work_item_id = $2',
        [validation.mttrSeconds, id]
      );
    }

    // Refresh dashboard cache
    await refreshDashboardCache();

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('workItem:updated', {
        ...updated.rows[0],
        mttr_seconds: validation.mttrSeconds || null,
      });
    }

    res.json({
      workItem: updated.rows[0],
      mttr_seconds: validation.mttrSeconds || null,
    });
  } catch (err) {
    console.error('[WorkItems] Status update error:', err.message);
    res.status(500).json({ error: 'Failed to update work item status' });
  }
});

module.exports = router;
