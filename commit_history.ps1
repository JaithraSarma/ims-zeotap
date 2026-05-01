git init

# 1. Initial setup
git add .gitignore
git commit -m "chore: initial project setup and gitignore"

# 2. Backend Base
git add backend/package.json backend/.env backend/src/server.js backend/src/middleware/
git commit -m "feat(backend): initialize express server and base config"

# 3. Database configs
git add backend/src/config/index.js
git commit -m "chore(config): centralize environment variables and config"

# 4. Postgres setup
git add backend/src/db/postgres.js backend/init.sql
git commit -m "feat(db): implement postgres pool with retry logic and schema"

# 5. Mongo setup
git add backend/src/db/mongo.js
git commit -m "feat(db): implement mongodb connection and indexing"

# 6. Redis setup
git add backend/src/db/redis.js
git commit -m "feat(db): implement redis client for dashboard caching"

# 7. Rate limiter
git add backend/src/ingestion/rateLimiter.js
git commit -m "feat(ingestion): add token bucket rate limiting middleware"

# 8. Ring Buffer
git add backend/src/ingestion/ringBuffer.js
git commit -m "feat(ingestion): implement O(1) drop-oldest ring buffer for backpressure"

# 9. Debouncer
git add backend/src/ingestion/debouncer.js
git commit -m "feat(ingestion): implement debounce engine for signal aggregation"

# 10. Patterns - Strategy
git add backend/src/patterns/alertStrategy.js
git commit -m "feat(patterns): implement Strategy pattern for severity mapping"

# 11. Patterns - State
git add backend/src/patterns/workItemState.js
git commit -m "feat(patterns): implement State pattern for incident lifecycle and RCA validation"

# 12. Services
git add backend/src/services/
git commit -m "feat(services): implement async signal processor and metrics tracker"

# 13. API Routes 1
git add backend/src/routes/signals.js backend/src/routes/health.js
git commit -m "feat(api): add signal ingestion and health check endpoints"

# 14. API Routes 2
git add backend/src/routes/workItems.js backend/src/routes/rca.js backend/src/routes/dashboard.js
git commit -m "feat(api): add work item CRUD, RCA, and dashboard endpoints"

# 15. Tests
git add backend/tests/
git commit -m "test: add comprehensive unit tests for patterns and ingestion layers"

# 16. Frontend Base
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx
git commit -m "feat(frontend): setup React 19 + Vite boilerplate"

# 17. Frontend Services
git add frontend/src/services/
git commit -m "feat(frontend): add API client and Socket.IO connection handling"

# 18. Frontend Styling
git add frontend/src/App.css
git commit -m "style(frontend): implement dark theme and premium design system"

# 19. Frontend Dashboard
git add frontend/src/App.jsx frontend/src/pages/Dashboard.jsx frontend/src/components/SignalSimulator.jsx
git commit -m "feat(frontend): build live dashboard view with signal simulator"

# 20. Frontend Detail
git add frontend/src/pages/IncidentDetail.jsx frontend/src/components/
git commit -m "feat(frontend): build incident detail view and RCA submission flow"

# 21. Docker Infrastructure
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf
git commit -m "chore(infra): add Dockerfiles for multi-stage builds and nginx proxy"

# 22. Orchestration
git add docker-compose.yml
git commit -m "chore(infra): configure docker-compose for full stack orchestration"

# 23. Mock Script
git add scripts/
git commit -m "test(scripts): add mock signal generator for various failure scenarios"

# 24. Docs
git add README.md
git commit -m "docs: add comprehensive README with architecture and setup instructions"

# 25. Planning Docs
git add docs/ prompt.md
git commit -m "docs: check in prompt engineering history and AI planning artifacts"

# Catch-all for anything missed
git add .
git commit -m "chore: final polish and minor fixes"
