## Module: Deployment & Operations
## Owner: DevOps Team
## Phase: 5

---

## Purpose

Containerize the application, set up CI/CD pipelines, configure production
environment, and add monitoring/observability.

---

## Sub-Tasks

### 5.1 Docker Containerization
- backend/Dockerfile:
  - Node 20 Alpine base
  - Install dependencies, compile TypeScript
  - Copy built files + sql.js wasm
  - Run as non-root user
  - Expose PORT from env
- frontend/Dockerfile:
  - Node 20 Alpine for build
  - Nginx alpine for serving built static files
  - Reverse proxy: /api/* → backend:3000, / → frontend
- docker-compose.yml:
  - services: backend, frontend, nginx
  - volumes for SQLite DB file (bind mount)
  - environment variables from .env file
  - healthcheck for backend (/health/ready)

### 5.2 Environment Configuration
- backend/.env.production:
  - All required env vars documented with defaults
  - Production JWT_SECRET (generate 256-bit key)
  - SQLite DB path: /data/smpms.db
  - TELEMETRY_INTERVAL_MS: 10000 (10s)
  - COMMAND_TIMEOUT_CYCLES: 3
- secrets management: DO NOT commit .env files
- Use Docker secrets or K8s secrets for production

### 5.3 Database Migration (SQLite → PostgreSQL)
- Decision: Keep SQLite for MVP or migrate to PostgreSQL?
  - SQLite is fine for single-instance, low-to-medium traffic
  - If > 10 nodes or > 1000 telemetry/min → migrate to PostgreSQL
- If migrating: use Knex.js for migrations, update all repositories
- For now: document SQLite production limitations

### 5.4 CI/CD Pipeline (GitHub Actions)
- .github/workflows/ci.yml:
  - On push to main: npm install, tsc --noEmit, vitest run
  - On PR: same + coverage report
- .github/workflows/deploy.yml:
  - On merge to main: build Docker images, push to registry
  - Deploy to Railway/Render/Docker Hub (depending on hosting choice)
- Secrets: add DOCKER_REGISTRY_TOKEN, RAILWAY_TOKEN, etc. to GitHub secrets

### 5.5 Hosting & Infrastructure
- Options evaluated:
  a) Railway — easiest, ephemeral disk (SQLite not persisted!), add persistent disk
  b) Render — similar to Railway, persistent disks available
  c) DigitalOcean App Platform — more control
  d) Self-hosted VPS — full control, SQLite on mounted volume
- RECOMMENDED for MVP: Railway with persistent disk for SQLite
- Document deployment steps per chosen platform

### 5.6 Monitoring & Observability
- Add Prometheus metrics endpoint: GET /metrics
  - telemetry_ingestion_total (counter)
  - decision_evaluations_total (counter, labels: risk_level)
  - command_dispatched_total (counter)
  - alert_sent_total (counter, labels: channel)
  - active_nodes_gauge (gauge)
  - avg_pressure_gauge (gauge)
- Add structured logging: use pino logger
  - Log level from env: DEBUG, INFO, WARN, ERROR
  - Log format: JSON with timestamp, level, message, node_id (if relevant)
- Health endpoint enhancement:
  - GET /health/ready → checks DB connection + Telegram connectivity
  - GET /health/live → just returns 200 (for K8s liveness probe)

---

## Acceptance Criteria

- [ ] Docker build succeeds for both backend and frontend
- [ ] docker-compose up starts all services and they communicate
- [ ] Health endpoints return correct status
- [ ] CI pipeline runs tests and fails on test failures
- [ ] CD pipeline deploys on merge to main
- [ ] Prometheus metrics endpoint returns valid metrics format
- [ ] Structured logs output valid JSON to stdout
- [ ] All secrets documented and no hardcoded credentials

---

## Claude Code Usage Instructions

### Recommended Agent Strategy

1. **docker-patterns skill** — Use for Docker and Docker Compose patterns.
  Invoke with: /docker-patterns
  This ensures container security, networking, and volume best practices.

2. **deployment-patterns skill** — Use for CI/CD pipeline patterns.
  Invoke with: /deployment-patterns
  This helps design the GitHub Actions workflow correctly.

3. **Plan agent** — Before choosing hosting platform (5.5), use to
  evaluate Railway vs Render vs DigitalOcean based on project needs.

4. **code-reviewer agent** — After Dockerfiles are written, review for
   security (non-root user, no secrets in image, minimal base image).

### Execution Order

  1. Start with 5.1 (Docker) — foundation for everything else
  2. Then 5.2 (env config) — document all env vars
  3. Then 5.4 (CI/CD) — add GitHub Actions workflows
  4. Then 5.6 (monitoring) — metrics and logging (can run parallel)
  5. Then 5.5 (hosting) — deploy once CI/CD works
  6. Then 5.3 (DB migration) — only if SQLite proves insufficient

### Critical Files (Read First)

- `backend/package.json` (scripts, dependencies)
- `backend/tsconfig.json` (TypeScript config)
- `backend/src/main.ts` (entry point for Dockerfile CMD)
- `frontend/package.json` (build script)
- `frontend/vite.config.ts` or similar (build config)
- `.github/` directory (if exists)

### Docker Security Checklist

- [ ] Non-root user in Dockerfile (USER node)
- [ ] No secrets baked into image (use env vars at runtime)
- [ ] Minimal base image (Alpine variants)
- [ ] No .git or .env in image (use .dockerignore)
- [ ] Healthcheck defined in docker-compose
- [ ] Ports exposed minimally (only what's needed)