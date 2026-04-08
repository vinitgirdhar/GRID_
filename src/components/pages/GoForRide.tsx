import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Navigation,
  CloudRain,
  Zap,
  Filter,
  Compass,
  ArrowRight,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOffline } from '../../OfflineContext';
import MapComponent, { MapHotspot, MapRoute, MapRidePin } from '../MapComponent';
import { getActiveHotspotPeriod, getHotspots } from '../../services/apiService';
import { HotspotsResponse, HotspotZone, RideRequest } from '../../types';

const DRIVER_START: [number, number] = [40.7580, -73.9855];

// Known high-traffic landmarks — used as fallback hotspots when ML has no zone data for that area
const FALLBACK_HOTSPOTS: MapHotspot[] = [
  { id: 'fb-jfk',        position: [40.6413, -73.7781], label: 'JFK Airport',         intensity: 'high',   demand: 142 },
  { id: 'fb-lga',        position: [40.7769, -73.8740], label: 'LaGuardia Airport',   intensity: 'high',   demand: 118 },
  { id: 'fb-penn',       position: [40.7506, -73.9971], label: 'Penn Station',         intensity: 'high',   demand: 203 },
  { id: 'fb-timessq',    position: [40.7580, -73.9855], label: 'Times Square',         intensity: 'high',   demand: 280 },
  { id: 'fb-grandct',    position: [40.7527, -73.9772], label: 'Grand Central',        intensity: 'high',   demand: 195 },
  { id: 'fb-wtc',        position: [40.7127, -74.0134], label: 'World Trade Center',   intensity: 'medium', demand: 97  },
  { id: 'fb-brooklyn',   position: [40.6829, -73.9752], label: 'Downtown Brooklyn',    intensity: 'medium', demand: 88  },
  { id: 'fb-astoria',    position: [40.7721, -73.9302], label: 'Astoria / Queens',     intensity: 'medium', demand: 74  },
  { id: 'fb-bronx',      position: [40.8448, -73.8648], label: 'South Bronx',          intensity: 'low',    demand: 45  },
  { id: 'fb-statenisle', position: [40.5795, -74.1502], label: 'St. George / SI',      intensity: 'low',    demand: 31  },
  { id: 'fb-hoboken',    position: [40.7440, -74.0324], label: 'Hoboken Terminal',     intensity: 'medium', demand: 66  },
  { id: 'fb-columbia',   position: [40.8075, -73.9626], label: 'Columbia / Harlem',    intensity: 'medium', demand: 59  },
];

function buildHotspots(zones: HotspotZone[]): MapHotspot[] {
  // Build hotspots from ML zone data
  const mlHotspots: MapHotspot[] = zones.map((zone) => ({
    id: `ml-${zone.zone_id}`,
    position: [zone.lat, zone.lng] as [number, number],
    label: zone.zone_name,
    intensity: zone.demand_level === 'High' ? 'high' : zone.demand_level === 'Medium' ? 'medium' : 'low',
    demand: zone.predicted_demand,
  }));

  // Collect zone ids already covered by ML data (approximate by proximity ~0.05deg)
  const covered = (pos: [number, number]) =>
    mlHotspots.some(
      (h) => Math.abs(h.position[0] - pos[0]) < 0.05 && Math.abs(h.position[1] - pos[1]) < 0.05,
    );

  // Fill in fallback spots that aren't already covered by an ML zone
  const fallbacks = FALLBACK_HOTSPOTS.filter((f) => !covered(f.position));

  return [...mlHotspots, ...fallbacks];
}

const BOROUGH_COORDS: Record<string, [number, number]> = {
  'manhattan': [40.7580, -73.9855],
  'brooklyn': [40.6829, -73.9752],
  'queens': [40.6413, -73.7781],
  'bronx': [40.8448, -73.8648],
  'staten island': [40.5795, -74.1502],
};

const DESTINATION_BY_BOROUGH: Record<string, string> = {
  manhattan: 'Midtown Manhattan',
  brooklyn: 'Downtown Brooklyn',
  queens: 'Long Island City',
  bronx: 'South Bronx',
  'staten island': 'St. George',
};

function getDirection(start: [number, number], end: [number, number]): RideRequest['direction'] {
  const latDelta = end[0] - start[0];
  const lngDelta = end[1] - start[1];

  if (Math.abs(lngDelta) > Math.abs(latDelta)) {
    return lngDelta >= 0 ? 'East' : 'West';
  }

  return latDelta >= 0 ? 'North' : 'South';
}

function getApproxDistance(start: [number, number], end: [number, number]) {
  const latMiles = (end[0] - start[0]) * 69;
  const lngMiles = (end[1] - start[1]) * 53;
  return Math.sqrt((latMiles ** 2) + (lngMiles ** 2));
}

function buildRideRequests(zones: HotspotZone[]): RideRequest[] {
  return zones.slice(0, 6).map((zone) => {
    const position: [number, number] = [zone.lat, zone.lng];
    const distance = getApproxDistance(DRIVER_START, position);
    const recommendation: RideRequest['recommendation'] =
      zone.demand_level === 'High' ? 'ACCEPT' : zone.demand_level === 'Medium' ? 'CONSIDER' : 'REJECT';

    return {
      id: zone.zone_id,
      pickup: zone.zone_name,
      drop: DESTINATION_BY_BOROUGH[zone.borough.toLowerCase()] ?? `${zone.borough} Core`,
      distance: `${distance.toFixed(1)} mi`,
      fare: Number((12 + (zone.predicted_demand * 0.12)).toFixed(2)),
      traffic: zone.demand_level === 'High' ? 'High' : zone.demand_level === 'Medium' ? 'Moderate' : 'Low',
      weather: zone.weather_condition,
      eventScore: Math.round(zone.predicted_demand),
      recommendation,
      reasoning: `${zone.zone_name} is currently scoring ${zone.predicted_demand.toFixed(1)} predicted trips/hour in the active hotspot window.`,
      borough: zone.borough,
      direction: getDirection(DRIVER_START, position),
    };
  });
}

function resolveSearch(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === 'home') return 'brooklyn';
  if (s === 'jfk' || s === 'airport') return 'queens';
  return s;
}

export default function GoForRide({ copilotZoneId }: { copilotZoneId?: string | null }) {
  const { isOnline } = useOffline();
  const [destination, setDestination] = useState('');
  const [destinationActive, setDestinationActive] = useState(false);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getHotspots()
      .then((response) => {
        if (!cancelled) {
          setHotspots(response);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            isOnline
              ? 'Unable to load live hotspot rides. Start the FastAPI backend on port 8000 and refresh.'
              : 'Offline mode is active and no cached hotspot ride feed is available yet. Connect once to prime the cache.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  const activeZones = hotspots ? getActiveHotspotPeriod(hotspots).zones : [];
  const rideRequests = buildRideRequests(activeZones);

  useEffect(() => {
     if (copilotZoneId && hotspots && !destination) {
        const targetZone = activeZones.find(z => z.zone_id === copilotZoneId);
        if (targetZone) {
          setDestination(targetZone.borough);
          setDestinationActive(true);
        }
     }
  }, [copilotZoneId, hotspots, activeZones, destination]);

  const filteredRides = destinationActive && destination.trim()
    ? rideRequests.filter(ride => {
        const search = resolveSearch(destination);
        return (
          ride.drop.toLowerCase().includes(search) ||
          ride.borough.toLowerCase().includes(search)
        );
      })
    : [];

  const zoneById = Object.fromEntries(activeZones.map((zone) => [zone.zone_id, zone]));
  const mapHotspots = buildHotspots(activeZones);

  let mapRoute: MapRoute | undefined;
  let ridePins: MapRidePin[] = [];

  if (destinationActive && destination.trim()) {
    const search = resolveSearch(destination);
    const destCoords = BOROUGH_COORDS[search] || BOROUGH_COORDS['brooklyn'];

    mapRoute = {
      start: DRIVER_START,
      end: destCoords,
    };

    ridePins = filteredRides.map((ride) => {
      const zone = zoneById[ride.id];
      return {
        id: ride.id,
        position: [zone.lat, zone.lng],
        label: ride.pickup,
        fare: ride.fare
      };
    });
  }

  function handleActivate() {
    if (destinationActive) {
      setDestinationActive(false);
      setDestination('');
    } else if (destination.trim()) {
      setDestinationActive(true);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#facc15]" style={{fontFamily:'Outfit,sans-serif',letterSpacing:'-0.03em'}}>Go For Ride</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {destinationActive
              ? 'Showing rides along your route. Browse freely — no penalties for skipping.'
              : 'Set your destination to see ride opportunities along the way.'}
          </p>
        </div>
        <div
          className={cn(
            'self-start sm:self-auto flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0',
            isOnline ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-amber-700 bg-amber-100',
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-[var(--success)] animate-pulse' : 'bg-amber-500')} />
          {hotspots
            ? `${isOnline ? 'Live' : 'Cached'} ${hotspots.active_period} feed`
            : isOnline
              ? 'Waiting for live feed'
              : 'Waiting for cached feed'}
        </div>
      </div>

      {!isOnline && hotspots && (
        <div className="glass-card p-4 border border-amber-300/50 bg-amber-50 text-amber-950 rounded-2xl">
          <p className="text-sm font-bold">Offline Mode</p>
          <p className="text-sm mt-1">
            Ride alerts below are served from the most recent cached hotspot snapshot. New requests and map tiles are limited until the connection returns.
          </p>
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border border-[var(--danger)]/20 text-[var(--danger)] rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Destination input — full width, compact on mobile */}
      <div className={cn(
        'rounded-2xl border p-4 sm:p-5 transition-all duration-300',
        destinationActive
          ? 'bg-[var(--primary)]/8 border-[var(--primary)]/30 shadow-[0_0_24px_rgba(250,204,21,0.08)]'
          : 'glass-card hover:border-[var(--primary)]/20'
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Left: label + input + chips */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                'p-2 rounded-xl transition-colors shrink-0',
                destinationActive ? 'bg-[var(--primary)] text-[#0f172a]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]'
              )}>
                <Compass size={18} />
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] leading-tight">Where are you heading?</p>
                <p className="text-xs text-[var(--text-secondary)] leading-tight">Set destination to see rides along your route</p>
              </div>
            </div>

            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="e.g. Brooklyn, Manhattan, Airport..."
                value={destination}
                onChange={(e) => setDestination((e.target as HTMLInputElement).value)}
                disabled={destinationActive}
                onKeyDown={(e) => { if ((e as KeyboardEvent).key === 'Enter' && destination.trim()) handleActivate(); }}
                className="w-full bg-white/5 border border-[rgba(250,204,21,0.1)] rounded-xl py-2.5 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {!destinationActive && (
              <div className="flex flex-wrap gap-2">
                {['Home', 'Airport', 'Manhattan', 'Brooklyn', 'Bronx'].map((label) => (
                  <button
                    key={label}
                    onClick={() => setDestination(label)}
                    className="px-3 py-1 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 hover:text-[var(--text-primary)] transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: CTA button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleActivate}
            disabled={!destinationActive && !destination.trim()}
            className={cn(
              'w-full sm:w-auto shrink-0 py-2.5 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap',
              destinationActive
                ? 'bg-[var(--danger)] text-white'
                : destination.trim()
                  ? 'bg-[var(--text-primary)] text-[var(--background)] shadow-md'
                  : 'bg-[var(--text-primary)]/20 text-[var(--text-secondary)] cursor-not-allowed'
            )}
          >
            {destinationActive ? (
              'Clear Destination'
            ) : (
              <>Find Rides <ArrowRight size={15} /></>
            )}
          </motion.button>
        </div>
      </div>

      {/* Main content */}
      {!destinationActive ? (
        <div className="glass-card p-10 sm:p-14 text-center space-y-4 rounded-2xl">
          <div className="w-14 h-14 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto border border-[var(--border)]">
            <Compass className="text-[var(--text-secondary)] opacity-30" size={28} />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Set your destination to get started</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
            Enter where you&apos;re heading and we&apos;ll show ride opportunities along the way. Browse at your own pace.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-[var(--text-muted)]">Powered by</span>
            <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-black tracking-tight">Uber</span>
            <span className="px-2 py-0.5 rounded bg-[#3DB34A] text-white text-[10px] font-black tracking-tight">OLA</span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Map */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full bg-[var(--card)] rounded-2xl shadow-lg border border-[var(--border)] overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                <div className="w-2 h-2 rounded-full bg-[#facc15] animate-pulse" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Live Route Tracking</h3>
              </div>
              <MapComponent
                theme="light"
                height="460px"
                simplified={false}
                noBorderRadius
                route={mapRoute}
                ridePins={ridePins}
                hotspots={mapHotspots}
                offlineMode={!isOnline}
              />
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-[var(--text-muted)]">Live data from</span>
            <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-black tracking-tight">Uber</span>
            <span className="px-2 py-0.5 rounded bg-[#3DB34A] text-white text-[10px] font-black tracking-tight">OLA</span>
          </div>

          {/* Ride cards */}
          <AnimatePresence mode="popLayout">
            {filteredRides.length > 0 ? (
              filteredRides.map((ride, idx) => (
                <motion.div
                  key={ride.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, delay: idx * 0.04 }}
                  className="glass-card p-4 sm:p-5 group hover:border-[var(--primary)]/30 transition-all rounded-2xl"
                >
                  {/* Top row: route + fare */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{ride.pickup}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-1">
                        <div className="w-[1px] h-3 bg-[var(--border)] ml-[3px]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-[var(--danger)] shrink-0" />
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{ride.drop}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      {idx % 2 === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-black text-white text-[10px] font-black tracking-tight">Uber</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-[#3DB34A] text-white text-[10px] font-black tracking-tight">OLA</span>
                      )}
                      <p className="text-xl font-black text-[var(--primary)]">${ride.fare.toFixed(2)}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{ride.distance}</p>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)]">
                      <Navigation size={12} className="text-[var(--primary)] shrink-0" />
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate">{ride.traffic} Traffic</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)]">
                      <CloudRain size={12} className="text-[var(--text-secondary)] shrink-0" />
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate">{ride.weather}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)]">
                      <Zap size={12} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate">Impact {ride.eventScore}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)]">
                      <Compass size={12} className="text-[var(--success)] shrink-0" />
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate">{ride.direction}</span>
                    </div>
                  </div>

                  {/* AI reasoning + CTA */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-3">
                    <div className={cn(
                      'flex-1 p-3 rounded-xl border flex items-start gap-3',
                      ride.recommendation === 'ACCEPT' ? 'bg-[var(--success)]/5 border-[var(--success)]/20' :
                        ride.recommendation === 'CONSIDER' ? 'bg-amber-500/5 border-amber-500/20' :
                          'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                    )}>
                      <span className={cn(
                        'shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase',
                        ride.recommendation === 'ACCEPT' ? 'bg-[var(--success)] text-white' :
                          ride.recommendation === 'CONSIDER' ? 'bg-amber-500 text-white' :
                            'bg-[var(--danger)] text-white'
                      )}>
                        {ride.recommendation}
                      </span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                        <span className="not-italic font-bold text-[var(--text-primary)] flex items-center gap-1 mb-0.5">
                          <Info size={11} /> AI Reasoning
                        </span>
                        "{ride.reasoning}"
                      </p>
                    </div>

                    <button className="sm:w-32 py-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-bold text-sm rounded-xl shadow-lg shadow-[var(--primary)]/20 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]">
                      Route
                      <Navigation size={14} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="glass-card p-10 text-center space-y-3 rounded-2xl">
                <div className="w-12 h-12 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto border border-[var(--border)]">
                  <Filter className="text-[var(--text-secondary)] opacity-30" size={24} />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">No rides heading there just yet</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                  We&apos;ll refresh as soon as a matching hotspot route appears.
                </p>
                <button
                  onClick={() => { setDestinationActive(false); setDestination(''); }}
                  className="text-[var(--primary)] font-bold text-sm hover:underline"
                >
                  Change Destination
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
