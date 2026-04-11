## Unified Integration Plan: IWEDS + MPC + Leak Detection (Event-Driven, Advisory Control)

### Summary
Implement a backend-first integration layer that connects the three modules through shared event contracts, correlation IDs, and a single cross-module analytics API.  
Control policy remains **advisory** in Phase 1: IWEDS/Leak ML risk signals influence analytics and recommendations, but do not auto-block MPC commands.

### Key Implementation Changes
1. **Canonical Integration Contracts**
- Define a shared envelope for cross-module events: `event_id`, `source_module`, `node_id|dma_id|household_id`, `timestamp`, `risk_level`, `confidence`, `correlation_id`.
- Standardize risk vocabulary mapping across modules:
  - IWEDS: `NORMAL/SUSPECT/ILLEGAL`
  - Leak ML: anomaly + predicted event
  - MPC/Decision: `NORMAL/LOW/WARNING/CRITICAL`
- Add a mapping layer that normalizes all three into a common `integration_risk_state`.

2. **Integration Orchestrator Service (Backend)**
- Add an orchestrator that subscribes to existing event bus emissions and module outputs.
- Responsibilities:
  - Correlate telemetry/pressure, IWEDS illegal extraction events, Leak ML anomaly outputs, and MPC cycle results by zone/time windows.
  - Emit derived integration events (e.g., `RISK_CORRELATED`, `ZONE_RISK_UPDATED`, `MPC_ADVISORY_GENERATED`).
  - Persist correlation snapshots for analytics and audit (read-optimized integration table/view).
- Keep module ownership unchanged:
  - IWEDS keeps detection logic and webhook handling.
  - MPC keeps optimization and command dispatch.
  - ML runtime keeps training/inference loop.

3. **Unified Integration APIs (Phase 1 scope)**
- Add backend endpoints for cross-module consumers:
  - `GET /api/v1/integration/zones/:zoneId/risk` (latest unified risk + contributors)
  - `GET /api/v1/integration/zones/:zoneId/timeline` (correlated events across 3 modules)
  - `GET /api/v1/integration/summary` (system-wide KPIs: correlated incidents, active high-risk zones, IWEDS vs ML agreement rate)
- Add optional query filters: `from`, `to`, `severity`, `limit`.

4. **Advisory MPC Policy Integration**
- Add advisory computation only (no automatic command override):
  - Generate MPC advisory metadata such as `recommended_bound_tightening` or `operator_attention_required`.
  - Attach advisory info to MPC status/history responses without changing dispatch behavior.
- Manual/operator override precedence remains unchanged.

5. **Operational Readiness**
- Add structured logging and traceability with `correlation_id`.
- Add feature flags:
  - `INTEGRATION_ORCHESTRATION_ENABLED`
  - `INTEGRATION_ADVISORY_ENABLED`
- Add migration for integration persistence objects (table/view/indexes) with backfill from recent events.

### Test Plan
1. **Contract and Mapping Tests**
- Validate risk normalization for all module states and edge values.
- Validate event envelope schema and required fields.

2. **Correlation/Orchestration Tests**
- Synthetic flows where:
  - IWEDS illegal + ML leak anomaly + MPC cycle occur in same zone/time window.
  - Conflicting signals (e.g., IWEDS normal, ML anomaly) produce expected unified risk.
- Verify deduplication/idempotency for repeated event processing.

3. **API Tests**
- Integration endpoints return correct aggregated outputs and filtering behavior.
- Timeline ordering and pagination/limit behavior verified.

4. **Regression and Safety Tests**
- Confirm existing IWEDS APIs, MPC run cycle, and ML run/simulate endpoints remain behaviorally unchanged.
- Confirm advisory mode does not alter command dispatch decisions.

### Assumptions and Defaults
- Selected architecture: **event-driven orchestration**.
- Selected control mode: **advisory only** (no hard/soft control interlocks in Phase 1).
- Selected Phase 1 scope: **backend contracts + orchestration + APIs only**.
- Existing DB trigger path (`telemetry` → `pressure_readings`) remains source of pressure truth for IWEDS.
- Dashboard unification, alert automation, and auto-response workflows are deferred to Phase 2+.
