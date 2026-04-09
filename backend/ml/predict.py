from __future__ import annotations

import argparse

import joblib
import numpy as np
import pandas as pd

from model_utils import (
    as_feature_matrix,
    build_alert_records,
    build_features,
    load_csv,
    model_metadata_row,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run leakage detection model against telemetry CSV"
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Path to trained model bundle (.joblib)",
    )
    parser.add_argument(
        "--data",
        required=True,
        help="Path to CSV telemetry input",
    )
    parser.add_argument(
        "--out",
        default="artifacts/predictions.csv",
        help="Path to CSV prediction output",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bundle = joblib.load(args.model)

    raw_df = load_csv(args.data)
    feat_result = build_features(raw_df)
    enriched_df = feat_result.dataframe

    feature_columns = bundle["feature_columns"]
    x = as_feature_matrix(enriched_df, feature_columns)

    scaler = bundle["scaler"]
    x_scaled = scaler.transform(x)

    anomaly_model = bundle["anomaly_model"]
    anomaly_scores = -anomaly_model.score_samples(x_scaled)
    anomaly_threshold = float(bundle["anomaly_threshold"])
    anomaly_flags = (anomaly_scores >= anomaly_threshold).astype(int)

    classifier = bundle.get("classifier")
    label_encoder = bundle.get("label_encoder")

    predicted_labels: list[str] = []
    if classifier is not None and label_encoder is not None:
        y_pred = classifier.predict(x_scaled)
        pred_text = label_encoder.inverse_transform(y_pred)
        for i, base_label in enumerate(pred_text):
            if anomaly_flags[i] == 0 and base_label != "normal":
                predicted_labels.append("normal")
            else:
                predicted_labels.append(str(base_label))
    else:
        predicted_labels = ["unknown_anomaly" if flag else "normal" for flag in anomaly_flags]

    output_df = build_alert_records(
        raw_df=raw_df,
        enriched_df=enriched_df,
        anomaly_flags=anomaly_flags,
        anomaly_scores=anomaly_scores,
        predicted_labels=predicted_labels,
    )

    output_df.to_csv(args.out, index=False)

    events = output_df[output_df["anomaly_flag"] == 1]
    print(f"Predictions written to: {args.out}")
    print(f"Detected anomalies: {len(events)} / {len(output_df)}")
    if not events.empty:
        print("Top predicted events:")
        print(events["predicted_event"].value_counts().head(5).to_string())

    metadata = model_metadata_row(bundle)
    print("Model metadata:")
    print(pd.DataFrame([metadata]).to_string(index=False))


if __name__ == "__main__":
    main()
