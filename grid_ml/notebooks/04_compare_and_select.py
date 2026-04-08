"""Step 4 & 5 — Model Comparison and Winner Selection"""
import pandas as pd
import numpy as np
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import json
import joblib
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = Path("..")
PROC_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"
FIG_DIR  = BASE_DIR / "outputs" / "figures"
FIG_DIR.mkdir(parents=True, exist_ok=True)

print("=== STEP 4-5: Model Comparison & Winner Selection ===\n")

# --- Load metadata ---
with open(MODEL_DIR / "xgboost_metadata.json") as f:
    xgb_meta = json.load(f)
with open(MODEL_DIR / "lightgbm_metadata.json") as f:
    lgb_meta = json.load(f)

# --- Print comparison table ---
print("=" * 65)
print(f"{'Metric':<12} {'XGBoost (Test)':>18} {'LightGBM (Test)':>18} {'Winner':>10}")
print("=" * 65)

metrics = ["mae", "rmse", "r2", "mape"]
scores = {}
for m in metrics:
    xv = xgb_meta["test_metrics"][m]
    lv = lgb_meta["test_metrics"][m]
    if m == "r2":
        winner = "XGBoost" if xv > lv else "LightGBM"
    else:
        winner = "XGBoost" if xv < lv else "LightGBM"
    scores[m] = {"xgb": xv, "lgb": lv, "winner": winner}
    print(f"  {m.upper():<10} {xv:>18.4f} {lv:>18.4f} {winner:>10}")

print("=" * 65)

# --- Tally ---
xgb_wins = sum(1 for m in scores.values() if m["winner"] == "XGBoost")
lgb_wins = sum(1 for m in scores.values() if m["winner"] == "LightGBM")

print(f"\nXGBoost wins: {xgb_wins}/4 metrics")
print(f"LightGBM wins: {lgb_wins}/4 metrics")

# Primary decision metric: MAE on test set (most interpretable for demand forecasting)
if scores["mae"]["winner"] == "XGBoost":
    winner_name = "XGBoost"
    winner_model_file = "xgboost_model.json"
    winner_meta = xgb_meta
    loser_name = "LightGBM"
else:
    winner_name = "LightGBM"
    winner_model_file = "lightgbm_model.txt"
    winner_meta = lgb_meta
    loser_name = "XGBoost"

print(f"\nWINNER (by test MAE): {winner_name}")
print(f"  MAE  = {winner_meta['test_metrics']['mae']:.4f} trips/hour")
print(f"  RMSE = {winner_meta['test_metrics']['rmse']:.4f}")
print(f"  R²   = {winner_meta['test_metrics']['r2']:.4f}")
print(f"  MAPE = {winner_meta['test_metrics']['mape']:.2f}%")

# --- Save final model metadata ---
final_meta = {
    "winner": winner_name,
    "model_file": winner_model_file,
    "selection_metric": "test_mae",
    "comparison": {
        "xgboost": xgb_meta["test_metrics"],
        "lightgbm": lgb_meta["test_metrics"],
    },
    "winner_metrics": winner_meta["test_metrics"],
    "features": winner_meta["features"],
    "n_features": winner_meta["n_features"],
    "train_size": winner_meta["train_size"],
    "val_size": winner_meta["val_size"],
    "test_size": winner_meta["test_size"],
    "best_iteration": winner_meta["best_iteration"],
}

with open(MODEL_DIR / "model_metadata.json", "w") as f:
    json.dump(final_meta, f, indent=2)

# --- Also copy winner as "production" model for backend ---
import shutil
src = MODEL_DIR / winner_model_file
dst = MODEL_DIR / f"production_model{'.' + winner_model_file.split('.')[-1]}"
shutil.copy2(src, dst)

print(f"\nSaved: models/model_metadata.json")
print(f"Saved: models/{dst.name}  (production copy)")

# --- Quick summary of what the model learned ---
print(f"\n--- Top 10 Features ({winner_name}) ---")
feat_imp = winner_meta["feature_importance"]
top10 = sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:10]
for feat, imp in top10:
    print(f"  {feat:40s} {imp:.4f}")

print("\nSTEP 4-5 COMPLETE")
print(f"\nProduction model: {winner_name} -> models/{winner_model_file}")
print("Training pipeline fully complete!")
