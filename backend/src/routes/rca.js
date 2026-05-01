const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryWithRetry } = require('../db/postgres');

const router = express.Router();

// Valid root cause categories
const VALID_CATEGORIES = [
  'Infrastructure',
  'Code Bug',
  'Configuration',
  'External Dependency',
  'Capacity',
  'Human Error',
  'Network',
  'Security',
];

/**
 * POST /api/work-items/:id/rca — Submit an RCA for a work item.
 * Validates all required fields before saving.
 */
router.post('/:id/rca', async (req, res) => {
  try {
    const { id } = req.params;
    const { incident_start, incident_end, root_cause_category, fix_applied, prevention_steps } = req.body;

    // Verify work item exists
    const wiResult = await queryWithRetry('SELECT * FROM work_items WHERE id = $1', [id]);
    if (wiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Validate required fields
    if (!incident_start || !incident_end) {
      return res.status(400).json({ error: 'incident_start and incident_end are required' });
    }
    if (!root_cause_category) {
      return res.status(400).json({ error: 'root_cause_category is required' });
    }
    if (!VALID_CATEGORIES.includes(root_cause_category)) {
      return res.status(400).json({
        error: `Invalid root_cause_category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }
    if (!fix_applied || fix_applied.trim() === '') {
      return res.status(400).json({ error: 'fix_applied is required and cannot be empty' });
    }
    if (!prevention_steps || prevention_steps.trim() === '') {
      return res.status(400).json({ error: 'prevention_steps is required and cannot be empty' });
    }

    // Check if RCA already exists (update if so)
    const existing = await queryWithRetry('SELECT id FROM rca_records WHERE work_item_id = $1', [id]);

    let result;
    if (existing.rows.length > 0) {
      result = await queryWithRetry(
        `UPDATE rca_records SET
          incident_start = $1, incident_end = $2, root_cause_category = $3,
          fix_applied = $4, prevention_steps = $5
        WHERE work_item_id = $6 RETURNING *`,
        [incident_start, incident_end, root_cause_category, fix_applied, prevention_steps, id]
      );
    } else {
      const rcaId = uuidv4();
      result = await queryWithRetry(
        `INSERT INTO rca_records (id, work_item_id, incident_start, incident_end, root_cause_category, fix_applied, prevention_steps)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [rcaId, id, incident_start, incident_end, root_cause_category, fix_applied, prevention_steps]
      );
    }

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('rca:submitted', { work_item_id: id, rca: result.rows[0] });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[RCA] Submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit RCA' });
  }
});

/**
 * GET /api/work-items/:id/rca — Get the RCA for a work item.
 */
router.get('/:id/rca', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryWithRetry('SELECT * FROM rca_records WHERE work_item_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No RCA found for this work item' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[RCA] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch RCA' });
  }
});

module.exports = router;
