## Module: Decision Engine
## File: src/modules/decision/

---

## Purpose
Evaluate incoming telemetry, classify risk, generate a confidence
score, produce an action recommendation, and emit events for the
alert and command modules.

---

## Input Contract (from TelemetryService via event bus)

{
  node_id: string,          // "DMA-01"
  pressure: number,         // BAR, float
  valve_position: number,   // %, integer
  timestamp: string
}

---

## Output Contract (IMMUTABLE — ML swap must match this exactly)

{
  node_id: string,
  risk_level: "LOW" | "NORMAL" | "WARNING" | "CRITICAL",
  action: "NONE" | "REDUCE_FLOW" | "INCREASE_FLOW" | "EMERGENCY_CLOSE",
  recommended_valve_position: number,   // % integer
  confidence: number,                   // 0.00 – 1.00
  reason: string,                       // human-readable
  requires_alert: boolean,
  alert_severity: "ok" | "warn" | "crit" | "low"
}

---

## Thresholds (read from config, not hardcoded)

PRESSURE_CRITICAL_HIGH = 5.5 BAR   → CRITICAL
PRESSURE_WARNING_HIGH  = 4.5 BAR   → WARNING
PRESSURE_NORMAL_LOW    = 2.5 BAR   → LOW
PRESSURE_CRITICAL_LOW  = 1.5 BAR   → CRITICAL (possible leak)

---

## Rule Logic (in priority order)

1. pressure > CRITICAL_HIGH
   → risk: CRITICAL
   → action: REDUCE_FLOW
   → recommended_valve: current_position - 20 (min 0)
   → reason: "Overpressure detected"
   → requires_alert: true
   → alert_severity: "crit"

2. pressure < CRITICAL_LOW
   → risk: CRITICAL
   → action: INCREASE_FLOW
   → recommended_valve: current_position + 20 (max 100)
   → reason: "Critical low pressure — possible leakage"
   → requires_alert: true
   → alert_severity: "crit"

3. pressure > WARNING_HIGH
   → risk: WARNING
   → action: REDUCE_FLOW
   → recommended_valve: current_position - 10 (min 0)
   → reason: "Elevated pressure reading"
   → requires_alert: true
   → alert_severity: "warn"

4. pressure < NORMAL_LOW
   → risk: LOW
   → action: INCREASE_FLOW
   → recommended_valve: current_position + 10 (max 100)
   → reason: "Below normal pressure range"
   → requires_alert: true
   → alert_severity: "low"

5. else
   → risk: NORMAL
   → action: NONE
   → recommended_valve: current_position
   → reason: "Pressure within normal range"
   → requires_alert: false
   → alert_severity: "ok"

---

## Confidence Score (mock, deterministic)

Confidence represents how certain the engine is about its
classification. Derived from pressure deviation from threshold.

Formula:

deviation = | pressure - nearest_threshold | / nearest_threshold
confidence = min(0.50 + (deviation * 2.5), 0.99)

Examples:
- Pressure 6.20, threshold 5.5 → deviation 0.127 → confidence 0.82
- Pressure 3.49 (normal)       → deviation from 2.5 = 0.396 → confidence 0.99
- Pressure 4.60, threshold 4.5 → deviation 0.022 → confidence 0.55

Floor: confidence never below 0.50
Cap:   confidence never above 0.99 (ML humility principle)

---

## Anomaly Log Entry (for frontend AI Log panel)

Each CRITICAL or WARNING decision must also produce:

{
  node_id: string,
  confidence: number,
  severity: "crit" | "warn",
  message: string,          // same as reason
  model: "Rule Engine v1",  // swap to "Isolation Forest + LSTM" when ML added
  timestamp: string
}

Store in decisions table.
Expose via GET /api/v1/decisions/:nodeId/anomalies

---

## Events Emitted

On CRITICAL or WARNING:
  → emit ALERT_TRIGGERED (payload: decision output)
  → emit ACTION_DISPATCHED (payload: decision output)

On LOW:
  → emit ALERT_TRIGGERED only

On NORMAL:
  → no events emitted

---

## Interface (for future ML swap)

export interface IDecisionEngine {
  evaluate(
    telemetry: TelemetryInput,
    history: TelemetryInput[]   // last 10 readings for this node
  ): DecisionOutput;
}

RuleEngine implements IDecisionEngine
MLEngine implements IDecisionEngine   // future

History is fetched by DecisionService before calling engine.
Engine itself never touches the database.

---

## Acceptance Criteria

- evaluate() returns correct risk level for all 5 pressure bands
- confidence score is deterministic (same input = same output)
- anomaly log entry created for CRITICAL and WARNING
- ALERT_TRIGGERED emitted correctly
- ACTION_DISPATCHED emitted for CRITICAL and WARNING only
- engine has zero database imports