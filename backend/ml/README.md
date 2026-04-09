# Leakage Detection AI Model (SMPMS)

This folder contains a production-friendly baseline model pipeline for pressure anomaly detection and root-cause classification.

The model focuses on your exact use case:

- detect abrupt pressure changes between nodes
- detect events with no operator valve action
- detect suspicious pressure drops while supply is off
- classify likely causes such as leak, burst, old pipe degradation, valve fault, sensor fault, and construction damage

## 1) What is implemented

1. `generate_synthetic_dataset.py`
- creates realistic labeled training data for fast testing

2. `train.py`
- trains an anomaly detector (`IsolationForest`)
- optionally trains a cause classifier (`RandomForestClassifier`) when `event_label` exists
- saves model bundle in `artifacts/`

3. `predict.py`
- scores new telemetry data
- marks anomalies
- predicts event class
- exports predictions to CSV for API/UI integration

4. `model_utils.py`
- shared feature engineering and input validation

## 2) Data schema required

Required CSV columns:

- `timestamp` (ISO datetime)
- `node_id`
- `pressure`
- `flow_rate`
- `valve_position`
- `supply_on` (`0` or `1`)
- `control_action` (`0` or `1`, where `1` means valve/pump command happened)
- `neighbor_pressure`

Optional columns:

- `event_label` (for supervised root-cause training)
- `pipe_age_years`
- `construction_flag`

## 3) Features used by model

- raw telemetry: pressure, flow, valve position, supply and control flags
- pressure differential vs neighbor node
- pressure and flow deltas
- rolling pressure mean/std
- flow-pressure ratio
- night-time indicator
- unexplained pressure-drop flag:
  - pressure dropped sharply
  - no control action happened
  - supply was off

This unexplained-drop feature directly captures your requirement.

## 4) Installation

From `backend/ml`:

```bash
pip install -r requirements.txt
```

## 5) Quick start

1. Generate sample training data

```bash
python generate_synthetic_dataset.py --out data/synthetic_training_data.csv
```

2. Train the model

```bash
python train.py --data data/synthetic_training_data.csv --out artifacts/leakage_model.joblib
```

3. Run predictions

```bash
python predict.py --model artifacts/leakage_model.joblib --data data/synthetic_training_data.csv --out artifacts/predictions.csv
```

## 6) Output fields in predictions.csv

- `anomaly_flag` (`0` normal, `1` anomaly)
- `anomaly_score` (higher means more abnormal)
- `predicted_event` (`normal`, `leak`, `burst`, etc.)
- `event_explanation`
- `unexplained_pressure_drop`
- `pressure_gradient_abs`

## 7) How to connect into your current app

Recommended architecture:

1. Backend service
- run this model as a Python microservice (FastAPI/Flask) or periodic batch scorer
- ingest telemetry from your existing backend database

2. API endpoint
- expose scored anomalies through backend route:
  - `GET /api/v1/dashboard/zones/:zoneId/anomalies`

3. Frontend integration
- show model confidence and root-cause in `frontend/src/pages/Analytics.tsx`
- optionally add a dedicated tab: `Leakage AI`

### Built-in backend runtime integration

This repository now includes backend ML runtime endpoints and scheduler support:

- `GET /api/v1/dashboard/ml/status`
- `POST /api/v1/dashboard/ml/run`

Environment flags in `backend/.env`:

- `ML_AUTORUN_ENABLED=true`
- `ML_AUTORUN_INTERVAL_MS=300000`
- `ML_PYTHON_BIN=python`
- `ML_MODEL_FILE=./ml/artifacts/leakage_model.joblib`
- `ML_PREDICT_INPUT_CSV=./ml/artifacts/runtime_input.csv`
- `ML_PREDICTIONS_CSV=./ml/artifacts/predictions.csv`

## 7.1) Backend-integrated refresh (already wired)

The backend now supports model refresh orchestration directly.

Endpoints:

- `GET /api/v1/dashboard/ml/status`
- `POST /api/v1/dashboard/ml/refresh`

Scheduler controls via `.env`:

- `ML_REFRESH_ENABLED=true|false`
- `ML_REFRESH_INTERVAL_MS=300000`
- `ML_PYTHON_CMD=python`
- `ML_MODEL_FILE=./ml/artifacts/leakage_model.joblib`
- `ML_INFERENCE_INPUT_CSV=./ml/artifacts/inference_input.csv`
- `ML_PREDICTIONS_CSV=./ml/artifacts/predictions.csv`

Flow:

1. Backend reads latest telemetry from DB
2. Backend creates inference input CSV
3. Backend runs `predict.py`
4. Backend writes predictions CSV
5. Dashboard anomalies endpoint serves ML events

## 8) Which page should host this model in your UI

Best page to start: `Analytics`.

Why:

- it already contains pressure analysis views
- operators expect anomaly intelligence there
- minimal UX disruption

Recommended rollout:

1. Phase 1: add anomaly cards and event timeline in Analytics
2. Phase 2: add drill-down from Analytics to Zone Detail
3. Phase 3: add map overlays for leak probability in Map View

## 9) Real datasets you can use next

- BATADAL / C-Town benchmark
- LeakDB
- BattLeDIM / L-TOWN benchmark
- your own telemetry + maintenance logs (most important)

## 10) Model limitations (important)

- synthetic data is only for bootstrapping
- domain adaptation is required before production
- thresholds must be tuned per DMA zone
- always keep rule-based safety checks in parallel with ML
