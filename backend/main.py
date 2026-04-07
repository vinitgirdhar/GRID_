from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from math import hypot
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Dict, List
import json
import re
import time
from pydantic import BaseModel
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse

from .config import get_settings
from .schemas import (
    AvoidZone,
    DriverEventCreate,
    DriverLoginRequest,
    DriverProfile,
    DriverStatusUpdate,
    DrowsinessResponse,
    DrowsinessUpdate,
    FeatureImportancePoint,
    ForecastPoint,
    ForecastResponse,
    ForecastSummary,
    HealthResponse,
    HotspotPeriod,
    HotspotsResponse,
    HotspotZone,
    MetricsResponse,
    ModelVariantMetric,
    PredictionResponse,
    RecommendedZone,
    SessionToggle,
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


def _build_metrics_response(metadata_map: dict[str, dict], booster: xgb.Booster) -> MetricsResponse:
    variants = [
        ("baseline", "Base Model"),
        ("events", "Event-Enriched Model"),
        ("improved", "Improved Model"),
    ]
    model_variants = [
        ModelVariantMetric(
            key=key,
            label=label,
            model_type=metadata_map[key].get("model_type", label),
            training_date=metadata_map[key].get("training_date"),
            test_rmse=float(metadata_map[key]["test_rmse"]),
            test_r2=float(metadata_map[key]["test_r2"]),
            train_rmse=float(metadata_map[key]["train_rmse"]) if metadata_map[key].get("train_rmse") is not None else None,
            train_r2=float(metadata_map[key]["train_r2"]) if metadata_map[key].get("train_r2") is not None else None,
            feature_count=len(metadata_map[key].get("features", [])),
        )
        for key, label in variants
    ]

    raw_importance = booster.get_score(importance_type="gain")
    feature_importance = [
        FeatureImportancePoint(name=name, value=float(value[0] if isinstance(value, list) else value))
        for name, value in sorted(raw_importance.items(), key=lambda item: item[1], reverse=True)[:8]
    ]

    return MetricsResponse(
        generated_at=datetime.utcnow(),
        current_model_key="improved",
        current_model_label="Improved Model",
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
    booster: xgb.Booster = app.state.booster
    features: list[str] = app.state.feature_names
    hotspots: HotspotsResponse = app.state.hotspots
    frame = _build_feature_frame(prediction_time, zone_id, hotspots)
    frame = frame.reindex(columns=features, fill_value=0.0)
    prediction = float(booster.predict(xgb.DMatrix(frame))[0])
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
        model_key="improved",
        model_label="Improved Model",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    models_dir = settings.models_dir
    outputs_dir = settings.outputs_dir

    metadata_map = {
        "baseline": _load_json(models_dir / "model_metadata.json"),
        "events": _load_json(models_dir / "model_metadata_with_events.json"),
        "improved": _load_json(models_dir / "model_metadata_improved.json"),
    }

    booster = xgb.Booster()
    booster.load_model(str(models_dir / "xgboost_demand_model_improved.json"))

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

    app.state.metadata_map = metadata_map
    app.state.booster = booster
    app.state.feature_names = feature_names
    app.state.forecast = forecast
    app.state.hotspots = hotspots
    app.state.metrics = metrics

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
import queue as _queue_module

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
            {k: v for k, v in d.items() if k != "password"}
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
        snapshot = [{k: v for k, v in d.items() if k != "password"} for d in DRIVERS.values()]
    _sse_broadcast("drivers", snapshot)


@app.post(f"{settings.api_prefix}/drivers/login", response_model=DriverProfile)
def driver_login(payload: DriverLoginRequest) -> DriverProfile:
    profile = None
    with DRIVERS_LOCK:
        for driver in DRIVERS.values():
            if driver["phone"] == payload.phone and driver["password"] == payload.password:
                driver["status"] = "online"
                DRIVER_SESSION["is_live"] = False
                DRIVER_SESSION["start_time"] = datetime.utcnow()
                with STATE_LOCK:
                    global DROWSINESS_STATE
                    DROWSINESS_STATE = DrowsinessResponse()
                profile = DriverProfile(**{k: v for k, v in driver.items() if k != "password"})
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
        return [
            DriverProfile(**{k: v for k, v in d.items() if k != "password"})
            for d in DRIVERS.values()
        ]


@app.post(f"{settings.api_prefix}/drivers/{{driver_id}}/status")
def update_driver_status(driver_id: str, payload: DriverStatusUpdate) -> dict:
    if payload.status not in ("online", "driving", "offline"):
        raise HTTPException(status_code=400, detail="status must be 'online', 'driving', or 'offline'.")
    with DRIVERS_LOCK:
        if driver_id not in DRIVERS:
            raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")
        DRIVERS[driver_id]["status"] = payload.status
    _broadcast_drivers()
    return {"ok": True}


# ==============================================================================
# PREDICTION VALIDATION — IN-MEMORY STORES + LEARNING SIMULATION
# ==============================================================================

import math
import random
import uuid
from collections import defaultdict

_PREDICTION_STORE: dict[str, dict] = {}   # prediction_id -> record
_EVENT_LOG: list[dict] = []               # driver events in order
_VALIDATION_STORE: dict[str, dict] = {}   # prediction_id -> validation record
_VALIDATION_LOCK = Lock()


def _init_model_state() -> dict:
    """Read real RMSE/R² from the saved metadata so the baseline is accurate."""
    try:
        meta = _load_json(settings.models_dir / "model_metadata_improved.json")
        base_rmse = float(meta["test_rmse"])
        base_r2   = float(meta["test_r2"])
    except Exception:
        base_rmse, base_r2 = 13.58, 0.9617

    return {
        "rmse": base_rmse,
        "r2":   base_r2,
        "generation": 0,
        "retrain_log": [],
        "validations_since_retrain": 0,
        "retrain_every": 10,
        # Physically realistic ceilings for NYC demand prediction
        "rmse_floor": round(base_rmse * 0.50, 2),   # 50% RMSE reduction is excellent
        "r2_ceiling": min(0.995, round(base_r2 + 0.025, 4)),
    }


_MODEL_STATE: dict = _init_model_state()

_STARTUP_TIME = datetime.utcnow()


def _noise(spread: float) -> float:
    return (random.random() - 0.5) * 2 * spread


def _current_error_spread() -> float:
    """How noisy actual demand is relative to predicted — shrinks as model improves."""
    # Generation 0 = ±28%, generation 10+ = ±8%
    gen = _MODEL_STATE["generation"]
    return max(0.08, 0.28 - gen * 0.018)


def _make_prediction_record(zone_id: str, level: str, pred_demand: float, created_at: datetime) -> tuple[str, dict]:
    pid = str(uuid.uuid4())
    return pid, {
        "prediction_id": pid,
        "zone_id": zone_id,
        "prediction_time": created_at,
        "predicted_demand": round(pred_demand, 1),
        "prediction_type": level,
        "suggested_action": f"Head to zone {zone_id}",
        "created_at": created_at,
    }


def _make_validation_record(pid: str, pred_demand: float) -> dict:
    spread = _current_error_spread()
    actual = pred_demand * (1 + _noise(spread))
    # Hit rate improves with model generation
    gen = _MODEL_STATE["generation"]
    hit_threshold = max(0.20, 0.40 - gen * 0.018)   # 40% miss → 20% miss at gen 10+
    got_ride = 1 if random.random() > hit_threshold else 0
    # Pickup time shortens as driver routing improves
    avg_pickup = max(3.0, 12.0 - gen * 0.8)
    pickup_min = avg_pickup + _noise(3.0) if got_ride else None
    source = random.choice(["feedback", "movement", "simulation"])
    return {
        "prediction_id": pid,
        "actual_demand": round(actual, 1),
        "driver_got_ride": got_ride,
        "pickup_time_minutes": round(max(1.5, pickup_min), 1) if pickup_min else None,
        "validation_source": source,
    }


def _build_feature_row(zone_id: str, pred_demand: float, ts: datetime) -> dict:
    """Build one training row matching the 17 model features exactly."""
    zone = ZONE_CATALOG.get(zone_id, ZONE_CATALOG[DEFAULT_ZONE_ID])
    hour = ts.hour
    dow = ts.weekday()
    return {
        "hour": hour,
        "day_of_week": dow,
        "day_of_month": ts.day,
        "month": ts.month,
        "is_weekend": int(dow >= 5),
        "is_morning_rush": int(7 <= hour <= 9),
        "is_evening_rush": int(17 <= hour <= 19),
        "is_night": int(hour >= 22 or hour <= 4),
        "is_business_hours": int(9 <= hour <= 17),
        "demand_lag_1h": round(pred_demand * random.uniform(0.88, 1.12), 1),
        "demand_lag_24h": round(pred_demand * random.uniform(0.82, 1.18), 1),
        "demand_lag_168h": round(pred_demand * random.uniform(0.78, 1.22), 1),
        "demand_rolling_mean_3h": round(pred_demand * random.uniform(0.90, 1.10), 1),
        "demand_rolling_max_6h": round(pred_demand * random.uniform(1.05, 1.25), 1),
        "demand_rolling_std_6h": round(pred_demand * random.uniform(0.05, 0.20), 2),
        "avg_distance": float(zone.get("avg_distance", 3.8)),
        "avg_fare": float(zone.get("avg_fare", 18.5)),
    }


def _run_real_retrain() -> None:
    """
    Perform a genuine XGBoost incremental retrain using accumulated validation data.
    Runs in the background thread (NOT holding _VALIDATION_LOCK during training).
    """
    # Snapshot data without holding lock during slow training
    with _VALIDATION_LOCK:
        pred_snapshot = dict(_PREDICTION_STORE)
        val_snapshot = dict(_VALIDATION_STORE)
        gen = _MODEL_STATE["generation"]
        rmse_before = _MODEL_STATE["rmse"]
        r2_before = _MODEL_STATE["r2"]

    # Build training rows from validated predictions
    feature_names = getattr(app.state, "feature_names", None)
    booster = getattr(app.state, "booster", None)
    if feature_names is None or booster is None:
        return  # backend not fully initialised yet

    rows_X, rows_y = [], []
    for pid, val in val_snapshot.items():
        pred = pred_snapshot.get(pid)
        if pred is None or val.get("actual_demand") is None:
            continue
        row = _build_feature_row(pred["zone_id"], pred["predicted_demand"], pred["created_at"])
        rows_X.append([row[f] for f in feature_names])
        rows_y.append(float(val["actual_demand"]))

    if len(rows_X) < 5:
        return  # not enough data to bother

    X = pd.DataFrame(rows_X, columns=feature_names)
    y = pd.Series(rows_y)

    # 80/20 split for eval
    split = max(1, int(len(X) * 0.8))
    X_train, X_val = X.iloc[:split], X.iloc[split:]
    y_train, y_val = y.iloc[:split], y.iloc[split:]

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names)
    dval   = xgb.DMatrix(X_val,   label=y_val,   feature_names=feature_names)

    # Incremental: continue from current booster weights, add 30 more trees
    evals_result: dict = {}
    new_booster = xgb.train(
        params={
            "objective": "reg:squarederror",
            "learning_rate": max(0.005, 0.05 * math.exp(-gen * 0.15)),
            "max_depth": 8,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "gamma": 0.1,
            "verbosity": 0,
        },
        dtrain=dtrain,
        num_boost_round=30,
        xgb_model=booster,           # ← key: continues from existing weights
        evals=[(dtrain, "train"), (dval, "val")],
        evals_result=evals_result,
        verbose_eval=False,
    )

    # Extract real RMSE from eval
    new_rmse_raw = evals_result["val"]["rmse"][-1]
    new_r2_raw = float(1 - (
        sum((y_val - pd.Series(new_booster.predict(dval)))**2) /
        max(sum((y_val - y_val.mean())**2), 1e-9)
    ))

    new_rmse = round(float(new_rmse_raw), 4)
    new_r2   = round(float(new_r2_raw), 4)

    # Only accept the new booster if it actually improved (or is within noise)
    if new_rmse > rmse_before * 1.05:
        # Regression — discard and keep old booster
        return

    # Hot-swap booster in app state (thread-safe: GIL protects object assignment)
    app.state.booster = new_booster

    improvement_pct = round((rmse_before - new_rmse) / max(rmse_before, 1e-9) * 100, 2)
    logs_used = len(rows_X)

    with _VALIDATION_LOCK:
        _MODEL_STATE["rmse"] = new_rmse
        _MODEL_STATE["r2"]   = new_r2
        _MODEL_STATE["generation"] = gen + 1
        retrain_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "generation": gen + 1,
            "rmse_before": round(rmse_before, 4),
            "rmse_after":  new_rmse,
            "r2_before":   round(r2_before, 4),
            "r2_after":    new_r2,
            "improvement_pct": improvement_pct,
            "logs_used":   logs_used,
        }
        _MODEL_STATE["retrain_log"].append(retrain_entry)

    _sse_broadcast("retrain", retrain_entry)


def _maybe_retrain() -> None:
    """Called inside _VALIDATION_LOCK. Kicks off a real retrain in a separate thread."""
    _MODEL_STATE["validations_since_retrain"] += 1
    if _MODEL_STATE["validations_since_retrain"] < _MODEL_STATE["retrain_every"]:
        return
    _MODEL_STATE["validations_since_retrain"] = 0
    # Run the actual XGBoost retrain off the lock in a daemon thread
    Thread(target=_run_real_retrain, daemon=True).start()


def _seed_validation_demo() -> None:
    """Pre-populate 48 historical records over the last 8 hours + simulate early retrain history."""
    levels = ["high", "medium", "low"]
    zone_ids = list(ZONE_CATALOG.keys())[:6]
    now = datetime.utcnow()

    # Simulate 3 historical retrains so the log isn't empty on first load
    base_rmse = _MODEL_STATE["rmse"]
    base_r2   = _MODEL_STATE["r2"]
    cur_rmse, cur_r2 = base_rmse, base_r2
    for g in range(3):
        fake_ts = (now - timedelta(hours=8 - g * 2.5)).isoformat()
        drop = random.uniform(0.20, 0.50) * math.exp(-g * 0.22)
        gain = random.uniform(0.0008, 0.0020) * math.exp(-g * 0.22)
        new_rmse = round(max(_MODEL_STATE["rmse_floor"], cur_rmse - drop), 4)
        new_r2   = round(min(_MODEL_STATE["r2_ceiling"],  cur_r2   + gain), 4)
        _MODEL_STATE["retrain_log"].append({
            "timestamp": fake_ts,
            "generation": g + 1,
            "rmse_before": round(cur_rmse, 4),
            "rmse_after":  new_rmse,
            "r2_before":   round(cur_r2, 4),
            "r2_after":    new_r2,
            "improvement_pct": round((cur_rmse - new_rmse) / cur_rmse * 100, 2),
            "logs_used": (g + 1) * 10,
        })
        cur_rmse, cur_r2 = new_rmse, new_r2
    # Advance state to reflect those 3 historical retrains
    _MODEL_STATE["generation"] = 3
    _MODEL_STATE["rmse"] = cur_rmse
    _MODEL_STATE["r2"]   = cur_r2

    for i in range(48):
        minutes_ago = (48 - i) * 10
        created_at = now - timedelta(minutes=minutes_ago)
        level = levels[i % 3]
        zone_id = zone_ids[i % len(zone_ids)]
        hour = created_at.hour
        base = 160 if hour in (7, 8, 9, 17, 18, 19) else 90
        pred_demand = (
            base + random.uniform(-25, 25) if level == "high"
            else random.uniform(40, 80) if level == "medium"
            else random.uniform(10, 40)
        )
        pid, pred_record = _make_prediction_record(zone_id, level, pred_demand, created_at)
        val_record = _make_validation_record(pid, pred_demand)
        _PREDICTION_STORE[pid] = pred_record
        _VALIDATION_STORE[pid] = val_record


_seed_validation_demo()


def _live_prediction_loop() -> None:
    """Background thread: add a new prediction+validation every 30 seconds, trigger retrains."""
    levels = ["high", "medium", "low"]
    zone_ids = list(ZONE_CATALOG.keys())[:6]

    while True:
        time.sleep(30)
        try:
            now = datetime.utcnow()
            level = random.choice(levels)
            zone_id = random.choice(zone_ids)
            hour = now.hour
            base = 160 if hour in (7, 8, 9, 17, 18, 19) else 90
            pred_demand = (
                base + random.uniform(-25, 25) if level == "high"
                else random.uniform(50, 120) if level == "medium"
                else random.uniform(10, 50)
            )
            pid, pred_record = _make_prediction_record(zone_id, level, pred_demand, now)
            val_record = _make_validation_record(pid, pred_demand)

            with _VALIDATION_LOCK:
                _PREDICTION_STORE[pid] = pred_record
                _VALIDATION_STORE[pid] = val_record
                _maybe_retrain()
            _sse_broadcast("prediction", {
                "zone_id": zone_id,
                "level": level,
                "predicted_demand": round(pred_demand, 1),
                "ts": now.isoformat(),
            })
        except Exception:
            pass


Thread(target=_live_prediction_loop, daemon=True).start()


# ==============================================================================
# PREDICTION VALIDATION ENDPOINTS
# ==============================================================================

@app.post(f"{settings.api_prefix}/events", status_code=201)
def record_driver_event(payload: DriverEventCreate) -> dict:
    """Ingest a driver event (movement, feedback, etc.) tied to a prediction."""
    event = {
        "driver_id": payload.driver_id,
        "prediction_id": payload.prediction_id,
        "zone_id": payload.zone_id,
        "event_type": payload.event_type,
        "event_time": datetime.utcnow(),
    }
    with _VALIDATION_LOCK:
        _EVENT_LOG.append(event)
        # Resolve validation from explicit feedback immediately
        pid = payload.prediction_id
        if payload.event_type in ("feedback_yes", "feedback_no") and pid not in _VALIDATION_STORE:
            got_ride = 1 if payload.event_type == "feedback_yes" else 0
            pred = _PREDICTION_STORE.get(pid, {})
            actual = pred.get("predicted_demand", 0) * (random.uniform(0.85, 1.15) if got_ride else random.uniform(0.4, 0.75))
            _VALIDATION_STORE[pid] = {
                "prediction_id": pid,
                "actual_demand": round(actual, 1),
                "driver_got_ride": got_ride,
                "pickup_time_minutes": round(random.uniform(2, 10), 1) if got_ride else None,
                "validation_source": "feedback",
            }
        elif payload.event_type == "moved_to_zone" and pid not in _VALIDATION_STORE:
            pred = _PREDICTION_STORE.get(pid, {})
            got_ride = 1 if random.random() > 0.3 else 0
            actual = pred.get("predicted_demand", 0) * random.uniform(0.8, 1.2)
            _VALIDATION_STORE[pid] = {
                "prediction_id": pid,
                "actual_demand": round(actual, 1),
                "driver_got_ride": got_ride,
                "pickup_time_minutes": round(random.uniform(3, 12), 1) if got_ride else None,
                "validation_source": "movement",
            }
    return {"ok": True}


@app.get(f"{settings.api_prefix}/validation-metrics", response_model=ValidationMetricsResponse)
def get_validation_metrics() -> ValidationMetricsResponse:
    """Return live KPIs and graph datasets for the admin panel."""
    from .schemas import (
        DriverImpactPoint,
        ModelLearningState,
        PredictionBreakdown,
        RetrainEvent,
        ValidationPointData,
    )

    with _VALIDATION_LOCK:
        all_preds = list(_PREDICTION_STORE.values())
        all_validations = list(_VALIDATION_STORE.values())

    total_predictions = len(all_preds)
    validated = len(all_validations)

    if validated == 0:
        return ValidationMetricsResponse(
            generated_at=datetime.utcnow(),
            total_predictions=total_predictions,
            validated_predictions=0,
            prediction_accuracy_pct=0.0,
            hit_rate_pct=0.0,
            driver_success_rate_pct=0.0,
            avg_pickup_time_min=0.0,
            predicted_vs_actual=[],
            prediction_breakdown=[],
            driver_impact=[],
        )

    # Build a map for quick lookup
    pred_map = {p["prediction_id"]: p for p in all_preds}

    # Prediction accuracy: |predicted - actual| / predicted <= 20% tolerance
    accurate = sum(
        1 for v in all_validations
        if v["actual_demand"] is not None
        and pred_map.get(v["prediction_id"])
        and abs(pred_map[v["prediction_id"]]["predicted_demand"] - v["actual_demand"])
           / max(pred_map[v["prediction_id"]]["predicted_demand"], 1) <= 0.20
    )
    prediction_accuracy_pct = round((accurate / validated) * 100, 1)

    # Hit rate: driver acted on prediction and got a ride
    rides = [v for v in all_validations if v["driver_got_ride"] == 1]
    hit_rate_pct = round((len(rides) / validated) * 100, 1)

    # Driver success rate: same as hit rate here (rides / total validated)
    driver_success_rate_pct = hit_rate_pct

    # Avg pickup time
    pickup_times = [v["pickup_time_minutes"] for v in rides if v["pickup_time_minutes"] is not None]
    avg_pickup_time_min = round(sum(pickup_times) / len(pickup_times), 1) if pickup_times else 0.0

    # Predicted vs Actual — 20-minute buckets over the last 8 hours, newest last
    now = datetime.utcnow()
    window_hours = 8
    bucket_minutes = 20
    total_buckets = (window_hours * 60) // bucket_minutes  # 24 buckets

    # Build bucket slots
    bucket_keys: list[str] = []
    bucket_data: dict[str, list] = {}
    for b in range(total_buckets):
        slot_start = now - timedelta(minutes=(total_buckets - b) * bucket_minutes)
        label = slot_start.strftime("%H:%M")
        bucket_keys.append(label)
        bucket_data[label] = []

    for v in all_validations:
        pred = pred_map.get(v["prediction_id"])
        if not pred or v["actual_demand"] is None:
            continue
        created = pred.get("created_at")
        if not isinstance(created, datetime):
            continue
        age_minutes = (now - created).total_seconds() / 60
        if age_minutes < 0 or age_minutes > window_hours * 60:
            continue
        bucket_index = min(int(age_minutes // bucket_minutes), total_buckets - 1)
        # Reverse: oldest is bucket_index=total_buckets-1, newest=0
        slot_label = bucket_keys[total_buckets - 1 - bucket_index]
        bucket_data[slot_label].append((pred["predicted_demand"], v["actual_demand"]))

    # Only emit buckets that have data, keep chronological order
    predicted_vs_actual = [
        ValidationPointData(
            period=label,
            predicted=round(sum(p for p, _ in bucket_data[label]) / len(bucket_data[label]), 1),
            actual=round(sum(a for _, a in bucket_data[label]) / len(bucket_data[label]), 1),
        )
        for label in bucket_keys
        if bucket_data[label]
    ]

    # Prediction breakdown by level
    breakdown: dict[str, dict] = {
        "high": {"total": 0, "hits": 0},
        "medium": {"total": 0, "hits": 0},
        "low": {"total": 0, "hits": 0},
    }
    for v in all_validations:
        pred = pred_map.get(v["prediction_id"])
        if pred:
            level = pred.get("prediction_type", "low")
            if level in breakdown:
                breakdown[level]["total"] += 1
                if v["driver_got_ride"] == 1:
                    breakdown[level]["hits"] += 1

    prediction_breakdown = [
        PredictionBreakdown(
            level=level.capitalize(),
            total=data["total"],
            hits=data["hits"],
            hit_rate=round((data["hits"] / data["total"]) * 100, 1) if data["total"] > 0 else 0.0,
        )
        for level, data in breakdown.items()
        if data["total"] > 0
    ]

    # Driver impact — same 20-min buckets, success rate + avg pickup
    impact_map: dict[str, list] = {label: [] for label in bucket_keys}
    for v in all_validations:
        pred = pred_map.get(v["prediction_id"])
        if not pred:
            continue
        created = pred.get("created_at")
        if not isinstance(created, datetime):
            continue
        age_minutes = (now - created).total_seconds() / 60
        if age_minutes < 0 or age_minutes > window_hours * 60:
            continue
        bucket_index = min(int(age_minutes // bucket_minutes), total_buckets - 1)
        slot_label = bucket_keys[total_buckets - 1 - bucket_index]
        impact_map[slot_label].append((v["driver_got_ride"], v["pickup_time_minutes"]))

    driver_impact = []
    for label in bucket_keys:
        entries = impact_map[label]
        if not entries:
            continue
        sr = round((sum(g for g, _ in entries) / len(entries)) * 100, 1)
        valid_pickups = [pt for _, pt in entries if pt is not None]
        avg_pt = round(sum(valid_pickups) / len(valid_pickups), 1) if valid_pickups else 0.0
        driver_impact.append(DriverImpactPoint(period=label, success_rate=sr, avg_pickup_min=avg_pt))

    with _VALIDATION_LOCK:
        model_state = ModelLearningState(
            current_rmse=_MODEL_STATE["rmse"],
            current_r2=_MODEL_STATE["r2"],
            generation=_MODEL_STATE["generation"],
            rmse_floor=_MODEL_STATE["rmse_floor"],
            r2_ceiling=_MODEL_STATE["r2_ceiling"],
            next_retrain_in=_MODEL_STATE["retrain_every"] - _MODEL_STATE["validations_since_retrain"],
        )
        retrain_log = [RetrainEvent(**e) for e in _MODEL_STATE["retrain_log"]]

    return ValidationMetricsResponse(
        generated_at=datetime.utcnow(),
        total_predictions=total_predictions,
        validated_predictions=validated,
        prediction_accuracy_pct=prediction_accuracy_pct,
        hit_rate_pct=hit_rate_pct,
        driver_success_rate_pct=driver_success_rate_pct,
        avg_pickup_time_min=avg_pickup_time_min,
        predicted_vs_actual=predicted_vs_actual,
        prediction_breakdown=prediction_breakdown,
        driver_impact=driver_impact,
        model_state=model_state,
        retrain_log=retrain_log,
    )
