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
) -> dict[str, object]:
    label = pick_label()
    supply_on = 1 if 5 <= ts.hour <= 22 else 0
    control_action = 1 if random.random() < 0.03 else 0
    valve_position = int(np.clip(np.random.normal(58, 14), 5, 100))
    construction_flag = 1 if random.random() < 0.03 else 0

    pressure = np.random.normal(base_pressure, 0.22)
    flow_rate = np.random.normal(base_flow, 1.8)
    neighbor_pressure = np.random.normal(base_pressure - 0.15, 0.25)

    if label == "leak":
        pressure -= np.random.uniform(0.5, 1.1)
        flow_rate += np.random.uniform(1.0, 3.8)
    elif label == "burst":
        pressure -= np.random.uniform(1.4, 2.7)
        flow_rate += np.random.uniform(4.0, 8.0)
    elif label == "sensor_fault":
        pressure += np.random.uniform(1.5, 3.0) * random.choice([-1, 1])
    elif label == "valve_fault":
        control_action = 0
        valve_position = int(np.clip(valve_position + np.random.uniform(-45, 45), 0, 100))
        pressure += np.random.uniform(0.9, 1.7) * random.choice([-1, 1])
    elif label == "construction_damage":
        construction_flag = 1
        pressure -= np.random.uniform(0.7, 1.6)
        flow_rate += np.random.uniform(1.6, 3.6)
    elif label == "old_pipe_degradation":
        pressure -= np.random.uniform(0.3, 0.8)
        flow_rate += np.random.uniform(0.8, 2.0)
        pipe_age_years = max(pipe_age_years, 18)

    return {
        "timestamp": ts.isoformat(),
        "node_id": node_id,
        "pressure": float(np.clip(pressure, 0.2, 8.5)),
        "flow_rate": float(np.clip(flow_rate, 0.0, 120.0)),
        "valve_position": valve_position,
        "supply_on": supply_on,
        "control_action": control_action,
        "neighbor_pressure": float(np.clip(neighbor_pressure, 0.2, 8.5)),
        "pipe_age_years": pipe_age_years,
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

        for h in range(args.hours):
            ts = start + timedelta(hours=h)
            rows.append(
                row_from_label(
                    node_id=node_id,
                    ts=ts,
                    base_pressure=base_pressure,
                    base_flow=base_flow,
                    pipe_age_years=pipe_age_years,
                )
            )

    df = pd.DataFrame(rows)
    df.to_csv(args.out, index=False)
    print(f"Synthetic dataset generated: {args.out}")
    print(df["event_label"].value_counts().to_string())


if __name__ == "__main__":
    main()
