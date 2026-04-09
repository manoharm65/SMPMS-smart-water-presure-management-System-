from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta

import joblib
import numpy as np
import pandas as pd

from model_utils import as_feature_matrix, build_features


SCENARIOS = [
    "normal",
    "sudden_drop_no_action_supply_off",
    "high_flow_low_pressure",
    "erratic_pressure_sensor_issue",
    "valve_fault_signature",
    "construction_damage_signature",
    "old_pipe_degradation_signature",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simulate condition-based water network cases and predict likely issue"
    )
    parser.add_argument(
        "--model",
        default="artifacts/leakage_model.joblib",
        help="Path to trained model bundle",
    )
    parser.add_argument(
        "--scenario",
        default="all",
        choices=["all", *SCENARIOS],
        help="Scenario to run",
    )
    parser.add_argument(
        "--out",
        default="artifacts/scenario_simulation_results.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--json-stdout",
        action="store_true",
        help="Emit machine-readable JSON result markers to stdout",
    )
    return parser.parse_args()


def _row(ts: datetime, node_id: str, pressure: float, flow_rate: float, valve_position: int, supply_on: int, control_action: int, neighbor_pressure: float, pipe_age_years: int = 12, construction_flag: int = 0) -> dict[str, object]:
    return {
        "timestamp": ts.isoformat(),
        "node_id": node_id,
        "pressure": pressure,
        "flow_rate": flow_rate,
        "valve_position": valve_position,
        "supply_on": supply_on,
        "control_action": control_action,
        "neighbor_pressure": neighbor_pressure,
        "pipe_age_years": pipe_age_years,
        "construction_flag": construction_flag,
    }


def build_scenario_rows(name: str) -> pd.DataFrame:
    start = datetime.now(UTC) - timedelta(minutes=50)
    node_id = "SIM-01"

    if name == "normal":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, 4.3, 29.0 + (i % 2), 55, 1, 0, 4.2)
            for i in range(6)
        ]
        return pd.DataFrame(vals)

    if name == "sudden_drop_no_action_supply_off":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, 23.0, 52, 0, 0, 4.1)
            for i, p in enumerate([4.2, 4.1, 4.0, 3.8, 3.1, 2.1])
        ]
        return pd.DataFrame(vals)

    if name == "high_flow_low_pressure":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, f, 60, 1, 0, 4.3)
            for i, (p, f) in enumerate(
                [(4.1, 30), (3.9, 34), (3.7, 39), (3.3, 44), (2.9, 51), (2.4, 56)]
            )
        ]
        return pd.DataFrame(vals)

    if name == "erratic_pressure_sensor_issue":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, 27.0, 54, 1, 0, 4.2)
            for i, p in enumerate([4.2, 1.2, 5.8, 1.0, 6.1, 4.3])
        ]
        return pd.DataFrame(vals)

    if name == "valve_fault_signature":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, 24.0, v, 1, 0, 4.2)
            for i, (p, v) in enumerate([(4.2, 55), (4.1, 52), (4.0, 50), (2.8, 5), (2.7, 3), (2.9, 2)])
        ]
        return pd.DataFrame(vals)

    if name == "construction_damage_signature":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, f, 56, 1, 0, 4.1, construction_flag=1)
            for i, (p, f) in enumerate([(4.1, 25), (4.0, 26), (3.8, 28), (3.2, 33), (2.8, 36), (2.5, 39)])
        ]
        return pd.DataFrame(vals)

    if name == "old_pipe_degradation_signature":
        vals = [
            _row(start + timedelta(minutes=10 * i), node_id, p, f, 55, 1, 0, 4.1, pipe_age_years=24)
            for i, (p, f) in enumerate([(4.2, 24), (4.0, 25), (3.9, 26), (3.7, 27), (3.6, 29), (3.4, 30)])
        ]
        return pd.DataFrame(vals)

    raise ValueError(f"Unknown scenario: {name}")


def simulate_one(bundle: dict, name: str) -> dict[str, object]:
    raw_df = build_scenario_rows(name)
    raw_df["timestamp"] = pd.to_datetime(raw_df["timestamp"], errors="coerce")
    feat = build_features(raw_df)
    x = as_feature_matrix(feat.dataframe, bundle["feature_columns"])
    x_scaled = bundle["scaler"].transform(x)

    anomaly_model = bundle["anomaly_model"]
    anomaly_scores = -anomaly_model.score_samples(x_scaled)
    anomaly_threshold = float(bundle["anomaly_threshold"])

    idx = len(raw_df) - 1
    anomaly_score = float(anomaly_scores[idx])
    anomaly_flag = int(anomaly_score >= anomaly_threshold)

    classifier = bundle.get("classifier")
    label_encoder = bundle.get("label_encoder")
    predicted_event = "unknown_anomaly" if anomaly_flag else "normal"
    top3 = ""
    likely_issue_if_persists = "normal"

    if classifier is not None and label_encoder is not None:
        pred_idx = int(classifier.predict(x_scaled[idx : idx + 1])[0])
        predicted_event = str(label_encoder.inverse_transform([pred_idx])[0])
        if anomaly_flag == 0 and predicted_event != "normal":
            predicted_event = "normal"

        probs = classifier.predict_proba(x_scaled[idx : idx + 1])[0]
        classes = list(label_encoder.classes_)
        ranked = sorted(zip(classes, probs), key=lambda x: float(x[1]), reverse=True)[:3]
        top3 = " | ".join(f"{label}:{prob:.2f}" for label, prob in ranked)

        ranked_non_normal = [x for x in sorted(zip(classes, probs), key=lambda x: float(x[1]), reverse=True) if x[0] != "normal"]
        if ranked_non_normal:
            if float(ranked_non_normal[0][1]) >= 0.25:
                likely_issue_if_persists = str(ranked_non_normal[0][0])

    last = feat.dataframe.iloc[idx]
    ml_model_message = (
        f"Anomaly={'YES' if anomaly_flag == 1 else 'NO'} | "
        f"Likely problem now: {predicted_event} | "
        f"If condition persists: {likely_issue_if_persists}"
    )
    return {
        "scenario": name,
        "pressure": float(last["pressure"]),
        "flow_rate": float(last["flow_rate"]),
        "supply_on": int(last["supply_on"]),
        "control_action": int(last["control_action"]),
        "unexplained_pressure_drop": int(last["unexplained_pressure_drop"]),
        "anomaly_flag": anomaly_flag,
        "anomaly_score": anomaly_score,
        "anomaly_threshold": anomaly_threshold,
        "predicted_possible_problem": predicted_event,
        "possible_problem_if_condition_persists": likely_issue_if_persists,
        "ml_model_message": ml_model_message,
        "top3_probable_problems": top3,
    }


def main() -> None:
    args = parse_args()
    bundle = joblib.load(args.model)

    scenario_list = SCENARIOS if args.scenario == "all" else [args.scenario]
    results = [simulate_one(bundle, name) for name in scenario_list]
    out_df = pd.DataFrame(results)
    out_df.to_csv(args.out, index=False)

    print(f"Simulation results saved to: {args.out}")
    print(out_df.to_string(index=False))
    if args.json_stdout:
        payload = {
            "results": results,
            "available_scenarios": SCENARIOS,
        }
        print("JSON_RESULT_START")
        print(json.dumps(payload))
        print("JSON_RESULT_END")


if __name__ == "__main__":
    main()
