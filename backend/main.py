from contextlib import asynccontextmanager
from datetime import datetime
from math import hypot
from pathlib import Path
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .schemas import (
    AvoidZone,
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
    WeatherResponse,
)


settings = get_settings()

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
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


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
        resolved_zone_id = _pick_zone_from_coordinates(lat, lng)

    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Provide zone_id or both lat and lng.")

    return _fetch_weather_snapshot(resolved_zone_id, lat, lng)