import {
  CopilotResponse,
  DriverEventCreate,
  DrowsinessUpdatePayload,
  DrowsinessResponse,
  Driver,
  DriverSessionResponse,
  DriverSessionTogglePayload,
  ForecastResponse,
  HotspotPeriod,
  HotspotsResponse,
  MetricsResponse,
  PredictionResponse,
  ValidationMetricsResponse,
  WeatherResponse,
  WellnessStatus,
} from '../types';
import { API_BASE_URL } from '../config/api';
import { CacheStoreName, offlineService } from './offlineService';
import {
  mockAskCopilot,
  mockComputeGoalRoute,
  mockGetDrowsinessStatus,
  mockGetValidationMetrics,
  mockListDrivers,
  mockGetForecast,
  mockGetHotspots,
  mockGetMetrics,
  mockGetPrediction,
  mockGetWeather,
  mockGetWellnessStatus,
  mockLoginDriver,
  mockLogoutDriver,
  mockPostDriverSession,
  mockPostDrowsinessStatus,
  mockRegisterDriver,
  mockUpdateDriverStatus,
} from './mockApi';

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

function isRecoverableApiError(error: unknown) {
  if (isNetworkError(error)) {
    return true;
  }

  if (error instanceof ApiRequestError) {
    return error.status === 404 || error.status >= 500;
  }

  return false;
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

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  fallback?: () => Promise<T> | T,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  const cacheStore = method === 'GET' ? getCacheStore(path) : null;

  if (method === 'GET' && cacheStore && !isBrowserOnline()) {
    return getCachedResponse<T>(cacheStore);
  }

  // Fast timeout — if the backend is unreachable, fall back to mock data quickly
  // instead of waiting for the browser's default TCP timeout (30+ seconds).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiRequestError(response.status, `API request failed with status ${response.status}`);
    }

    const data = await response.json() as T;

    if (method === 'GET' && cacheStore) {
      void offlineService.saveToCache(cacheStore, data).catch(() => undefined);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (fallback && isRecoverableApiError(error)) {
      const data = await Promise.resolve(fallback());

      if (method === 'GET' && cacheStore) {
        void offlineService.saveToCache(cacheStore, data).catch(() => undefined);
      }

      return data;
    }

    // AbortError (from our timeout) should also trigger fallback
    if (fallback && error instanceof DOMException && error.name === 'AbortError') {
      const data = await Promise.resolve(fallback());

      if (method === 'GET' && cacheStore) {
        void offlineService.saveToCache(cacheStore, data).catch(() => undefined);
      }

      return data;
    }

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
  return fetchJson<MetricsResponse>('/metrics', undefined, () => mockGetMetrics());
}

export async function getForecast(): Promise<ForecastResponse> {
  return fetchJson<ForecastResponse>('/forecast', undefined, () => mockGetForecast());
}

export async function getHotspots(): Promise<HotspotsResponse> {
  return fetchJson<HotspotsResponse>('/hotspots', undefined, () => mockGetHotspots());
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
  return fetchJson<PredictionResponse>(
    `/predictions${suffix ? `?${suffix}` : ''}`,
    undefined,
    () => mockGetPrediction({ zoneId: query.zoneId, predictionTime: query.predictionTime }),
  );
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
  return fetchJson<WeatherResponse>(
    `/weather${suffix ? `?${suffix}` : ''}`,
    undefined,
    () => mockGetWeather({ zoneId: query.zoneId }),
  );
}

export async function getDrowsinessStatus(): Promise<DrowsinessResponse> {
  return fetchJson<DrowsinessResponse>('/driver/drowsiness', undefined, () => mockGetDrowsinessStatus());
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
    }, () => mockPostDrowsinessStatus(payload));
  } catch (error) {
    if (!isNetworkError(error) && !isRecoverableApiError(error)) {
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
    }, () => mockPostDriverSession(payload));
  } catch (error) {
    if (!isNetworkError(error) && !isRecoverableApiError(error)) {
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
  }, () => mockAskCopilot(query));
}

export async function loginDriver(phone: string, password: string): Promise<Driver> {
  return fetchJson<Driver>('/drivers/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  }, () => mockLoginDriver(phone, password));
}

export interface RegisterDriverPayload {
  name: string;
  phone: string;
  password: string;
  borough: string;
  carModel: string;
}

export async function registerDriver(payload: RegisterDriverPayload): Promise<Driver> {
  return fetchJson<Driver>('/drivers/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, () => mockRegisterDriver(payload));
}

export async function getDrivers(): Promise<Driver[]> {
  return fetchJson<Driver[]>('/drivers', undefined, () => mockListDrivers());
}

export async function updateDriverStatus(driverId: string, status: 'online' | 'offline') {
  return fetchJson<Driver | null>(
    `/drivers/${driverId}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ status }),
    },
    () => mockUpdateDriverStatus(driverId, status),
  );
}

export async function logoutDriver(driverId: string) {
  return fetchJson<{ status: string }>(
    `/drivers/${driverId}/logout`,
    { method: 'POST' },
    () => mockLogoutDriver(driverId),
  );
}

// ==============================================================================
// GOAL-BASED ROUTING
// ==============================================================================

export interface GoalRouteRequest {
  time_hours: number;
  earnings_target: number;
}

export interface GoalRouteZone {
  rank: number;
  zone_id: string;
  zone_name: string;
  borough: string;
  lat: number;
  lng: number;
  estimated_minutes: number;
  estimated_trips: number;
  estimated_earnings: number;
}

export interface GoalRouteResponse {
  generated_at: string;
  time_budget_hours: number;
  earnings_target: number;
  projected_earnings: number;
  meets_target: boolean;
  zones: GoalRouteZone[];
  summary_text: string;
}

export async function computeGoalRoute(payload: GoalRouteRequest): Promise<GoalRouteResponse> {
  return fetchJson<GoalRouteResponse>('/goal-route', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, () => mockComputeGoalRoute(payload));
}

export async function getWellnessStatus(): Promise<WellnessStatus> {
  return fetchJson<WellnessStatus>('/driver/wellness', undefined, () => mockGetWellnessStatus());
}

export async function getValidationMetrics(): Promise<ValidationMetricsResponse> {
  return fetchJson<ValidationMetricsResponse>('/validation-metrics', undefined, () => mockGetValidationMetrics());
}

export async function postDriverEvent(payload: DriverEventCreate): Promise<void> {
  await fetchJson<{ ok: boolean }>('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
