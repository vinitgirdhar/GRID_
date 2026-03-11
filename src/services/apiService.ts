import {
  ForecastResponse,
  HotspotPeriod,
  HotspotsResponse,
  MetricsResponse,
  PredictionResponse,
  WeatherResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getActiveHotspotPeriod(hotspots: HotspotsResponse): HotspotPeriod {
  return hotspots.active_period === 'morning' ? hotspots.morning : hotspots.evening;
}

export async function getMetrics(): Promise<MetricsResponse> {
  return fetchJson<MetricsResponse>('/metrics');
}

export async function getForecast(): Promise<ForecastResponse> {
  return fetchJson<ForecastResponse>('/forecast');
}

export async function getHotspots(): Promise<HotspotsResponse> {
  return fetchJson<HotspotsResponse>('/hotspots');
}

export interface PredictionQuery {
  zoneId?: string;
  lat?: number;
  lng?: number;
  predictionTime?: string;
}

export async function getPrediction(query: PredictionQuery): Promise<PredictionResponse> {
  const params = new URLSearchParams();

  if (query.zoneId) {
    params.set('zone_id', query.zoneId);
  }

  if (typeof query.lat === 'number') {
    params.set('lat', String(query.lat));
  }

  if (typeof query.lng === 'number') {
    params.set('lng', String(query.lng));
  }

  if (query.predictionTime) {
    params.set('prediction_time', query.predictionTime);
  }

  const suffix = params.toString();
  return fetchJson<PredictionResponse>(`/predictions${suffix ? `?${suffix}` : ''}`);
}

export interface WeatherQuery {
  zoneId?: string;
  lat?: number;
  lng?: number;
}

export async function getWeather(query: WeatherQuery): Promise<WeatherResponse> {
  const params = new URLSearchParams();

  if (query.zoneId) {
    params.set('zone_id', query.zoneId);
  }

  if (typeof query.lat === 'number') {
    params.set('lat', String(query.lat));
  }

  if (typeof query.lng === 'number') {
    params.set('lng', String(query.lng));
  }

  const suffix = params.toString();
  return fetchJson<WeatherResponse>(`/weather${suffix ? `?${suffix}` : ''}`);
}

export async function askCopilot(query: string, currentTime: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/copilot/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      current_time: currentTime,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}