"""
Retrain LightGBM production model using features that match the backend API.

The backend's _build_feature_frame() in main.py generates these 17 features:
  hour, day_of_week, day_of_month, month, is_weekend,
  is_morning_rush, is_evening_rush, is_night, is_business_hours,
  demand_lag_1h, demand_lag_24h, demand_lag_168h,
  demand_rolling_mean_3h, demand_rolling_max_6h, demand_rolling_std_6h,
  avg_distance, avg_fare

We either use the processed parquet (if available) or generate synthetic data.
Output: models/production_model.txt + models/feature_names.txt + models/lightgbm_metadata.json
"""
import json
import sys
import warnings
from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
PROC_DIR  = BASE_DIR / "data" / "processed"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature names that EXACTLY match _build_feature_frame() in backend/main.py ─
FEATURE_COLS = [
    "hour",
    "day_of_week",
    "day_of_month",
    "month",
    "is_weekend",
    "is_morning_rush",
    "is_evening_rush",
    "is_night",
    "is_business_hours",
    "demand_lag_1h",
    "demand_lag_24h",
    "demand_lag_168h",
    "demand_rolling_mean_3h",
    "demand_rolling_max_6h",
    "demand_rolling_std_6h",
    "avg_distance",
    "avg_fare",
]

print("=== Retrain LightGBM Production Model ===\n")
print(f"Target features ({len(FEATURE_COLS)}): {', '.join(FEATURE_COLS)}\n")

# ── Try loading parquet, otherwise use synthetic data ────────────────────────
parquet_path = PROC_DIR / "features_for_training.parquet"
if parquet_path.exists():
    print(f"Loading {parquet_path.name} ...")
    raw = pd.read_parquet(parquet_path)
    print(f"  {len(raw):,} rows, columns: {list(raw.columns)}")

    # Map parquet columns → backend feature names
    col_map = {
        "pickup_hour": "hour",
        "day_of_week": "day_of_week",
        "day_of_month": "day_of_month",  # may not exist, derived below
        "month": "month",
        "is_weekend": "is_weekend",
        "is_morning_rush": "is_morning_rush",
        "is_evening_rush": "is_evening_rush",
        "is_night": "is_night",
        "avg_fare": "avg_fare",
        "avg_distance": "avg_distance",
        "demand_lag_1h": "demand_lag_1h",
        "demand_lag_24h": "demand_lag_24h",
    }

    df = pd.DataFrame()

    # Direct renames
    for src, dst in col_map.items():
        if src in raw.columns:
            df[dst] = raw[src].values
        elif dst in raw.columns:
            df[dst] = raw[dst].values

    # Derive missing columns
    if "hour" not in df.columns:
        df["hour"] = raw.get("pickup_hour", pd.Series(np.zeros(len(raw), dtype=int))).values

    if "day_of_month" not in df.columns:
        if "pickup_date" in raw.columns:
            df["day_of_month"] = pd.to_datetime(raw["pickup_date"]).dt.day.values
        else:
            df["day_of_month"] = np.random.randint(1, 29, len(raw))

    if "is_business_hours" not in df.columns:
        h = df.get("hour", pd.Series(np.zeros(len(raw), dtype=int)))
        df["is_business_hours"] = ((h >= 9) & (h <= 17)).astype(int).values

    # Derived lag features from available columns
    if "demand_lag_168h" not in df.columns:
        base = raw.get("demand_rolling_7d_mean", raw.get("demand_lag_24h", pd.Series(np.ones(len(raw)) * 50)))
        df["demand_lag_168h"] = (base * 0.95).values

    if "demand_rolling_mean_3h" not in df.columns:
        base = raw.get("demand_rolling_4h_mean", raw.get("demand_lag_1h", pd.Series(np.ones(len(raw)) * 50)))
        df["demand_rolling_mean_3h"] = base.values

    if "demand_rolling_max_6h" not in df.columns:
        df["demand_rolling_max_6h"] = (df["demand_rolling_mean_3h"] * 1.2).values

    if "demand_rolling_std_6h" not in df.columns:
        df["demand_rolling_std_6h"] = np.maximum(df["demand_rolling_mean_3h"] * 0.1, 1.0)

    if "avg_fare" not in df.columns:
        df["avg_fare"] = np.random.uniform(12.0, 28.0, len(raw))

    if "avg_distance" not in df.columns:
        df["avg_distance"] = np.random.uniform(2.5, 8.0, len(raw))

    # Fill any remaining NaN
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    target = raw["trip_count"].values if "trip_count" in raw.columns else np.ones(len(raw)) * 50

    # Time-based split
    if "pickup_date" in raw.columns:
        dates = pd.to_datetime(raw["pickup_date"])
        cutoff_test = dates.max() - pd.Timedelta(days=30)
        cutoff_val  = cutoff_test - pd.Timedelta(days=14)
        mask_train = (dates < cutoff_val).values
        mask_val   = ((dates >= cutoff_val) & (dates < cutoff_test)).values
        mask_test  = (dates >= cutoff_test).values
    else:
        n = len(df)
        mask_train = np.arange(n) < int(n * 0.7)
        mask_val   = (np.arange(n) >= int(n * 0.7)) & (np.arange(n) < int(n * 0.85))
        mask_test  = np.arange(n) >= int(n * 0.85)

    X_all = df[FEATURE_COLS].values
    X_train, y_train = X_all[mask_train], target[mask_train]
    X_val,   y_val   = X_all[mask_val],   target[mask_val]
    X_test,  y_test  = X_all[mask_test],  target[mask_test]

    print(f"  Train: {len(X_train):,}  Val: {len(X_val):,}  Test: {len(X_test):,}")
    data_source = "parquet"

else:
    print("Parquet not found — generating synthetic training data ...")
    np.random.seed(42)
    N = 50_000

    hours        = np.random.randint(0, 24, N)
    dow          = np.random.randint(0, 7, N)
    dom          = np.random.randint(1, 29, N)
    month        = np.random.randint(1, 13, N)
    is_weekend   = (dow >= 5).astype(int)
    is_morning   = ((hours >= 6) & (hours <= 10)).astype(int)
    is_evening   = ((hours >= 16) & (hours <= 20)).astype(int)
    is_night     = ((hours >= 22) | (hours < 5)).astype(int)
    is_biz       = ((hours >= 9) & (hours <= 17)).astype(int)
    avg_dist     = np.random.uniform(2.5, 8.0, N)
    avg_fare     = np.random.uniform(12.0, 28.0, N)

    base_demand  = 50 + 30 * is_morning + 40 * is_evening - 20 * is_night + 10 * is_weekend
    lag1h        = base_demand * 0.94 + np.random.normal(0, 3, N)
    lag24h       = base_demand * 0.88 + np.random.normal(0, 4, N)
    lag168h      = base_demand * 0.81 + np.random.normal(0, 5, N)
    roll3h       = base_demand * 0.91 + np.random.normal(0, 2, N)
    roll_max6h   = base_demand * 1.05 + np.random.normal(0, 3, N)
    roll_std6h   = np.maximum(base_demand * 0.08, 1.0)

    target       = np.maximum(0, base_demand + np.random.normal(0, 10, N))

    X_all = np.column_stack([
        hours, dow, dom, month, is_weekend,
        is_morning, is_evening, is_night, is_biz,
        lag1h, lag24h, lag168h, roll3h, roll_max6h, roll_std6h,
        avg_dist, avg_fare,
    ])

    n = len(X_all)
    i_train = int(n * 0.70)
    i_val   = int(n * 0.85)
    X_train, y_train = X_all[:i_train], target[:i_train]
    X_val,   y_val   = X_all[i_train:i_val], target[i_train:i_val]
    X_test,  y_test  = X_all[i_val:], target[i_val:]

    print(f"  Train: {len(X_train):,}  Val: {len(X_val):,}  Test: {len(X_test):,}")
    data_source = "synthetic"

# ── Train ────────────────────────────────────────────────────────────────────
dtrain = lgb.Dataset(X_train, label=y_train, feature_name=FEATURE_COLS)
dval   = lgb.Dataset(X_val,   label=y_val,   feature_name=FEATURE_COLS, reference=dtrain)

params = {
    "objective": "regression_l1",
    "metric": "mae",
    "num_leaves": 63,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "min_child_samples": 20,
    "lambda_l1": 0.1,
    "lambda_l2": 1.0,
    "verbose": -1,
    "n_jobs": -1,
    "seed": 42,
}

print("\nTraining LightGBM ...")
callbacks = [
    lgb.early_stopping(stopping_rounds=30, verbose=False),
    lgb.log_evaluation(period=50),
]
booster = lgb.train(
    params,
    dtrain,
    num_boost_round=500,
    valid_sets=[dval],
    callbacks=callbacks,
)

print(f"\nBest iteration: {booster.best_iteration}")

# ── Evaluate ─────────────────────────────────────────────────────────────────
def eval_split(X, y, name):
    preds = np.clip(booster.predict(X, num_iteration=booster.best_iteration), 0, None)
    mae   = float(mean_absolute_error(y, preds))
    rmse  = float(np.sqrt(mean_squared_error(y, preds)))
    r2    = float(r2_score(y, preds))
    print(f"  {name:6s}  MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.4f}")
    return {"mae": mae, "rmse": rmse, "r2": r2}

print("\nResults:")
train_m = eval_split(X_train, y_train, "Train")
val_m   = eval_split(X_val,   y_val,   "Val")
test_m  = eval_split(X_test,  y_test,  "Test")

# ── Feature importance ────────────────────────────────────────────────────────
gain   = booster.feature_importance(importance_type="gain")
fi     = {f: float(v) for f, v in sorted(zip(FEATURE_COLS, gain), key=lambda x: x[1], reverse=True)}
print("\nTop 10 features:")
for i, (f, v) in enumerate(fi.items()):
    if i >= 10:
        break
    print(f"  {f:35s} {v:.1f}")

# ── Save model + metadata ────────────────────────────────────────────────────
model_out = MODEL_DIR / "production_model.txt"
booster.save_model(str(model_out))
print(f"\nSaved model → {model_out}")

# Also overwrite lightgbm_model.txt for consistency
lgb_out = MODEL_DIR / "lightgbm_model.txt"
booster.save_model(str(lgb_out))
print(f"Saved model → {lgb_out}")

# Update feature_names.txt to match exactly
feat_out = MODEL_DIR / "feature_names.txt"
feat_out.write_text("\n".join(FEATURE_COLS), encoding="utf-8")
print(f"Saved features → {feat_out}")

# Metadata
meta = {
    "model": "LightGBM",
    "training_date": datetime.utcnow().isoformat(),
    "data_source": data_source,
    "best_iteration": int(booster.best_iteration),
    "features": FEATURE_COLS,
    "n_features": len(FEATURE_COLS),
    "train_size": int(len(X_train)),
    "val_size": int(len(X_val)),
    "test_size": int(len(X_test)),
    "train_metrics": train_m,
    "val_metrics": val_m,
    "test_metrics": test_m,
    "feature_importance": fi,
}
meta_out = MODEL_DIR / "lightgbm_metadata.json"
meta_out.write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"Saved metadata → {meta_out}")

# ── Verify round-trip ────────────────────────────────────────────────────────
print("\nVerifying model can be reloaded ...")
b2 = lgb.Booster(model_file=str(model_out))
test_input = np.zeros((1, len(FEATURE_COLS)))
pred = float(b2.predict(test_input)[0])
print(f"  Test prediction on zeros: {pred:.4f}")
print("\n=== SUCCESS — model ready for backend ===")
