# Gold Price Prediction

This project recreates the prediction page and data-analysis dashboard described
in the attached project report. Express serves the web interface and forwards
API requests to a Python service that loads the two scikit-learn model files.

## Run locally

1. Install the Python dependencies:

   ```sh
   python3 -m pip install -r backend/requirements.txt
   ```

2. Start the application:

   ```sh
   npm start
   ```

3. Open <http://localhost:3000>.

Set `PYTHON` if your Python executable is not named `python3`, `PORT` to change
the Express port, or `MODEL_API_PORT` to change the local Python API port.

## Models and dataset

The prediction form accepts SPX, USO, SLV, and EUR/USD, and displays the model's
GLD estimate in USD and INR. The INR conversion uses the report's fixed rate of
₹96.29 per USD.

`model.sav` is trained as Linear Regression and `model2.sav` is the supplied
Decision Tree Regressor. To retrain the linear model from the included CSV using
the report's 80/20 split and `random_state=42`, run:

```sh
python3 backend/train_model.py
```

The included `gld_price_data.csv` contains the report's 2,290 daily records and
is used for full-precision dashboard charts and summary figures. The dashboard's
model-evaluation figures use the report's Linear Regression test split. Only
load trusted pickle model files.
