# IMS Build Walkthrough

## What Was Built

A complete Incident Management System per the Zeotap engineering challenge requirements:

### Backend (`/backend`)
- **Node.js + Express** server with Socket.IO for real-time events
- **Three-layer ingestion pipeline**: Rate Limiter → Ring Buffer (50K capacity, drop-oldest) → Debouncer (100 signals/10s per component)
- **Three data stores**, each serving a specific purpose:
  - PostgreSQL — transactional Work Items + RCA (source of truth)
  - MongoDB — raw signal audit log + timeseries aggregations
  - Redis — dashboard cache (hot-path reads)
- **Strategy Pattern** for alert classification (RDBMS=P0, API=P1, Cache=P2)
- **State Pattern** for work item lifecycle (OPEN→INVESTIGATING→RESOLVED→CLOSED) with mandatory RCA enforcement
- **MTTR auto-calculation** on incident closure
- **Retry logic** on all DB writes with exponential backoff
- **`/health` endpoint** showing all service statuses + ring buffer utilization
- **Throughput metrics** printed to console every 5 seconds

### Frontend (`/frontend`)
- **React 19 + Vite** single-page application
- **Dashboard**: Live stats cards, severity distribution bars, incident feed sorted by severity, filters
- **Incident Detail**: Status timeline, transition buttons, raw signal table, RCA form/display
- **RCA Form**: DateTime pickers, category dropdown, textareas with client-side validation
- **Signal Simulator** (creative bonus): Trigger failure scenarios directly from the UI
- **Dark theme** with severity color coding, hover animations, responsive layout
- **Socket.IO** for live WebSocket updates (no polling)

### Infrastructure
- **Docker Compose** with health checks on all services — single `docker-compose up --build`
- **Nginx** reverse proxy for production frontend
- **Vite dev proxy** for local development

### Documentation
- [README.md](file:///c:/Users/Jaith/OneDrive/Desktop/projects/Zeotap/README.md) — Architecture diagram, setup instructions, backpressure explanation, API reference, design pattern justifications
- [prompt.md](file:///c:/Users/Jaith/OneDrive/Desktop/projects/Zeotap/prompt.md) — 8-prompt iterative design process with reasoning and alternatives considered

### Scripts
- [mock-signals.js](file:///c:/Users/Jaith/OneDrive/Desktop/projects/Zeotap/scripts/mock-signals.js) — 4 scenarios: RDBMS outage, cache storm, full-stack failure, burst test (10K signals)

## Tests

**33 tests, 4 suites — all passing ✅**

| Suite | Tests | Covers |
|-------|-------|--------|
| workItemState.test.js | 14 | Valid/invalid transitions, RCA validation, MTTR |
| ringBuffer.test.js | 7 | Enqueue/dequeue, overflow, batch drain, 50K stress |
| debouncer.test.js | 4 | Threshold flush, timer flush, multi-component |
| alertStrategy.test.js | 8 | Component→severity mapping, fallback, execute() |

## Rubric Coverage

| Category (Weight) | How It's Addressed |
|-------|----------|
| **Concurrency & Scaling (10%)** | Ring buffer + async drain loop. Single-threaded event loop = no race conditions. Rate limiter prevents cascading failures. |
| **Data Handling (20%)** | Three stores, each purpose-built: MongoDB (audit), PostgreSQL (transactions), Redis (cache). Clear separation. |
| **LLD (20%)** | Strategy Pattern, State Pattern, Ring Buffer data structure, Debouncer with timer management, retry-with-backoff. |
| **UI/UX & Integration (20%)** | Responsive React dashboard with live Socket.IO, status timeline, RCA form with validation, signal table with expandable payloads. |
| **Resilience & Testing (10%)** | 33 unit tests, retry logic on all DB writes, health endpoint, graceful shutdown, drop-oldest backpressure. |
| **Documentation (10%)** | Comprehensive README with arch diagram, API docs, backpressure section. prompt.md with 8 iterative prompts. |
| **Tech Stack Choices (10%)** | Justified each choice in README. No over-engineering (no Kafka, no k8s, no Redis Streams). |
