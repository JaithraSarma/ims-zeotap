# Incident Management System (IMS) — Implementation Plan

## Goal

Build a resilient Incident Management System that ingests high-volume failure signals from a distributed stack, deduplicates them into Work Items, manages incident lifecycle via design patterns, and provides a live dashboard with RCA workflow.

---

## Tech Stack Rationale

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend Runtime** | Node.js + Express | Event loop excels at async I/O; natural fit for high-throughput signal ingestion without thread management overhead |
| **RDBMS (Source of Truth)** | PostgreSQL | Transactional integrity for Work Items + RCA. Industry standard |
| **NoSQL (Data Lake)** | MongoDB | Schema-flexible for raw signal payloads; natural audit log. Supports aggregation pipelines for timeseries |
| **Cache (Hot-Path)** | Redis | Sub-ms reads for dashboard state; built-in TTL; pub/sub for live feed |
| **Frontend** | React (Vite) | Fast dev experience, component model fits dashboard + detail views |
| **Real-time** | WebSocket (Socket.IO) | Push-based live feed; avoids polling |
| **Containerization** | Docker Compose | Single `docker-compose up` for full stack |

> [!IMPORTANT]
> This stack is intentionally practical — each tool solves a specific requirement without overlap. No Kafka, no k8s, no over-engineering.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Signal Producers                         │
│          (API errors, Cache failures, DB outages, etc.)         │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/signals (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INGESTION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Rate Limiter  │→│ Ring Buffer   │→│ Debounce Engine       │ │
│  │ (token bucket)│  │ (in-memory)  │  │ (100 signals/10s      │ │
│  └──────────────┘  └──────────────┘  │  per component_id)    │ │
│                                       └───────────┬───────────┘ │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │
                    ┌───────────────────────────────┼──────────┐
                    ▼                               ▼          ▼
          ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
          │    MongoDB       │  │  PostgreSQL   │  │    Redis     │
          │  (Raw Signals)   │  │ (Work Items   │  │  (Dashboard  │
          │                  │  │   + RCA)      │  │    Cache)    │
          └─────────────────┘  └──────────────┘  └──────┬───────┘
                                                        │ pub/sub
                                                        ▼
                                              ┌──────────────────┐
                                              │  Socket.IO       │
                                              │  (Live Feed)     │
                                              └────────┬─────────┘
                                                       ▼
                                              ┌──────────────────┐
                                              │  React Dashboard │
                                              └──────────────────┘
```

---

## Proposed Changes

### Backend — `/backend`

#### [NEW] `backend/package.json`
Dependencies: express, socket.io, pg (node-postgres), mongoose, redis, express-rate-limit, uuid, cors, dotenv

#### [NEW] `backend/src/server.js`
- Express app setup with middleware
- Socket.IO integration
- `/health` endpoint (observability)
- Throughput metrics printed every 5 seconds
- Graceful shutdown handling

#### [NEW] `backend/src/config/index.js`
- Centralized config from environment variables (DB URLs, ports, thresholds)

#### [NEW] `backend/src/db/postgres.js`
- PostgreSQL connection pool with retry logic
- Schema initialization (work_items, rca_records tables)

#### [NEW] `backend/src/db/mongo.js`
- MongoDB connection with retry logic
- Signal collection setup with indexes on `component_id` and `timestamp`

#### [NEW] `backend/src/db/redis.js`
- Redis client with reconnection strategy
- Helper methods for dashboard cache operations

---

#### [NEW] `backend/src/ingestion/ringBuffer.js`
- Fixed-size circular buffer (capacity: 50,000 signals)
- Non-blocking enqueue; drops oldest if full (backpressure handling)
- Consumer drains buffer in batches asynchronously

#### [NEW] `backend/src/ingestion/debouncer.js`
- In-memory Map: `component_id → { signals: [], timer, count }`
- On signal arrival: if count < 100 within 10s window, accumulate
- On threshold (100 signals) OR timer expiry (10s): flush → create/link Work Item
- Properly handles concurrent access via single-threaded event loop

#### [NEW] `backend/src/ingestion/rateLimiter.js`
- Token bucket rate limiter on `/api/signals` (configurable: 1000 req/sec default)
- Returns 429 with `Retry-After` header

---

#### [NEW] `backend/src/patterns/alertStrategy.js`
**Strategy Pattern** for alert severity:
```
AlertStrategy (interface)
  ├── CriticalAlert (P0) — RDBMS, MCP Host failures
  ├── HighAlert (P1) — API, Async Queue failures
  └── MediumAlert (P2) — Cache, NoSQL store failures
```
- Factory function maps `component_type` → strategy
- Each strategy defines: `severity`, `notificationMethod`, `escalationTimeout`

#### [NEW] `backend/src/patterns/workItemState.js`
**State Pattern** for Work Item lifecycle:
```
WorkItemState (interface)
  ├── OpenState → can transition to INVESTIGATING
  ├── InvestigatingState → can transition to RESOLVED
  ├── ResolvedState → can transition to CLOSED (only if RCA exists)
  └── ClosedState → terminal state
```
- Each state validates allowed transitions
- `ResolvedState.close()` enforces mandatory RCA check
- Calculates MTTR on transition to CLOSED

---

#### [NEW] `backend/src/routes/signals.js`
- `POST /api/signals` — Ingest signal → ring buffer → debouncer
- `POST /api/signals/batch` — Batch ingestion endpoint

#### [NEW] `backend/src/routes/workItems.js`
- `GET /api/work-items` — List with filters (status, severity, component)
- `GET /api/work-items/:id` — Detail with linked signals from MongoDB
- `PATCH /api/work-items/:id/status` — Transition status (uses State Pattern)
- `GET /api/work-items/:id/signals` — Raw signals from MongoDB

#### [NEW] `backend/src/routes/rca.js`
- `POST /api/work-items/:id/rca` — Submit RCA (validates completeness)
- `GET /api/work-items/:id/rca` — Get RCA for work item

#### [NEW] `backend/src/routes/dashboard.js`
- `GET /api/dashboard/stats` — Aggregated stats from Redis cache
- `GET /api/dashboard/timeseries` — Timeseries data from MongoDB aggregation pipeline

#### [NEW] `backend/src/routes/health.js`
- `GET /health` — Returns status of all DB connections + uptime + signal throughput

---

#### [NEW] `backend/src/services/signalProcessor.js`
- Async worker that drains ring buffer → processes through debouncer
- Writes raw signals to MongoDB (with retry logic)
- Creates/updates Work Items in PostgreSQL (transactional)
- Updates Redis dashboard cache
- Emits Socket.IO events for live feed

#### [NEW] `backend/src/services/metricsService.js`
- Tracks signals/sec, active work items, processing latency
- Prints to console every 5 seconds

---

#### [NEW] `backend/src/middleware/errorHandler.js`
- Global error handler with structured error responses

#### [NEW] `backend/tests/rca.test.js`
- Unit tests for RCA validation (reject incomplete RCA on close)
- Unit tests for state transitions
- Unit tests for debouncing logic

#### [NEW] `backend/Dockerfile`
- Node.js 20 Alpine image, production-ready

---

### Frontend — `/frontend`

#### [NEW] `frontend/` (Vite + React scaffold)
Created via `npx create-vite`

#### [NEW] `frontend/src/App.jsx`
- Main layout with sidebar navigation
- Socket.IO connection for live updates

#### [NEW] `frontend/src/pages/Dashboard.jsx`
- **Live Feed**: Active incidents sorted by severity (P0 → P2)
- Real-time counters: Open, Investigating, Resolved, Closed
- Severity distribution chart
- Auto-refreshes via WebSocket

#### [NEW] `frontend/src/pages/IncidentDetail.jsx`
- Work Item details (status, severity, component, timestamps)
- Raw signals table (fetched from backend → MongoDB)
- Status transition buttons (with validation feedback)
- RCA section (shows form or existing RCA)

#### [NEW] `frontend/src/components/RCAForm.jsx`
- Date-time pickers for Incident Start/End
- Dropdown for Root Cause Category (options: Infrastructure, Code Bug, Configuration, External Dependency, Capacity, Human Error)
- Text areas for Fix Applied & Prevention Steps
- Client-side validation before submission

#### [NEW] `frontend/src/components/IncidentCard.jsx`
- Compact card showing: severity badge, component, status, time since creation

#### [NEW] `frontend/src/components/SignalTable.jsx`
- Paginated table of raw signals linked to a work item

#### [NEW] `frontend/src/services/api.js`
- Axios/fetch wrapper for all backend API calls

#### [NEW] `frontend/src/services/socket.js`
- Socket.IO client connection manager

#### [NEW] `frontend/Dockerfile`
- Multi-stage build: npm build → nginx serve

---

### Infrastructure

#### [NEW] `docker-compose.yml`
Services:
- `backend` (Node.js app, port 3001)
- `frontend` (Nginx, port 3000)
- `postgres` (port 5432, with init schema)
- `mongodb` (port 27017)
- `redis` (port 6379)

#### [NEW] `backend/src/db/init.sql`
PostgreSQL schema:
```sql
CREATE TABLE work_items (
  id UUID PRIMARY KEY,
  component_id VARCHAR(100) NOT NULL,
  component_type VARCHAR(50) NOT NULL,
  severity VARCHAR(10) NOT NULL,  -- P0, P1, P2
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  signal_count INTEGER DEFAULT 0,
  first_signal_at TIMESTAMPTZ NOT NULL,
  last_signal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rca_records (
  id UUID PRIMARY KEY,
  work_item_id UUID REFERENCES work_items(id),
  incident_start TIMESTAMPTZ NOT NULL,
  incident_end TIMESTAMPTZ NOT NULL,
  root_cause_category VARCHAR(50) NOT NULL,
  fix_applied TEXT NOT NULL,
  prevention_steps TEXT NOT NULL,
  mttr_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### [NEW] `scripts/mock-signals.js`
- Simulates RDBMS outage → cascading MCP failure
- Sends 10,000+ signals in bursts to test debouncing and backpressure
- Configurable signal rate and component types

---

### Documentation

#### [NEW] `README.md`
- Architecture diagram (Mermaid)
- Setup instructions (Docker Compose)
- Backpressure handling explanation
- API documentation
- Design pattern justifications

#### [NEW] `prompt.md`
- Curated prompt engineering conversation showing iterative thinking
- Covers: architecture decisions, tech stack selection, design patterns, implementation approach

---

## Design Pattern Details

### Strategy Pattern — Alerting

```javascript
// Each component type maps to an alert strategy
const alertStrategies = {
  RDBMS:       new CriticalAlertStrategy(),   // P0
  MCP_HOST:    new CriticalAlertStrategy(),   // P0
  API:         new HighAlertStrategy(),        // P1
  ASYNC_QUEUE: new HighAlertStrategy(),        // P1
  CACHE:       new MediumAlertStrategy(),      // P2
  NOSQL:       new MediumAlertStrategy(),      // P2
};
```

### State Pattern — Work Item Lifecycle

```
OPEN ──→ INVESTIGATING ──→ RESOLVED ──→ CLOSED
                                          ↑
                                    (requires RCA)
```

Invalid transitions are rejected with clear error messages.

---

## Backpressure Handling Strategy

1. **Rate Limiter** (first line): Rejects excess requests with 429
2. **Ring Buffer** (second line): Fixed-size buffer absorbs bursts; if persistence is slow, new signals continue to be accepted up to buffer capacity; oldest signals are dropped if buffer is full (with metric tracking)
3. **Async Batch Processing**: Consumer drains buffer in configurable batch sizes, decoupling ingestion speed from write speed
4. **Redis Buffering**: Dashboard updates are written to Redis first (fast), then lazily synced

---

## Verification Plan

### Automated Tests
- `npm test` — Unit tests for RCA validation, state transitions, debouncing
- Mock signal script to verify end-to-end flow

### Manual Verification
- `docker-compose up` — Full stack comes up healthy
- Hit `/health` endpoint — All services green
- Run mock signal script — See signals debounced into work items on dashboard
- Walk through OPEN → INVESTIGATING → RESOLVED → CLOSED lifecycle
- Verify CLOSED is rejected without RCA
- Check console for throughput metrics every 5 seconds

---

## Open Questions

> [!IMPORTANT]
> **Frontend Styling**: I'm planning a clean, dark-themed dashboard with severity-colored badges. Should I prioritize visual polish or keep it minimal/functional?

> [!NOTE]
> **Timeseries Aggregations**: The assignment mentions "Sink (Aggregations)" for timeseries. I plan to use MongoDB's aggregation pipeline (`$group` by time buckets) rather than adding a dedicated timeseries DB like InfluxDB. This keeps the stack simpler. Let me know if you'd prefer something different.

> [!NOTE]
> **Notification/Alerting**: The Strategy Pattern handles *classifying* alerts by severity. Since this is a take-home (no actual Slack/PagerDuty), I'll log the alert action to console and show it in the UI. Sound good?
