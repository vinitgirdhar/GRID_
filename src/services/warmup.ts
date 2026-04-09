/**
 * warmup.ts — Pre-fetches all critical API data at app boot and seeds the
 * shared `useApiData` memory cache. Every page that uses `useApiData` will
 * then render instantly from cache on first mount.
 *
 * Called once from WarmupProvider on app load. Completely silent — all errors
 * are caught so the app always boots even if the backend is down (mock data
 * from apiService fallbacks fills the cache instead).
 */

import {
  getForecast,
  getHotspots,
  getMetrics,
  getWeather,
  getPrediction,
  getActiveHotspotPeriod,
} from './apiService';

// ── Direct access to the shared cache used by useApiData ─────────────────────
// We import the seed function instead of the Map directly to keep the module
// boundary clean.
import { seedCache } from '../hooks/useApiData';

export interface WarmupProgress {
  done: number;
  total: number;
  label: string;
  status: 'running' | 'complete' | 'error';
}

type ProgressCallback = (p: WarmupProgress) => void;

// Keys must match what each page passes to useApiData as the cacheKey.
const WARMUP_TASKS: Array<{
  key: string;
  label: string;
  ttl: number;
  fetch: () => Promise<unknown>;
}> = [
  {
    key: 'forecast',
    label: 'Loading 24-hour forecast…',
    ttl: 60_000,
    fetch: getForecast,
  },
  {
    key: 'hotspots',
    label: 'Loading hotspot zones…',
    ttl: 60_000,
    fetch: getHotspots,
  },
  {
    key: 'metrics',
    label: 'Loading model metrics…',
    ttl: 120_000,
    fetch: getMetrics,
  },
  {
    key: 'prediction-default',
    label: 'Running demand prediction…',
    ttl: 60_000,
    fetch: () => getPrediction({}),
  },
  {
    key: 'weather-default',
    label: 'Fetching weather data…',
    ttl: 120_000,
    fetch: () => getWeather({}),
  },
];

let warmupPromise: Promise<void> | null = null;

/**
 * Runs all warmup tasks in parallel (with controlled concurrency).
 * Subsequent calls return the same in-flight promise — safe to call many times.
 */
export async function runWarmup(onProgress?: ProgressCallback): Promise<void> {
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    const total = WARMUP_TASKS.length;
    let done = 0;

    const report = (label: string, status: WarmupProgress['status']) => {
      onProgress?.({ done, total, label, status });
    };

    report('Connecting to backend…', 'running');

    // Phase 1: fire all tasks in parallel
    const results = await Promise.allSettled(
      WARMUP_TASKS.map(async (task) => {
        try {
          const data = await task.fetch();
          seedCache(task.key, data, task.ttl);
          done++;
          report(task.label, 'running');
          return { key: task.key, data };
        } catch {
          // Silently skip — apiService already returned mock data on error
          done++;
          report(task.label, 'running');
          return null;
        }
      }),
    );

    // Phase 2: after hotspots resolved, also warm the top-zone weather
    const hotspotsResult = results.find(
      (r) => r.status === 'fulfilled' && r.value?.key === 'hotspots',
    );
    if (hotspotsResult?.status === 'fulfilled' && hotspotsResult.value?.data) {
      try {
        const hotspots = hotspotsResult.value.data as Awaited<ReturnType<typeof getHotspots>>;
        const activePeriod = getActiveHotspotPeriod(hotspots);
        const topZone = activePeriod.zones[0];
        if (topZone) {
          const weatherKey = `weather-${topZone.zone_id}`;
          const weatherData = await getWeather({ zoneId: topZone.zone_id });
          seedCache(weatherKey, weatherData, 120_000);
        }
      } catch {
        // ignore
      }
    }

    report('Ready!', 'complete');
  })();

  return warmupPromise;
}

/** True once runWarmup has fully resolved. */
export function isWarmupComplete(): boolean {
  return warmupPromise !== null;
}
