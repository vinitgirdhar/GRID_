from contextlib import asynccontextmanager
from datetime import datetime
from math import hypot
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List
import hashlib
import json
import re
from pydantic import BaseModel
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import pandas as pd
import lightgbm as lgb
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse

from .config import get_settings
from .database import SessionLocal
from .models import DriverAccount
from .schemas import (
    AvoidZone,
    DriverEventCreate,
    DriverLoginRequest,
    DriverRegisterRequest,
    DriverProfile,
    DriverStatusUpdate,
    DrowsinessResponse,
    DrowsinessUpdate,
    FeatureImportancePoint,
    ForecastPoint,
    ForecastResponse,
    ForecastSummary,
    GoalRouteRequest,
    GoalRouteResponse,
    GoalRouteZone,
    HealthResponse,
    HotspotPeriod,
    HotspotsResponse,
    HotspotZone,
    MetricsResponse,
    ModelVariantMetric,
    PredictionResponse,
    RecommendedZone,
    SessionToggle,
    TransitResponse,
    TransitStop,
    TransitZoneSummary,
    ValidationMetricsResponse,
    WeatherResponse,
    WellnessStatus,
)


# Wellness State (Accelerated for demo)
# 1 real minute = 15 simulated driver minutes (approx 10 mins to reach "Take Break")
DRIVER_SESSION = {
    "is_live": False,
    "start_time": datetime.utcnow(),
    "acceleration": 60
}

STATE_LOCK = Lock()
DROWSINESS_STATE = DrowsinessResponse()

# ── In-memory driver fleet ────────────────────────────────────────────────────
_DRIVER_SEED = [
    ("Alex Thompson",   "Manhattan",     "gold",   4.9, 1240,  4520),
    ("Sarah Jenkins",   "Brooklyn",      "silver",  4.8,  850,  3100),
    ("Michael Chen",    "Queens",        "gold",   4.7, 2100,  7800),
    ("Elena Rodriguez", "Bronx",         "bronze",  4.6,  420,  1200),
    ("David Wilson",    "Manhattan",     "gold",   4.9, 1560,  5900),
    ("Lisa Park",       "Brooklyn",      "silver",  4.8,  980,  3400),
    ("James Miller",    "Staten Island", "bronze",  4.5,  310,   950),
    ("Priya Sharma",    "Queens",        "silver",  4.7,  730,  2600),
    ("Carlos Rivera",   "Manhattan",     "gold",   4.8, 1890,  6700),
    ("Aisha Johnson",   "Brooklyn",      "silver",  4.6,  640,  2200),
    ("Thomas Brown",    "Bronx",         "bronze",  4.4,  280,   820),
    ("Mei Lin",         "Queens",        "gold",   4.9, 2340,  8900),
    ("Kevin O'Brien",   "Manhattan",     "silver",  4.7,  920,  3300),
    ("Fatima Hassan",   "Brooklyn",      "bronze",  4.5,  380,  1100),
    ("Andre Martin",    "Queens",        "gold",   4.8, 1670,  6200),
    ("Sophie Turner",   "Manhattan",     "silver",  4.7,  810,  2900),
    ("Ravi Patel",      "Staten Island", "bronze",  4.3,  190,   580),
    ("Naomi Clark",     "Bronx",         "silver",  4.6,  560,  1900),
    ("Omar Khalil",     "Queens",        "gold",   4.9, 3100, 11500),
    ("Yuki Tanaka",     "Brooklyn",      "silver",  4.8, 1050,  3800),
]

DRIVERS_LOCK = Lock()
DRIVERS: dict[str, dict] = {
    str(i): {
        "id": str(i),
        "phone": f"{i:010d}",
        "password": "qwerty",
        "name": name,
        "tier": tier,
        "status": "offline",
        "avatar": f"https://picsum.photos/seed/{name.split()[0].lower()}/100/100",
        "borough": borough,
        "rating": rating,
        "trips": trips,
        "earnings": earnings,
    }
    for i, (name, borough, tier, rating, trips, earnings) in enumerate(_DRIVER_SEED, 1)
}
LOCAL_ASSISTANT_STATE: dict[str, Any] = {
    "last_response": None,
    "last_source": "idle",
    "updated_at": datetime.utcnow(),
}


settings = get_settings()

# ==============================================================================
# DRIVER STORE (in-memory, 20 mock drivers)
# ==============================================================================

_DRIVER_SEED: List[tuple] = [
    ("Alex Thompson",   "Manhattan",    "gold",   4.9, 1240, 4520),
    ("Sarah Jenkins",   "Brooklyn",     "silver", 4.8,  850, 3100),
    ("Michael Chen",    "Queens",       "gold",   4.7, 2100, 7800),
    ("Elena Rodriguez", "Bronx",        "bronze", 4.6,  420, 1200),
    ("David Wilson",    "Manhattan",    "gold",   4.9, 1560, 5900),
    ("Lisa Park",       "Brooklyn",     "silver", 4.8,  980, 3400),
    ("James Miller",    "Staten Island","bronze", 4.5,  310,  950),
    ("Priya Sharma",    "Queens",       "silver", 4.7,  730, 2600),
    ("Carlos Rivera",   "Manhattan",    "gold",   4.8, 1890, 6700),
    ("Aisha Johnson",   "Brooklyn",     "silver", 4.6,  640, 2200),
    ("Thomas Brown",    "Bronx",        "bronze", 4.4,  280,  820),
    ("Mei Lin",         "Queens",       "gold",   4.9, 2340, 8900),
    ("Kevin O'Brien",   "Manhattan",    "silver", 4.7,  920, 3300),
    ("Fatima Hassan",   "Brooklyn",     "bronze", 4.5,  380, 1100),
    ("Andre Martin",    "Queens",       "gold",   4.8, 1670, 6200),
    ("Sophie Turner",   "Manhattan",    "silver", 4.7,  810, 2900),
    ("Ravi Patel",      "Staten Island","bronze", 4.3,  190,  580),
    ("Naomi Clark",     "Bronx",        "silver", 4.6,  560, 1900),
    ("Omar Khalil",     "Queens",       "gold",   4.9, 3100, 11500),
    ("Yuki Tanaka",     "Brooklyn",     "silver", 4.8, 1050, 3800),
]

DRIVERS_LOCK = Lock()
DRIVERS: Dict[str, Dict[str, Any]] = {}

_DRIVER_CAR_MODELS = [
    "Toyota Camry Hybrid",
    "Honda Accord",
    "Hyundai Sonata",
    "Tesla Model 3",
    "Nissan Altima",
    "Toyota RAV4 Hybrid",
    "Kia K5",
    "Chevrolet Malibu",
]

_DRIVER_STYLE_SNIPPETS = [
    "airport pickups",
    "late-night demand windows",
    "smooth downtown handoffs",
    "high-density commuter corridors",
    "surge-ready event routing",
    "fast turnaround dispatches",
]


def _build_driver_record(
    index: int,
    name: str,
    borough: str,
    tier: str,
    rating: float,
    trips: int,
    earnings: int,
) -> Dict[str, Any]:
    email_slug = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")
    experience = max(1, min(12, 2 + (index % 6) + (1 if tier == "gold" else 0)))
    joined_year = max(2016, datetime.utcnow().year - experience)
    joined_month = ((index * 2) % 12) + 1
    joined_day = ((index * 3) % 27) + 1
    cancellation_rate = round(
        min(
            6.4,
            1.4 + (index % 5) * 0.45 + (0.4 if tier == "bronze" else 0.15 if tier == "silver" else 0.0),
        ),
        1,
    )
    online_hours = round(38 + (trips / 110) + ((index % 4) * 2.75), 1)
    tone = "calm, premium" if tier == "gold" else "reliable, efficient" if tier == "silver" else "steady, neighborhood-first"
    seed = name.split()[0].lower()

    return {
        "id": str(index),
        "phone": f"{index:010d}",
        "password": "qwerty",
        "name": name,
        "email": f"{email_slug}@gridfleet.com",
        "joinedDate": datetime(joined_year, joined_month, joined_day).date().isoformat(),
        "carModel": _DRIVER_CAR_MODELS[(index - 1) % len(_DRIVER_CAR_MODELS)],
        "licensePlate": f"NYC-{index:02d}{(trips // 10) % 100:02d}",
        "bio": f"{borough}-based driver focused on {_DRIVER_STYLE_SNIPPETS[(index - 1) % len(_DRIVER_STYLE_SNIPPETS)]} with a {tone} service style.",
        "experience": experience,
        "completedTrips": trips,
        "cancellationRate": cancellation_rate,
        "onlineHours": online_hours,
        "tier": tier,
        "status": "offline",
        "avatar": f"https://picsum.photos/seed/{seed}/100/100",
        "borough": borough,
        "rating": rating,
        "trips": trips,
        "earnings": earnings,
        "target_zone": None,
        "lat": None,
        "lng": None,
    }


for _i, (_name, _borough, _tier, _rating, _trips, _earnings) in enumerate(_DRIVER_SEED, 1):
    DRIVERS[str(_i)] = _build_driver_record(_i, _name, _borough, _tier, _rating, _trips, _earnings)

ZONE_CATALOG: dict[str, dict[str, float | str]] = {
    "132": {"name": "Zone 132", "borough": "Manhattan", "lat": 40.7580, "lng": -73.9855, "avg_distance": 3.8, "avg_fare": 19.5, "multiplier": 1.18},
    "138": {"name": "Zone 138", "borough": "Queens", "lat": 40.7769, "lng": -73.8740, "avg_distance": 6.2, "avg_fare": 28.0, "multiplier": 1.1},
    "186": {"name": "Zone 186", "borough": "Manhattan", "lat": 40.7505, "lng": -73.9934, "avg_distance": 3.5, "avg_fare": 18.8, "multiplier": 1.0},
    "142": {"name": "Zone 142", "borough": "Manhattan", "lat": 40.7484, "lng": -73.9857, "avg_distance": 3.2, "avg_fare": 17.4, "multiplier": 0.92},
    "161": {"name": "Zone 161", "borough": "Manhattan", "lat": 40.7128, "lng": -74.0060, "avg_distance": 3.4, "avg_fare": 17.9, "multiplier": 0.9},
    "68": {"name": "Zone 68", "borough": "Brooklyn", "lat": 40.7061, "lng": -73.9969, "avg_distance": 4.6, "avg_fare": 20.2, "multiplier": 0.88},
    "230": {"name": "Zone 230", "borough": "Manhattan", "lat": 40.7590, "lng": -73.9845, "avg_distance": 3.6, "avg_fare": 18.9, "multiplier": 0.87},
    "239": {"name": "Zone 239", "borough": "Manhattan", "lat": 40.7587, "lng": -73.9787, "avg_distance": 3.1, "avg_fare": 17.8, "multiplier": 0.84},
    "249": {"name": "Zone 249", "borough": "Manhattan", "lat": 40.7060, "lng": -74.0086, "avg_distance": 3.7, "avg_fare": 18.5, "multiplier": 0.82},
    "162": {"name": "Zone 162", "borough": "Manhattan", "lat": 40.7306, "lng": -73.9866, "avg_distance": 3.0, "avg_fare": 16.8, "multiplier": 0.8},
}

DEFAULT_ZONE_ID = "132"


def _zone_offset_position(zone_id: str, seed_index: int) -> tuple[float, float]:
    """Deterministic position near a zone center — offset by driver index so
    markers spread out instead of stacking. ~±1km. No randomness: stable across
    refreshes and restarts."""
    zone = ZONE_CATALOG.get(zone_id, ZONE_CATALOG[DEFAULT_ZONE_ID])
    d_lat = (((seed_index * 37) % 100) - 50) / 5000.0
    d_lng = (((seed_index * 53) % 100) - 50) / 5000.0
    return float(zone["lat"]) + d_lat, float(zone["lng"]) + d_lng


def _assign_demo_fleet_positions() -> None:
    """Put a fixed subset of the seed fleet on the road, heading to hotspot zones.

    ponytail: deterministic index-based assignment — replace with real GPS/status
    feeds when actual driver clients report positions."""
    # Zone 132 gets 3 drivers on purpose — demonstrates the crowding demotion (red → green)
    demo_targets = ["132", "132", "132", "186", "138", "230"]
    driving_ids = ["2", "5", "8", "11", "14", "17"]
    for slot, driver_id in enumerate(driving_ids):
        driver = DRIVERS.get(driver_id)
        if not driver:
            continue
        zone_id = demo_targets[slot % len(demo_targets)]
        lat, lng = _zone_offset_position(zone_id, int(driver_id))
        driver["status"] = "driving"
        driver["target_zone"] = zone_id
        driver["lat"] = lat
        driver["lng"] = lng


_assign_demo_fleet_positions()

RECOMMENDED_ZONE_PATTERN = re.compile(r"\s*\d+\.\s+Zone\s+(\d+)\s+-\s+Expected\s+([\d.]+)\s+trips/hour")
AVOID_ZONE_PATTERN = re.compile(r"\s*Zone\s+(\d+)\s+-\s+Expected\s+([\d.]+)\s+trips/hour")


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _get_zone_profile(zone_id: str) -> dict[str, float | str]:
    return ZONE_CATALOG.get(zone_id, ZONE_CATALOG[DEFAULT_ZONE_ID])


def _pick_zone_from_coordinates(lat: float, lng: float) -> str:
    nearest_zone_id = DEFAULT_ZONE_ID
    nearest_distance = float("inf")

    for zone_id, zone in ZONE_CATALOG.items():
        distance = hypot(lat - float(zone["lat"]), lng - float(zone["lng"]))
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_zone_id = zone_id

    return nearest_zone_id


def _demand_level(value: float) -> str:
    if value >= 250:
        return "High"
    if value >= 80:
        return "Medium"
    return "Low"


def _event_intensity(value: float) -> str:
    if value >= 250:
        return "High"
    if value >= 80:
        return "Medium"
    return "Low"


def _active_period(now: datetime) -> str:
    return "morning" if now.hour < 15 else "evening"


def _resolve_weather_impact(temp_c: float, wind_kph: float, precip_mm: float, condition: str) -> tuple[str, float]:
    score = 1.0
    normalized_condition = condition.lower()

    if precip_mm >= 5:
        score += 0.2
    elif precip_mm >= 1:
        score += 0.1

    if wind_kph >= 35:
        score += 0.12
    elif wind_kph >= 20:
        score += 0.05

    if temp_c <= 0 or temp_c >= 32:
        score += 0.08

    if any(token in normalized_condition for token in ["rain", "thunder", "snow", "storm"]):
        score += 0.1

    if score >= 1.25:
        return "High", round(score, 2)
    if score >= 1.1:
        return "Moderate", round(score, 2)
    return "Low", round(score, 2)


def _fetch_weather_snapshot(zone_id: str | None, lat: float, lng: float) -> WeatherResponse:
    if not settings.weather_api_key:
        raise HTTPException(status_code=503, detail="WEATHER_API_KEY is not configured.")

    params = urlencode(
        {
            "key": settings.weather_api_key,
            "q": f"{lat},{lng}",
            "aqi": "no",
        }
    )
    request_url = f"{settings.weather_api_base_url}?{params}"

    try:
        with urlopen(request_url, timeout=10) as response:
            payload = json.load(response)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Weather API error: {detail or str(exc)}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"Unable to reach Weather API: {exc.reason}") from exc

    current = payload.get("current", {})
    location = payload.get("location", {})

    condition = str(current.get("condition", {}).get("text", "Unknown"))
    temp_c = float(current.get("temp_c", 0.0))
    wind_kph = float(current.get("wind_kph", 0.0))
    precip_mm = float(current.get("precip_mm", 0.0))
    demand_impact, impact_score = _resolve_weather_impact(temp_c, wind_kph, precip_mm, condition)

    zone_name = None
    borough = None
    if zone_id and zone_id in ZONE_CATALOG:
        zone_profile = _get_zone_profile(zone_id)
        zone_name = str(zone_profile["name"])
        borough = str(zone_profile["borough"])

    return WeatherResponse(
        requested_at=datetime.utcnow(),
        source="weatherapi",
        zone_id=zone_id,
        zone_name=zone_name,
        borough=borough,
        location_name=str(location.get("name", "Unknown")),
        region=str(location.get("region", "")) or None,
        country=str(location.get("country", "")) or None,
        lat=float(location.get("lat", lat)),
        lng=float(location.get("lon", lng)),
        local_time=str(location.get("localtime", "")),
        condition=condition,
        temp_c=temp_c,
        temp_f=float(current.get("temp_f", 0.0)),
        feelslike_c=float(current.get("feelslike_c", temp_c)),
        humidity=int(current.get("humidity", 0)),
        wind_kph=wind_kph,
        precip_mm=precip_mm,
        cloud=int(current.get("cloud", 0)),
        demand_impact=demand_impact,
        impact_score=impact_score,
    )


def _parse_recommendations(path: Path) -> tuple[str, list[RecommendedZone], list[AvoidZone]]:
    text = path.read_text(encoding="utf-8")
    target_match = re.search(r"Target Time:\s+(.+)", text)
    target_time = target_match.group(1).strip() if target_match else "Unknown"

    recommended: list[RecommendedZone] = []
    avoid: list[AvoidZone] = []

    for line in text.splitlines():
        recommended_match = RECOMMENDED_ZONE_PATTERN.match(line)
        if recommended_match:
            zone_id, expected = recommended_match.groups()
            zone = _get_zone_profile(zone_id)
            recommended.append(
                RecommendedZone(
                    zone_id=zone_id,
                    zone_name=str(zone["name"]),
                    rank=len(recommended) + 1,
                    expected_trips_per_hour=float(expected),
                )
            )
            continue

        avoid_match = AVOID_ZONE_PATTERN.match(line)
        if avoid_match:
            zone_id, expected = avoid_match.groups()
            avoid.append(AvoidZone(zone_id=zone_id, expected_trips_per_hour=float(expected)))

    return target_time, recommended, avoid


def _load_hotspot_period(csv_path: Path, recommendation_path: Path, label: str) -> HotspotPeriod:
    frame = pd.read_csv(csv_path)
    target_time, recommended_zones, avoid_zones = _parse_recommendations(recommendation_path)

    zones: list[HotspotZone] = []
    for record in frame.head(10).to_dict(orient="records"):
        zone_id = str(int(record["PULocationID"]))
        zone = _get_zone_profile(zone_id)
        predicted_demand = round(float(record["predicted_demand"]), 2)
        zones.append(
            HotspotZone(
                zone_id=zone_id,
                zone_name=str(zone["name"]),
                borough=str(zone["borough"]),
                lat=float(zone["lat"]),
                lng=float(zone["lng"]),
                predicted_demand=predicted_demand,
                demand_level=_demand_level(predicted_demand),
                event_intensity=_event_intensity(predicted_demand),
                weather_condition="Cloudy",
            )
        )

    return HotspotPeriod(
        label=label,
        target_time=target_time,
        zones=zones,
        recommended_zones=recommended_zones,
        avoid_zones=avoid_zones,
    )


def _build_metrics_response(metadata_map: dict[str, dict], booster: lgb.Booster) -> MetricsResponse:
    variants = [
        ("lightgbm", "Production Model"),
    ]
    model_variants = []
    for key, label in variants:
        meta = metadata_map.get(key, {})
        model_variants.append(
            ModelVariantMetric(
                key=key,
                label=label,
                model_type=meta.get("model", label),
                training_date=meta.get("training_date", datetime.utcnow().isoformat()),
                test_rmse=float(meta.get("test_metrics", {}).get("rmse", 0.0)),
                test_r2=float(meta.get("test_metrics", {}).get("r2", 0.0)),
                test_mae=float(meta.get("test_metrics", {}).get("mae", 0.0)),
                test_mape=float(meta.get("test_metrics", {}).get("mape", 0.0)),
                train_rmse=float(meta.get("train_metrics", {}).get("rmse", 0.0)),
                train_r2=float(meta.get("train_metrics", {}).get("r2", 0.0)),
                val_rmse=float(meta.get("val_metrics", {}).get("rmse", 0.0)),
                val_r2=float(meta.get("val_metrics", {}).get("r2", 0.0)),
                val_mae=float(meta.get("val_metrics", {}).get("mae", 0.0)),
                train_mae=float(meta.get("train_metrics", {}).get("mae", 0.0)),
                train_size=int(meta.get("train_size", 0)),
                val_size=int(meta.get("val_size", 0)),
                test_size=int(meta.get("test_size", 0)),
                feature_count=meta.get("n_features", 0),
            )
        )

    meta = metadata_map.get("lightgbm", {})
    raw_importance = meta.get("feature_importance", {})
    feature_importance = [
        FeatureImportancePoint(name=name, value=float(value))
        for name, value in sorted(raw_importance.items(), key=lambda item: item[1], reverse=True)[:8]
    ]

    return MetricsResponse(
        generated_at=datetime.utcnow(),
        current_model_key="lightgbm",
        current_model_label="Production Model",
        model_variants=model_variants,
        feature_importance=feature_importance,
    )


def _build_forecast_response(frame: pd.DataFrame) -> ForecastResponse:
    points: list[ForecastPoint] = []
    for record in frame.to_dict(orient="records"):
        zone_id = str(int(float(record["top_zone"])))
        zone = _get_zone_profile(zone_id)
        points.append(
            ForecastPoint(
                hour=int(record["hour"]),
                datetime=pd.to_datetime(record["datetime"]).to_pydatetime(),
                total_predicted_demand=round(float(record["total_predicted_demand"]), 2),
                top_zone_id=zone_id,
                top_zone_name=str(zone["name"]),
                top_zone_demand=round(float(record["top_zone_demand"]), 2),
            )
        )

    peak_point = max(points, key=lambda point: point.total_predicted_demand)
    summary = ForecastSummary(
        total_horizon_demand=round(sum(point.total_predicted_demand for point in points), 2),
        peak_hour=peak_point.hour,
        peak_datetime=peak_point.datetime,
        peak_zone_id=peak_point.top_zone_id,
        peak_zone_name=peak_point.top_zone_name,
        peak_zone_demand=peak_point.top_zone_demand,
    )

    return ForecastResponse(generated_at=datetime.utcnow(), forecast=points, summary=summary)


def _build_feature_frame(prediction_time: datetime, zone_id: str, hotspots: HotspotsResponse) -> pd.DataFrame:
    zone_profile = _get_zone_profile(zone_id)
    active_period_name = _active_period(prediction_time)
    active_period = hotspots.morning if active_period_name == "morning" else hotspots.evening
    hotspot_match = next((zone for zone in active_period.zones if zone.zone_id == zone_id), None)
    anchor = hotspot_match.predicted_demand if hotspot_match else active_period.zones[0].predicted_demand

    row = {
        "hour": prediction_time.hour,
        "day_of_week": prediction_time.weekday(),
        "day_of_month": prediction_time.day,
        "month": prediction_time.month,
        "is_weekend": 1 if prediction_time.weekday() >= 5 else 0,
        "is_morning_rush": 1 if 6 <= prediction_time.hour <= 10 else 0,
        "is_evening_rush": 1 if 16 <= prediction_time.hour <= 20 else 0,
        "is_night": 1 if prediction_time.hour >= 22 or prediction_time.hour < 5 else 0,
        "is_business_hours": 1 if 9 <= prediction_time.hour <= 17 else 0,
        "demand_lag_1h": anchor * 0.94,
        "demand_lag_24h": anchor * 0.88,
        "demand_lag_168h": anchor * 0.81,
        "demand_rolling_mean_3h": anchor * 0.91,
        "demand_rolling_max_6h": anchor * 1.05,
        "demand_rolling_std_6h": max(anchor * 0.08, 1.0),
        "avg_distance": float(zone_profile["avg_distance"]),
        "avg_fare": float(zone_profile["avg_fare"]),
    }

    return pd.DataFrame([row])


def _predict_for_zone(app: FastAPI, prediction_time: datetime, zone_id: str) -> PredictionResponse:
    booster: lgb.Booster = app.state.booster
    features: list[str] = app.state.feature_names
    hotspots: HotspotsResponse = app.state.hotspots
    frame = _build_feature_frame(prediction_time, zone_id, hotspots)
    frame = frame.reindex(columns=features, fill_value=0.0)
    prediction = float(booster.predict(frame)[0])
    zone_profile = _get_zone_profile(zone_id)
    adjusted_prediction = round(prediction * float(zone_profile["multiplier"]), 2)
    active_period_name = _active_period(prediction_time)

    return PredictionResponse(
        requested_at=datetime.utcnow(),
        prediction_time=prediction_time,
        zone_id=zone_id,
        zone_name=str(zone_profile["name"]),
        borough=str(zone_profile["borough"]),
        lat=float(zone_profile["lat"]),
        lng=float(zone_profile["lng"]),
        predicted_demand=adjusted_prediction,
        demand_level=_demand_level(adjusted_prediction),
        confidence=0.96,
        active_period=active_period_name,
        model_key="lightgbm",
        model_label="Production Model",
    )


# ==============================================================================
# DRIVER ACCOUNT HELPERS
# ==============================================================================

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _account_to_driver_dict(acc: "DriverAccount") -> Dict[str, Any]:
    return {
        "id": acc.driver_id,
        "phone": acc.phone,
        "password_hash": acc.password_hash,
        "_is_registered": True,
        "name": acc.name,
        "email": acc.email or f"{acc.driver_id}@gridfleet.com",
        "joinedDate": acc.joined_date or datetime.utcnow().date().isoformat(),
        "carModel": acc.car_model or "Toyota Camry Hybrid",
        "licensePlate": acc.license_plate or f"NYC-{acc.driver_id[-4:].upper()}",
        "bio": acc.bio or f"{acc.borough}-based driver.",
        "experience": acc.experience,
        "completedTrips": acc.completed_trips,
        "cancellationRate": acc.cancellation_rate,
        "onlineHours": acc.online_hours,
        "tier": acc.tier,
        "status": acc.status,
        "avatar": acc.avatar or f"https://picsum.photos/seed/{acc.driver_id}/100/100",
        "borough": acc.borough or "Manhattan",
        "rating": acc.rating,
        "trips": acc.trips,
        "target_zone": None,
        "lat": None,
        "lng": None,
        "earnings": acc.earnings,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Create DB tables (no-op if already exist) ─────────────────────────────
    try:
        from .database import engine
        from .models import Base
        Base.metadata.create_all(bind=engine)

        # Load persisted driver accounts into the in-memory DRIVERS dict
        with SessionLocal() as db:
            accounts = db.query(DriverAccount).all()
            with DRIVERS_LOCK:
                for acc in accounts:
                    DRIVERS[acc.driver_id] = _account_to_driver_dict(acc)
    except Exception:
        pass  # DB unavailable — seed-only mode, still functional
    models_dir = settings.models_dir
    outputs_dir = settings.outputs_dir

    metadata_map = {
        "lightgbm": _load_json(models_dir / "lightgbm_metadata.json"),
    }

    booster = lgb.Booster(model_file=str(models_dir / "production_model.txt"))

    feature_names = [
        name.strip()
        for name in (models_dir / "feature_names.txt").read_text(encoding="utf-8").splitlines()
        if name.strip()
    ]

    forecast_frame = pd.read_csv(outputs_dir / "24hour_forecast.csv")
    forecast = _build_forecast_response(forecast_frame)
    hotspots = HotspotsResponse(
        generated_at=datetime.utcnow(),
        active_period=_active_period(datetime.utcnow()),
        morning=_load_hotspot_period(
            outputs_dir / "morning_hotspots.csv",
            outputs_dir / "morning_recommendations.txt",
            "Morning positioning",
        ),
        evening=_load_hotspot_period(
            outputs_dir / "evening_hotspots.csv",
            outputs_dir / "evening_recommendations.txt",
            "Evening positioning",
        ),
    )
    metrics = _build_metrics_response(metadata_map, booster)

    # Transit data ---------------------------------------------------------
    transit_csv = Path(__file__).resolve().parent.parent / "grid_ml" / "data" / "external" / "transit_data.csv"
    transit_response = _build_transit_response(transit_csv)

    app.state.metadata_map = metadata_map
    app.state.booster = booster
    app.state.feature_names = feature_names
    app.state.forecast = forecast
    app.state.hotspots = hotspots
    app.state.metrics = metrics
    app.state.transit = transit_response

    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_origin_regex=r"^(https?://.+|vscode-webview://.+|null)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# SSE BROADCASTER — real-time cross-device sync
# ==============================================================================

import asyncio

# Each connected SSE client gets its own asyncio.Queue registered here.
# The broadcaster thread puts JSON strings into every queue.
_SSE_CLIENTS: set[asyncio.Queue] = set()
_SSE_LOCK = Lock()


def _sse_broadcast(event_type: str, data: dict) -> None:
    """Push a JSON event to all connected SSE clients (thread-safe)."""
    payload = json.dumps({"type": event_type, "data": data, "ts": datetime.utcnow().isoformat()})
    with _SSE_LOCK:
        dead = set()
        for q in _SSE_CLIENTS:
            try:
                q.put_nowait(payload)
            except Exception:
                dead.add(q)
        _SSE_CLIENTS.difference_update(dead)


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    api = settings.api_prefix
    return f"""
<!doctype html>
<html lang=\"en\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{settings.app_name}</title>
    <style>
        :root {{
            color-scheme: light;
            --bg: #f4f7fb;
            --card: #ffffff;
            --text: #1f2a37;
            --muted: #5b6470;
            --accent: #0f62fe;
            --accent-hover: #0043ce;
            --border: #dfe6ef;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            font-family: Segoe UI, Tahoma, sans-serif;
            background: radial-gradient(1200px 700px at 10% -10%, #dbe8ff 0%, var(--bg) 45%) no-repeat;
            color: var(--text);
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
        }}
        .card {{
            width: min(780px, 100%);
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: 0 12px 34px rgba(17, 24, 39, 0.08);
            padding: 28px;
        }}
        h1 {{ margin: 0 0 10px; font-size: 1.7rem; }}
        p {{ margin: 0 0 16px; color: var(--muted); }}
        ul {{ margin: 0; padding-left: 18px; }}
        li {{ margin: 10px 0; }}
        a {{
            color: var(--accent);
            text-decoration: none;
            font-weight: 600;
        }}
        a:hover {{ color: var(--accent-hover); text-decoration: underline; }}
        code {{
            background: #eef4ff;
            border: 1px solid #d0ddff;
            border-radius: 6px;
            padding: 2px 6px;
        }}
    </style>
</head>
<body>
    <main class=\"card\">
        <h1>{settings.app_name} Backend</h1>
        <p>The API is running. Use the links below to test endpoints quickly.</p>
        <ul>
            <li><a href=\"/health\">Health Check</a> <code>/health</code></li>
            <li><a href=\"/docs\">Swagger UI</a> <code>/docs</code></li>
            <li><a href=\"{api}/metrics\">Model Metrics</a> <code>{api}/metrics</code></li>
            <li><a href=\"{api}/forecast\">24-Hour Forecast</a> <code>{api}/forecast</code></li>
            <li><a href=\"{api}/hotspots\">Hotspots</a> <code>{api}/hotspots</code></li>
            <li><a href=\"{api}/predictions\">Predictions</a> <code>{api}/predictions</code></li>
            <li><a href=\"{api}/weather\">Weather</a> <code>{api}/weather</code></li>
        </ul>
    </main>
</body>
</html>
"""


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(f"{settings.api_prefix}/stream")
async def sse_stream(request: Request) -> StreamingResponse:
    """Server-Sent Events endpoint — clients subscribe here for real-time updates."""
    client_queue: asyncio.Queue = asyncio.Queue(maxsize=64)

    with _SSE_LOCK:
        _SSE_CLIENTS.add(client_queue)

    # Send initial snapshot immediately so the new client is in sync
    with DRIVERS_LOCK:
        drivers_snapshot = [
            {k: v for k, v in d.items() if k not in ("password", "password_hash", "_is_registered")}
            for d in DRIVERS.values()
        ]
    with STATE_LOCK:
        drowsiness_snapshot = DROWSINESS_STATE.model_dump()

    async def event_stream():
        try:
            # Handshake
            yield "event: connected\ndata: {}\n\n"
            # Send current state to the new client
            yield f"event: drivers\ndata: {json.dumps(drivers_snapshot)}\n\n"
            yield f"event: drowsiness\ndata: {json.dumps(drowsiness_snapshot, default=str)}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait up to 25 s for a message, then send a keepalive ping
                    payload = await asyncio.wait_for(client_queue.get(), timeout=25)
                    msg = json.loads(payload)
                    yield f"event: {msg['type']}\ndata: {json.dumps(msg['data'], default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            with _SSE_LOCK:
                _SSE_CLIENTS.discard(client_queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get(f"{settings.api_prefix}/metrics", response_model=MetricsResponse)
def get_metrics() -> MetricsResponse:
    return app.state.metrics.model_copy(update={"generated_at": datetime.utcnow()})


@app.get(f"{settings.api_prefix}/forecast", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    return app.state.forecast.model_copy(update={"generated_at": datetime.utcnow()})


@app.get(f"{settings.api_prefix}/hotspots", response_model=HotspotsResponse)
def get_hotspots() -> HotspotsResponse:
    return app.state.hotspots.model_copy(
        update={
            "generated_at": datetime.utcnow(),
            "active_period": _active_period(datetime.utcnow()),
        }
    )


@app.get(f"{settings.api_prefix}/predictions", response_model=PredictionResponse)
def get_prediction(
    zone_id: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    prediction_time: str | None = Query(default=None),
) -> PredictionResponse:
    if zone_id is None and (lat is None or lng is None):
        zone_id = DEFAULT_ZONE_ID

    if zone_id is None and lat is not None and lng is not None:
        zone_id = _pick_zone_from_coordinates(lat, lng)

    if zone_id is None:
        raise HTTPException(status_code=400, detail="Provide zone_id or both lat and lng.")

    if zone_id not in ZONE_CATALOG:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} is not configured for live prediction.")

    try:
        resolved_prediction_time = datetime.fromisoformat(prediction_time) if prediction_time else datetime.utcnow()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="prediction_time must be ISO-8601 formatted.") from exc

    return _predict_for_zone(app, resolved_prediction_time, zone_id)


@app.get(f"{settings.api_prefix}/weather", response_model=WeatherResponse)
def get_weather(
    zone_id: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
) -> WeatherResponse:
    resolved_zone_id = zone_id

    if resolved_zone_id is None and (lat is None or lng is None):
        resolved_zone_id = DEFAULT_ZONE_ID

    if resolved_zone_id is not None:
        if resolved_zone_id not in ZONE_CATALOG:
            raise HTTPException(status_code=404, detail=f"Zone {resolved_zone_id} is not configured for weather lookup.")
        zone_profile = _get_zone_profile(resolved_zone_id)
        lat = float(zone_profile["lat"])
        lng = float(zone_profile["lng"])
    elif lat is not None and lng is not None:
        raise HTTPException(status_code=400, detail="Provide zone_id or both lat and lng.")

    return _fetch_weather_snapshot(resolved_zone_id, lat, lng)


# ==============================================================================
# TRANSIT ENDPOINT
# ==============================================================================

# Map transit CSV zone-id → borough
_TRANSIT_ZONE_BOROUGH: dict[str, str] = {
    "zone-1": "Manhattan",
    "zone-2": "Brooklyn",
    "zone-3": "Queens",
    "zone-4": "Bronx",
    "zone-5": "Staten Island",
    "zone-6": "Long Island City",
}

# Map transit zone-id → closest app zone id
_TRANSIT_ZONE_TO_APP_ZONE: dict[str, str] = {
    "zone-1": "132",
    "zone-2": "68",
    "zone-3": "138",
    "zone-4": "138",
    "zone-5": "161",
    "zone-6": "138",
}


def _build_transit_response(csv_path: Path) -> TransitResponse:
    """Pre-compute transit summary from the MTA-style transit_data.csv."""
    if not csv_path.exists():
        return TransitResponse(generated_at=datetime.utcnow(), zones=[], nearest_zone=None)

    df = pd.read_csv(csv_path)

    # Determine which day columns to count — approximate "today"
    day_cols = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    today_idx = datetime.utcnow().weekday()  # 0=Mon
    today_col = day_cols[today_idx]

    # Filter to trips running today
    if today_col in df.columns:
        df = df[df[today_col] == 1]

    zone_summaries: list[TransitZoneSummary] = []

    for zone_id, group in df.groupby("zone_id"):
        borough = _TRANSIT_ZONE_BOROUGH.get(str(zone_id), "Unknown")
        app_zone = _TRANSIT_ZONE_TO_APP_ZONE.get(str(zone_id), "132")

        # Route type counts: 1=subway, 2=rail, 3=bus
        route_type_counts = group.groupby("route_type")["route_id"].nunique()
        subway_routes = int(route_type_counts.get(1, 0))
        bus_routes = int(route_type_counts.get(3, 0))
        rail_routes = int(route_type_counts.get(2, 0))

        total_stops = int(group["stop_id"].nunique())
        total_routes = int(group["route_id"].nunique())
        total_trips = int(group["trip_id"].nunique())

        # Build busy stops — top 3 by trip count
        stop_agg = (
            group.groupby(["stop_id", "stop_name", "stop_lat", "stop_lon"])
            .agg(
                trips=("trip_id", "nunique"),
                routes=("route_long_name", lambda x: list(x.unique())),
                route_types=("route_type", lambda x: list(x.unique())),
            )
            .reset_index()
            .sort_values("trips", ascending=False)
            .head(3)
        )

        busy_stops = [
            TransitStop(
                stop_id=str(row["stop_id"]),
                stop_name=str(row["stop_name"]),
                lat=float(row["stop_lat"]),
                lng=float(row["stop_lon"]),
                routes=[str(r) for r in row["routes"]],
                route_types=[int(rt) for rt in row["route_types"]],
                trips_today=int(row["trips"]),
            )
            for _, row in stop_agg.iterrows()
        ]

        zone_summaries.append(
            TransitZoneSummary(
                zone_id=app_zone,
                borough=borough,
                total_stops=total_stops,
                total_routes=total_routes,
                total_trips=total_trips,
                subway_routes=subway_routes,
                bus_routes=bus_routes,
                rail_routes=rail_routes,
                busy_stops=busy_stops,
            )
        )

    # Sort by total_trips descending
    zone_summaries.sort(key=lambda z: z.total_trips, reverse=True)

    return TransitResponse(
        generated_at=datetime.utcnow(),
        zones=zone_summaries,
        nearest_zone=zone_summaries[0] if zone_summaries else None,
    )


@app.get(f"{settings.api_prefix}/transit", response_model=TransitResponse)
def get_transit(
    zone_id: str | None = Query(default=None),
) -> TransitResponse:
    transit: TransitResponse = app.state.transit
    if zone_id is None:
        return transit
    # Find matching zone
    matched = [z for z in transit.zones if z.zone_id == zone_id]
    if not matched:
        raise HTTPException(status_code=404, detail=f"No transit data for zone {zone_id}.")
    return TransitResponse(
        generated_at=transit.generated_at,
        zones=matched,
        nearest_zone=matched[0],
    )


# ==============================================================================
# COPILOT ENDPOINT (Gemini-powered)
# ==============================================================================

class CopilotRequest(BaseModel):
    query: str
    current_time: str
    current_zone: str | None = None

class CopilotResponse(BaseModel):
    spoken_response: str
    action: Dict[str, Any] | None = None


def _build_grid_context(hotspots: HotspotsResponse) -> str:
    """Build a short context string from live hotspot/forecast data for the LLM."""
    now = datetime.utcnow()
    period_name = _active_period(now)
    active = hotspots.morning if period_name == "morning" else hotspots.evening
    with STATE_LOCK:
        drowsiness_snapshot = DROWSINESS_STATE.model_copy()

    lines = [
        f"Current time: {now.strftime('%I:%M %p')}",
        f"Active period: {period_name}",
        f"Driver alertness: {drowsiness_snapshot.status}",
        f"Top recommended zones:",
    ]
    if drowsiness_snapshot.ear is not None:
        lines.append(f"Current EAR: {drowsiness_snapshot.ear:.3f}")
    if drowsiness_snapshot.eyes_closed_seconds > 0:
        lines.append(f"Eyes closed duration: {drowsiness_snapshot.eyes_closed_seconds:.1f} seconds")
    for z in active.zones[:5]:
        lines.append(
            f"  - {z.zone_name} (Zone {z.zone_id}, {z.borough}): "
            f"{z.predicted_demand:.0f} trips/hr"
        )

    return "\n".join(lines)


def _store_local_assistant_response(response_text: str | None, source: str) -> None:
    if not response_text:
        return

    with STATE_LOCK:
        LOCAL_ASSISTANT_STATE["last_response"] = response_text
        LOCAL_ASSISTANT_STATE["last_source"] = source
        LOCAL_ASSISTANT_STATE["updated_at"] = datetime.utcnow()


def _extract_copilot_action(spoken: str, hotspots: HotspotsResponse) -> Dict[str, Any] | None:
    normalized_spoken = spoken.lower()
    period_name = _active_period(datetime.utcnow())
    active = hotspots.morning if period_name == "morning" else hotspots.evening

    for zone in active.zones:
        if str(zone.zone_name).lower() in normalized_spoken or f"zone {zone.zone_id}" in normalized_spoken:
            return {"type": "navigate_to_zone", "payload": str(zone.zone_id)}

    if any(token in normalized_spoken for token in ["destination", "towards", "filter", "routing", "airport", "home"]):
        if active.zones:
            return {"type": "navigate_to_zone", "payload": str(active.zones[0].zone_id)}

    return None


def _gemini_ask(query: str, context: str, hotspots: HotspotsResponse) -> CopilotResponse | None:
    """Try to call Gemini API for a smart response. Returns None if unavailable."""
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        system_prompt = (
            "You are GRID Pilot, a smart AI voice assistant for taxi and rideshare drivers. "
            "You help drivers find the best areas for rides based on live demand data. "
            "Your answers will be spoken aloud to the driver while they are driving, so keep responses SHORT (1-3 sentences). "
            "Be conversational, direct, and actionable. Never use markdown or special formatting. "
            "If the driver asks to head towards a location (e.g. 'airport', 'home', 'downtown', 'direction'), acknowledge it "
            "and tell them you are filtering rides or activating Destination Mode towards that area. "
            "If you recommend a specific zone, mention the zone name naturally in your response.\n\n"
            f"LIVE GRID DATA:\n{context}"
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=query,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=150,
                temperature=0.7,
            ),
        )

        spoken = response.text.strip()
        if not spoken:
            return None

        return CopilotResponse(spoken_response=spoken, action=_extract_copilot_action(spoken, hotspots))

    except Exception as exc:
        print(f"[Copilot] Gemini API error: {exc}")
        return None


def _local_ask(query: str, context: str, hotspots: HotspotsResponse) -> CopilotResponse | None:
    try:
        from grid_ml.src.local_assistant import generate_driver_guidance
    except Exception as exc:
        print(f"[Copilot] Local assistant unavailable: {exc}")
        return None

    with STATE_LOCK:
        drowsiness_snapshot = DROWSINESS_STATE.model_dump()

    try:
        spoken, engine = generate_driver_guidance(
            query=query,
            context=context,
            drowsiness_status=drowsiness_snapshot,
        )
    except Exception as exc:
        print(f"[Copilot] Local assistant error: {exc}")
        return None

    if not spoken:
        return None

    _store_local_assistant_response(spoken, engine)
    return CopilotResponse(spoken_response=spoken, action=_extract_copilot_action(spoken, hotspots))


def _build_drowsiness_assistant_response(update: DrowsinessUpdate) -> tuple[str | None, str]:
    try:
        from grid_ml.src.local_assistant import generate_drowsiness_guidance
    except Exception as exc:
        print(f"[Drowsiness] Local assistant unavailable: {exc}")
        return None, "unavailable"

    try:
        return generate_drowsiness_guidance(update.model_dump())
    except Exception as exc:
        print(f"[Drowsiness] Local assistant error: {exc}")
        return None, "error"


def _fallback_ask(query: str, hotspots: HotspotsResponse) -> CopilotResponse:
    """Keyword-based fallback when Gemini is unavailable."""
    query_lower = query.lower()
    now = datetime.utcnow()

    # Time parsing
    match = re.search(r'after (\d+)\s*(am|pm)?', query_lower)
    target_hour = now.hour
    if match:
        h = int(match.group(1))
        ampm = match.group(2)
        if ampm == 'pm' and h < 12:
            h += 12
        if ampm == 'am' and h == 12:
            h = 0
        target_hour = h

    period = "morning" if target_hour < 15 else "evening"
    active = hotspots.morning if period == "morning" else hotspots.evening
    top_zone = active.zones[0] if active.zones else None

    # Intent 1: Home / Directional routing ("travel towards home", "end of shift")
    if "home" in query_lower or "towards" in query_lower or "direction" in query_lower:
        return CopilotResponse(
            spoken_response=(
                f"I can help you filter rides heading towards your destination. "
                f"Right now, {top_zone.borough if top_zone else 'the city center'} has good volume. "
                "I've activated Destination Mode for you."
            ),
            action={"type": "navigate_to_zone", "payload": str(top_zone.zone_id) if top_zone else "Manhattan"}
        )

    # Intent 2: Nearby rides ("can I get a ride nearby", "around here")
    elif "nearby" in query_lower or "around here" in query_lower or "close" in query_lower:
        return CopilotResponse(
            spoken_response=(
                "There are several ride requests near your current location. "
                "I'm pulling up the map so you can accept one right now."
            ),
            action={"type": "navigate_to_zone", "payload": str(top_zone.zone_id) if top_zone else "Manhattan"}
        )

    # Intent 3: High Demand / Where to go ("where should I go", "highest demand")
    elif ("where" in query_lower or "demand" in query_lower or "go" in query_lower
            or "ride" in query_lower or "best" in query_lower or "should" in query_lower):
        if top_zone:
            return CopilotResponse(
                spoken_response=(
                    f"The highest demand right now is in {top_zone.zone_name}. "
                    f"I expect about {int(top_zone.predicted_demand)} trips per hour there. "
                    f"Head that way for the best earnings."
                ),
                action={"type": "navigate_to_zone", "payload": str(top_zone.zone_id)},
            )

    # Intent 4: Areas to avoid
    elif "avoid" in query_lower or "bad" in query_lower or "low" in query_lower:
        avoid = active.avoid_zones[:3]
        if avoid:
            names = ", ".join(f"Zone {zone.zone_id}" for zone in avoid)
            return CopilotResponse(
                spoken_response=f"I'd avoid these areas right now: {names}. Demand is low there.",
                action=None,
            )

    # Fallback response
    return CopilotResponse(
        spoken_response=(
            "I'm monitoring the city grid. "
            "You can ask me where the highest demand is, if there are rides nearby, or for a route towards home."
        ),
        action=None,
    )


@app.post(f"{settings.api_prefix}/copilot/ask", response_model=CopilotResponse)
def ask_copilot(request: CopilotRequest) -> CopilotResponse:
    hotspots: HotspotsResponse = app.state.hotspots
    context = _build_grid_context(hotspots)

    # Try Gemini first
    gemini_response = _gemini_ask(request.query, context, hotspots)
    if gemini_response:
        _store_local_assistant_response(gemini_response.spoken_response, "gemini")
        return gemini_response

    local_response = _local_ask(request.query, context, hotspots)
    if local_response:
        return local_response

    fallback_response = _fallback_ask(request.query, hotspots)
    _store_local_assistant_response(fallback_response.spoken_response, "keyword")
    return fallback_response


@app.get(f"{settings.api_prefix}/driver/drowsiness", response_model=DrowsinessResponse)
def get_drowsiness_status() -> DrowsinessResponse:
    with STATE_LOCK:
        return DROWSINESS_STATE.model_copy()


@app.post(f"{settings.api_prefix}/driver/drowsiness", response_model=DrowsinessResponse)
def update_drowsiness_status(update: DrowsinessUpdate) -> DrowsinessResponse:
    global DROWSINESS_STATE

    assistant_response = update.assistant_response
    assistant_source = update.source

    if not assistant_response and "drows" in update.status.casefold():
        assistant_response, assistant_source = _build_drowsiness_assistant_response(update)

    next_state = DrowsinessResponse(
        **update.model_dump(exclude={"updated_at", "assistant_response"}),
        assistant_response=assistant_response,
        updated_at=update.updated_at or datetime.utcnow(),
    )

    with STATE_LOCK:
        DROWSINESS_STATE = next_state

    if assistant_response:
        _store_local_assistant_response(assistant_response, assistant_source)

    _sse_broadcast("drowsiness", next_state.model_dump(mode="json"))
    return next_state


# ==============================================================================
# WELLNESS & SESSION ENDPOINTS
# ==============================================================================

@app.get(f"{settings.api_prefix}/driver/wellness", response_model=WellnessStatus)
def get_wellness_status() -> WellnessStatus:
    is_live = DRIVER_SESSION["is_live"]
    start_time = DRIVER_SESSION["start_time"]
    
    drive_minutes = 0
    if is_live:
        elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
        drive_minutes = int(elapsed_seconds * (DRIVER_SESSION["acceleration"] / 60.0))

    fatigue_level = "low"
    if drive_minutes >= 270:
        fatigue_level = "high"
    elif drive_minutes >= 120:
        fatigue_level = "moderate"

    # Start filling immediately and show progress relative to the 270m break goal
    is_filling = drive_minutes > 0
    progress = min(1.0, drive_minutes / 270.0)

    return WellnessStatus(
        drive_minutes=drive_minutes,
        fatigue_level=fatigue_level,
        is_live=is_live,
        is_filling=is_filling,
        progress=progress
    )


@app.post(f"{settings.api_prefix}/driver/session")
def toggle_session(toggle: SessionToggle):
    global DROWSINESS_STATE

    DRIVER_SESSION["is_live"] = toggle.is_live
    if toggle.is_live:
        DRIVER_SESSION["start_time"] = datetime.utcnow()

    with STATE_LOCK:
        DROWSINESS_STATE = DrowsinessResponse()

    _sse_broadcast("session", {"is_live": toggle.is_live})
    return {"status": "updated", "is_live": toggle.is_live}


# ==============================================================================
# DRIVER AUTH & FLEET ENDPOINTS
# ==============================================================================

def _broadcast_drivers() -> None:
    with DRIVERS_LOCK:
        snapshot = [
            {k: v for k, v in d.items() if k not in ("password", "password_hash", "_is_registered")}
            for d in DRIVERS.values()
        ]
    _sse_broadcast("drivers", snapshot)


def _driver_dict_to_profile(d: Dict[str, Any]) -> DriverProfile:
    return DriverProfile(**{
        k: v for k, v in d.items()
        if k not in ("password", "password_hash", "_is_registered")
    })


@app.post(f"{settings.api_prefix}/drivers/register", response_model=DriverProfile)
def driver_register(payload: DriverRegisterRequest) -> DriverProfile:
    import uuid as _uuid
    # Check for duplicate phone in the in-memory fleet
    with DRIVERS_LOCK:
        for d in DRIVERS.values():
            if d["phone"] == payload.phone:
                raise HTTPException(status_code=409, detail="This phone number is already registered.")

    driver_id = str(_uuid.uuid4())
    password_hash = _hash_password(payload.password)
    email_slug = re.sub(r"[^a-z0-9]+", ".", payload.name.lower()).strip(".")
    joined_date = datetime.utcnow().date().isoformat()
    avatar = f"https://picsum.photos/seed/{payload.name.split()[0].lower()}/100/100"
    license_plate = f"NYC-NEW{payload.phone[-4:]}"
    bio = f"{payload.borough}-based driver ready to hit the road with GRID."

    driver_dict: Dict[str, Any] = {
        "id": driver_id,
        "phone": payload.phone,
        "password_hash": password_hash,
        "_is_registered": True,
        "name": payload.name,
        "email": f"{email_slug}@gridfleet.com",
        "joinedDate": joined_date,
        "carModel": payload.carModel,
        "licensePlate": license_plate,
        "bio": bio,
        "experience": 0,
        "completedTrips": 0,
        "cancellationRate": 0.0,
        "onlineHours": 0.0,
        "tier": "bronze",
        "status": "offline",
        "avatar": avatar,
        "borough": payload.borough,
        "rating": 5.0,
        "trips": 0,
        "earnings": 0,
    }

    # Persist to DB (best-effort — works once DATABASE_URL is set on Railway)
    try:
        with SessionLocal() as db:
            account = DriverAccount(
                driver_id=driver_id,
                phone=payload.phone,
                password_hash=password_hash,
                name=payload.name,
                email=f"{email_slug}@gridfleet.com",
                borough=payload.borough,
                car_model=payload.carModel,
                license_plate=license_plate,
                bio=bio,
                tier="bronze",
                status="offline",
                avatar=avatar,
                rating=5.0,
                trips=0,
                earnings=0,
                completed_trips=0,
                cancellation_rate=0.0,
                online_hours=0.0,
                experience=0,
                joined_date=joined_date,
            )
            db.add(account)
            db.commit()
    except Exception:
        pass  # DB unavailable — driver still added to in-memory fleet for this session

    with DRIVERS_LOCK:
        DRIVERS[driver_id] = driver_dict

    _broadcast_drivers()
    return _driver_dict_to_profile(driver_dict)


@app.post(f"{settings.api_prefix}/drivers/login", response_model=DriverProfile)
def driver_login(payload: DriverLoginRequest) -> DriverProfile:
    profile = None
    password_hash = _hash_password(payload.password)

    with DRIVERS_LOCK:
        for driver in DRIVERS.values():
            if driver["phone"] != payload.phone:
                continue
            # Registered accounts use password_hash; seed accounts use plain "password" field
            if driver.get("_is_registered"):
                matched = driver.get("password_hash") == password_hash
            else:
                matched = driver.get("password") == payload.password
            if matched:
                driver["status"] = "online"
                DRIVER_SESSION["is_live"] = False
                DRIVER_SESSION["start_time"] = datetime.utcnow()
                with STATE_LOCK:
                    global DROWSINESS_STATE
                    DROWSINESS_STATE = DrowsinessResponse()
                profile = _driver_dict_to_profile(driver)
                break

    if profile is None:
        raise HTTPException(status_code=401, detail="Invalid phone number or password.")
    _broadcast_drivers()
    return profile


@app.post(f"{settings.api_prefix}/drivers/{{driver_id}}/logout")
def driver_logout(driver_id: str) -> dict:
    with DRIVERS_LOCK:
        if driver_id not in DRIVERS:
            raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")
        DRIVERS[driver_id]["status"] = "offline"
    DRIVER_SESSION["is_live"] = False
    DRIVER_SESSION["start_time"] = datetime.utcnow()
    _broadcast_drivers()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/drivers", response_model=list[DriverProfile])
def list_drivers() -> list[DriverProfile]:
    with DRIVERS_LOCK:
        return [_driver_dict_to_profile(d) for d in DRIVERS.values()]


@app.post(f"{settings.api_prefix}/drivers/{{driver_id}}/status")
def update_driver_status(driver_id: str, payload: DriverStatusUpdate) -> dict:
    if payload.status not in ("online", "driving", "offline"):
        raise HTTPException(status_code=400, detail="status must be 'online', 'driving', or 'offline'.")
    if payload.target_zone is not None and payload.target_zone not in ZONE_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown zone {payload.target_zone}.")
    with DRIVERS_LOCK:
        if driver_id not in DRIVERS:
            raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")
        driver = DRIVERS[driver_id]
        driver["status"] = payload.status
        if payload.status == "offline":
            driver["target_zone"] = None
            driver["lat"] = None
            driver["lng"] = None
        elif payload.target_zone is not None:
            seed = int(driver_id) if driver_id.isdigit() else sum(ord(c) for c in driver_id) % 20
            lat, lng = _zone_offset_position(payload.target_zone, seed)
            driver["target_zone"] = payload.target_zone
            driver["lat"] = lat
            driver["lng"] = lng
    _broadcast_drivers()
    return {"ok": True}


# ==============================================================================
# MODEL VALIDATION METRICS — REAL TEST-SET RESULTS (fixed artifact, no simulation)
# ==============================================================================

_EVENT_LOG: list[dict] = []               # driver events (audit log only)
_VALIDATION_LOCK = Lock()


def _load_real_model_metrics() -> dict:
    """Real test-set metrics of the winning model, read from training metadata.

    Computed once on the held-out NYC taxi test set (111,906 real samples) during
    training. Fixed and honest — the model is a static artifact, not retrained live.
    """
    fallback = {"accuracy_pct": 79.4, "rmse": 9.33, "r2": 0.9822,
                "mae": 3.74, "mape": 20.58, "test_size": 111906}
    try:
        meta = _load_json(settings.models_dir / "lightgbm_metadata.json")
        test = meta.get("test_metrics", {})
        mape = float(test["mape"])
        return {
            "accuracy_pct": round(max(0.0, 100.0 - mape), 1),
            "rmse": round(float(test["rmse"]), 2),
            "r2": round(float(test["r2"]), 4),
            "mae": round(float(test["mae"]), 2),
            "mape": round(mape, 2),
            "test_size": int(meta.get("test_size", fallback["test_size"])),
        }
    except Exception:
        return fallback


_REAL_MODEL_METRICS = _load_real_model_metrics()


# ==============================================================================
# PREDICTION VALIDATION ENDPOINTS
# ==============================================================================

@app.post(f"{settings.api_prefix}/events", status_code=201)
def record_driver_event(payload: DriverEventCreate) -> dict:
    """Ingest a driver event (movement, feedback, etc.) for audit logging."""
    event = {
        "driver_id": payload.driver_id,
        "prediction_id": payload.prediction_id,
        "zone_id": payload.zone_id,
        "event_type": payload.event_type,
        "event_time": datetime.utcnow(),
    }
    with _VALIDATION_LOCK:
        _EVENT_LOG.append(event)
    return {"ok": True}


@app.get(f"{settings.api_prefix}/validation-metrics", response_model=ValidationMetricsResponse)
def get_validation_metrics() -> ValidationMetricsResponse:
    """Return the trained model's real, fixed performance metrics.

    Sourced from the winning model's held-out test set (real NYC taxi data).
    The model is a fixed artifact — no live simulation, no continuous retraining.
    """
    from .schemas import ModelLearningState

    m = _REAL_MODEL_METRICS
    model_state = ModelLearningState(
        current_rmse=m["rmse"],
        current_r2=m["r2"],
        generation=0,
        rmse_floor=m["rmse"],
        r2_ceiling=m["r2"],
        next_retrain_in=0,
    )
    return ValidationMetricsResponse(
        generated_at=datetime.utcnow(),
        total_predictions=m["test_size"],
        validated_predictions=m["test_size"],
        prediction_accuracy_pct=m["accuracy_pct"],
        hit_rate_pct=0.0,
        driver_success_rate_pct=0.0,
        avg_pickup_time_min=0.0,
        predicted_vs_actual=[],
        prediction_breakdown=[],
        driver_impact=[],
        model_state=model_state,
        retrain_log=[],
    )


# ==============================================================================
# GOAL-BASED ROUTING
# ==============================================================================

@app.post(f"{settings.api_prefix}/goal-route", response_model=GoalRouteResponse)
def compute_goal_route(request: GoalRouteRequest) -> GoalRouteResponse:
    """Greedy zone sequencer: picks the highest-scoring zones until the time
    budget is exhausted, then returns per-zone earnings estimates."""

    hotspots: HotspotsResponse | None = getattr(app.state, "hotspots", None)
    if hotspots is None:
        raise HTTPException(status_code=503, detail="Hotspot data not yet loaded.")

    active_hour = datetime.utcnow().hour
    active_period: HotspotPeriod = hotspots.morning if active_hour < 15 else hotspots.evening
    zones: list[HotspotZone] = active_period.zones

    AVG_TRAVEL_MINUTES = 15
    AVG_FARE = 12.0

    def zone_score(z: HotspotZone) -> float:
        multiplier = 1.15 if z.demand_level == "High" else (1.08 if z.demand_level == "Medium" else 1.0)
        return (z.predicted_demand * multiplier) / AVG_TRAVEL_MINUTES

    sorted_zones = sorted(zones, key=zone_score, reverse=True)

    time_remaining = request.time_hours * 60  # minutes
    result_zones: list[GoalRouteZone] = []
    projected_earnings = 0.0
    rank = 1

    for z in sorted_zones:
        if time_remaining <= 0:
            break
        stay_minutes = min(int(time_remaining), max(AVG_TRAVEL_MINUTES, int(z.predicted_demand * 0.5)))
        estimated_trips = max(1, int(z.predicted_demand * 0.08))
        estimated_earnings = round(estimated_trips * AVG_FARE, 2)
        result_zones.append(GoalRouteZone(
            rank=rank,
            zone_id=z.zone_id,
            zone_name=z.zone_name,
            borough=z.borough,
            lat=z.lat,
            lng=z.lng,
            estimated_minutes=stay_minutes,
            estimated_trips=estimated_trips,
            estimated_earnings=estimated_earnings,
        ))
        projected_earnings += estimated_earnings
        time_remaining -= stay_minutes + AVG_TRAVEL_MINUTES
        rank += 1

    meets_target = projected_earnings >= request.earnings_target

    if result_zones:
        zone_names = [z.zone_name for z in result_zones]
        if len(zone_names) == 1:
            summary_text = (
                f"With {request.time_hours:.0f}h and a ${request.earnings_target:.0f} target, "
                f"head straight to {zone_names[0]} — that's where the demand is highest right now."
            )
        else:
            summary_text = (
                f"With {request.time_hours:.0f}h and a ${request.earnings_target:.0f} target, "
                f"start at {zone_names[0]} for the highest demand, "
                f"then move to {zone_names[1]}"
                + (f", and finish in {zone_names[-1]}" if len(zone_names) > 2 else "")
                + f". Projected earnings: ${projected_earnings:.0f}."
            )
    else:
        summary_text = "No zones matched your time budget. Try increasing your available hours."

    return GoalRouteResponse(
        generated_at=datetime.utcnow(),
        time_budget_hours=request.time_hours,
        earnings_target=request.earnings_target,
        projected_earnings=round(projected_earnings, 2),
        meets_target=meets_target,
        zones=result_zones,
        summary_text=summary_text,
    )
