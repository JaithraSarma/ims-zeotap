# IMS Build Task List

## Backend Core
- [x] package.json + .env + config
- [x] server.js (Express + Socket.IO + health + metrics)
- [x] PostgreSQL connection + schema init
- [x] MongoDB connection
- [x] Redis connection

## Ingestion Layer
- [x] Ring buffer (backpressure)
- [x] Debouncer (100 signals / 10s per component_id)
- [x] Rate limiter middleware

## Design Patterns
- [x] Strategy Pattern — Alert severity
- [x] State Pattern — Work Item lifecycle

## API Routes
- [x] POST /api/signals
- [x] GET/PATCH /api/work-items
- [x] POST/GET /api/work-items/:id/rca
- [x] GET /api/dashboard/stats + timeseries
- [x] GET /health

## Services
- [x] Signal processor (async drain + persist)
- [x] Metrics service (throughput every 5s)

## Tests — 33 passing ✅
- [x] RCA validation tests
- [x] State transition tests
- [x] Debouncer tests
- [x] Ring buffer tests
- [x] Alert strategy tests

## Frontend
- [x] Vite + React scaffold
- [x] Dashboard page (live feed, sorted by severity)
- [x] Incident Detail page (raw signals + status + timeline)
- [x] RCA Form component
- [x] Socket.IO live updates
- [x] Signal Simulator (creative bonus)
- [x] Dark theme CSS

## Infrastructure
- [x] Backend Dockerfile
- [x] Frontend Dockerfile + nginx.conf
- [x] docker-compose.yml
- [x] SQL init script

## Documentation & Scripts
- [x] mock-signals.js script (4 scenarios)
- [x] README.md (architecture, setup, backpressure)
- [x] prompt.md (prompt engineering showcase)
