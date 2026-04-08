"""Step 3 — LightGBM Training"""
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import json
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = Path("..")
PROC_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

print("=== STEP 3: LightGBM Training ===\n")

# --- Load features ---
print("Loading features...")
df = pd.read_parquet(PROC_DIR / "features_for_training.parquet")
print(f"Dataset: {len(df):,} rows, {df.shape[1]} columns")

with open(MODEL_DIR / "feature_names.txt") as f:
    feature_cols = [line.strip() for line in f if line.strip()]

feature_cols = [c for c in feature_cols if c in df.columns]
print(f"Features: {len(feature_cols)}")

X = df[feature_cols].values
y = df["trip_count"].values

# --- Time-based split (same as XGBoost for fair comparison) ---
df["pickup_date"] = pd.to_datetime(df["pickup_date"])
cutoff_test = df["pickup_date"].max() - pd.Timedelta(days=30)
cutoff_val  = cutoff_test - pd.Timedelta(days=14)

mask_train = df["pickup_date"] < cutoff_val
mask_val   = (df["pickup_date"] >= cutoff_val) & (df["pickup_date"] < cutoff_test)
mask_test  = df["pickup_date"] >= cutoff_test

X_train, y_train = X[mask_train], y[mask_train]
X_val,   y_val   = X[mask_val],   y[mask_val]
X_test,  y_test  = X[mask_test],  y[mask_test]

print(f"\nSplit sizes:")
print(f"  Train: {len(X_train):,}  Val: {len(X_val):,}  Test: {len(X_test):,}")

# --- LightGBM datasets ---
dtrain = lgb.Dataset(X_train, label=y_train, feature_name=feature_cols)
dval   = lgb.Dataset(X_val,   label=y_val,   feature_name=feature_cols, reference=dtrain)

params = {
    "objective": "regression_l1",   # MAE — robust to demand spikes
    "metric": "mae",
    "num_leaves": 127,
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

print("\nTraining LightGBM...")
callbacks = [
    lgb.early_stopping(stopping_rounds=50, verbose=True),
    lgb.log_evaluation(period=100),
]
booster = lgb.train(
    params,
    dtrain,
    num_boost_round=1000,
    valid_sets=[dval],
    callbacks=callbacks,
)

best_iter = booster.best_iteration
print(f"\nBest iteration: {best_iter}")

# --- Evaluate ---
def evaluate(booster, X, y, split_name):
    preds = booster.predict(X, num_iteration=booster.best_iteration)
    preds = np.clip(preds, 0, None)
    mae  = mean_absolute_error(y, preds)
    rmse = np.sqrt(mean_squared_error(y, preds))
    r2   = r2_score(y, preds)
    mape = np.mean(np.abs((y - preds) / (y + 1))) * 100
    print(f"  {split_name:6s}  MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.4f}  MAPE={mape:.2f}%")
    return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape}

print("\nLightGBM Results:")
train_metrics = evaluate(booster, X_train, y_train, "Train")
val_metrics   = evaluate(booster, X_val,   y_val,   "Val")
test_metrics  = evaluate(booster, X_test,  y_test,  "Test")

# --- Feature importance ---
feat_imp_gain = booster.feature_importance(importance_type="gain")
feat_imp_pairs = sorted(zip(feature_cols, feat_imp_gain), key=lambda x: x[1], reverse=True)
print("\nTop 10 Feature Importances (gain):")
for feat, imp in feat_imp_pairs[:10]:
    print(f"  {feat:40s} {imp:.1f}")

# --- Save ---
booster.save_model(str(MODEL_DIR / "lightgbm_model.txt"))

metadata = {
    "model": "LightGBM",
    "best_iteration": int(best_iter),
    "features": feature_cols,
    "n_features": len(feature_cols),
    "train_size": int(len(X_train)),
    "val_size": int(len(X_val)),
    "test_size": int(len(X_test)),
    "train_metrics": train_metrics,
    "val_metrics": val_metrics,
    "test_metrics": test_metrics,
    "feature_importance": {f: float(i) for f, i in feat_imp_pairs},
}
with open(MODEL_DIR / "lightgbm_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nSaved: models/lightgbm_model.txt")
print(f"Saved: models/lightgbm_metadata.json")
print("STEP 3 COMPLETE")
