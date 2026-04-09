/**
 * useApiData — generic hook for async API data with:
 *  - Instant stale-while-revalidate (shows cached data immediately)
 *  - Request deduplication (one in-flight request per key)
 *  - Configurable TTL-based smart refresh
 *  - Background refresh (no UI blocking)
 *  - Debounce support for parameter-driven queries
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ── In-memory cache shared across all hook instances ──────────────────────────
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

// ── Hook ──────────────────────────────────────────────────────────────────────
interface UseApiDataOptions {
  /** Cache TTL in milliseconds. Default: 30 000 (30 s). */
  ttl?: number;
  /** If true, the fetch is skipped until enabled. Default: false. */
  skip?: boolean;
  /** Debounce delay in milliseconds for fast-changing params. Default: 0. */
  debounceMs?: number;
  /** Refetch interval in milliseconds (0 = disabled). Default: 0. */
  refetchInterval?: number;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useApiData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: UseApiDataOptions = {},
): UseApiDataResult<T> {
  const { ttl = 30_000, skip = false, debounceMs = 0, refetchInterval = 0 } = options;

  // Pull any cached data immediately (stale-while-revalidate)
  const initial = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  const [data, setData] = useState<T | null>(initial?.data ?? null);
  const [loading, setLoading] = useState(!initial && !skip);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(
    async (force = false) => {
      if (skip) return;

      const cached = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
      const isStale = !cached || Date.now() - cached.fetchedAt > ttl;

      // Serve from cache if still fresh and not forced
      if (cached && !isStale && !force) {
        if (mountedRef.current) {
          setData(cached.data);
          setLoading(false);
        }
        return;
      }

      // If a request is already in-flight, attach to it
      if (inFlightRequests.has(cacheKey)) {
        try {
          const result = await (inFlightRequests.get(cacheKey) as Promise<T>);
          if (mountedRef.current) {
            setData(result);
            setLoading(false);
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        }
        return;
      }

      // Show loading only when we have no stale data to display
      if (!cached) {
        if (mountedRef.current) setLoading(true);
      }

      const promise = fetcherRef.current();
      inFlightRequests.set(cacheKey, promise as Promise<unknown>);

      try {
        const result = await promise;
        memoryCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
        if (mountedRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          // Keep stale data visible on error
          if (!cached) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
          setLoading(false);
        }
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, skip, ttl],
  );

  // Trigger fetch (with optional debounce) whenever cacheKey or skip changes
  useEffect(() => {
    mountedRef.current = true;

    if (skip) return;

    if (debounceMs > 0) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => doFetch(), debounceMs);
    } else {
      doFetch();
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [cacheKey, skip, doFetch, debounceMs]);

  // Background refetch interval
  useEffect(() => {
    if (!refetchInterval || skip) return;
    const id = setInterval(() => doFetch(), refetchInterval);
    return () => clearInterval(id);
  }, [refetchInterval, skip, doFetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(() => doFetch(true), [doFetch]);

  return { data, loading, error, refetch };
}

/**
 * Clear all or a specific cache entry. Useful after mutations.
 */
export function invalidateCache(cacheKey?: string) {
  if (cacheKey) {
    memoryCache.delete(cacheKey);
  } else {
    memoryCache.clear();
  }
}

/**
 * Directly seed the cache with pre-fetched data (used by warmup.ts).
 * Only writes if the cache entry is absent or older than ttl.
 */
export function seedCache<T>(cacheKey: string, data: T, ttl = 30_000): void {
  const existing = memoryCache.get(cacheKey);
  if (!existing || Date.now() - existing.fetchedAt > ttl) {
    memoryCache.set(cacheKey, { data, fetchedAt: Date.now() });
  }
}
