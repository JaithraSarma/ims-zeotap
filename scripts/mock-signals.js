/**
 * Mock Signal Generator — Simulates distributed system failures.
 *
 * Usage: node scripts/mock-signals.js [scenario]
 *
 * Scenarios:
 *   rdbms-outage   — Simulates a primary database outage with cascading MCP failures
 *   cache-storm    — Simulates a cache cluster failure causing high traffic to DB
 *   full-stack     — Simulates failures across the entire stack
 *   burst          — Sends 10,000 signals in rapid bursts to test backpressure
 *
 * Default: full-stack
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SCENARIO = process.argv[2] || 'full-stack';

function sendSignal(signal) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(signal);
    const url = new URL(`${API_URL}/api/signals`);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendBatch(signals) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ signals });
    const url = new URL(`${API_URL}/api/signals/batch`);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Scenario Definitions ---

async function rdbmsOutage() {
  console.log('🔥 Scenario: RDBMS Outage with cascading MCP failure\n');

  // Phase 1: RDBMS starts failing
  console.log('Phase 1: RDBMS connection errors...');
  for (let i = 0; i < 120; i++) {
    await sendSignal({
      component_id: 'DB_PRIMARY_01',
      component_type: 'RDBMS',
      message: `Connection timeout on query ${i}`,
      payload: { error_code: 'ETIMEOUT', query_id: `q-${i}`, latency_ms: 30000 + Math.random() * 5000 },
    });
    if (i % 20 === 0) await sleep(100);
  }

  // Phase 2: MCP Host starts failing (cascading)
  console.log('Phase 2: MCP Host failures (cascade)...');
  await sleep(2000);
  for (let i = 0; i < 80; i++) {
    await sendSignal({
      component_id: 'MCP_HOST_01',
      component_type: 'MCP_HOST',
      message: `Tool execution failed: cannot reach database`,
      payload: { tool: 'db_query', error: 'upstream_timeout', attempt: i },
    });
    if (i % 20 === 0) await sleep(100);
  }

  // Phase 3: API errors spike
  console.log('Phase 3: API 503 errors...');
  await sleep(1000);
  for (let i = 0; i < 50; i++) {
    await sendSignal({
      component_id: 'API_GATEWAY_01',
      component_type: 'API',
      message: `HTTP 503 Service Unavailable`,
      payload: { endpoint: '/api/users', status_code: 503, response_time_ms: 29500 },
    });
  }

  console.log('\n✅ RDBMS outage scenario complete. Sent ~250 signals.');
}

async function cacheStorm() {
  console.log('🌊 Scenario: Cache cluster failure\n');

  // Phase 1: Cache misses spike
  console.log('Phase 1: Cache miss rate spike...');
  for (let i = 0; i < 150; i++) {
    await sendSignal({
      component_id: 'CACHE_CLUSTER_01',
      component_type: 'CACHE',
      message: `Cache miss - key evicted`,
      payload: { key: `user:${Math.floor(Math.random() * 10000)}`, hit_rate: 0.1 },
    });
    if (i % 30 === 0) await sleep(50);
  }

  // Phase 2: DB load increases
  console.log('Phase 2: DB load increases from cache misses...');
  await sleep(1000);
  for (let i = 0; i < 60; i++) {
    await sendSignal({
      component_id: 'DB_REPLICA_01',
      component_type: 'RDBMS',
      message: `Query latency elevated: ${500 + Math.floor(Math.random() * 2000)}ms`,
      payload: { active_connections: 150 + i, max_connections: 200 },
    });
  }

  console.log('\n✅ Cache storm scenario complete. Sent ~210 signals.');
}

async function fullStack() {
  console.log('💥 Scenario: Full stack failure simulation\n');

  const components = [
    { id: 'DB_PRIMARY_01', type: 'RDBMS', msg: 'Connection pool exhausted' },
    { id: 'MCP_HOST_01', type: 'MCP_HOST', msg: 'Tool execution timeout' },
    { id: 'API_GATEWAY_01', type: 'API', msg: 'HTTP 500 Internal Server Error' },
    { id: 'CACHE_CLUSTER_01', type: 'CACHE', msg: 'Node unreachable' },
    { id: 'QUEUE_BROKER_01', type: 'ASYNC_QUEUE', msg: 'Consumer lag exceeds threshold' },
    { id: 'NOSQL_CLUSTER_01', type: 'NOSQL', msg: 'Write concern timeout' },
  ];

  for (const comp of components) {
    console.log(`  Sending signals for ${comp.id} (${comp.type})...`);
    const signals = [];
    for (let i = 0; i < 110; i++) {
      signals.push({
        component_id: comp.id,
        component_type: comp.type,
        message: `${comp.msg} #${i}`,
        payload: { iteration: i, timestamp: new Date().toISOString() },
      });
    }
    // Send in batches of 50
    for (let i = 0; i < signals.length; i += 50) {
      await sendBatch(signals.slice(i, i + 50));
    }
    await sleep(500);
  }

  console.log('\n✅ Full stack scenario complete. Sent ~660 signals across 6 components.');
}

async function burst() {
  console.log('⚡ Scenario: Burst test (10,000 signals)\n');

  const batchSize = 100;
  const totalSignals = 10000;
  let sent = 0;

  for (let batch = 0; batch < totalSignals / batchSize; batch++) {
    const signals = [];
    for (let i = 0; i < batchSize; i++) {
      const componentIdx = Math.floor(Math.random() * 5);
      const components = [
        { id: 'DB_PRIMARY_01', type: 'RDBMS' },
        { id: 'CACHE_CLUSTER_01', type: 'CACHE' },
        { id: 'API_GATEWAY_01', type: 'API' },
        { id: 'MCP_HOST_01', type: 'MCP_HOST' },
        { id: 'QUEUE_BROKER_01', type: 'ASYNC_QUEUE' },
      ];
      const comp = components[componentIdx];
      signals.push({
        component_id: comp.id,
        component_type: comp.type,
        message: `Burst signal ${sent + i}`,
        payload: { burst_id: batch, index: i },
      });
    }

    try {
      await sendBatch(signals);
      sent += batchSize;
      if (batch % 10 === 0) {
        process.stdout.write(`\r  Sent ${sent}/${totalSignals} signals...`);
      }
    } catch (err) {
      console.log(`\n  ⚠ Batch ${batch} failed: ${err.message}`);
    }
  }

  console.log(`\n\n✅ Burst test complete. Attempted ${totalSignals} signals.`);
}

// --- Main ---
const scenarios = { 'rdbms-outage': rdbmsOutage, 'cache-storm': cacheStorm, 'full-stack': fullStack, burst };

async function main() {
  console.log(`\n=== IMS Mock Signal Generator ===`);
  console.log(`Target: ${API_URL}`);
  console.log(`Scenario: ${SCENARIO}\n`);

  const scenarioFn = scenarios[SCENARIO];
  if (!scenarioFn) {
    console.error(`Unknown scenario: ${SCENARIO}`);
    console.log(`Available: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }

  try {
    await scenarioFn();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.log('Is the backend running? Try: docker-compose up');
  }
}

main();
