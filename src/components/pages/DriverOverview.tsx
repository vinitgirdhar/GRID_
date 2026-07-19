import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  CheckCircle,
  Percent,
  Zap,
  CloudRain,
  Thermometer,
  Wind,
  Calendar,
  MapPin,
  Clock,
  X,
  Leaf,
  AlertTriangle,
  TrainFront
} from 'lucide-react';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getActiveHotspotPeriod, getDrivers, getForecast, getHotspots, getTransit, getWeather, postDriverSession } from '../../services/apiService';
import { useApiData } from '../../hooks/useApiData';
import { useLiveStream } from '../../hooks/useLiveStream';
import { Driver, ForecastResponse, HotspotsResponse, Theme, TransitResponse, WeatherResponse, ZoneDemand } from '../../types';
import MapComponent, { MapDriverPin } from '../MapComponent';
import { cn } from '../../lib/utils';

const REFRESH_INTERVAL_MS = 60000;

function getWeatherFactor(condition?: string) {
  const normalized = (condition ?? '').toLowerCase();
  if (normalized.includes('rain')) return 1.12;
  if (normalized.includes('storm')) return 1.2;
  if (normalized.includes('snow')) return 1.18;
  if (normalized.includes('cloud')) return 1.05;
  return 1.0;
}

function getEventFactor(level?: string) {
  if (level === 'High') return 1.15;
  if (level === 'Medium') return 1.08;
  return 1.0;
}

export default function DriverOverview({
  currentHour,
  isLive,
  setIsLive
}: {
  currentHour?: number;
  isLive?: boolean;
  setIsLive?: (val: boolean) => void;
}) {
  const activeHour = currentHour ?? new Date().getHours();
  const { data: forecast, error: forecastError } = useApiData('forecast', getForecast, {
    ttl: 60000
  });

  const { data: hotspots, error: hotspotsError } = useApiData('hotspots', getHotspots, {
    ttl: 60000
  });

  const [theme, setTheme] = useState<Theme>('dark');
  const [expandedCard, setExpandedCard] = useState<'demand' | 'weather' | 'event' | 'transit' | null>(null);
  const [ecoMode, setEcoMode] = useState(false);

  // Live fleet: other drivers currently on the road (initial fetch + SSE updates)
  const { data: initialDrivers } = useApiData<Driver[]>('fleet-drivers', getDrivers, { ttl: 60000 });
  const [liveDrivers, setLiveDrivers] = useState<Driver[] | null>(null);
  useLiveStream({ onDrivers: (d) => setLiveDrivers(d) });
  const fleetDrivers = liveDrivers ?? initialDrivers ?? [];
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Virtual driver location: Midtown Manhattan, NYC (fixed — no real GPS)
  const VIRTUAL_DRIVER_LOCATION: [number, number] = [40.7549, -73.9840];

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          setTheme(isDarkNow ? 'dark' : 'light');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => {
      observer.disconnect();
    };
  }, []);

  // Real geolocation removed — app operates in virtual NYC mode.

  const activePeriod = hotspots
    ? (activeHour < 15 ? hotspots.morning : hotspots.evening)
    : null;
  const primaryZone = activePeriod?.zones[0];

  const primaryZoneId = primaryZone?.zone_id;
  const { data: weather, error: weatherError } = useApiData(
    primaryZoneId ? `weather-${primaryZoneId}` : '--skip--',
    () => primaryZoneId ? getWeather({ zoneId: primaryZoneId }) : Promise.resolve(null as any),
    { ttl: 120000 }
  );

  const { data: transit } = useApiData<TransitResponse>(
    'transit',
    () => getTransit(),
    { ttl: 120000 }
  );

  const nearestTransitZone = useMemo(() => {
    if (!transit || !primaryZoneId) return transit?.zones[0] ?? null;
    return transit.zones.find(z => z.zone_id === primaryZoneId) ?? transit.zones[0] ?? null;
  }, [transit, primaryZoneId]);

  const isLocalHost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const error = (forecastError || hotspotsError || weatherError)
    ? (isLocalHost
      ? 'Unable to load data from the backend API. Ensure FastAPI is running on port 8000.'
      : 'Unable to connect to the live intelligence feed. Showing simulated demand data.')
    : null;

  // Dynamic forecast slicing: find the entry matching the simulated hour and show the next 4 hours
  const forecastStartIndex = forecast?.forecast.findIndex(p => p.hour === activeHour) ?? -1;
  const trendSlice = forecast && forecastStartIndex >= 0
    ? forecast.forecast.slice(forecastStartIndex, forecastStartIndex + 4)
    : forecast?.forecast.slice(0, 4) ?? [];
  const trendData = trendSlice.map((point, index) => ({
    name: index === 0 ? 'Now' : `+${index}h`,
    value: point.total_predicted_demand,
  }));

  // Dynamic peak: find the peak from the remaining hours in the day
  const remainingForecast = forecast && forecastStartIndex >= 0
    ? forecast.forecast.slice(forecastStartIndex)
    : forecast?.forecast ?? [];
  const dynamicPeak = remainingForecast.length > 0
    ? remainingForecast.reduce((best, p) => p.total_predicted_demand > best.total_predicted_demand ? p : best, remainingForecast[0])
    : null;

  // Current hour forecast point
  const currentForecastPoint = forecast?.forecast.find(p => p.hour === activeHour) ?? null;

  const displayHour = activeHour % 24;
  const period = displayHour >= 12 ? 'PM' : 'AM';
  const h12 = displayHour % 12 || 12;
  const timeLabel = `${h12}:00 ${period}`;

  const liveKpis = [
    {
      label: 'Busiest Area Right Now',
      value: currentForecastPoint ? `${currentForecastPoint.total_predicted_demand.toFixed(0)}` : (primaryZone ? `${primaryZone.predicted_demand.toFixed(1)}` : '--'),
      change: currentForecastPoint?.top_zone_name ?? primaryZone?.zone_name ?? 'Best place to be',
      icon: DollarSign,
    },
    {
      label: 'Hot Zones — Where to Go',
      value: String(activePeriod?.recommended_zones.length ?? 0),
      change: `${activePeriod?.recommended_zones.length ?? 0} hot zones active right now`,
      icon: CheckCircle,
    },
    {
      label: 'Best Time to Drive',
      value: dynamicPeak ? `${dynamicPeak.hour % 12 || 12}:00 ${dynamicPeak.hour >= 12 ? 'PM' : 'AM'}` : '--',
      change: dynamicPeak ? `Earnings peak at ${dynamicPeak.hour % 12 || 12}:00 ${dynamicPeak.hour >= 12 ? 'PM' : 'AM'}` : '--',
      icon: Percent,
    },
    {
      label: 'Weather Boost',
      value: primaryZone?.weather_condition ?? '--',
      change: 'Rainy weather means more rides',
      icon: Zap,
    },
  ];

  // How many drivers are heading to each zone right now
  const headingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of fleetDrivers) {
      if (d.status === 'driving' && d.target_zone) {
        counts[d.target_zone] = (counts[d.target_zone] ?? 0) + 1;
      }
    }
    return counts;
  }, [fleetDrivers]);

  // Other drivers on the road → map pins
  const driverPins: MapDriverPin[] = useMemo(() =>
    fleetDrivers
      .filter((d) => d.status === 'driving' && d.lat != null && d.lng != null)
      .map((d) => ({
        id: d.id,
        position: [d.lat as number, d.lng as number] as [number, number],
        name: d.name,
        targetLabel: d.target_zone ? `Zone ${d.target_zone}` : 'a pickup',
      })),
  [fleetDrivers]);

  // Crowding demotes zone priority: 3+ drivers → Low (green), 1–2 → one level down
  const demoteLevel = (level: ZoneDemand['demandLevel'], count: number): ZoneDemand['demandLevel'] => {
    if (count >= 3) return 'Low';
    if (count >= 1) return level === 'High' ? 'Medium' : 'Low';
    return level;
  };

  const mapZones: ZoneDemand[] = useMemo(() => {
    const zones = activePeriod?.zones.map((zone) => {
      const heading = headingCounts[zone.zone_id] ?? 0;
      return {
        id: zone.zone_id,
        name: zone.zone_name,
        lat: zone.lat,
        lng: zone.lng,
        demand: zone.predicted_demand,
        demandLevel: demoteLevel(zone.demand_level, heading),
        eventIntensity: zone.event_intensity,
        weatherCondition: zone.weather_condition,
        driversHeading: heading,
      };
    }) ?? [];

    if (!ecoMode || zones.length === 0) return zones;

    // Eco mode: sort by proximity-weighted efficiency (demand / distance)
    const [driverLat, driverLng] = VIRTUAL_DRIVER_LOCATION;
    const withDistance = zones.map(z => {
      const dLat = z.lat - driverLat;
      const dLng = z.lng - driverLng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 0.001; // degrees, ~0.01 ≈ 1km in NYC
      return { zone: z, dist, efficiency: z.demand / dist };
    });
    withDistance.sort((a, b) => b.efficiency - a.efficiency);
    return withDistance.map(w => w.zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod, ecoMode, headingCounts]);

  const ecoStats = useMemo(() => {
    if (!ecoMode || mapZones.length === 0) return null;
    const [driverLat, driverLng] = VIRTUAL_DRIVER_LOCATION;
    const nearbyCount = mapZones.filter(z => {
      const dLat = z.lat - driverLat;
      const dLng = z.lng - driverLng;
      return Math.sqrt(dLat * dLat + dLng * dLng) < 0.03; // ~3km radius
    }).length;
    const topZone = mapZones[0];
    const estimatedCO2 = (nearbyCount * 0.4).toFixed(1); // rough kg saved by shorter trips
    return { nearbyCount, topZone, estimatedCO2 };
  }, [ecoMode, mapZones]);

  const baseDemand = currentForecastPoint?.total_predicted_demand ?? primaryZone?.predicted_demand ?? 0;
  const hourlyForecast = trendData[1]?.value ?? trendData[0]?.value ?? 0;
  const weatherFactor = getWeatherFactor(weather?.condition ?? primaryZone?.weather_condition);
  const eventFactor = getEventFactor(primaryZone?.event_intensity);
  const weatherLift = baseDemand * (weatherFactor - 1);
  const eventLift = baseDemand * (eventFactor - 1);
  const horizonLift = hourlyForecast * 0.18;
  const formulaPrediction = baseDemand + weatherLift + eventLift + horizonLift;

  const formulaData = [
    { name: 'Base Zone', value: Number(baseDemand.toFixed(2)) },
    { name: 'Weather Lift', value: Number(weatherLift.toFixed(2)) },
    { name: 'Event Lift', value: Number(eventLift.toFixed(2)) },
    { name: 'Horizon Lift', value: Number(horizonLift.toFixed(2)) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-heading font-light tracking-tight text-[var(--primary)]" style={{ letterSpacing: '-0.03em' }}>Intelligence</h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">Urban demand & awareness &middot; <span className="text-[var(--primary)] font-medium">{timeLabel}</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEcoMode((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${ecoMode ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-[rgba(250,204,21,0.15)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            title="Toggle Eco-Mode"
          >
            <Leaf size={13} />
            {ecoMode ? 'Eco On' : 'Eco'}
          </button>
          <button
            onClick={() => setShowAdvanced((prev: boolean) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${showAdvanced ? 'bg-[rgba(250,204,21,0.12)] border-[rgba(250,204,21,0.3)] text-[var(--primary)]' : 'bg-white/5 border-[rgba(250,204,21,0.15)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            title="Toggle advanced data"
          >
            🔬 Deep Data {showAdvanced ? '▴' : '▾'}
          </button>
          <button
            onClick={async () => {
              const nextLive = !isLive;
              setIsLive?.(nextLive);
              try {
                await postDriverSession({ is_live: nextLive });
              } catch (e) {
                console.error('Failed to sync session with backend:', e);
              }
            }}
            className={cn(
              "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-300 shadow-sm",
              isLive
                ? "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/25"
                : "text-[var(--text-muted)] bg-white/5 border-[rgba(250,204,21,0.15)] hover:text-[var(--text-secondary)]"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              isLive ? "bg-[var(--success)] animate-pulse-soft" : "bg-[var(--text-muted)]"
            )}></span>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </button>
        </div>
      </div>

      {/* Eco Mode Banner */}
      {ecoMode && (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <Leaf size={18} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-400">Eco-Mode Active — Nearby-First Routing</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {ecoStats
                ? <>Prioritizing <span className="font-medium text-green-400">{ecoStats.nearbyCount}</span> nearby zone{ecoStats.nearbyCount !== 1 ? 's' : ''}. Top pick: <span className="font-medium text-green-400">{ecoStats.topZone?.name ?? '--'}</span>. Est. CO₂ saved: <span className="font-medium text-green-400">{ecoStats.estimatedCO2} kg</span>.</>
                : <>GRID is routing you through fuel-efficient, low-idle paths.</>
              }
            </p>
          </div>
        </div>
      )}

      {/* Urgency AI Banner (when high demand is expected) */}
      {primaryZone?.demand_level === 'High' && (
        <div className="p-4 rounded-2xl bg-[var(--danger)]/8 border border-[var(--danger)]/20 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[var(--danger)] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--danger)]">🔥 Surge Alert: High demand in {primaryZone?.zone_name ?? 'your zone'}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Position now for maximum earnings. Demand peaks at {' '}
              <span className="font-medium text-[var(--danger)]">
                {dynamicPeak ? `${dynamicPeak.hour % 12 || 12}:00 ${dynamicPeak.hour >= 12 ? 'PM' : 'AM'}` : 'peak window'}
              </span> {' '}
              in your area.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-danger/10 hover:bg-danger/20 rounded-lg text-xs font-mono font-medium uppercase tracking-widest text-danger transition-colors cursor-pointer">
            Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {liveKpis.map((kpi, idx) => (
          <div key={kpi.label} className="kpi-card !p-3 sm:!p-4">
            {/* Icon row hidden on mobile — halves card height so all 4 KPIs fit one screen */}
            <div className="hidden sm:block mb-3">
              <div className="p-1.5 bg-primary/10 rounded-lg inline-flex">
                {idx === 0 && <DollarSign className="text-primary w-4 h-4" />}
                {idx === 1 && <CheckCircle className="text-success w-4 h-4" />}
                {idx === 2 && <Percent className="text-warning w-4 h-4" />}
                {idx === 3 && <Zap className="text-sky-500 w-4 h-4" />}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-mono text-[var(--text-secondary)] mb-1 leading-tight">{kpi.label}</p>
              {idx === 0 ? (
                <>
                  <p className="text-lg font-extrabold text-[var(--text-primary)] leading-tight tracking-tight truncate">{kpi.change}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5">{kpi.value} rides predicted</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight">{kpi.value}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 truncate">{kpi.change}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <MapPin className="text-sky-500 w-5 h-5" />
            </div>
            <h3 className="font-heading font-medium text-[var(--text-primary)]">Hotspot Map</h3>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-danger shrink-0"></div>
              <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-warning shrink-0"></div>
              <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#22c55e' }}></div>
              <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#0ea5e9' }}></div>
              <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Other Drivers</span>
            </div>
          </div>
        </div>

        <Suspense fallback={<div style={{ height: '450px' }} className="rounded-xl bg-[var(--surface)] animate-pulse" />}>
          <MapComponent
            zones={mapZones}
            theme={theme}
            height="450px"
            simplified={true}
            zoom={13}
            autoFit={true}
            showYouAreHere={true}
            youAreHerePosition={VIRTUAL_DRIVER_LOCATION}
            driverPins={driverPins}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div
          onClick={() => setExpandedCard('demand')}
          className="glass-card p-4 sm:p-6 flex flex-col h-full cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <h3 className="font-heading font-medium text-[var(--text-primary)]">Where Money Is</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-heading font-medium text-[var(--danger)] leading-tight">High Demand Expected</p>
                <span className="px-2 py-1 bg-[var(--danger)]/10 text-[var(--danger)] text-[10px] font-mono font-medium rounded uppercase tracking-widest border border-[var(--danger)]/20">HIGH DEMAND</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Area</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{primaryZone ? `${primaryZone.borough} - ${primaryZone.zone_name}` : '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Expected pickups</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{primaryZone ? primaryZone.predicted_demand.toFixed(1) : '--'}</p>
                </div>
              </div>
            </div>

            {showAdvanced && (
              <div className="h-[100px] w-full mt-4">
                <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-2">3 Hour Trend</p>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="basis"
                      dataKey="value"
                      stroke="var(--primary-dark)"
                      fillOpacity={1}
                      fill="url(#colorDemand)"
                      strokeWidth={3}
                      activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }}
                    />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d0d20', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', fontSize: '11px' }}
                      itemStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-[var(--primary-dark)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-heading font-medium text-[var(--primary-dark)] not-italic">Tip:</span> "Position near {primaryZone?.zone_name ?? 'the top zone'} during the active hotspot window."
              </p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setExpandedCard('weather')}
          className="glass-card p-4 sm:p-6 flex flex-col h-full cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <CloudRain className="text-sky-500 w-5 h-5" />
            </div>
            <h3 className="font-heading font-medium text-[var(--text-primary)]">Weather Effect</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-heading font-medium text-[var(--accent)] leading-tight">Weather-Adjusted Demand</p>
                <span className="px-2 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-mono font-medium rounded uppercase tracking-widest border border-sky-500/20">
                  {weather?.condition ?? primaryZone?.weather_condition ?? 'Checking...'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Area</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{weather?.location_name ?? primaryZone?.borough ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{activePeriod?.label ?? '--'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">{weather ? `${weather.temp_f.toFixed(1)}°F` : '--'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">{weather ? `${weather.wind_kph.toFixed(1)} kph` : '--'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/15">
              <p className="text-xs font-heading font-medium text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Current weather is <span className="text-sky-400 font-medium">{weather?.condition ?? primaryZone?.weather_condition ?? 'Unknown'}</span>
                {' '}with demand impact rated <span className="text-sky-400 font-medium">{weather?.demand_impact ?? 'Unknown'}</span>.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-sky-500 mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-heading font-medium text-sky-500 not-italic">Tip:</span> "Use weather as confirmation, but follow the hotspot ranking first."
              </p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setExpandedCard('event')}
          className="glass-card p-4 sm:p-6 flex flex-col h-full cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Calendar className="text-warning w-5 h-5" />
            </div>
            <h3 className="font-heading font-medium text-[var(--text-primary)]">Nearby Events</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-heading font-medium text-[var(--warning)] leading-tight">Events Boosting Rides</p>
                <span className="px-2 py-1 bg-[var(--warning)]/10 text-[var(--warning)] text-[10px] font-mono font-medium rounded uppercase tracking-widest border border-[var(--warning)]/20">EVENT BOOST</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Area</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{activePeriod?.recommended_zones[0]?.zone_name ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Expected Surge</p>
                  <p className="text-sm font-medium text-warning">{primaryZone?.demand_level ?? '--'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20">
              <p className="text-xs font-heading font-medium text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Focus on the top recommended zone and avoid low-yield zones: {activePeriod?.avoid_zones.map((zone) => zone.zone_id).join(', ') || '--'}.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-[var(--warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-heading font-medium text-[var(--warning)] not-italic">Tip:</span> "Cycle toward the highest-ranked zone before the peak forecast hour."
              </p>
            </div>
          </div>
        </div>
        <div
          onClick={() => setExpandedCard('transit')}
          className="glass-card p-4 sm:p-6 flex flex-col h-full cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrainFront className="text-emerald-500 w-5 h-5" />
            </div>
            <h3 className="font-heading font-medium text-[var(--text-primary)]">Transit Hubs</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-heading font-medium text-emerald-400 leading-tight">Subway & Bus Coverage</p>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-medium rounded uppercase tracking-widest border border-emerald-500/20">TRANSIT</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Nearest Hub</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{nearestTransitZone?.borough ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Active Routes</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{nearestTransitZone?.total_routes ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Trips Today</p>
                  <p className="text-sm font-medium text-emerald-400">{nearestTransitZone?.total_trips ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">Stops Covered</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{nearestTransitZone?.total_stops ?? '--'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-xs font-heading font-medium text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {nearestTransitZone
                  ? <>{nearestTransitZone.subway_routes} subway + {nearestTransitZone.bus_routes} bus routes serving {nearestTransitZone.total_stops} stops near your zone.</>
                  : 'Loading transit data...'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-heading font-medium text-emerald-500 not-italic">Tip:</span> "Position near busy transit stops — passengers exiting subways often need rides."
              </p>
            </div>
          </div>
        </div>      </div>

      {showAdvanced && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest bg-[var(--primary)]/10 text-[var(--primary-dark)] rounded border border-[var(--primary)]/20">
              Advanced data is showing — charts &amp; raw numbers
            </span>
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-medium text-[var(--text-primary)]">Demand Breakdown</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                How GRID calculates demand: base + weather + events + time-of-day boost.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)]">Estimated Next-Hour Demand</p>
              <p className="text-2xl font-heading font-medium text-[var(--primary)]">{formulaPrediction.toFixed(1)}</p>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formulaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d0d20', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '8px' }}
                  formatter={(value: number) => [value.toFixed(2), 'Contribution']}
                  cursor={{ fill: 'rgba(250,204,21,0.04)' }}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}



      {/* Dynamic Details Modal */}
      {expandedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 animate-in fade-in duration-200"
          onClick={() => setExpandedCard(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-[#0a0a1e] rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-[rgba(250,204,21,0.15)] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[rgba(250,204,21,0.1)]">
              <div className="flex items-center gap-3">
                {expandedCard === 'demand' && (
                  <>
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <TrendingUp className="text-primary w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-heading font-medium text-[var(--text-primary)]">Where Money Is</h2>
                      <p className="text-[var(--text-secondary)] font-light text-sm mt-0.5">Detailed hotspot volume breakdown</p>
                    </div>
                  </>
                )}
                {expandedCard === 'weather' && (
                  <>
                    <div className="p-3 bg-sky-500/10 rounded-xl">
                      <CloudRain className="text-sky-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-heading font-medium text-[var(--text-primary)]">Weather Effect</h2>
                      <p className="text-[var(--text-secondary)] font-light text-sm mt-0.5">Atmospheric conditions and demand impact</p>
                    </div>
                  </>
                )}
                {expandedCard === 'event' && (
                  <>
                    <div className="p-3 bg-warning/10 rounded-xl">
                      <Calendar className="text-warning w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-heading font-medium text-[var(--text-primary)]">Nearby Events</h2>
                      <p className="text-[var(--text-secondary)] font-light text-sm mt-0.5">Regional activity and surge tracking</p>
                    </div>
                  </>
                )}
                {expandedCard === 'transit' && (
                  <>
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                      <TrainFront className="text-emerald-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-heading font-medium text-[var(--text-primary)]">Transit Hubs</h2>
                      <p className="text-[var(--text-secondary)] font-light text-sm mt-0.5">MTA coverage and passenger flow near your zone</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setExpandedCard(null)}
                className="p-2 bg-white/5 hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-8 hide-scrollbar">
              {expandedCard === 'demand' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20">
                      <p className="text-[11px] font-mono font-medium tracking-widest text-[var(--danger)] uppercase mb-1">Peak Time Window</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
                      <p className="text-[11px] font-mono font-medium tracking-widest text-[var(--primary-dark)] uppercase mb-1">Base Demand Layer</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)]">{baseDemand.toFixed(1)} rides</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-[var(--success)]/5 border border-[var(--success)]/20">
                      <p className="text-[11px] font-mono font-medium tracking-widest text-[var(--success)] uppercase mb-1">Total Adjusted Lift</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)]">+{(weatherLift + eventLift + horizonLift).toFixed(1)} rides</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-heading font-medium text-[var(--text-primary)] border-b border-[rgba(250,204,21,0.1)] pb-2">Extended 4-Hour Trend Detail</h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorDemandLarge" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="var(--primary-dark)"
                            fillOpacity={1}
                            fill="url(#colorDemandLarge)"
                            strokeWidth={4}
                            activeDot={{ r: 8, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 3 }}
                          />
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} />
                          <YAxis domain={['dataMin - 100', 'dataMax + 100']} tick={{ fill: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0d0d20', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold' }}
                            itemStyle={{ color: 'var(--primary-dark)', fontWeight: 'black' }}
                            formatter={(value: number) => [value, 'Predicted Demand']}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {expandedCard === 'weather' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Thermometer className="mx-auto text-orange-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Temperature</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{weather ? `${weather.temp_f.toFixed(1)}°F` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Wind className="mx-auto text-sky-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Wind Speed</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{weather ? `${weather.wind_kph.toFixed(1)} kph` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <CloudRain className="mx-auto text-indigo-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Precipitation</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{weather ? `${weather.precip_mm.toFixed(1)} mm` : '0 mm'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Zap className="mx-auto text-yellow-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Lift Multiplier</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{weatherFactor.toFixed(2)}x</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-sky-500/5 border border-sky-500/15">
                    <h3 className="text-lg font-heading font-medium text-sky-400 mb-2">Weather Strategy Guidance</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed font-normal">
                      Current conditions ({weather?.condition ?? primaryZone?.weather_condition ?? 'Unknown'}) are providing a
                      {(weatherLift > 0 ? ' positive ' : ' neutral ')} influence on baseline demand calculations. As weather intensity
                      grows, fewer competitive vehicles typically remain on network—generating supply choke points near transit hubs. Keep
                      your navigation bound to interior high-traffic zones rather than long-route residential runs during adverse conditions.
                    </p>
                  </div>
                </>
              )}

              {expandedCard === 'event' && (
                <div className="space-y-5">
                  {/* Avoid Zones — danger strip */}
                  <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-danger/15 flex items-center justify-center shrink-0">
                        <MapPin size={11} className="text-danger" />
                      </div>
                      <span className="text-xs font-mono font-medium text-danger uppercase tracking-widest">Avoid Zones</span>
                      {activePeriod?.avoid_zones.length ? (
                        <span className="ml-auto text-[10px] font-mono font-medium text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full">
                          {activePeriod.avoid_zones.length} zones
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activePeriod?.avoid_zones.map((zone) => (
                        <span key={zone.zone_id} className="px-3 py-1.5 bg-white border border-danger/25 rounded-full text-xs font-mono font-medium text-danger">
                          Zone {zone.zone_id}
                        </span>
                      )) ?? <p className="text-sm text-[var(--text-muted)]">No active avoid zones.</p>}
                    </div>
                  </div>

                  {/* Recommended Targets — full-width ranked list */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                        <TrendingUp size={11} className="text-success" />
                      </div>
                      <span className="text-xs font-mono font-medium text-success uppercase tracking-widest">Recommended Targets</span>
                      {activePeriod?.recommended_zones.length ? (
                        <span className="ml-auto text-[10px] font-mono font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                          {activePeriod.recommended_zones.length} zones
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {activePeriod?.recommended_zones.map((zone, idx) => {
                        const maxTrips = activePeriod.recommended_zones[0]?.expected_trips_per_hour ?? 1;
                        const pct = Math.round((zone.expected_trips_per_hour / maxTrips) * 100);
                        const rankBadge =
                          idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                            idx === 1 ? 'bg-slate-300 text-slate-700' :
                              idx === 2 ? 'bg-amber-500/80 text-amber-900' :
                                'bg-white/5 text-[var(--text-muted)]';
                        return (
                          <div key={zone.zone_id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${rankBadge}`}>
                              {idx + 1}
                            </span>
                            <span className="font-medium text-[var(--text-primary)] text-sm flex-1 truncate">{zone.zone_name}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-16 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                                <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-mono text-[var(--text-secondary)] w-20 text-right tabular-nums">
                                {zone.expected_trips_per_hour.toFixed(0)} trips/hr
                              </span>
                            </div>
                          </div>
                        );
                      }) ?? <p className="text-sm text-[var(--text-muted)]">Loading target zones...</p>}
                    </div>
                  </div>
                </div>
              )}

              {expandedCard === 'transit' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <TrainFront className="mx-auto text-emerald-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Total Stops</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{nearestTransitZone?.total_stops ?? '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <MapPin className="mx-auto text-blue-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Subway Routes</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{nearestTransitZone?.subway_routes ?? '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Clock className="mx-auto text-amber-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Bus Routes</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{nearestTransitZone?.bus_routes ?? '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Zap className="mx-auto text-yellow-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">Trips Today</p>
                      <p className="text-xl font-heading font-light text-[var(--text-primary)] mt-1">{nearestTransitZone?.total_trips ?? '--'}</p>
                    </div>
                  </div>

                  {/* Zone-by-zone breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-heading font-medium text-[var(--text-primary)] border-b border-[rgba(250,204,21,0.1)] pb-2">All Transit Zones</h3>
                    <div className="space-y-3">
                      {transit?.zones.map((zone) => {
                        const maxTrips = transit.zones[0]?.total_trips ?? 1;
                        const pct = Math.round((zone.total_trips / maxTrips) * 100);
                        return (
                          <div key={zone.zone_id} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-[var(--text-primary)] text-sm">{zone.borough}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-20 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-mono text-[var(--text-secondary)] w-16 text-right tabular-nums">
                                  {zone.total_trips} trips
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                              <span>{zone.total_stops} stops</span>
                              <span>·</span>
                              <span>{zone.subway_routes} subway</span>
                              <span>·</span>
                              <span>{zone.bus_routes} bus</span>
                              <span>·</span>
                              <span>{zone.rail_routes} rail</span>
                            </div>
                            {zone.busy_stops.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {zone.busy_stops.map((stop) => (
                                  <span key={stop.stop_id} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-mono font-medium text-emerald-400">
                                    {stop.stop_name} ({stop.trips_today})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }) ?? <p className="text-sm text-[var(--text-muted)]">Loading transit zones...</p>}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                    <h3 className="text-lg font-heading font-medium text-emerald-400 mb-2">Transit Strategy Guidance</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed font-normal">
                      Focus on subway exit clusters during rush hours — passengers leaving subway stations are high-intent riders.
                      Bus stop pickups tend to be dispersed but consistent throughout the day. Position near the busiest stops
                      in {nearestTransitZone?.borough ?? 'your zone'} where {nearestTransitZone?.total_trips ?? 'many'} trips are
                      running today.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 bg-white/5/50 border-t border-[var(--border)] flex justify-end">
              <button
                className="px-6 py-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--surface)] font-medium rounded-full transition-all duration-300 shadow-md"
                onClick={() => setExpandedCard(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
