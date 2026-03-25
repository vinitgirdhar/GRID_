import {
  AuthTokensResponse,
  CopilotResponse,
  DriverSessionResponse,
  DriverSessionTogglePayload,
  DriverTripStateResponse,
  DrowsinessResponse,
  DrowsinessTelemetryPayload,
  DrowsinessTelemetryResponse,
  DrowsinessUpdatePayload,
  ForecastResponse,
  HotspotPeriod,
  HotspotsResponse,
  MetricsResponse,
  NotificationListResponse,
  PredictionResponse,
  PresenceUpdatePayload,
  PresenceUpdateResponse,
  TripItem,
  TripOfferListResponse,
  WeatherResponse,
} from '../types';
import { clearAuthTokens, readAuthTokens, saveAuthTokens } from './secureStorage';
import { CacheStoreName, offlineService } from './offlineService';

import { Capacitor } from '@capacitor/core';

const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();
const ENV_ANDROID_API_BASE_URL = import.meta.env.VITE_ANDROID_API_BASE_URL?.trim();
const BACKEND_UNREACHABLE_MESSAGE = 'Unable to reach the backend server. Please verify your connection.';
const ANDROID_EMULATOR_API_BASE_URL = 'http://10.0.2.2:8000/api';

function normalizeAndroidApiBase(baseUrl: string | undefined, isAndroid: boolean) {
  if (!baseUrl) {
    return null;
  }

  if (!isAndroid) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
      parsed.hostname = '10.0.2.2';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return baseUrl;
  }

  return baseUrl;
}

function buildApiCandidates() {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const nativePreferredBase = normalizeAndroidApiBase(ENV_ANDROID_API_BASE_URL ?? ENV_API_BASE_URL, isAndroid);

  const fromWindow =
    typeof window === 'undefined'
      ? []
      : [
          `${window.location.protocol}//${window.location.hostname}:8000/api`,
          `${window.location.origin}/api`,
        ];

  // Native Android should talk to the backend directly, not probe the app WebView origin.
  const candidates = [
    nativePreferredBase,
    isAndroid ? ANDROID_EMULATOR_API_BASE_URL : ENV_API_BASE_URL,
    isAndroid ? 'http://192.168.1.35:8000/api' : 'http://localhost:8000/api',
    isAndroid ? null : 'http://192.168.1.35:8000/api',
    isAndroid ? null : 'http://127.0.0.1:8000/api',
    ...(isAndroid ? [] : fromWindow),
    !isAndroid ? ANDROID_EMULATOR_API_BASE_URL : null,
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(candidates));
}

const API_BASE_CANDIDATES = buildApiCandidates();
let activeApiBaseUrl = API_BASE_CANDIDATES[0] ?? 'http://localhost:8000/api';

function buildApiUrl(base: string, path: string) {
  return `${base}${path}`;
}

function isHtmlResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('text/html');
}

function shouldTryNextBase(response: Response) {
  const status = response.status;
  // If it's a common server error OR if it returned HTML when we expected JSON (common in SPAs/Capacitor 404s)
  return status === 404 || status === 502 || status === 503 || isHtmlResponse(response);
}

export function getResolvedApiBaseUrl() {
  return activeApiBaseUrl;
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
    message.includes('load failed') ||
    message.includes('timed out') ||
    message.includes('aborted')
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

async function refreshAccessToken() {
  const tokens = await readAuthTokens();
  if (!tokens?.refreshToken) {
    return null;
  }

  let response: Response | null = null;
  let lastError: unknown;

  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const attempt = await fetch(buildApiUrl(baseUrl, '/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (attempt.ok && !isHtmlResponse(attempt)) {
        activeApiBaseUrl = baseUrl;
        response = attempt;
        break;
      }
      
      if (!shouldTryNextBase(attempt)) {
        activeApiBaseUrl = baseUrl;
        response = attempt;
        break;
      }
      response = attempt;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError instanceof Error
      ? new Error(`Failed to refresh token. Could not reach API. Last error: ${lastError.message}`)
      : new Error('Failed to refresh token.');
  }

  if (!response.ok) {
    await clearAuthTokens();
    return null;
  }

  const refreshed = (await response.json()) as AuthTokensResponse;
  await saveAuthTokens({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
  });
  return refreshed;
}

async function buildHeaders(init?: RequestInit, auth = false) {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Content-Type') && init?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const tokens = await readAuthTokens();
    if (tokens?.accessToken) {
      headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }
  }

  return headers;
}

async function fetchJson<T>(path: string, init?: RequestInit & { auth?: boolean; retry?: boolean }): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  const auth = init?.auth ?? false;
  const cacheStore = method === 'GET' ? getCacheStore(path) : null;

  if (method === 'GET' && cacheStore && !isBrowserOnline()) {
    return getCachedResponse<T>(cacheStore);
  }

  const headers = await buildHeaders(init, auth);
  let response: Response | null = null;
  let lastError: unknown;
  const orderedBases = [activeApiBaseUrl, ...API_BASE_CANDIDATES.filter((candidate) => candidate !== activeApiBaseUrl)];

  for (const baseUrl of orderedBases) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for candidate polling

      const attempt = await fetch(buildApiUrl(baseUrl, path), {
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (attempt.ok && !isHtmlResponse(attempt)) {
        activeApiBaseUrl = baseUrl;
        response = attempt;
        break;
      }

      if (!shouldTryNextBase(attempt)) {
        activeApiBaseUrl = baseUrl;
        response = attempt;
        break;
      }
      response = attempt;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    const baseHint = orderedBases.join(', ');
    throw lastError instanceof Error
      ? new Error(`Failed to fetch API. Tried: ${baseHint}. Last error: ${lastError.message}`)
      : new Error(`Failed to fetch API. Tried: ${baseHint}`);
  }

  if (isHtmlResponse(response)) {
    throw new Error(BACKEND_UNREACHABLE_MESSAGE);
  }

  if (response.status === 401 && auth && init?.retry !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchJson<T>(path, { ...init, retry: false });
    }
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as T;

  if (method === 'GET' && cacheStore) {
    void offlineService.saveToCache(cacheStore, data).catch(() => undefined);
  }

  return data;
}

export function getActiveHotspotPeriod(hotspots: HotspotsResponse): HotspotPeriod {
  return hotspots.active_period === 'morning' ? hotspots.morning : hotspots.evening;
}

export async function loginDriver(email: string, password: string): Promise<AuthTokensResponse> {
  const response = await fetchJson<AuthTokensResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveAuthTokens({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  });
  return response;
}

export async function logoutDriver() {
  try {
    await fetchJson<{ status: string }>('/auth/logout', {
      method: 'POST',
      auth: true,
    });
  } finally {
    await clearAuthTokens();
  }
}

export async function getCurrentDriver() {
  const response = await fetchJson<AuthTokensResponse['driver']>('/auth/me', { auth: true });
  return response;
}

export async function getMetrics(): Promise<MetricsResponse> {
  try {
    return await fetchJson<MetricsResponse>('/metrics');
  } catch (error) {
    if (isNetworkError(error)) {
      return getCachedResponse<MetricsResponse>('metrics');
    }
    throw error;
  }
}

export async function getForecast(): Promise<ForecastResponse> {
  try {
    return await fetchJson<ForecastResponse>('/forecast');
  } catch (error) {
    if (isNetworkError(error)) {
      return getCachedResponse<ForecastResponse>('forecast');
    }
    throw error;
  }
}

export async function getHotspots(): Promise<HotspotsResponse> {
  try {
    return await fetchJson<HotspotsResponse>('/hotspots');
  } catch (error) {
    if (isNetworkError(error)) {
      return getCachedResponse<HotspotsResponse>('hotspots');
    }
    throw error;
  }
}

export interface PredictionQuery {
  zoneId?: string;
  lat?: number;
  lng?: number;
  predictionTime?: string;
}

export async function getPrediction(query: PredictionQuery): Promise<PredictionResponse> {
  const params = new URLSearchParams();
  if (query.zoneId) params.set('zone_id', query.zoneId);
  if (typeof query.lat === 'number') params.set('lat', String(query.lat));
  if (typeof query.lng === 'number') params.set('lng', String(query.lng));
  if (query.predictionTime) params.set('prediction_time', query.predictionTime);
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
  if (query.zoneId) params.set('zone_id', query.zoneId);
  if (typeof query.lat === 'number') params.set('lat', String(query.lat));
  if (typeof query.lng === 'number') params.set('lng', String(query.lng));
  const suffix = params.toString();
  return fetchJson<WeatherResponse>(`/weather${suffix ? `?${suffix}` : ''}`);
}

export async function getTripOffers(): Promise<TripOfferListResponse> {
  return fetchJson<TripOfferListResponse>('/trips/offers', { auth: true });
}

export async function getTripState(): Promise<DriverTripStateResponse> {
  return fetchJson<DriverTripStateResponse>('/trips/active', { auth: true });
}

export async function acceptTripOffer(offerId: string): Promise<TripItem> {
  return fetchJson<TripItem>(`/trips/${offerId}/accept`, { method: 'POST', auth: true });
}

export async function startTrip(tripId: string): Promise<TripItem> {
  return fetchJson<TripItem>(`/trips/${tripId}/start`, { method: 'POST', auth: true });
}

export async function completeTrip(tripId: string): Promise<TripItem> {
  return fetchJson<TripItem>(`/trips/${tripId}/complete`, { method: 'POST', auth: true });
}

export async function getNotifications(): Promise<NotificationListResponse> {
  return fetchJson<NotificationListResponse>('/notifications', { auth: true });
}

export async function postPresenceUpdate(payload: PresenceUpdatePayload): Promise<PresenceUpdateResponse> {
  return fetchJson<PresenceUpdateResponse>('/driver/presence', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
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

export async function postDrowsinessStatus(payload: DrowsinessTelemetryPayload): Promise<DrowsinessResponse> {
  if (!isBrowserOnline()) {
    await offlineService.addToSyncQueue('driver-drowsiness', payload);
    return buildQueuedDrowsinessResponse(payload);
  }

  try {
    const event = await fetchJson<DrowsinessTelemetryResponse>('/driver/telemetry/drowsiness', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload satisfies DrowsinessTelemetryPayload),
    });
    return event;
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
    body: JSON.stringify({ query, current_time: currentTime }),
  });
}
