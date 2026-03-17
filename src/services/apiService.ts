import {
  CopilotResponse,
  DrowsinessUpdatePayload,
  DrowsinessResponse,
  DriverSessionResponse,
  DriverSessionTogglePayload,
  ForecastResponse,
  HotspotPeriod,
  HotspotsResponse,
  MetricsResponse,
  PredictionResponse,
  WeatherResponse,
} from '../types';
import { CacheStoreName, offlineService } from './offlineService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('load failed')
  );
}

function getCacheStore(path: string): CacheStoreName | null {
  const normalizedPath = path.split('?')[0];

  switch (normalizedPath) {
    case '/metrics':
      return 'metrics';
    case '/forecast':
      return 'forecast';
    case '/hotspots':
      return 'hotspots';
    default:
      return null;
  }
}

async function getCachedResponse<T>(storeName: CacheStoreName): Promise<T> {
  const cached = await offlineService.getFromCache<T>(storeName);
  if (cached !== null) {
    return cached;
  }

  throw new Error(`Offline and no cached ${storeName} data is available yet.`);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  const cacheStore = method === 'GET' ? getCacheStore(path) : null;

  if (method === 'GET' && cacheStore && !isBrowserOnline()) {
    return getCachedResponse<T>(cacheStore);
  }

  try {
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

    const data = await response.json() as T;

    if (method === 'GET' && cacheStore) {
      void offlineService.saveToCache(cacheStore, data).catch(() => undefined);
    }

    return data;
  } catch (error) {
    if (method === 'GET' && cacheStore && isNetworkError(error)) {
      return getCachedResponse<T>(cacheStore);
    }

    throw error;
  }
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

export async function getDrowsinessStatus(): Promise<DrowsinessResponse> {
  return fetchJson<DrowsinessResponse>('/driver/drowsiness');
}

function buildQueuedDrowsinessResponse(payload: DrowsinessUpdatePayload): DrowsinessResponse {
  return {
    ...payload,
    updated_at: payload.updated_at ?? new Date().toISOString(),
    assistant_response:
      payload.assistant_response ?? 'Offline. Safety event saved locally and will sync automatically.',
  };
}

export async function postDrowsinessStatus(payload: DrowsinessUpdatePayload): Promise<DrowsinessResponse> {
  if (!isBrowserOnline()) {
    await offlineService.addToSyncQueue('driver-drowsiness', payload);
    return buildQueuedDrowsinessResponse(payload);
  }

  try {
    return await fetchJson<DrowsinessResponse>('/driver/drowsiness', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    await offlineService.addToSyncQueue('driver-drowsiness', payload);
    return buildQueuedDrowsinessResponse(payload);
  }
}

export async function postDriverSession(payload: DriverSessionTogglePayload): Promise<DriverSessionResponse> {
  if (!isBrowserOnline()) {
    await offlineService.addToSyncQueue('driver-session', payload);
    return {
      status: 'queued',
      is_live: payload.is_live,
      queued: true,
    };
  }

  try {
    return await fetchJson<DriverSessionResponse>('/driver/session', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    await offlineService.addToSyncQueue('driver-session', payload);
    return {
      status: 'queued',
      is_live: payload.is_live,
      queued: true,
    };
  }
}

export async function askCopilot(query: string, currentTime: string): Promise<CopilotResponse> {
  return fetchJson<CopilotResponse>('/copilot/ask', {
    method: 'POST',
    body: JSON.stringify({
      query,
      current_time: currentTime,
    }),
  });
}
