from __future__ import annotations

import os
import pickle
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "gld_price_data.csv"
MODEL_PATH = ROOT / "model.sav"
FEATURES = ["SPX", "USO", "SLV", "EUR/USD"]
TARGET = "GLD"


def main() -> None:
    data = pd.read_csv(DATASET_PATH)
    required_columns = {*FEATURES, TARGET}
    missing_columns = required_columns.difference(data.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing_columns))}.")
    if data.empty:
        raise ValueError("Dataset must contain at least one record.")

    values = data[[*FEATURES, TARGET]].apply(pd.to_numeric, errors="coerce")
    if values.isna().any().any() or not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("Dataset contains missing, non-numeric, or non-finite model values.")

    features = values[FEATURES]
    target = values[TARGET]
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
    )
    model = LinearRegression()
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)

    with tempfile.NamedTemporaryFile(dir=ROOT, prefix=".model.sav.", delete=False) as temporary_file:
        temporary_path = Path(temporary_file.name)
        try:
            pickle.dump(model, temporary_file, protocol=pickle.HIGHEST_PROTOCOL)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
            os.replace(temporary_path, MODEL_PATH)
        finally:
            temporary_path.unlink(missing_ok=True)

    print(f"Saved LinearRegression to {MODEL_PATH.name}")
    print(f"Training records: {len(x_train)}; test records: {len(x_test)}")
    print(f"Mean squared error: {mean_squared_error(y_test, predictions):.2f}")
    print(f"R-squared: {r2_score(y_test, predictions):.2f}")


if __name__ == "__main__":
    main()
