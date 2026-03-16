from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class ModelVariantMetric(BaseModel):
    key: str
    label: str
    model_type: str
    training_date: str | None = None
    test_rmse: float
    test_r2: float
    train_rmse: float | None = None
    train_r2: float | None = None
    feature_count: int


class FeatureImportancePoint(BaseModel):
    name: str
    value: float


class MetricsResponse(BaseModel):
    generated_at: datetime
    current_model_key: str
    current_model_label: str
    model_variants: list[ModelVariantMetric]
    feature_importance: list[FeatureImportancePoint]


class ForecastPoint(BaseModel):
    hour: int
    datetime: datetime
    total_predicted_demand: float
    top_zone_id: str
    top_zone_name: str
    top_zone_demand: float


class ForecastSummary(BaseModel):
    total_horizon_demand: float
    peak_hour: int
    peak_datetime: datetime
    peak_zone_id: str
    peak_zone_name: str
    peak_zone_demand: float


class ForecastResponse(BaseModel):
    generated_at: datetime
    forecast: list[ForecastPoint]
    summary: ForecastSummary


class RecommendedZone(BaseModel):
    zone_id: str
    zone_name: str
    rank: int
    expected_trips_per_hour: float


class AvoidZone(BaseModel):
    zone_id: str
    expected_trips_per_hour: float


class HotspotZone(BaseModel):
    zone_id: str
    zone_name: str
    borough: str
    lat: float
    lng: float
    predicted_demand: float
    demand_level: str
    event_intensity: str
    weather_condition: str


class HotspotPeriod(BaseModel):
    label: str
    target_time: str
    zones: list[HotspotZone]
    recommended_zones: list[RecommendedZone]
    avoid_zones: list[AvoidZone]


class HotspotsResponse(BaseModel):
    generated_at: datetime
    active_period: str
    morning: HotspotPeriod
    evening: HotspotPeriod


class PredictionResponse(BaseModel):
    requested_at: datetime
    prediction_time: datetime
    zone_id: str
    zone_name: str
    borough: str
    lat: float
    lng: float
    predicted_demand: float
    demand_level: str
    confidence: float = Field(ge=0, le=1)
    active_period: str
    model_key: str
    model_label: str


class WeatherResponse(BaseModel):
    requested_at: datetime
    source: str
    zone_id: str | None = None
    zone_name: str | None = None
    borough: str | None = None
    location_name: str
    region: str | None = None
    country: str | None = None
    lat: float
    lng: float
    local_time: str
    condition: str
    temp_c: float
    temp_f: float
    feelslike_c: float
    humidity: int
    wind_kph: float
    precip_mm: float
    cloud: int
    demand_impact: str
    impact_score: float


class WellnessStatus(BaseModel):
    drive_minutes: int
    fatigue_level: str
    is_live: bool
    is_filling: bool
    progress: float


class SessionToggle(BaseModel):
    is_live: bool


class DrowsinessUpdate(BaseModel):
    status: str = "Awaiting detector"
    severity: Literal["normal", "warning", "critical"] = "warning"
    ear: float | None = None
    threshold: float | None = None
    consecutive_closed_frames: int = 0
    eyes_closed_seconds: float = 0.0
    alarm_active: bool = False
    assistant_response: str | None = None
    source: str = "webcam"
    updated_at: datetime | None = None


class DrowsinessResponse(DrowsinessUpdate):
    updated_at: datetime = Field(default_factory=datetime.utcnow)
