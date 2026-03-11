export type Page = 'overview' | 'data-insights' | 'weather-insights' | 'prediction' | 'hotspot-map' | 'performance' | 'drivers' | 'go-for-ride' | 'driver-performance';
export type UserRole = 'driver' | 'admin';
export type Theme = 'dark' | 'light';

export interface KPI {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface ChartData {
  name: string;
  value: number;
  secondary?: number;
}

export interface RideRequest {
  id: string;
  pickup: string;
  drop: string;
  distance: string;
  fare: number;
  traffic: 'Low' | 'Moderate' | 'High';
  weather: string;
  eventScore: number;
  recommendation: 'ACCEPT' | 'CONSIDER' | 'REJECT';
  reasoning: string;
  borough: string;
  direction: 'North' | 'South' | 'East' | 'West';
}

export type DemandLevel = 'Low' | 'Medium' | 'High';

export interface WeatherInfo {
  temp: number;
  condition: string;
  windSpeed: number;
  rainExpectedIn: number | null; // minutes
  impactOnDemand: 'High' | 'Moderate' | 'Low';
}

export interface EventInfo {
  id: string;
  name: string;
  location: string;
  endTime: string;
  surgeNotice: string;
  intensity: 'High' | 'Medium' | 'Low';
}

export interface ZoneDemand {
  id: string;
  name: string;
  lat: number;
  lng: number;
  demand: number;
  demandLevel: DemandLevel;
  eventIntensity: 'High' | 'Medium' | 'Low';
  weatherCondition: string;
}

export interface PredictionState {
  currentDemand: DemandLevel;
  nextHourDemand: number;
  threeHourTrend: ChartData[];
  weather: WeatherInfo;
  events: EventInfo[];
  zones: ZoneDemand[];
}

export interface ModelVariantMetric {
  key: string;
  label: string;
  model_type: string;
  training_date?: string | null;
  test_rmse: number;
  test_r2: number;
  train_rmse?: number | null;
  train_r2?: number | null;
  feature_count: number;
}

export interface FeatureImportancePoint {
  name: string;
  value: number;
}

export interface MetricsResponse {
  generated_at: string;
  current_model_key: string;
  current_model_label: string;
  model_variants: ModelVariantMetric[];
  feature_importance: FeatureImportancePoint[];
}

export interface ForecastPoint {
  hour: number;
  datetime: string;
  total_predicted_demand: number;
  top_zone_id: string;
  top_zone_name: string;
  top_zone_demand: number;
}

export interface ForecastSummary {
  total_horizon_demand: number;
  peak_hour: number;
  peak_datetime: string;
  peak_zone_id: string;
  peak_zone_name: string;
  peak_zone_demand: number;
}

export interface ForecastResponse {
  generated_at: string;
  forecast: ForecastPoint[];
  summary: ForecastSummary;
}

export interface RecommendedZone {
  zone_id: string;
  zone_name: string;
  rank: number;
  expected_trips_per_hour: number;
}

export interface AvoidZone {
  zone_id: string;
  expected_trips_per_hour: number;
}

export interface HotspotZone {
  zone_id: string;
  zone_name: string;
  borough: string;
  lat: number;
  lng: number;
  predicted_demand: number;
  demand_level: DemandLevel;
  event_intensity: 'High' | 'Medium' | 'Low';
  weather_condition: string;
}

export interface HotspotPeriod {
  label: string;
  target_time: string;
  zones: HotspotZone[];
  recommended_zones: RecommendedZone[];
  avoid_zones: AvoidZone[];
}

export interface HotspotsResponse {
  generated_at: string;
  active_period: 'morning' | 'evening';
  morning: HotspotPeriod;
  evening: HotspotPeriod;
}

export interface PredictionResponse {
  requested_at: string;
  prediction_time: string;
  zone_id: string;
  zone_name: string;
  borough: string;
  lat: number;
  lng: number;
  predicted_demand: number;
  demand_level: DemandLevel;
  confidence: number;
  active_period: 'morning' | 'evening';
  model_key: string;
  model_label: string;
}

export interface WeatherResponse {
  requested_at: string;
  source: string;
  zone_id?: string | null;
  zone_name?: string | null;
  borough?: string | null;
  location_name: string;
  region?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
  local_time: string;
  condition: string;
  temp_c: number;
  temp_f: number;
  feelslike_c: number;
  humidity: number;
  wind_kph: number;
  precip_mm: number;
  cloud: number;
  demand_impact: 'Low' | 'Moderate' | 'High';
  impact_score: number;
}

export interface CopilotRequest {
  query: string;
  current_time: string;
  current_zone?: string;
}

export interface CopilotResponse {
  spoken_response: string;
  action?: {
    type: string;
    payload: string;
  };
}
