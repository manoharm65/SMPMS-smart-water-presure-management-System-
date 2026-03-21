## Module: Backend Completion & Testing
## Owner: Backend Team
## Phase: 1

---

## Purpose

Complete the backend implementation by adding comprehensive unit tests,
integration tests, robust error handling, and input validation gaps.
The backend currently has all modules implemented but no test coverage.

---

## Sub-Tasks

### 1.1 Unit Tests — Decision Engine
- File: `src/modules/decision/rule.engine.test.ts`
- Cover all 5 pressure bands (CRITICAL_HIGH, CRITICAL_LOW, WARNING_HIGH, NORMAL_LOW, else)
- Test confidence score formula determinism
- Test valve position calculations (min 0, max 100 bounds)
- Test history array usage (last 10 readings passed in)
- Use TDD approach: write tests first, then verify against existing rule.engine.ts

### 1.2 Unit Tests — Command Lifecycle
- File: `src/modules/command/command.service.test.ts`
- Test command state machine: PENDING → DISPATCHED → EXECUTED/FAILED/TIMEOUT
- Test queue logic: CRITICAL replaces, WARNING queues, manual replaces
- Test auto-revert on CRITICAL when in override mode
- Test timeout detection (mock time progression)
- Test manual override and revert-to-auto flows

### 1.3 Unit Tests — Telemetry Service
- File: `src/modules/telemetry/telemetry.service.test.ts`
- Test create() stores and emits TELEMETRY_RECEIVED
- Test createForEsp() piggybacks pending command
- Test syncBuffered() bulk insert behavior

### 1.4 Integration Tests — API Endpoints
- File: `src/__tests__/api.test.ts` (or `tests/api/` directory)
- Use Supertest + the Express app
- Test all auth endpoints (register, login, profile)
- Test ESP register + telemetry flow end-to-end
- Test dashboard API responses match exact field shapes from DASHBOARD_API.md
- Test command ACK flow
- Test valve override and revert endpoints

### 1.5 Input Validation Hardening
- Review all DTOs in `src/modules/*/dto/`
- Ensure all user input (auth, dashboard, node) is validated with class-validator
- Add Zod schema validation as second layer for ESP payloads
- Validate pressure ranges (0–20 BAR sanity check)
- Validate valve position (0–100 integer)
- Validate node_id format (DMA-XX regex)

### 1.6 Error Handling Audit
- Ensure all repository methods return proper error types
- Add global error handler middleware in main.ts
- Ensure 401/403/404/500 responses are consistent
- Ensure no error leaks sensitive data (stack traces to client)

---

## Acceptance Criteria

- [ ] Decision engine unit tests: all 5 pressure bands + confidence formula + bounds
- [ ] Command service unit tests: state machine, queue, auto-revert, timeout
- [ ] Telemetry service unit tests: create, createForEsp, syncBuffered
- [ ] Integration tests: all major API flows covered
- [ ] All DTOs have validation decorators
- [ ] No unhandled promise rejections in any module
- [ ] Error responses never leak internal paths or stack traces

---

## Claude Code Usage Instructions

### Recommended Agent Strategy

1. **tdd-guide agent** — Use PROACTIVELY before writing any test code.
   Invoke with: /tdd-guide
   This enforces write-tests-first workflow. Do NOT write implementation
   code before the tests exist.

2. **code-reviewer agent** — After each test file is written and passing,
   invoke to review test quality and coverage.

3. **Use parallel agents** for 1.1, 1.2, 1.3 (unit tests) since they are
   independent — launch 3 tdd-guide agents in parallel, one per test file.

### Workflow Per Sub-Task

  a. Use tdd-guide agent → it will scaffold tests FIRST (RED phase)
  b. Run tests — they should fail (no implementation yet)
  c. Implement the module to make tests pass (GREEN phase)
  d. Use code-reviewer agent to review the implementation
  e. Refactor if needed (IMPROVE phase)
  f. Verify coverage is 80%+

### Critical Files (Read First)

- `src/modules/decision/rule.engine.ts`
- `src/modules/decision/decision.service.ts`
- `src/modules/command/command.service.ts`
- `src/modules/telemetry/telemetry.service.ts`
- `src/modules/decision/decision.interface.ts`
- `src/core/event-bus.ts`
- `src/core/constants.ts`

### Test Framework

- Use Vitest (modern, fast, TypeScript-native)
- Use Supertest for API integration tests
- Mock the event bus and database layer with vi.mock()
- DO NOT use the real database for unit tests — mock repositories

### Coverage Target

- Minimum 80% line coverage
- Critical paths (decision engine, command queue) should be 95%+