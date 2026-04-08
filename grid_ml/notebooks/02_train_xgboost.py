"""Step 2 — XGBoost Baseline Training"""
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import json
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = Path("..")
PROC_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

print("=== STEP 2: XGBoost Baseline Training ===\n")

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

# --- Train/Val/Test split (time-based: last month = test) ---
df["pickup_date"] = pd.to_datetime(df["pickup_date"])
cutoff_test  = df["pickup_date"].max() - pd.Timedelta(days=30)
cutoff_val   = cutoff_test - pd.Timedelta(days=14)

mask_train = df["pickup_date"] < cutoff_val
mask_val   = (df["pickup_date"] >= cutoff_val) & (df["pickup_date"] < cutoff_test)
mask_test  = df["pickup_date"] >= cutoff_test

X_train, y_train = X[mask_train], y[mask_train]
X_val,   y_val   = X[mask_val],   y[mask_val]
X_test,  y_test  = X[mask_test],  y[mask_test]

print(f"\nSplit sizes:")
print(f"  Train: {len(X_train):,}  Val: {len(X_val):,}  Test: {len(X_test):,}")

# --- Train XGBoost ---
print("\nTraining XGBoost...")
params = {
    "objective": "reg:squarederror",
    "n_estimators": 1000,
    "learning_rate": 0.05,
    "max_depth": 7,
    "min_child_weight": 5,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "n_jobs": -1,
    "early_stopping_rounds": 50,
    "eval_metric": "mae",
}

model = xgb.XGBRegressor(**params)
model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    verbose=100,
)

best_iter = model.best_iteration
print(f"\nBest iteration: {best_iter}")

# --- Evaluate ---
def evaluate(model, X, y, split_name):
    preds = model.predict(X)
    preds = np.clip(preds, 0, None)
    mae  = mean_absolute_error(y, preds)
    rmse = np.sqrt(mean_squared_error(y, preds))
    r2   = r2_score(y, preds)
    mape = np.mean(np.abs((y - preds) / (y + 1))) * 100
    print(f"  {split_name:6s}  MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.4f}  MAPE={mape:.2f}%")
    return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape}

print("\nXGBoost Results:")
train_metrics = evaluate(model, X_train, y_train, "Train")
val_metrics   = evaluate(model, X_val,   y_val,   "Val")
test_metrics  = evaluate(model, X_test,  y_test,  "Test")

# --- Feature importance ---
importances = model.feature_importances_
feat_imp = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)
print("\nTop 10 Feature Importances:")
for feat, imp in feat_imp[:10]:
    print(f"  {feat:40s} {imp:.4f}")

# --- Save ---
model.save_model(str(MODEL_DIR / "xgboost_model.json"))

metadata = {
    "model": "XGBoost",
    "best_iteration": int(best_iter),
    "features": feature_cols,
    "n_features": len(feature_cols),
    "train_size": int(len(X_train)),
    "val_size": int(len(X_val)),
    "test_size": int(len(X_test)),
    "train_metrics": train_metrics,
    "val_metrics": val_metrics,
    "test_metrics": test_metrics,
    "feature_importance": {f: float(i) for f, i in feat_imp},
}
with open(MODEL_DIR / "xgboost_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nSaved: models/xgboost_model.json")
print(f"Saved: models/xgboost_metadata.json")
print("STEP 2 COMPLETE")
