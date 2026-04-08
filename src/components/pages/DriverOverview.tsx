import { useState, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getActiveHotspotPeriod, getForecast, getHotspots, getWeather, postDriverSession } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse, Theme, WeatherResponse, ZoneDemand } from '../../types';
import MapComponent from '../MapComponent';
import MissedOpportunityFeed from '../MissedOpportunityFeed';
import { cn } from '../../lib/utils';

const REFRESH_INTERVAL_MS = 20000;

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
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [expandedCard, setExpandedCard] = useState<'demand' | 'weather' | 'event' | null>(null);
  const [ecoMode, setEcoMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Virtual driver location: Midtown Manhattan, NYC (fixed — no real GPS)
  const VIRTUAL_DRIVER_LOCATION: [number, number] = [40.7549, -73.9840];

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadDriverData = async () => {
      try {
        const [forecastResponse, hotspotResponse] = await Promise.all([getForecast(), getHotspots()]);
        
        if (!cancelled) {
          setForecast(forecastResponse);
          setHotspots(hotspotResponse);
          setError(null);
        }

        const activePeriodResponse = getActiveHotspotPeriod(hotspotResponse);
        const primaryZoneResponse = activePeriodResponse.zones[0];
        
        if (primaryZoneResponse && !cancelled) {
          getWeather({ zoneId: primaryZoneResponse.zone_id })
            .then(weatherResponse => {
              if (!cancelled) setWeather(weatherResponse);
            })
            .catch(error => console.warn('Weather API failed to load:', error));
        }

      } catch {
        if (!cancelled) {
          setError('Unable to load the driver dashboard from the backend API. Start FastAPI on port 8000 and refresh.');
        }
      }
    };

    loadDriverData();
    intervalId = setInterval(loadDriverData, REFRESH_INTERVAL_MS);

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
      cancelled = true;
      observer.disconnect();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Real geolocation removed — app operates in virtual NYC mode.

  const activePeriod = hotspots
    ? (activeHour < 15 ? hotspots.morning : hotspots.evening)
    : null;
  const primaryZone = activePeriod?.zones[0];

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

  const mapZones: ZoneDemand[] = activePeriod?.zones.map((zone) => ({
    id: zone.zone_id,
    name: zone.zone_name,
    lat: zone.lat,
    lng: zone.lng,
    demand: zone.predicted_demand,
    demandLevel: zone.demand_level,
    eventIntensity: zone.event_intensity,
    weatherCondition: zone.weather_condition,
  })) ?? [];

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#facc15]" style={{fontFamily:'Outfit,sans-serif',fontWeight:300,letterSpacing:'-0.03em'}}>Intelligence</h1>
          <p className="text-[#94a3b8] mt-1 text-sm">Urban demand & awareness &middot; <span className="text-[#fbbf24] font-semibold">{timeLabel}</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEcoMode((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 ${ecoMode ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-[rgba(250,204,21,0.15)] text-[#94a3b8] hover:text-[#e8edf3]'}`}
            title="Toggle Eco-Mode"
          >
            <Leaf size={13} />
            {ecoMode ? 'Eco On' : 'Eco'}
          </button>
          <button
            onClick={() => setShowAdvanced((prev: boolean) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 ${showAdvanced ? 'bg-[rgba(250,204,21,0.12)] border-[rgba(250,204,21,0.3)] text-[#facc15]' : 'bg-white/5 border-[rgba(250,204,21,0.15)] text-[#94a3b8] hover:text-[#e8edf3]'}`}
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
              "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border transition-all duration-300 shadow-sm",
              isLive
                ? "text-[#34d399] bg-[#34d399]/10 border-[#34d399]/25"
                : "text-[#4b5e78] bg-white/5 border-[rgba(250,204,21,0.15)] hover:text-[#94a3b8]"
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
            <p className="text-sm font-bold text-green-400">Eco-Mode Active</p>
            <p className="text-xs text-[#94a3b8] mt-0.5">GRID is routing you through fuel-efficient, low-idle paths. Estimated CO₂ saved today: <span className="font-bold text-green-400">1.2 kg</span>.</p>
          </div>
        </div>
      )}

      {/* Urgency AI Banner (when high demand is expected) */}
      {primaryZone?.demand_level === 'High' && (
        <div className="p-4 rounded-2xl bg-[var(--danger)]/8 border border-[var(--danger)]/20 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[var(--danger)] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--danger)]">🔥 Surge Alert: High demand in {primaryZone?.zone_name ?? 'your zone'}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Position now for maximum earnings. Demand peaks at {' '}
              <span className="font-bold text-[var(--danger)]">
                {dynamicPeak ? `${dynamicPeak.hour % 12 || 12}:00 ${dynamicPeak.hour >= 12 ? 'PM' : 'AM'}` : 'peak window'}
              </span> {' '}
              in your area.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {liveKpis.map((kpi, idx) => (
          <div key={kpi.label} className="kpi-card !p-4">
            <div className="mb-3">
              <div className="p-1.5 bg-primary/10 rounded-lg inline-flex">
                {idx === 0 && <DollarSign className="text-primary w-4 h-4" />}
                {idx === 1 && <CheckCircle className="text-success w-4 h-4" />}
                {idx === 2 && <Percent className="text-warning w-4 h-4" />}
                {idx === 3 && <Zap className="text-sky-500 w-4 h-4" />}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1 leading-tight">{kpi.label}</p>
              {idx === 0 ? (
                <>
                  <p className="text-lg font-extrabold text-[var(--text-primary)] leading-tight tracking-tight truncate">{kpi.change}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5">{kpi.value} rides predicted</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight">{kpi.value}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 truncate">{kpi.change}</p>
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
            <h3 className="font-semibold text-[#e8edf3]">Hotspot Map</h3>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-danger shrink-0"></div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-warning shrink-0"></div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0"></div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Low</span>
            </div>
          </div>
        </div>

        <MapComponent
          zones={mapZones}
          theme={theme}
          height="450px"
          simplified={true}
          zoom={15}
          showYouAreHere={true}
          youAreHerePosition={VIRTUAL_DRIVER_LOCATION}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div
          onClick={() => setExpandedCard('demand')}
          className="glass-card p-4 sm:p-6 flex flex-col h-full cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[#e8edf3]">Where Money Is</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--danger)] leading-tight">High Demand Expected</p>
                <span className="px-2 py-1 bg-[var(--danger)]/10 text-[var(--danger)] text-[10px] font-black rounded uppercase border border-[var(--danger)]/20">HIGH DEMAND</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{primaryZone ? `${primaryZone.borough} - ${primaryZone.zone_name}` : '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Expected pickups</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{primaryZone ? primaryZone.predicted_demand.toFixed(1) : '--'}</p>
                </div>
              </div>
            </div>

            {showAdvanced && (
              <div className="h-[100px] w-full mt-4">
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mb-2">3 Hour Trend</p>
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
                <span className="font-bold text-[var(--primary-dark)] not-italic">Tip:</span> “Position near {primaryZone?.zone_name ?? 'the top zone'} during the active hotspot window.”
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
            <h3 className="font-semibold text-[#e8edf3]">Weather Effect</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--accent)] leading-tight">Weather-Adjusted Demand</p>
                <span className="px-2 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-black rounded uppercase border border-sky-500/20">
                  {weather?.condition ?? primaryZone?.weather_condition ?? 'Checking...'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{weather?.location_name ?? primaryZone?.borough ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.label ?? '--'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">{weather ? `${weather.temp_f.toFixed(1)}°F` : '--'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">{weather ? `${weather.wind_kph.toFixed(1)} kph` : '--'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/15">
              <p className="text-xs font-bold text-[#e8edf3] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Current weather is <span className="text-sky-400 font-bold">{weather?.condition ?? primaryZone?.weather_condition ?? 'Unknown'}</span>
                {' '}with demand impact rated <span className="text-sky-400 font-bold">{weather?.demand_impact ?? 'Unknown'}</span>.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-bold text-slate-600 not-italic">Tip:</span> “Use weather as confirmation, but follow the hotspot ranking first.”
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
            <h3 className="font-semibold text-[#e8edf3]">Nearby Events</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--warning)] leading-tight">Events Boosting Rides</p>
                <span className="px-2 py-1 bg-[var(--warning)]/10 text-[var(--warning)] text-[10px] font-black rounded uppercase border border-[var(--warning)]/20">EVENT BOOST</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.recommended_zones[0]?.zone_name ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Best time to be there</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Expected Surge</p>
                  <p className="text-sm font-bold text-warning">{primaryZone?.demand_level ?? '--'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Focus on the top recommended zone and avoid low-yield zones: {activePeriod?.avoid_zones.map((zone) => zone.zone_id).join(', ') || '--'}.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] mt-auto">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-[var(--warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-bold text-[var(--warning)] not-italic">Tip:</span> “Cycle toward the highest-ranked zone before the peak forecast hour.”
              </p>
            </div>
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary-dark)] rounded border border-[var(--primary)]/20">
              Advanced data is showing — charts &amp; raw numbers
            </span>
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-[#e8edf3]">Demand Breakdown</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                How GRID calculates demand: base + weather + events + time-of-day boost.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Estimated Next-Hour Demand</p>
              <p className="text-2xl font-bold text-[var(--primary)]">{formulaPrediction.toFixed(1)}</p>
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
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Missed Opportunity Feed */}
      <div>
        <h3 className="font-semibold text-[#e8edf3] mb-3">Trips You Missed Nearby</h3>
        <MissedOpportunityFeed onCountChange={() => {}} />
      </div>

      {/* Dynamic Details Modal */}
      {expandedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
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
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Where Money Is</h2>
                      <p className="text-[var(--text-secondary)] font-medium text-sm mt-0.5">Detailed hotspot volume breakdown</p>
                    </div>
                  </>
                )}
                {expandedCard === 'weather' && (
                  <>
                    <div className="p-3 bg-sky-500/10 rounded-xl">
                      <CloudRain className="text-sky-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Weather Effect</h2>
                      <p className="text-[var(--text-secondary)] font-medium text-sm mt-0.5">Atmospheric conditions and demand impact</p>
                    </div>
                  </>
                )}
                {expandedCard === 'event' && (
                  <>
                    <div className="p-3 bg-warning/10 rounded-xl">
                      <Calendar className="text-warning w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Nearby Events</h2>
                      <p className="text-[var(--text-secondary)] font-medium text-sm mt-0.5">Regional activity and surge tracking</p>
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
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {expandedCard === 'demand' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20">
                      <p className="text-[11px] font-black tracking-widest text-[var(--danger)] uppercase mb-1">Peak Time Window</p>
                      <p className="text-xl font-bold text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
                      <p className="text-[11px] font-black tracking-widest text-[var(--primary-dark)] uppercase mb-1">Base Demand Layer</p>
                      <p className="text-xl font-bold text-[var(--text-primary)]">{baseDemand.toFixed(1)} rides</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-[var(--success)]/5 border border-[var(--success)]/20">
                      <p className="text-[11px] font-black tracking-widest text-[var(--success)] uppercase mb-1">Total Adjusted Lift</p>
                      <p className="text-xl font-bold text-[var(--text-primary)]">+{(weatherLift + eventLift + horizonLift).toFixed(1)} rides</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] border-b border-[rgba(250,204,21,0.1)] pb-2">Extended 4-Hour Trend Detail</h3>
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
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Temperature</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.temp_f.toFixed(1)}°F` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Wind className="mx-auto text-sky-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Wind Speed</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.wind_kph.toFixed(1)} kph` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <CloudRain className="mx-auto text-indigo-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Precipitation</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.precip_mm.toFixed(1)} mm` : '0 mm'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-center">
                      <Zap className="mx-auto text-yellow-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Lift Multiplier</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weatherFactor.toFixed(2)}x</p>
                    </div>
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-sky-500/5 border border-sky-500/15">
                    <h3 className="text-lg font-bold text-sky-400 mb-2">Weather Strategy Guidance</h3>
                    <p className="text-[#94a3b8] leading-relaxed font-normal">
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
                      <span className="text-xs font-black text-danger uppercase tracking-widest">Avoid Zones</span>
                      {activePeriod?.avoid_zones.length ? (
                        <span className="ml-auto text-[10px] font-black text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full">
                          {activePeriod.avoid_zones.length} zones
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activePeriod?.avoid_zones.map((zone) => (
                        <span key={zone.zone_id} className="px-3 py-1.5 bg-white border border-danger/25 rounded-full text-xs font-bold text-danger">
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
                      <span className="text-xs font-black text-success uppercase tracking-widest">Recommended Targets</span>
                      {activePeriod?.recommended_zones.length ? (
                        <span className="ml-auto text-[10px] font-black text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
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
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${rankBadge}`}>
                              {idx + 1}
                            </span>
                            <span className="font-bold text-[var(--text-primary)] text-sm flex-1 truncate">{zone.zone_name}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-16 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                                <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-bold text-[var(--text-secondary)] w-20 text-right tabular-nums">
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
            </div>
            
            {/* Modal footer */}
            <div className="p-4 bg-white/5/50 border-t border-[var(--border)] flex justify-end">
              <button 
                className="px-6 py-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--surface)] font-bold rounded-full transition-all duration-300 shadow-md"
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
