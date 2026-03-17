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
import MapComponent, { MapRoute, MapRidePin } from '../MapComponent';
import { getActiveHotspotPeriod, getHotspots } from '../../services/apiService';
import { HotspotsResponse, HotspotZone, RideRequest } from '../../types';

const DRIVER_START: [number, number] = [40.7580, -73.9855];

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
      distance: `${distance.toFixed(1)} miles`,
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

export default function GoForRide({ copilotZoneId }: { copilotZoneId?: string | null }) {
  const { isOnline } = useOffline();
  const [destinationModeActive, setDestinationModeActive] = useState(!!copilotZoneId);
  const [destination, setDestination] = useState('');
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

  // If a copilotZoneId was passed in and hotspot data is loaded, try to set the destination 
  // to that zone's borough if we haven't already set one.
  useEffect(() => {
     if (copilotZoneId && hotspots && !destination) {
        const targetZone = activeZones.find(z => z.zone_id === copilotZoneId);
        if (targetZone) {
          setDestination(targetZone.borough);
          setDestinationModeActive(true);
        }
     }
  }, [copilotZoneId, hotspots, activeZones, destination]);

  const filteredRides = rideRequests.filter(ride => {
    if (!destinationModeActive || !destination.trim()) return true;

    let search = destination.toLowerCase();
    if (search === 'home') search = 'brooklyn';
    if (search === 'jfk' || search === 'airport') search = 'queens';

    return (
      ride.drop.toLowerCase().includes(search) ||
      ride.borough.toLowerCase().includes(search)
    );
  });

  const zoneById = Object.fromEntries(activeZones.map((zone) => [zone.zone_id, zone]));

  let mapRoute: MapRoute | undefined;
  let ridePins: MapRidePin[] = [];

  if (destinationModeActive) {
    let search = destination.toLowerCase();
    if (search === 'home') search = 'brooklyn';
    if (search === 'jfk' || search === 'airport') search = 'queens';

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Go For Ride</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {isOnline
              ? 'Live ride opportunities generated from the current hotspot feed.'
              : 'Cached ride opportunities remain available while the connection is down.'}
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full',
            isOnline ? 'text-success bg-success/10' : 'text-amber-700 bg-amber-100',
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-amber-500')}></span>
          {hotspots
            ? `${isOnline ? 'Live' : 'Cached'} ${hotspots.active_period} feed`
            : isOnline
              ? 'Waiting for live feed'
              : 'Waiting for cached feed'}
        </div>
      </div>

      {!isOnline && hotspots && (
        <div className="glass-card p-4 border border-amber-300/50 bg-amber-50 text-amber-950">
          <p className="text-sm font-bold">Offline Mode</p>
          <p className="text-sm mt-1">
            Ride alerts below are being served from the most recent cached hotspot snapshot. New requests and map tiles are limited until the connection returns.
          </p>
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Destination Mode Panel */}
        <div className="lg:col-span-4">
          <div className={cn(
            "p-6 rounded-2xl border transition-all duration-300 sticky top-24",
            destinationModeActive
              ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-[0_0_30px_rgba(250,204,21,0.1)]"
              : "glass-card hover:border-[var(--primary)]/20"
          )}>
            <div className="flex items-start gap-4 mb-6">
              <div className={cn(
                "p-3 rounded-xl transition-colors",
                destinationModeActive ? "bg-[var(--primary)] text-[#0f172a]" : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]"
              )}>
                <Compass size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Destination Mode</h2>
                <p className="text-sm text-[var(--text-secondary)] leading-tight mt-1">
                  Filter live hotspot rides to routes heading toward the same borough corridor.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3 relative">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider pl-1">Set Destination</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="e.g. Home, Brooklyn..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    disabled={destinationModeActive}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Quick Destinations */}
                {!destinationModeActive && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => setDestination('Home')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => setDestination('Airport')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Airport
                    </button>
                    <button
                      onClick={() => setDestination('Manhattan')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Downtown
                    </button>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDestinationModeActive(!destinationModeActive)}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2",
                  destinationModeActive
                    ? "bg-danger hover:bg-danger/90 text-white shadow-danger/20"
                    : "bg-[var(--text-primary)] hover:bg-[var(--text-primary)]/90 text-[var(--background)] shadow-[var(--border)]"
                )}
              >
                {destinationModeActive ? (
                  <>Stop Destination Mode</>
                ) : (
                  <>Activate Destination Mode <ArrowRight size={16} /></>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Ride Requests Feed & Map */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence>
            {destinationModeActive && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                className="w-full bg-[var(--card)] p-2 rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-3 mb-2 border-b border-[var(--border)]">
                  <div className="w-2 h-2 rounded-full bg-[#facc15] animate-pulse" />
                  <h3 className="font-bold text-[var(--text-primary)]">Live Route Tracking</h3>
                </div>
                <MapComponent
                  theme="light"
                  height="350px"
                  simplified={false}
                  route={mapRoute}
                  ridePins={ridePins}
                  offlineMode={!isOnline}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {filteredRides.length > 0 ? (
              filteredRides.map((ride, idx) => (
                <motion.div
                  key={ride.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="glass-card p-6 group hover:border-primary/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{ride.pickup}</p>
                          </div>
                          <div className="w-[1px] h-4 bg-[var(--border)] ml-1"></div>
                          <div className="flex items-center gap-3">
                            <MapPin size={14} className="text-danger" />
                            <p className="text-sm font-bold text-[var(--text-primary)]">{ride.drop}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary">${ride.fare.toFixed(2)}</p>
                          <p className="text-xs text-[var(--text-secondary)] font-medium">{ride.distance}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Navigation size={14} className="text-primary" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.traffic} Traffic</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <CloudRain size={14} className="text-secondary" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.weather}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Zap size={14} className="text-warning" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Impact: {ride.eventScore}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Compass size={14} className="text-success" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.direction}</span>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 rounded-2xl border flex items-start gap-4",
                        ride.recommendation === 'ACCEPT' ? "bg-success/5 border-success/20" :
                          ride.recommendation === 'CONSIDER' ? "bg-warning/5 border-warning/20" :
                            "bg-danger/5 border-danger/20"
                      )}>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                          ride.recommendation === 'ACCEPT' ? "bg-success text-white" :
                            ride.recommendation === 'CONSIDER' ? "bg-warning text-white" :
                              "bg-danger text-white"
                        )}>
                          {ride.recommendation}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                            <Info size={12} /> AI Reasoning
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                            “{ride.reasoning}”
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col justify-center gap-3">
                      <button className="flex-1 md:flex-none w-full md:w-32 py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group-hover:scale-105">
                        Accept
                        <ArrowRight size={16} />
                      </button>
                      <button className="flex-1 md:flex-none w-full md:w-32 py-4 bg-[var(--background)] border border-[var(--border)] hover:bg-danger/10 hover:border-danger/30 text-[var(--text-secondary)] hover:text-danger font-bold rounded-2xl transition-all">
                        Decline
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="glass-card p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto">
                  <Filter className="text-[var(--text-secondary)] opacity-30" size={32} />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">No rides heading there just yet</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">We&apos;ll refresh the hotspot-backed opportunities as soon as a matching route appears.</p>
                <button
                  onClick={() => setDestinationModeActive(false)}
                  className="text-primary font-bold text-sm hover:underline"
                >
                  Cancel Destination Mode
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
