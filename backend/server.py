from __future__ import annotations

import json
import math
import os
import pickle
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
FEATURES = ("SPX", "USO", "SLV", "EUR/USD")
EXCHANGE_RATE_INR = 96.29
MAX_REQUEST_BYTES = 16 * 1024
REPORT_YEARLY_AVERAGES = (
    (2008, 86.11),
    (2009, 95.83),
    (2010, 119.97),
    (2011, 152.59),
    (2012, 162.15),
    (2013, 136.85),
    (2014, 121.72),
    (2015, 111.17),
    (2016, 118.78),
    (2017, 119.55),
    (2018, 126.02),
)
REPORT_MONTHLY_AVERAGES = {
    2008: (88.2, 91.5, 95.2, 90.0, 87.7, 87.4, 92.6, 82.4, 81.6, 79.3, 74.6, 81.2),
    2009: (84.9, 92.6, 91.1, 87.5, 91.1, 93.0, 91.7, 93.1, 97.9, 102.5, 110.7, 110.5),
    2010: (109.5, 107.6, 109.1, 112.5, 117.9, 120.6, 116.4, 119.0, 124.6, 131.4, 133.9, 135.9),
    2011: (132.7, 133.9, 138.7, 144.6, 147.3, 148.9, 154.0, 171.4, 171.9, 162.5, 169.4, 159.4),
    2012: (161.6, 169.3, 162.8, 160.2, 154.0, 155.4, 154.5, 157.8, 169.2, 169.6, 166.9, 163.1),
    2013: (161.7, 157.6, 154.1, 143.7, 137.3, 130.0, 124.6, 130.5, 130.3, 127.0, 123.1, 117.9),
    2014: (120.0, 125.4, 128.6, 125.0, 124.2, 123.3, 126.1, 124.6, 118.9, 117.6, 113.0, 115.2),
    2015: (120.4, 117.8, 113.2, 115.2, 115.0, 113.4, 108.3, 107.1, 107.7, 110.9, 103.9, 102.3),
    2016: (105.1, 114.9, 119.0, 118.6, 120.3, 121.8, 127.7, 127.8, 126.6, 120.8, 117.8, 109.7),
    2017: (113.8, 117.6, 117.2, 120.9, 118.4, 119.9, 117.8, 122.2, 124.9, 121.6, 121.7, 120.3),
    2018: (126.4, 126.2, 125.8, 126.6, 124.1),
}
REPORT_EVALUATION = {
    "trainingRecords": 1832,
    "testRecords": 458,
    "mse": 56.17,
    "rmse": 7.49,
    "r2": 0.90,
}


def load_model(model_path: Path) -> tuple[object, tuple[str, ...]]:
    with model_path.open("rb") as model_file:
        model = pickle.load(model_file)

    if not callable(getattr(model, "predict", None)):
        raise TypeError(f"{model_path.name} does not contain a prediction model.")

    feature_names = tuple(str(name) for name in getattr(model, "feature_names_in_", FEATURES))
    if len(feature_names) != len(FEATURES) or set(feature_names) != set(FEATURES):
        raise ValueError(f"{model_path.name} must use the features: {', '.join(FEATURES)}.")
    if getattr(model, "n_features_in_", len(feature_names)) != len(FEATURES):
        raise ValueError(f"{model_path.name} must accept exactly four input features.")

    return model, feature_names


MODEL_FILES = {
    "model": ROOT / "model.sav",
    "model2": ROOT / "model2.sav",
}
MODELS = {model_id: load_model(model_path) for model_id, model_path in MODEL_FILES.items()}


def model_details() -> list[dict[str, object]]:
    return [
        {
            "id": model_id,
            "file": model_path.name,
            "type": type(MODELS[model_id][0]).__name__,
            "features": list(MODELS[model_id][1]),
        }
        for model_id, model_path in MODEL_FILES.items()
    ]


def training_feature_ranges() -> dict[str, dict[str, float]]:
    dataset_path = ROOT / "gld_price_data.csv"
    if not dataset_path.is_file():
        return {}

    data = pd.read_csv(dataset_path, usecols=list(FEATURES))
    if data.empty:
        raise ValueError("Dataset must contain at least one daily record.")

    ranges: dict[str, dict[str, float]] = {}
    for feature in FEATURES:
        values = pd.to_numeric(data[feature], errors="coerce")
        if values.isna().any() or not np.isfinite(values.to_numpy(dtype=float)).all():
            raise ValueError(f"Dataset contains invalid values in {feature}.")
        ranges[feature] = {
            "minimum": float(values.min()),
            "maximum": float(values.max()),
        }
    return ranges


def report_analysis() -> dict[str, object]:
    heatmap = [
        {"year": year, "month": month, "average": average}
        for year, monthly_values in REPORT_MONTHLY_AVERAGES.items()
        for month, average in enumerate(monthly_values, start=1)
    ]
    monthly_trend = [
        {"period": f"{row['year']}-{row['month']:02d}", "average": row["average"]}
        for row in heatmap
    ]
    monthly_totals: dict[int, list[float]] = {month: [] for month in range(1, 13)}
    for row in heatmap:
        monthly_totals[row["month"]].append(row["average"])

    return {
        "source": "report",
        "datasetAvailable": False,
        "datasetMessage": "Charts use the one-decimal monthly averages shown in the report. Add gld_price_data.csv beside index.js for full-precision values.",
        "summary": {
            "records": 2290,
            "startDate": "2008-01-02",
            "endDate": "2018-05-16",
            "mean": 122.73,
            "minimum": 70.0,
            "maximum": 184.59,
        },
        "yearlyAverages": [
            {"year": year, "average": average}
            for year, average in REPORT_YEARLY_AVERAGES
        ],
        "monthlyTrend": monthly_trend,
        "calendarMonths": [
            {"month": month, "average": sum(values) / len(values)}
            for month, values in monthly_totals.items()
            if values
        ],
        "heatmap": heatmap,
        "outlierCounts": None,
        "evaluation": REPORT_EVALUATION,
    }


def dataset_analysis(dataset_path: Path) -> dict[str, object]:
    data = pd.read_csv(dataset_path)
    if data.empty:
        raise ValueError("Dataset must contain at least one daily record.")
    required_columns = {"Date", "GLD", *FEATURES}
    missing_columns = required_columns.difference(data.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing_columns))}.")

    data["Date"] = pd.to_datetime(data["Date"], errors="coerce")
    if data["Date"].isna().any():
        raise ValueError("Dataset contains invalid or missing dates.")

    numeric_columns = [*FEATURES, "GLD"]
    for column in numeric_columns:
        data[column] = pd.to_numeric(data[column], errors="coerce")
        if data[column].isna().any() or not np.isfinite(data[column].to_numpy(dtype=float)).all():
            raise ValueError(f"Dataset contains invalid or missing values in {column}.")

    data["Year"] = data["Date"].dt.year
    data["Month"] = data["Date"].dt.month
    monthly_data = data.assign(Period=data["Date"].dt.to_period("M").astype(str))
    yearly_averages = data.groupby("Year")["GLD"].mean()
    monthly_averages = data.groupby(["Year", "Month"])["GLD"].mean()
    calendar_months = data.groupby("Month")["GLD"].mean()

    outlier_counts: dict[str, int] = {}
    for column in [*numeric_columns, "Year"]:
        first_quartile = data[column].quantile(0.25)
        third_quartile = data[column].quantile(0.75)
        spread = third_quartile - first_quartile
        outlier_counts[column] = int(
            ((data[column] < first_quartile - 1.5 * spread) |
             (data[column] > third_quartile + 1.5 * spread)).sum()
        )

    return {
        "source": "csv",
        "datasetAvailable": True,
        "datasetMessage": "",
        "summary": {
            "records": int(len(data)),
            "startDate": data["Date"].min().date().isoformat(),
            "endDate": data["Date"].max().date().isoformat(),
            "mean": float(data["GLD"].mean()),
            "minimum": float(data["GLD"].min()),
            "maximum": float(data["GLD"].max()),
        },
        "yearlyAverages": [
            {"year": int(year), "average": float(average)}
            for year, average in yearly_averages.items()
        ],
        "monthlyTrend": [
            {"period": period, "average": float(average)}
            for period, average in monthly_data.groupby("Period")["GLD"].mean().items()
        ],
        "calendarMonths": [
            {"month": int(month), "average": float(average)}
            for month, average in calendar_months.items()
        ],
        "heatmap": [
            {"year": int(year), "month": int(month), "average": float(average)}
            for (year, month), average in monthly_averages.items()
        ],
        "outlierCounts": outlier_counts,
        "evaluation": REPORT_EVALUATION,
    }


def get_analysis() -> dict[str, object]:
    dataset_path = ROOT / "gld_price_data.csv"
    if not dataset_path.is_file():
        return report_analysis()
    return dataset_analysis(dataset_path)


def predict(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise ValueError("The request body must be a JSON object.")

    model_id = payload.get("model")
    if not isinstance(model_id, str) or model_id not in MODELS:
        raise ValueError("Choose either model.sav or model2.sav.")

    features = payload.get("features")
    if not isinstance(features, dict):
        raise ValueError("Provide SPX, USO, SLV, and EUR/USD values.")

    missing_features = set(FEATURES).difference(features)
    if missing_features:
        raise ValueError(f"Missing feature values: {', '.join(sorted(missing_features))}.")

    values: dict[str, float] = {}
    for feature in FEATURES:
        value = features[feature]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{feature} must be a number.")
        numeric_value = float(value)
        if not math.isfinite(numeric_value):
            raise ValueError(f"{feature} must be a finite number.")
        values[feature] = numeric_value

    model, feature_names = MODELS[model_id]
    model_input = pd.DataFrame([[values[name] for name in feature_names]], columns=feature_names)
    try:
        result = float(model.predict(model_input)[0])
    except (TypeError, ValueError, RuntimeError) as error:
        raise ValueError(f"Prediction failed: {error}") from error
    if not math.isfinite(result):
        raise ValueError("The model returned a non-finite prediction.")

    return {
        "model": model_id,
        "modelType": type(model).__name__,
        "goldUsd": result,
        "goldInr": result * EXCHANGE_RATE_INR,
        "exchangeRate": EXCHANGE_RATE_INR,
    }


class ApiHandler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        route = urlsplit(self.path).path
        if route == "/api/health":
            try:
                self.send_json(200, {
                    "status": "ok",
                    "models": model_details(),
                    "datasetAvailable": (ROOT / "gld_price_data.csv").is_file(),
                    "featureRanges": training_feature_ranges(),
                })
            except (OSError, ValueError) as error:
                self.send_json(500, {"error": f"Unable to read model feature ranges: {error}"})
            return
        if route == "/api/analysis":
            try:
                self.send_json(200, get_analysis())
            except (OSError, ValueError) as error:
                self.send_json(500, {"error": f"Unable to read the gold price dataset: {error}"})
            return
        self.send_json(404, {"error": "API route not found."})

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/predict":
            self.send_json(404, {"error": "API route not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid Content-Length header."})
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_json(400, {"error": "Request body must be between 1 byte and 16 KB."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            result = predict(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
            return

        self.send_json(200, result)

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"Python API: {format_string % args}")


def main() -> None:
    port = int(os.environ.get("MODEL_API_PORT", "5001"))
    server = ThreadingHTTPServer(("127.0.0.1", port), ApiHandler)
    print(f"Python model API listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
