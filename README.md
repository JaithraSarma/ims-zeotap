# 🚨 Incident Management System (IMS)

A resilient, mission-critical Incident Management System designed to monitor a complex distributed stack (APIs, MCP Hosts, Distributed Caches, Async Queues, RDBMS, and NoSQL stores) and manage failure mediation workflows.

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Signal Producers                            │
│    API Errors  │  MCP Failures  │  Cache Misses  │  DB Timeouts     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ POST /api/signals (JSON)
                               │ Rate-Limited (1000 req/sec)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       INGESTION LAYER                                │
│                                                                      │
│   ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│   │ Rate Limiter  │──▶│  Ring Buffer  │ ──▶│  Debounce Engine    │  │
│   │ (token bucket)│    │  (50K slots,  │    │  (100 signals/10s   │  │
│   │               │    │   drop-oldest)│    │   per component_id) │  │
│   └───────────────┘    └───────────────┘    └─────────┬───────────┘  │
│                                                       │              │
│   Backpressure: Buffer absorbs bursts. If persistence │              │
│   is slow, signals stay in memory. If full, oldest    │              │
│   are dropped (never crash).                          │              │
└───────────────────────────────────────────────────────┼──────────────┘
                                                        │
                  ┌────────────────────┼─────────────────────┐
                  ▼                    ▼                     ▼
        ┌──────────────────┐    ┌─────────────┐    ┌──────────────┐
        │    MongoDB       │    │  PostgreSQL │    │    Redis     │
        │  (Raw Signals    │    │  (Work Items│    │  (Dashboard  │
        │   Audit Log)     │    │   + RCA     │    │   Cache +    │
        │                  │    │Transactional│    │   Pub/Sub)   │
        │  ▸ Timeseries    │    │   Source of │    │              │
        │    Aggregations  │    │   Truth)    │    │              │
        └──────────────────┘    └─────────────┘    └──────┬───────┘
                                                          │
                                                          │ pub/sub
                                                          ▼
                                                ┌──────────────────┐
                                                │   Socket.IO      │
                                                │   (WebSocket)    │
                                                └────────┬─────────┘
                                                         ▼
                                                ┌──────────────────┐
                                                │  React Dashboard │
                                                │  (Vite + SPA)    │
                                                └──────────────────┘
```

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend Runtime** | Node.js + Express | Async I/O, event loop handles high-throughput ingestion |
| **RDBMS** | PostgreSQL 16 | Transactional source of truth for Work Items + RCA |
| **NoSQL** | MongoDB 7 | Schema-flexible audit log for raw signals + aggregation pipeline |
| **Cache** | Redis 7 | Sub-ms dashboard reads, pub/sub for real-time updates |
| **Frontend** | React 19 + Vite | Component-based SPA with live WebSocket updates |
| **Real-time** | Socket.IO | Push-based live feed (no polling) |
| **Containerization** | Docker Compose | Single-command full stack deployment |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed

### Run the Full Stack

```bash
# Clone the repository
git clone <repo-url>
cd Zeotap

# Start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Health:   http://localhost:3001/health
```

### Local Development (without Docker)

```bash
# Terminal 1: Start databases
docker-compose up postgres mongodb redis

# Terminal 2: Backend
cd backend
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

### Run Tests

```bash
cd backend
npm test
```

### Run Mock Signal Generator

```bash
# After the backend is running:
node scripts/mock-signals.js full-stack    # Simulates failures across all components
node scripts/mock-signals.js rdbms-outage  # Simulates RDBMS outage with MCP cascade
node scripts/mock-signals.js cache-storm   # Simulates cache failure
node scripts/mock-signals.js burst         # Sends 10,000 signals for load testing
```

---

## 🎯 Design Patterns

### Strategy Pattern — Alert Severity Classification

Different component failures trigger different alert levels. The Strategy Pattern allows swapping alerting logic without modifying the core processing code.

```
ComponentType → AlertStrategy
─────────────────────────────
RDBMS, MCP_HOST    → CriticalAlertStrategy (P0)  — 5 min escalation
API, ASYNC_QUEUE   → HighAlertStrategy     (P1)  — 15 min escalation
CACHE, NOSQL       → MediumAlertStrategy   (P2)  — 60 min escalation
```

**Why Strategy?** New component types or alert levels can be added by creating a new strategy class and adding one line to the factory map. No existing code changes needed (Open/Closed Principle).

### State Pattern — Work Item Lifecycle

Work Items follow a strict lifecycle managed by the State Pattern. Each state is a class that validates allowed transitions and enforces business rules.

```
OPEN ──▶ INVESTIGATING ──▶ RESOLVED ──▶ CLOSED
                                          ↑
                                  (requires complete RCA)
```

**Key Rule:** The `ResolvedState` rejects transitions to `CLOSED` unless a complete RCA is attached (all fields: incident_start, incident_end, root_cause_category, fix_applied, prevention_steps).

---

## 🛡️ Backpressure Handling

The system handles bursts of up to 10,000 signals/sec through a three-layer defense:

### Layer 1: Rate Limiter
- Token bucket algorithm on `/api/signals` endpoint
- Configurable limit (default: 1000 req/sec)
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- Prevents the ingestion layer from being overwhelmed

### Layer 2: Ring Buffer (In-Memory)
- Fixed-size circular buffer (default: 50,000 slots)
- **Non-blocking enqueue** — O(1) regardless of downstream speed
- **Drop-oldest policy** — if buffer fills up (persistence is too slow), the oldest signals are overwritten, not the newest
- The system **never crashes** even if the persistence layer is completely down
- Dropped signal count is tracked and exposed via `/health` for observability

### Layer 3: Async Batch Processing
- A background drain loop pulls signals from the ring buffer in batches (500 at a time, every 50ms)
- Signals are fed through the Debouncer before persistence
- **Decouples ingestion speed from write speed** — the producer (HTTP handler) never waits for MongoDB/PostgreSQL writes

```
HTTP Request → [Rate Limit] → [Ring Buffer] → [Drain Loop] → [Debounce] → [Persist]
     fast          gate          absorb          async           collapse      slow OK
```

---

## 📊 Data Separation Strategy

| Data Type | Store | Why |
|-----------|-------|-----|
| **Raw Signals** (high volume, audit) | MongoDB | Schema-flexible, handles high write throughput, aggregation pipeline for timeseries |
| **Work Items + RCA** (structured, transactional) | PostgreSQL | ACID transactions for status updates, referential integrity for RCA records |
| **Dashboard State** (hot-path, read-heavy) | Redis | Sub-millisecond reads, avoids querying PostgreSQL on every UI refresh |
| **Timeseries Aggregations** | MongoDB Aggregation Pipeline | `$dateTrunc` + `$group` for time-bucketed signal counts |

---

## 🔌 API Reference

### Signal Ingestion
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signals` | Ingest a single signal (rate-limited) |
| `POST` | `/api/signals/batch` | Ingest multiple signals at once |

### Work Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/work-items` | List work items (filterable by status, severity) |
| `GET` | `/api/work-items/:id` | Get work item detail with signals and RCA |
| `GET` | `/api/work-items/:id/signals` | Get raw signals for a work item |
| `PATCH` | `/api/work-items/:id/status` | Transition work item status |

### RCA
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/work-items/:id/rca` | Submit/update RCA for a work item |
| `GET` | `/api/work-items/:id/rca` | Get RCA for a work item |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Aggregated counts (cached in Redis) |
| `GET` | `/api/dashboard/timeseries` | Time-bucketed signal aggregation |

### Observability
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check — all service statuses + ring buffer metrics |

---

## 🧪 Testing

### Unit Tests (33 tests, 4 suites)

```
✓ Work Item State Transitions (12 tests)
  - Valid transitions (OPEN→INVESTIGATING, etc.)
  - Invalid transitions (skip states, terminal state)
  - RCA validation (missing, incomplete fields)
  - MTTR calculation accuracy

✓ Ring Buffer (7 tests)
  - Enqueue/dequeue correctness
  - Drop-oldest on overflow
  - Batch drain
  - High-volume stress test (50K signals)

✓ Debouncer (4 tests)
  - Threshold-based flushing
  - Window-based flushing
  - Independent component handling
  - Stats reporting

✓ Alert Strategy (7 tests)
  - Component → severity mapping
  - Fallback for unknown types
  - Alert object structure
```

### Resilience Features
- **Retry logic** on all database writes (PostgreSQL, MongoDB) with exponential backoff
- **Health checks** in Docker Compose for all services
- **Graceful shutdown** handling (drain buffer, close connections)
- **Non-blocking ingestion** — HTTP handler returns 202 immediately

### Non-Functional Enhancements (Bonus)
- **Security**: 
  - Express Rate Limiter prevents DDoS and brute-force flooding on the ingestion endpoint.
  - Parameterized SQL queries via `pg` library to prevent SQL Injection.
  - CORS configuration limits frontend access to trusted origins.
- **Performance**:
  - Redis cache layer prevents database hammering on read-heavy dashboard refreshes.
  - MongoDB compound indexing on `(component_id, timestamp)` for O(1) timeseries aggregation.
  - Debouncer drastically reduces write I/O by collapsing 100 signals into 1 relational write.

---

## 🎨 Creative Additions

1. **In-UI Signal Simulator** — Trigger predefined failure scenarios (RDBMS outage, Cache storm, API errors, MCP failure) directly from the dashboard without needing CLI access
2. **Visual Status Timeline** — Interactive progress bar showing the incident lifecycle with animated current state
3. **MTTR Display** — Automatic Mean Time To Repair calculation shown prominently after incident closure
4. **Severity Distribution Bars** — Visual bar chart showing P0/P1/P2 distribution on the dashboard
5. **Live Pulse Indicator** — Animated green dot in header showing real-time WebSocket connection status

---

## 📁 Project Structure

```
Zeotap/
├── docker-compose.yml              # Full stack orchestration
├── README.md                       # This file
├── prompt.md                       # Prompt engineering documentation
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── init.sql                    # PostgreSQL schema
│   ├── src/
│   │   ├── server.js               # Express + Socket.IO entry point
│   │   ├── config/index.js         # Centralized configuration
│   │   ├── db/
│   │   │   ├── postgres.js         # PostgreSQL pool + retry logic
│   │   │   ├── mongo.js            # MongoDB connection + Signal model
│   │   │   └── redis.js            # Redis client + cache helpers
│   │   ├── ingestion/
│   │   │   ├── ringBuffer.js       # Circular buffer for backpressure
│   │   │   ├── debouncer.js        # Signal deduplication engine
│   │   │   └── rateLimiter.js      # Token bucket rate limiter
│   │   ├── patterns/
│   │   │   ├── alertStrategy.js    # Strategy Pattern for alerts
│   │   │   └── workItemState.js    # State Pattern for lifecycle
│   │   ├── routes/
│   │   │   ├── signals.js          # Signal ingestion endpoints
│   │   │   ├── workItems.js        # Work item CRUD + transitions
│   │   │   ├── rca.js              # RCA submission + retrieval
│   │   │   ├── dashboard.js        # Stats + timeseries
│   │   │   └── health.js           # Health check
│   │   ├── services/
│   │   │   ├── signalProcessor.js  # Async processing orchestrator
│   │   │   └── metricsService.js   # Throughput metrics (5s interval)
│   │   └── middleware/
│   │       └── errorHandler.js     # Global error handler
│   └── tests/
│       ├── workItemState.test.js   # State transition + RCA tests
│       ├── ringBuffer.test.js      # Buffer overflow tests
│       ├── debouncer.test.js       # Debounce logic tests
│       └── alertStrategy.test.js   # Alert mapping tests
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf                  # Production reverse proxy
│   ├── package.json
│   ├── vite.config.js              # Dev proxy to backend
│   ├── index.html
│   └── src/
│       ├── App.jsx                 # Main layout + routing
│       ├── App.css                 # Complete design system
│       ├── main.jsx                # React entry point
│       ├── pages/
│       │   ├── Dashboard.jsx       # Live feed + stats + simulator
│       │   └── IncidentDetail.jsx  # Detail view + RCA + signals
│       ├── components/
│       │   ├── IncidentCard.jsx    # Severity-colored incident card
│       │   ├── RCAForm.jsx         # RCA submission form
│       │   ├── SignalTable.jsx     # Raw signal viewer
│       │   └── SignalSimulator.jsx # In-UI failure simulator
│       └── services/
│           ├── api.js              # Backend API client
│           └── socket.js           # Socket.IO connection
│
└── scripts/
    └── mock-signals.js             # CLI signal generator (4 scenarios)
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `ims` | Database name |
| `POSTGRES_USER` | `ims_user` | Database user |
| `POSTGRES_PASSWORD` | `ims_password` | Database password |
| `MONGO_URI` | `mongodb://localhost:27017/ims` | MongoDB connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `RATE_LIMIT_MAX` | `1000` | Max requests per second |
| `RING_BUFFER_SIZE` | `50000` | Ring buffer capacity |
| `DEBOUNCE_THRESHOLD` | `100` | Signals per component before flush |
| `DEBOUNCE_WINDOW_MS` | `10000` | Debounce window in milliseconds |
