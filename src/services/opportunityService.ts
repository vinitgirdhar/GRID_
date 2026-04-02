import { getPrediction } from './apiService';
import { HotspotZone, RideRequest } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────
/** Change to 30 * 60 * 1000 for production. */
export const RESOLVE_DELAY_MS = 2 * 60 * 1000; // 2 minutes (demo speed)
const STORAGE_KEY = 'grid_missed_opportunities';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MissedOpportunity {
  id: string;
  zone_id: string;
  zone_name: string;
  borough: string;
  skipped_at: string;       // ISO timestamp
  predicted_demand: number; // demand at time of skip
  estimated_fare: number;   // fare on the card when declined
  resolved: boolean;
  resolved_at?: string;
  actual_demand?: number;   // fetched after RESOLVE_DELAY_MS
  estimated_lost: number;   // computed post-resolution
  severity: 'low' | 'medium' | 'high';
}

// ─── Pub/sub ──────────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** Subscribe to any change in the opportunity store. Returns an unsubscribe fn. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
function load(): MissedOpportunity[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MissedOpportunity[];
  } catch {
    return [];
  }
}

function save(items: MissedOpportunity[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notify();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return all opportunities, newest-first. */
export function getAll(): MissedOpportunity[] {
  return [...load()].sort(
    (a, b) => new Date(b.skipped_at).getTime() - new Date(a.skipped_at).getTime(),
  );
}

/** Called when the driver clicks Decline on a ride card. */
export function recordSkip(ride: RideRequest, zone: HotspotZone): void {
  const items = load();
  // Don't double-record the same zone if it's already pending resolution
  if (items.some((o) => o.zone_id === zone.zone_id && !o.resolved)) return;

  const opp: MissedOpportunity = {
    id: crypto.randomUUID(),
    zone_id: zone.zone_id,
    zone_name: zone.zone_name,
    borough: zone.borough,
    skipped_at: new Date().toISOString(),
    predicted_demand: zone.predicted_demand,
    estimated_fare: ride.fare,
    resolved: false,
    estimated_lost: 0,
    severity: 'low',
  };
  items.push(opp);
  save(items);
}

/** Called when the driver accepts a ride — removes any pending skip for that zone. */
export function clearZone(zone_id: string): void {
  const items = load().filter((o) => !(o.zone_id === zone_id && !o.resolved));
  save(items);
}

/** Dismiss a resolved card from the feed. */
export function clearOpportunity(id: string): void {
  save(load().filter((o) => o.id !== id));
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

async function resolveOpportunity(opp: MissedOpportunity): Promise<void> {
  try {
    const result = await getPrediction({ zoneId: opp.zone_id });
    const actual_demand = result.predicted_demand;

    // If demand rose above what was predicted, the driver missed a wave.
    // estimated_lost = demand × fare / 40  →  gives plausible $ values for the UI.
    // If demand fell, it was a good call (estimated_lost stays 0).
    const estimated_lost =
      actual_demand > opp.predicted_demand
        ? Math.round(actual_demand * opp.estimated_fare / 40 * 100) / 100
        : 0;

    const severity: MissedOpportunity['severity'] =
      estimated_lost > 150 ? 'high' : estimated_lost > 50 ? 'medium' : 'low';

    const items = load();
    const idx = items.findIndex((o) => o.id === opp.id);
    if (idx === -1) return;

    items[idx] = {
      ...opp,
      resolved: true,
      resolved_at: new Date().toISOString(),
      actual_demand,
      estimated_lost,
      severity,
    };
    save(items);
  } catch {
    // Backend unreachable — mark resolved with demand=0 so UI shows "good call"
    const items = load();
    const idx = items.findIndex((o) => o.id === opp.id);
    if (idx === -1) return;
    items[idx] = {
      ...opp,
      resolved: true,
      resolved_at: new Date().toISOString(),
      actual_demand: 0,
      estimated_lost: 0,
      severity: 'low',
    };
    save(items);
  }
}

// ─── Background scanner ───────────────────────────────────────────────────────

let scanInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a background loop that resolves opportunities older than RESOLVE_DELAY_MS.
 * Returns a cleanup function. Safe to call multiple times (idempotent).
 */
export function startBackgroundScanner(): () => void {
  if (scanInterval !== null) {
    return () => {
      if (scanInterval !== null) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
    };
  }

  const scan = () => {
    const now = Date.now();
    load()
      .filter(
        (o) => !o.resolved && now - new Date(o.skipped_at).getTime() >= RESOLVE_DELAY_MS,
      )
      .forEach((o) => { void resolveOpportunity(o); });
  };

  scan(); // resolve any opportunities that survived a page refresh
  scanInterval = setInterval(scan, 60_000);

  return () => {
    if (scanInterval !== null) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
  };
}
