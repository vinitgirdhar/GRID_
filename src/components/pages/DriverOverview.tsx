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
  X
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getActiveHotspotPeriod, getForecast, getHotspots, getWeather } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse, Theme, WeatherResponse, ZoneDemand } from '../../types';
import MapComponent from '../MapComponent';

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

export default function DriverOverview({ currentHour }: { currentHour?: number }) {
  const activeHour = currentHour ?? new Date().getHours();
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [expandedCard, setExpandedCard] = useState<'demand' | 'weather' | 'event' | null>(null);

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
      label: 'Peak Zone Demand',
      value: currentForecastPoint ? `${currentForecastPoint.total_predicted_demand.toFixed(0)}` : (primaryZone ? `${primaryZone.predicted_demand.toFixed(1)}` : '--'),
      change: currentForecastPoint?.top_zone_name ?? primaryZone?.zone_name ?? '--',
      icon: DollarSign,
    },
    {
      label: 'Recommended Zones',
      value: String(activePeriod?.recommended_zones.length ?? 0),
      change: activeHour < 15 ? 'Morning Window' : 'Evening Window',
      icon: CheckCircle,
    },
    {
      label: 'Active Forecast Hour',
      value: dynamicPeak ? `${dynamicPeak.hour}:00` : '--',
      change: dynamicPeak ? `Peak: ${dynamicPeak.total_predicted_demand.toFixed(0)} rides` : '--',
      icon: Percent,
    },
    {
      label: 'Weather Signal',
      value: primaryZone?.weather_condition ?? '--',
      change: primaryZone?.borough ?? '--',
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
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--accent)]">Intelligence</h1>
          <p className="text-[var(--text-secondary)] mt-1 font-medium">Urban demand & awareness &middot; <span className="text-[var(--primary-dark)] font-bold">{timeLabel}</span></p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--success)] bg-[var(--success)]/10 px-3 py-1.5 rounded-full border border-[var(--success)]/20 shadow-sm">
          <span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse-soft"></span>
          LIVE
        </div>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {liveKpis.map((kpi, idx) => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                {idx === 0 && <DollarSign className="text-primary w-5 h-5" />}
                {idx === 1 && <CheckCircle className="text-success w-5 h-5" />}
                {idx === 2 && <Percent className="text-warning w-5 h-5" />}
                {idx === 3 && <Zap className="text-sky-500 w-5 h-5" />}
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-success justify-end ml-3 min-w-0">
                <TrendingUp size={14} className="shrink-0" />
                <span className="truncate">{kpi.change}</span>
              </div>
            </div>
            <div>
              <p className="kpi-label">{kpi.label}</p>
              <p className="kpi-value">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div 
          onClick={() => setExpandedCard('demand')}
          className="glass-card p-6 flex flex-col hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300 h-full cursor-pointer border-transparent hover:border-[var(--primary)]/50 group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Demand Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--danger)] leading-tight">High Demand Expected</p>
                <span className="px-2 py-1 bg-[var(--danger)]/10 text-[var(--danger)] text-[10px] font-black rounded uppercase border border-[var(--danger)]/20">Critical</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{primaryZone ? `${primaryZone.borough} - ${primaryZone.zone_name}` : '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.target_time ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Predicted Rides</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{primaryZone ? primaryZone.predicted_demand.toFixed(1) : '--'}</p>
                </div>
              </div>
            </div>

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
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px', boxShadow: 'var(--shadow-md)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
          className="glass-card p-6 flex flex-col hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300 h-full cursor-pointer border-transparent hover:border-sky-500/50 group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <CloudRain className="text-sky-500 w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Weather Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--secondary)] text-slate-700 leading-tight">Weather-Adjusted Demand</p>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded uppercase border border-slate-200">Active Alert</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{weather?.location_name ?? primaryZone?.borough ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
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

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Current weather is <span className="text-slate-700 font-bold">{weather?.condition ?? primaryZone?.weather_condition ?? 'Unknown'}</span>
                {' '}with demand impact rated <span className="text-slate-700 font-bold">{weather?.demand_impact ?? 'Unknown'}</span>.
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
          className="glass-card p-6 flex flex-col hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300 h-full cursor-pointer border-transparent hover:border-[var(--warning)]/50 group"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Calendar className="text-warning w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Event Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-black text-[var(--warning)] leading-tight">Positioning Recommendations</p>
                <span className="px-2 py-1 bg-[var(--warning)]/10 text-[var(--warning)] text-[10px] font-black rounded uppercase border border-[var(--warning)]/20">Surge Risk</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{activePeriod?.recommended_zones[0]?.zone_name ?? '--'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
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

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <MapPin className="text-sky-500 w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Operational Hotspot Map</h3>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-danger"></div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">High Demand</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning"></div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Low</span>
            </div>
          </div>
        </div>

        <MapComponent zones={mapZones} theme={theme} height="450px" simplified={true} />
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Prediction Formula Breakdown</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Formula: Base demand + weather lift + event lift + short-horizon forecast lift.
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
                contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                formatter={(value: number) => [value.toFixed(2), 'Contribution']}
              />
              <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dynamic Details Modal */}
      {expandedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[var(--accent)]/40 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setExpandedCard(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-[var(--border)] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                {expandedCard === 'demand' && (
                  <>
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <TrendingUp className="text-primary w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Demand Intelligence</h2>
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
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Weather Intelligence</h2>
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
                      <h2 className="text-2xl font-black text-[var(--text-primary)]">Event Intelligence</h2>
                      <p className="text-[var(--text-secondary)] font-medium text-sm mt-0.5">Regional activity and surge tracking</p>
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={() => setExpandedCard(null)}
                className="p-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full transition-colors"
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
                    <h3 className="text-lg font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">Extended 4-Hour Trend Detail</h3>
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
                            contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)', fontWeight: 'bold' }}
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <Thermometer className="mx-auto text-orange-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Temperature</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.temp_f.toFixed(1)}°F` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <Wind className="mx-auto text-sky-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Wind Speed</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.wind_kph.toFixed(1)} kph` : '--'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <CloudRain className="mx-auto text-indigo-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Precipitation</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weather ? `${weather.precip_mm.toFixed(1)} mm` : '0 mm'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <Zap className="mx-auto text-yellow-500 mb-2 w-8 h-8" />
                      <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">Lift Multiplier</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{weatherFactor.toFixed(2)}x</p>
                    </div>
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-sky-50 border border-sky-100 dark:bg-sky-900/10 dark:border-sky-800/20">
                    <h3 className="text-lg font-bold text-sky-950 dark:text-sky-100 mb-2">Weather Strategy Guidance</h3>
                    <p className="text-sky-900 dark:text-sky-200 leading-relaxed font-medium">
                      Current conditions ({weather?.condition ?? primaryZone?.weather_condition ?? 'Unknown'}) are providing a 
                      {(weatherLift > 0 ? ' positive ' : ' neutral ')} influence on baseline demand calculations. As weather intensity 
                      grows, fewer competitive vehicles typically remain on network—generating supply choke points near transit hubs. Keep 
                      your navigation bound to interior high-traffic zones rather than long-route residential runs during adverse conditions.
                    </p>
                  </div>
                </>
              )}

              {expandedCard === 'event' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                         <MapPin size={18} className="text-warning" /> Avoid Zones 
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {activePeriod?.avoid_zones.map((zone) => (
                          <span key={zone.zone_id} className="px-3 py-1.5 bg-[var(--secondary)] border border-[var(--border)] rounded-full text-sm font-bold text-[var(--text-secondary)] shadow-sm">
                            Zone {zone.zone_id}
                          </span>
                        )) ?? <p className="text-sm text-[var(--text-muted)]">No active avoid zones currently.</p>}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                        <TrendingUp size={18} className="text-success" /> Recommended Targets
                      </h3>
                      <div className="flex flex-col gap-2">
                        {activePeriod?.recommended_zones.map((zone, idx) => (
                          <div key={zone.zone_id} className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-black">{idx + 1}</span>
                              <span className="font-bold text-[var(--text-primary)]">{zone.zone_name}</span>
                            </div>
                            <span className="text-sm font-bold text-[var(--text-secondary)]">{zone.expected_trips_per_hour.toFixed(0)} trips/hr</span>
                          </div>
                        )) ?? <p className="text-sm text-[var(--text-muted)]">Loading target zones...</p>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Modal footer */}
            <div className="p-4 bg-[var(--secondary)]/50 border-t border-[var(--border)] flex justify-end">
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
