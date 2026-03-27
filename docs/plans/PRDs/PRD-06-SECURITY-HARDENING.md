## Module: Security & Hardening
## Owner: Security Team
## Phase: 6

---

## Purpose

Perform a full security audit, add rate limiting, improve input validation,
and harden the application against common attacks.

---

## Sub-Tasks

### 6.1 Security Audit
- Use security-reviewer agent on entire backend codebase
- Check for:
  - SQL injection (all repository queries must use parameterized statements)
  - XSS prevention (no raw HTML in responses)
  - JWT secret strength (reject weak secrets in config)
  - API key storage (plaintext? hashed?)
  - Rate limiting on auth endpoints (prevent brute force)
  - CORS configuration (whitelist specific origins only)
  - Helmet.js middleware for security headers
- Document all findings with severity (CRITICAL/HIGH/MEDIUM/LOW)

### 6.2 Rate Limiting
- Add express-rate-limit middleware
- Auth endpoints: 5 requests/min per IP (brute force protection)
- Telemetry endpoints: 200 requests/min per API key (prevent abuse)
- Dashboard endpoints: 60 requests/min per IP
- Alert actions (ack/resolve): 30 requests/min per user
- Config: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
- Return 429 Too Many Requests with Retry-After header

### 6.3 Input Validation Hardening (Round 2)
- Add schema validation for ALL incoming JSON bodies
- Use Zod for runtime validation (in addition to class-validator compile time)
- Validate:
  - node_id matches DMA-XX format (regex: ^DMA-0[1-8]$)
  - pressure is number between 0 and 20
  - valve_position is integer 0–100
  - timestamp is valid ISO8601 or epoch
- Reject any payload that doesn't match schema with 400 Bad Request

### 6.4 Authentication & Authorization
- Add JWT refresh token rotation
- Add logout endpoint (blacklist refresh token)
- Add role-based access: ADMIN can manage nodes, OPERATOR can view + override
- ESP API keys: consider hashing in database (currently stored plaintext?)
- Add API key rotation endpoint: POST /api/v1/nodes/:nodeId/rotate-key

### 6.5 HTTPS & TLS
- In production: backend must run behind TLS-terminating proxy (Nginx)
- Document Nginx config with:
  - TLS 1.2 minimum (disable TLS 1.0/1.1)
  - Strong cipher suite
  - HSTS header
  - Let's Encrypt for certificate management

### 6.6 Database Hardening
- Enable SQLite WAL mode for better concurrency
- Add database backup strategy (nightly .db file copy to S3/GCS)
- Set proper file permissions: chmod 600 for .db file
- Add indexes on: telemetry(node_id, timestamp), decisions(node_id, created_at),
  alerts(node_id, created_at), commands(node_id, status)
- Add database query timeout (prevent slow query DoS)

### 6.7 API Pagination & Limits
- Add pagination to all list endpoints:
  - GET /api/v1/alerts?page=1&limit=20
  - GET /api/v1/telemetry/:nodeId?page=1&limit=100
  - GET /api/v1/decisions/:nodeId?page=1&limit=50
- Add X-Total-Count, X-Page, X-Limit headers
- Enforce max page limit: 100 records per request

### 6.8 Log & Audit Trail
- Log all authentication events (login, logout, failed attempts)
- Log all manual valve override actions (who, when, which node, what position)
- Log all alert acknowledgment/resolution events
- Audit log table: id, user_id, action, resource, node_id, timestamp, ip_address
- Retention: 90 days for audit logs

---

## Acceptance Criteria

- [ ] security-reviewer agent reports no CRITICAL or HIGH vulnerabilities
- [ ] Rate limiting active on all endpoints with correct limits
- [ ] All payloads validated with Zod schema at runtime
- [ ] JWT refresh token rotation implemented
- [ ] Role-based access: ADMIN and OPERATOR roles
- [ ] API keys hashed in database (not plaintext)
- [ ] API key rotation endpoint works
- [ ] Nginx TLS config documented and tested
- [ ] SQLite WAL mode enabled
- [ ] Database indexes created on all query-heavy columns
- [ ] All list endpoints paginated with correct headers
- [ ] Audit log captures all sensitive operations
- [ ] Audit log retention policy documented (90 days)

---

## Claude Code Usage Instructions

### Recommended Agent Strategy

1. **security-reviewer agent** — MANDATORY before any deployment.
   Use PROACTIVELY on the entire backend codebase.
   Invoke with: /security-reviewer
   This flags secrets, injection, XSS, CSRF, auth issues.

2. **code-reviewer agent** — After fixing security issues, verify fixes
   don't break functionality.

3. **Plan agent** — For 6.4 (Auth/Authorization redesign), this is
   a significant change that needs careful planning.

### Execution Order (Security is Highest Priority)

  1. Start with 6.1 (security audit) — know what you're fixing first
  2. Then 6.2 (rate limiting) — quick win, high impact
  3. Then 6.3 (validation round 2) — reinforce input safety
  4. Then 6.7 (pagination) — easy, reduces DoS surface
  5. Then 6.4 (auth/authorization) — more complex, needs planning
  6. Then 6.6 (database hardening) — indexes, WAL, backups
  7. Then 6.5 (TLS) — depends on hosting decision (from PRD 5)
  8. Then 6.8 (audit trail) — log all the things

### Critical Files (Read First)

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.middleware.ts`
- `backend/src/repositories/*.ts` (all SQL queries)
- `backend/src/core/config.ts` (env var handling)
- `backend/src/main.ts` (middleware stack)
- `backend/src/modules/telemetry/telemetry.controller.ts`
- `backend/src/modules/command/command.controller.ts`

### Security Checklist (Per User's Rules)

Before marking ANY task in this PRD complete:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries — verify repo code)
- [ ] XSS prevention (sanitized HTML)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak sensitive data

### Key Libraries to Use

- express-rate-limit (rate limiting)
- zod (runtime schema validation)
- bcrypt (password hashing — already in use)
- helmet (security headers)
- pino (structured logging — from PRD 5)
- express-validator (additional validation layer)