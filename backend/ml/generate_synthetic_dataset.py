from __future__ import annotations

import argparse
from datetime import datetime, timedelta, UTC
import random

import numpy as np
import pandas as pd


LABELS = [
    "normal",
    "leak",
    "burst",
    "sensor_fault",
    "valve_fault",
    "construction_damage",
    "old_pipe_degradation",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic SMPMS training data")
    parser.add_argument("--out", default="data/synthetic_training_data.csv")
    parser.add_argument("--nodes", type=int, default=8)
    parser.add_argument("--hours", type=int, default=24 * 21)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def pick_label() -> str:
    return random.choices(
        LABELS,
        weights=[0.86, 0.05, 0.02, 0.025, 0.02, 0.015, 0.01],
        k=1,
    )[0]


def row_from_label(
    node_id: str,
    ts: datetime,
    base_pressure: float,
    base_flow: float,
    pipe_age_years: int,
    material_risk_score: float,
) -> dict[str, object]:
    label = pick_label()
    supply_on = 1 if 5 <= ts.hour <= 22 else 0
    control_action = 1 if random.random() < 0.03 else 0
    valve_position = int(np.clip(np.random.normal(58, 14), 5, 100))
    construction_flag = 1 if random.random() < 0.03 else 0
    traffic_load_index = float(np.clip(np.random.normal(0.45, 0.2), 0.0, 1.0))
    soil_movement_index = float(np.clip(np.random.normal(0.25, 0.18), 0.0, 1.0))

    pressure = np.random.normal(base_pressure, 0.22)
    flow_rate = np.random.normal(base_flow, 1.8)
    neighbor_pressure = np.random.normal(base_pressure - 0.15, 0.25)
    # Temperature, vibration, and acoustic channels come from the PDF factors.
    ambient_temp_c = np.random.normal(30.0, 4.5)
    water_temp_c = np.random.normal(27.0, 2.7)
    vibration_amp = np.random.normal(2.0, 0.6)
    acoustic_db = np.random.normal(48.0, 6.5)

    if label == "leak":
        pressure -= np.random.uniform(0.5, 1.1)
        flow_rate += np.random.uniform(1.0, 3.8)
        vibration_amp += np.random.uniform(0.8, 2.0)
        acoustic_db += np.random.uniform(5.0, 12.0)
    elif label == "burst":
        pressure -= np.random.uniform(1.4, 2.7)
        flow_rate += np.random.uniform(4.0, 8.0)
        vibration_amp += np.random.uniform(1.7, 3.4)
        acoustic_db += np.random.uniform(10.0, 20.0)
        pressure += np.random.uniform(0.0, 2.8) if random.random() < 0.25 else 0.0
        traffic_load_index = float(np.clip(traffic_load_index + np.random.uniform(0.2, 0.5), 0.0, 1.0))
        soil_movement_index = float(np.clip(soil_movement_index + np.random.uniform(0.15, 0.45), 0.0, 1.0))
    elif label == "sensor_fault":
        pressure += np.random.uniform(1.5, 3.0) * random.choice([-1, 1])
        acoustic_db += np.random.uniform(-2.0, 2.0)
    elif label == "valve_fault":
        control_action = 0
        valve_position = int(np.clip(valve_position + np.random.uniform(-45, 45), 0, 100))
        pressure += np.random.uniform(0.9, 1.7) * random.choice([-1, 1])
    elif label == "construction_damage":
        construction_flag = 1
        pressure -= np.random.uniform(0.7, 1.6)
        flow_rate += np.random.uniform(1.6, 3.6)
        vibration_amp += np.random.uniform(1.2, 2.8)
        acoustic_db += np.random.uniform(6.0, 15.0)
        traffic_load_index = float(np.clip(traffic_load_index + np.random.uniform(0.25, 0.55), 0.0, 1.0))
        soil_movement_index = float(np.clip(soil_movement_index + np.random.uniform(0.2, 0.6), 0.0, 1.0))
    elif label == "old_pipe_degradation":
        pressure -= np.random.uniform(0.3, 0.8)
        flow_rate += np.random.uniform(0.8, 2.0)
        pipe_age_years = max(pipe_age_years, 18)
        acoustic_db += np.random.uniform(2.0, 8.0)
        material_risk_score = float(np.clip(material_risk_score + np.random.uniform(0.15, 0.35), 0.0, 1.0))

    # Heat and sudden cooling impact mechanical stress in the PDF notes.
    if random.random() < 0.08:
        ambient_temp_c += np.random.uniform(4.5, 8.5)
    if random.random() < 0.06:
        ambient_temp_c -= np.random.uniform(4.0, 7.0)

    return {
        "timestamp": ts.isoformat(),
        "node_id": node_id,
        "pressure": float(np.clip(pressure, 0.2, 8.5)),
        "flow_rate": float(np.clip(flow_rate, 0.0, 120.0)),
        "valve_position": valve_position,
        "supply_on": supply_on,
        "control_action": control_action,
        "neighbor_pressure": float(np.clip(neighbor_pressure, 0.2, 8.5)),
        "ambient_temp_c": float(np.clip(ambient_temp_c, 5.0, 55.0)),
        "water_temp_c": float(np.clip(water_temp_c, 5.0, 45.0)),
        "vibration_amp": float(np.clip(vibration_amp, 0.0, 20.0)),
        "acoustic_db": float(np.clip(acoustic_db, 20.0, 130.0)),
        "pipe_age_years": pipe_age_years,
        "material_risk_score": material_risk_score,
        "traffic_load_index": traffic_load_index,
        "soil_movement_index": soil_movement_index,
        "construction_flag": construction_flag,
        "event_label": label,
    }


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)

    start = datetime.now(UTC) - timedelta(hours=args.hours)
    rows: list[dict[str, object]] = []

    for idx in range(args.nodes):
        node_id = f"DMA-{idx + 1:02d}"
        base_pressure = float(np.random.uniform(3.2, 5.8))
        base_flow = float(np.random.uniform(20.0, 45.0))
        pipe_age_years = int(np.random.randint(5, 28))
        material_risk_score = float(np.clip(np.random.normal(0.35, 0.18), 0.0, 1.0))

        for h in range(args.hours):
            ts = start + timedelta(hours=h)
            rows.append(
                row_from_label(
                    node_id=node_id,
                    ts=ts,
                    base_pressure=base_pressure,
                    base_flow=base_flow,
                    pipe_age_years=pipe_age_years,
                    material_risk_score=material_risk_score,
                )
            )

    df = pd.DataFrame(rows)
    df.to_csv(args.out, index=False)
    print(f"Synthetic dataset generated: {args.out}")
    print(df["event_label"].value_counts().to_string())


if __name__ == "__main__":
    main()
