from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = [
    "timestamp",
    "node_id",
    "pressure",
    "flow_rate",
    "valve_position",
    "supply_on",
    "control_action",
    "neighbor_pressure",
]


@dataclass
class FeatureBuildResult:
    dataframe: pd.DataFrame
    feature_columns: list[str]


def validate_input(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(
            "Input dataset is missing required columns: " + ", ".join(missing)
        )


def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    validate_input(df)
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    df = df.sort_values(["node_id", "timestamp"]).reset_index(drop=True)
    return df


def _rolling(group: pd.Series, window: int, stat: str) -> pd.Series:
    roll = group.rolling(window=window, min_periods=1)
    if stat == "mean":
        return roll.mean()
    if stat == "std":
        return roll.std().fillna(0.0)
    raise ValueError(f"Unsupported rolling stat: {stat}")


def build_features(df: pd.DataFrame) -> FeatureBuildResult:
    data = df.copy()

    if "construction_flag" not in data.columns:
        data["construction_flag"] = 0
    if "pipe_age_years" not in data.columns:
        data["pipe_age_years"] = 10
    if "ambient_temp_c" not in data.columns:
        data["ambient_temp_c"] = 27.0
    if "water_temp_c" not in data.columns:
        data["water_temp_c"] = 24.0
    if "vibration_amp" not in data.columns:
        data["vibration_amp"] = 0.0
    if "acoustic_db" not in data.columns:
        data["acoustic_db"] = 0.0
    if "material_risk_score" not in data.columns:
        data["material_risk_score"] = 0.35
    if "traffic_load_index" not in data.columns:
        data["traffic_load_index"] = 0.2
    if "soil_movement_index" not in data.columns:
        data["soil_movement_index"] = 0.15
    if "node_elevation_m" not in data.columns:
        data["node_elevation_m"] = 0.0
    if "neighbor_elevation_m" not in data.columns:
        data["neighbor_elevation_m"] = 0.0
    if "pipe_segment_length_m" not in data.columns:
        data["pipe_segment_length_m"] = 100.0

    by_node = data.groupby("node_id", group_keys=False)

    data["delta_pressure"] = by_node["pressure"].diff().fillna(0.0)
    data["delta_flow"] = by_node["flow_rate"].diff().fillna(0.0)
    data["prev_valve_position"] = by_node["valve_position"].shift(1).fillna(data["valve_position"])
    data["pressure_lag_2"] = by_node["pressure"].shift(2).fillna(by_node["pressure"].shift(1)).fillna(data["pressure"])
    data["pressure_gradient"] = data["pressure"] - data["neighbor_pressure"]
    data["pressure_gradient_abs"] = data["pressure_gradient"].abs()
    elevation_delta_m = data["node_elevation_m"] - data["neighbor_elevation_m"]
    safe_pipe_length = data["pipe_segment_length_m"].clip(lower=1.0)
    data["hydraulic_grade_angle_deg"] = np.degrees(np.arctan2(elevation_delta_m, safe_pipe_length))

    data["pressure_roll_mean_5"] = by_node["pressure"].transform(
        lambda s: _rolling(s, window=5, stat="mean")
    )
    data["pressure_roll_std_5"] = by_node["pressure"].transform(
        lambda s: _rolling(s, window=5, stat="std")
    )
    data["flow_roll_mean_5"] = by_node["flow_rate"].transform(
        lambda s: _rolling(s, window=5, stat="mean")
    )

    data["flow_pressure_ratio"] = data["flow_rate"] / (data["pressure"] + 0.1)
    data["temp_delta_c"] = data["ambient_temp_c"] - data["water_temp_c"]
    data["vibration_acoustic_index"] = data["vibration_amp"] * (data["acoustic_db"] / 100.0)
    data["burst_stress_index"] = (
        data["pressure_gradient_abs"] * 0.35
        + data["vibration_amp"] * 0.25
        + data["acoustic_db"] * 0.015
        + data["temp_delta_c"].abs() * 0.10
        + data["traffic_load_index"] * 1.8
        + data["soil_movement_index"] * 1.9
        + data["material_risk_score"] * 2.2
    )
    data["is_night"] = data["timestamp"].dt.hour.between(0, 4).astype(int)
    data["unexplained_pressure_drop"] = (
        (data["delta_pressure"] < -0.6)
        & (data["control_action"] == 0)
        & (data["supply_on"] == 0)
    ).astype(int)

    feature_columns = [
        "pressure",
        "flow_rate",
        "valve_position",
        "supply_on",
        "control_action",
        "neighbor_pressure",
        "prev_valve_position",
        "pressure_lag_2",
        "construction_flag",
        "pipe_age_years",
        "node_elevation_m",
        "neighbor_elevation_m",
        "pipe_segment_length_m",
        "hydraulic_grade_angle_deg",
        "ambient_temp_c",
        "water_temp_c",
        "temp_delta_c",
        "vibration_amp",
        "acoustic_db",
        "vibration_acoustic_index",
        "material_risk_score",
        "traffic_load_index",
        "soil_movement_index",
        "delta_pressure",
        "delta_flow",
        "pressure_gradient",
        "pressure_gradient_abs",
        "pressure_roll_mean_5",
        "pressure_roll_std_5",
        "flow_roll_mean_5",
        "flow_pressure_ratio",
        "burst_stress_index",
        "is_night",
        "unexplained_pressure_drop",
    ]

    for column in feature_columns:
        data[column] = pd.to_numeric(data[column], errors="coerce").fillna(0.0)

    return FeatureBuildResult(dataframe=data, feature_columns=feature_columns)


def as_feature_matrix(df: pd.DataFrame, feature_columns: list[str]) -> np.ndarray:
    return df[feature_columns].to_numpy(dtype=float)


def explain_label(label: str) -> str:
    mapping: dict[str, str] = {
        "normal": "No confirmed issue",
        "leak": "Likely continuous leak",
        "burst": "Likely pipe burst",
        "sensor_fault": "Likely sensor issue",
        "valve_fault": "Likely valve malfunction",
        "construction_damage": "Likely construction impact",
        "old_pipe_degradation": "Likely aging pipe degradation",
    }
    return mapping.get(label, "Unclassified event")


def build_alert_records(
    raw_df: pd.DataFrame,
    enriched_df: pd.DataFrame,
    anomaly_flags: np.ndarray,
    anomaly_scores: np.ndarray,
    predicted_labels: list[str],
) -> pd.DataFrame:
    output = raw_df.copy()
    output["anomaly_flag"] = anomaly_flags.astype(int)
    output["anomaly_score"] = anomaly_scores
    output["predicted_event"] = predicted_labels
    output["event_explanation"] = [explain_label(v) for v in predicted_labels]
    output["unexplained_pressure_drop"] = enriched_df["unexplained_pressure_drop"].values
    output["pressure_gradient_abs"] = enriched_df["pressure_gradient_abs"].values
    return output


def model_metadata_row(bundle: dict[str, Any]) -> dict[str, Any]:
    meta = bundle.get("metadata", {})
    return {
        "model_version": meta.get("model_version", "unknown"),
        "trained_at": meta.get("trained_at", "unknown"),
        "anomaly_threshold": bundle.get("anomaly_threshold", 0.0),
        "feature_count": len(bundle.get("feature_columns", [])),
    }
