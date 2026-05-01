# Prompt Engineering — IMS Build Process

This document captures the iterative prompt engineering process used to design and build the Incident Management System. Each prompt represents a stage of thinking, with refinements based on the requirements.

---

## Prompt 1: Initial Architecture Scoping

**Me:**
> I have an assignment to build an Incident Management System (IMS) for monitoring a distributed stack. It needs to handle high-volume signal ingestion (10,000/sec), store raw signals in NoSQL, structured work items in RDBMS, cache dashboard state, support debouncing (100 signals per component in 10s = 1 work item), and have a workflow-driven UI.
>
> Before writing any code, help me pick the right tech stack. I need something that handles async I/O well, isn't over-engineered, and can be containerized with Docker Compose. The evaluation rubric weights LLD (20%), Data Handling (20%), and UI/UX (20%) the highest.

**AI Response Summary:**
Recommended Node.js + Express (async event loop), PostgreSQL (RDBMS), MongoDB (NoSQL), Redis (cache), React + Vite (frontend). Justified each choice against the specific requirements and rubric weights.

**My Thinking:**
I went with this stack because:
- Node.js event loop naturally handles 10K concurrent signals without thread management
- PostgreSQL gives me transactional integrity for work item status transitions
- MongoDB's flexible schema fits raw signal payloads, and its aggregation pipeline handles timeseries
- Redis is the obvious choice for sub-millisecond dashboard reads
- Not introducing Kafka or k8s keeps it honest — this is a take-home, not a production SaaS

---

## Prompt 2: Data Layer Design

**Me:**
> Design the data schema. I need to separate data correctly:
> 1. Raw signals → MongoDB (audit log, queryable by component_id and timestamp)
> 2. Work Items + RCA → PostgreSQL (transactional, must support status transitions)
> 3. Dashboard state → Redis (avoid querying PostgreSQL on every UI refresh)
>
> The assignment mentions "transitions here must be transactional" for the Source of Truth. How do I ensure that?

**AI Response Summary:**
Designed PostgreSQL schema with `work_items` and `rca_records` tables (foreign key relationship). MongoDB `signals` collection with compound indexes on `(component_id, timestamp)` and `(work_item_id, timestamp)`. Redis stores pre-computed dashboard stats as a JSON string with 30-second TTL.

**My Thinking:**
The key insight here is the separation of concerns — each store does one thing well:
- MongoDB handles high write throughput and schema flexibility (signal payloads vary by component type)
- PostgreSQL guarantees that a status transition + RCA update happen atomically
- Redis serves as a read-through cache that gets invalidated whenever a work item changes

---

## Prompt 3: Backpressure & Memory Management

**Me:**
> The system must handle bursts of 10,000 signals/sec and "cannot crash if persistence layer is slow." How do I design the ingestion layer to handle this? I need a concrete backpressure strategy.

**AI Response Summary:**
Three-layer defense: (1) Rate limiter at API edge, (2) Ring buffer in memory, (3) Async batch drain loop. The ring buffer uses a drop-oldest policy when full — the system never blocks or crashes.

**My Thinking:**
The ring buffer was the key decision here. Alternatives I considered:
- **Unbounded queue**: Could crash if signals accumulate faster than we persist → rejected
- **Blocking queue**: Would slow down HTTP responses under load → rejected
- **Ring buffer with drop-oldest**: Fixed memory footprint, O(1) operations, graceful degradation → chosen

The 50,000-slot buffer at ~1KB per signal = ~50MB of memory. That's well within reasonable limits. And the dropped count is exposed via `/health` for observability — so we know if it's happening.

---

## Prompt 4: Design Patterns

**Me:**
> The assignment specifically asks for "the right Design Pattern" for:
> 1. Alert severity — different components need different alert types (P0 for RDBMS, P2 for Cache)
> 2. Work Item lifecycle — OPEN → INVESTIGATING → RESOLVED → CLOSED with mandatory RCA for closing
>
> Implement these using Strategy Pattern and State Pattern respectively. Show me the class structure.

**AI Response Summary:**
- **Strategy Pattern**: `CriticalAlertStrategy`, `HighAlertStrategy`, `MediumAlertStrategy` — each encapsulates severity level, escalation timeout, and notification behavior. A factory map routes `component_type → strategy`.
- **State Pattern**: `OpenState`, `InvestigatingState`, `ResolvedState`, `ClosedState` — each defines allowed transitions and validation logic. `ResolvedState.validate()` checks for complete RCA before allowing CLOSED transition.

**My Thinking:**
Why these specific patterns?
- **Strategy** is perfect because the alert behavior varies by component type but the interface is identical. Adding a new component type = adding one line to the factory map. Open/Closed Principle in action.
- **State** is perfect because each work item status has different valid transitions and different validation rules. The alternative (switch/case in a single function) would violate Single Responsibility and become unmaintainable as rules grow.

The mandatory RCA enforcement lives in `ResolvedState.validate()` — it checks every field and rejects with a specific error message if anything is missing. This is tested with 5 separate unit tests.

---

## Prompt 5: Debouncing Logic

**Me:**
> Implement the debouncing: "If 100 signals arrive for the same component_id within 10 seconds, only one Work Item should be created, while all 100 signals are linked to it in the NoSQL store."
>
> Key constraints:
> - The debouncer should flush on threshold (100 signals) OR timer expiry (10 seconds), whichever comes first
> - All signals in a batch must be linked to the same work_item_id in MongoDB
> - Must handle multiple component_ids concurrently

**AI Response Summary:**
In-memory `Map<component_id, Bucket>` where each bucket holds accumulated signals, a timer, and the pre-generated work_item_id. On threshold or timer expiry, the bucket flushes: creates work item in PostgreSQL, bulk-inserts signals into MongoDB with the shared work_item_id.

**My Thinking:**
Race conditions aren't a concern because Node.js is single-threaded — the event loop guarantees that `addSignal()` and the timer callback never execute simultaneously. This is actually a strength of the platform here.

The work_item_id is generated when the bucket is created (not on flush), so all signals can be linked to it immediately in MongoDB. This avoids a two-phase write.

---

## Prompt 6: Frontend Architecture

**Me:**
> Build the frontend with React + Vite. Three views needed:
> 1. Dashboard — live feed of incidents sorted by severity, stats cards
> 2. Incident Detail — raw signals table, status transitions, RCA section
> 3. RCA Form — datetime pickers, dropdown for category, textareas
>
> Use Socket.IO for live updates. Keep it simple but responsive. Dark theme.

**AI Response Summary:**
Single-page app with state-based routing (no React Router needed for 2 views). Socket.IO events trigger automatic re-fetches. CSS uses custom properties for dark theme with severity-based color coding.

**My Thinking:**
I kept the frontend simple intentionally — no Redux, no React Router, no component library. The app has exactly 2 views and 4 components. Using `useState` for page routing is simpler and more readable than adding a router dependency for 2 pages.

The signal simulator was a creative addition — it lets reviewers test the system without needing to run the CLI script. Each scenario button sends a batch of signals that trigger the full ingestion pipeline.

---

## Prompt 7: Testing & Resilience

**Me:**
> Write unit tests for:
> 1. RCA validation — reject incomplete RCA on close
> 2. State transitions — valid and invalid paths
> 3. Ring buffer — overflow behavior, batch drain
> 4. Debouncer — threshold vs. timer flushing
>
> Also add retry logic for all database writes.

**AI Response Summary:**
33 unit tests across 4 test suites. All database operations wrapped in retry-with-backoff functions. Health endpoint reports status of all 3 data stores.

**My Thinking:**
The tests are focused on business logic that doesn't need database connections — pure unit tests that run fast and verify the core invariants:
- "You cannot close a work item without a complete RCA" (5 tests for different incomplete states)
- "The ring buffer never crashes, it drops oldest" (stress test with 50K inserts into 1K buffer)
- "100 signals for the same component = exactly 1 flush" (debouncer test)

Retry logic uses exponential backoff (500ms × attempt) for transient failures, which is standard practice for distributed systems.

---

## Prompt 8: Docker Compose & Integration

**Me:**
> Wire everything together with Docker Compose. Requirements:
> - PostgreSQL, MongoDB, Redis as infrastructure services
> - Backend depends on all 3 being healthy before starting
> - Frontend builds as static files served by Nginx, which proxies API calls to backend
> - One `docker-compose up --build` should start everything

**AI Response Summary:**
Docker Compose with health checks on all database services. Backend uses `depends_on: condition: service_healthy`. Nginx config proxies `/api/*`, `/health`, and `/socket.io/*` to the backend service.

**My Thinking:**
The health check approach is important — without it, the backend would try to connect to databases that aren't ready yet and crash. The retry logic in the connection modules handles the remaining startup race condition (databases healthy but not fully accepting connections).

---

## Summary of Design Decisions

| Decision | Choice | Alternative Considered | Why |
|----------|--------|----------------------|-----|
| Runtime | Node.js | Go, Python | Event loop fits async I/O; no need for goroutines at this scale |
| Backpressure | Ring buffer (drop-oldest) | Unbounded queue, blocking queue | Fixed memory, never crashes, observable |
| Alert classification | Strategy Pattern | switch/case | Open/Closed Principle, testable |
| Work item lifecycle | State Pattern | if/else chains | Each state encapsulates its rules |
| Debouncing | In-memory Map + timers | Redis-based | No network hop, single-threaded safety |
| Real-time | Socket.IO | SSE, polling | Bidirectional, built-in reconnection |
| Frontend routing | useState | React Router | Only 2 views, simpler is better |
| CSS | Vanilla CSS custom properties | Tailwind, CSS-in-JS | Full control, no dependencies |
