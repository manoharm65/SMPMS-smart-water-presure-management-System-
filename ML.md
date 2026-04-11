# ML Model Section - Product Requirements Document (PRD)

## 1. Overview

The ML Model section provides **real-time leakage and anomaly detection** for the water distribution network. It uses machine learning to analyze telemetry data (pressure, flow rate, valve position) and predict potential issues like leaks, bursts, valve faults, and sensor anomalies.

---

## 2. What It Predicts

| Prediction Type | Description |
|-----------------|-------------|
| **Anomaly Detection** | Whether the current telemetry data represents abnormal behavior (IsolationForest) |
| **Event Classification** | Specific type of problem: `normal`, `leak`, `burst`, `sensor_fault`, `valve_fault`, `construction_damage`, `old_pipe_degradation` |
| **Risk Assessment** | LOW / MEDIUM / HIGH risk based on anomaly score vs threshold |
| **Trend Prediction** | "If condition persists" - predicts what problem will occur if current conditions continue |

---

## 3. Backend Logic Flow

### 3.1 Data Pipeline

```
Telemetry Data → Build Runtime CSV → Feature Engineering → ML Prediction → Store CSV
       ↑                                              ↓
Node Repository ←—— node_id, valve_position —— Telemetry Repository
```

### 3.2 Feature Engineering (`model_utils.py:55-147`)

The model creates **28 engineered features** from raw telemetry:

| Feature Category | Features |
|-----------------|----------|
| **Raw telemetry** | pressure, flow_rate, valve_position, supply_on, control_action, neighbor_pressure |
| **Temporal** | delta_pressure, delta_flow, pressure_gradient, pressure_gradient_abs |
| **Rolling stats** | pressure_roll_mean_5, pressure_roll_std_5, flow_roll_mean_5 |
| **Derived indices** | flow_pressure_ratio, burst_stress_index, vibration_acoustic_index |
| **Binary flags** | is_night, unexplained_pressure_drop, construction_flag |

### 3.3 ML Models Used

| Model | Purpose | Config |
|-------|---------|--------|
| **IsolationForest** | Anomaly detection | 300 estimators, 8% contamination |
| **RandomForestClassifier** | Event classification | 300 estimators, balanced classes |

The anomaly threshold is set at **95th percentile** of anomaly scores (top 5% most anomalous = flagged).

### 3.4 Scheduled & On-Demand Execution

- **Auto-run**: Enabled by default, runs every 5 minutes (`ML_AUTORUN_INTERVAL_MS`)
- **Manual trigger**: API endpoint `/ml/run` for on-demand prediction
- **Simulation**: Separate endpoint `/ml/simulate` for scenario-based testing

---

## 4. Frontend Integration

### 4.1 MlSimulation Page (`MlSimulation.tsx`)

User can:
1. **Adjust controls**: pressure, flow rate, valve position, pipe age, supply on/off, construction flag, sensor noise
2. **Select scenario**: auto-detected or manually chosen from 7 presets
3. **Run prediction**: calls `/ml/simulate` endpoint
4. **View results**: anomaly score, risk level, predicted problem, "if persists" prediction, top 3 probable problems

### 4.2 ZoneDetail Page

Shows "AI ANOMALY LOG — LEAKAGE ML" with:
- ML runtime status (idle/running/ok/error)
- Critical events with confidence levels
- "Run ML Now" button

---

## 5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ml/status` | GET | Returns ML runtime status (last run, errors, row counts) |
| `/ml/run` | POST | Triggers manual ML prediction run |
| `/ml/refresh` | POST | Triggers ML prediction and returns updated status |
| `/ml/simulate/scenarios` | GET | Returns available simulation scenarios |
| `/ml/simulate` | POST | Runs prediction for a specific scenario |

---

## 6. Configuration

All configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_AUTORUN_ENABLED` | true | Enable scheduled ML runs |
| `ML_AUTORUN_INTERVAL_MS` | 300000 | Run interval (5 minutes) |
| `ML_PYTHON_BIN` | python | Python executable |
| `ML_MODEL_FILE` | ./ml/artifacts/leakage_model.joblib | Model file path |
| `ML_PREDICT_INPUT_CSV` | ./ml/artifacts/runtime_input.csv | Input CSV path |
| `ML_PREDICTIONS_CSV_PATH` | ./ml/artifacts/predictions.csv | Output predictions |

---

## 7. Output Interpretation

When a prediction is returned:

| Field | Meaning |
|-------|---------|
| `anomaly_flag` | 1 = anomaly detected, 0 = normal |
| `anomaly_score` | Higher = more anomalous (threshold ~0.2-0.3) |
| `predicted_possible_problem` | Most likely current issue |
| `possible_problem_if_condition_persists` | What will happen if nothing changes |
| `risk_level` | LOW (score < threshold), MEDIUM (flagged), HIGH (score > 1.15× threshold) |

---

## 8. Technical Stack

- **Backend**: Node.js + TypeScript (ml-runtime.service.ts)
- **ML Runtime**: Python (scikit-learn, pandas, numpy)
- **Model Format**: joblib bundle (leakage_model.joblib)
- **Frontend**: React with Zustand store
- **Data Storage**: CSV files (no database)