const mongoose = require('mongoose');
const config = require('../config');

const signalSchema = new mongoose.Schema(
  {
    signal_id: { type: String, required: true, index: true },
    component_id: { type: String, required: true, index: true },
    component_type: { type: String, required: true },
    severity: { type: String },
    message: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    work_item_id: { type: String, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Compound index for efficient timeseries aggregation queries
signalSchema.index({ component_id: 1, timestamp: -1 });
signalSchema.index({ work_item_id: 1, timestamp: -1 });

const Signal = mongoose.model('Signal', signalSchema);

/**
 * Initialize MongoDB connection with retry logic.
 */
async function initMongo(retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(config.mongo.uri);
      console.log('[MongoDB] Connected successfully');
      return;
    } catch (err) {
      console.error(`[MongoDB] Connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

module.exports = { Signal, initMongo };
