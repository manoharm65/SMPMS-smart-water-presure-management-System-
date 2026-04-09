from __future__ import annotations

import argparse
from datetime import datetime, UTC

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

from model_utils import as_feature_matrix, build_features, load_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train SMPMS leakage detection anomaly and root-cause models"
    )
    parser.add_argument(
        "--data",
        required=True,
        help="Path to CSV training data",
    )
    parser.add_argument(
        "--out",
        default="artifacts/leakage_model.joblib",
        help="Path to model output file",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=0.08,
        help="Expected anomaly ratio for IsolationForest",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_df = load_csv(args.data)
    feat_result = build_features(raw_df)
    df = feat_result.dataframe
    feature_columns = feat_result.feature_columns
    x = as_feature_matrix(df, feature_columns)

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)

    anomaly_model = IsolationForest(
        contamination=args.contamination,
        random_state=args.random_state,
        n_estimators=300,
    )
    anomaly_model.fit(x_scaled)
    anomaly_scores = -anomaly_model.score_samples(x_scaled)
    anomaly_threshold = float(np.quantile(anomaly_scores, 0.95))

    classifier = None
    label_encoder = None

    if "event_label" in df.columns:
        y_text = df["event_label"].fillna("normal").astype(str)
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_text)

        x_train, x_test, y_train, y_test = train_test_split(
            x_scaled,
            y,
            test_size=0.2,
            random_state=args.random_state,
            stratify=y if len(set(y)) > 1 else None,
        )

        classifier = RandomForestClassifier(
            n_estimators=300,
            random_state=args.random_state,
            class_weight="balanced",
            min_samples_leaf=2,
        )
        classifier.fit(x_train, y_train)

        y_pred = classifier.predict(x_test)
        label_names = list(label_encoder.classes_)
        print("\nClassification report:")
        print(classification_report(y_test, y_pred, target_names=label_names, zero_division=0))
    else:
        print("No event_label column found. Training anomaly model only.")

    bundle = {
        "feature_columns": feature_columns,
        "scaler": scaler,
        "anomaly_model": anomaly_model,
        "anomaly_threshold": anomaly_threshold,
        "classifier": classifier,
        "label_encoder": label_encoder,
        "metadata": {
            "model_version": "smpms-leakage-v1",
            "trained_at": datetime.now(UTC).isoformat(),
            "contamination": args.contamination,
            "rows": len(df),
        },
    }

    joblib.dump(bundle, args.out)
    print(f"\nModel saved to: {args.out}")
    print(f"Anomaly threshold: {anomaly_threshold:.4f}")


if __name__ == "__main__":
    main()
