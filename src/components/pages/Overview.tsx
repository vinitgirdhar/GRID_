import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Activity, Car, ChevronRight, CloudRain, DollarSign, Target, Users } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { InsightTooltip } from '../charts/InsightTooltip';
import {
  asNumber, formatBucketLabel, formatHourLabel, formatRideCount,
  formatTripsPerHour, getDemandWindowInsight, getZoneDemandInsight,
} from '../charts/insightTooltipUtils';
import { getActiveHotspotPeriod, getForecast, getHotspots, getMetrics, getValidationMetrics } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse, MetricsResponse, ValidationMetricsResponse } from '../../types';
import { useLiveStream } from '../../hooks/useLiveStream';
import { useApiData } from '../../hooks/useApiData';

const BAR_COLORS = ['#facc15', '#eab308', '#d4a017', '#b8860b', '#8b6914', '#6b5310'];
const VALIDATION_REFRESH_INTERVAL_MS = 30000;

const ACTIVE_DRIVERS_PREVIEW = [
  { name: 'Alex Thompson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/alex/100/100' },
  { name: 'Sarah Jenkins', borough: 'Brooklyn', tier: 'silver', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { name: 'Michael Chen', borough: 'Queens', tier: 'gold', avatar: 'https://picsum.photos/seed/michael/100/100' },
  { name: 'Elena Rodriguez', borough: 'Bronx', tier: 'bronze', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { name: 'David Wilson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/david/100/100' },
];

/* Shared bento card class string */
const bento = 'relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group';
const glowLine = 'absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300';
const eyebrow = 'text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest';

export default function Overview() {
  // ── Cached, non-blocking data fetching ──────────────────────────────────────
  // Data is served instantly on re-navigation (stale-while-revalidate).
  // Background refresh keeps stats fresh without blocking the UI.
  const { data: forecast } = useApiData<ForecastResponse>(
    'overview:forecast',
    getForecast,
    { ttl: 60_000, refetchInterval: 120_000 },
  );
  const { data: hotspots } = useApiData<HotspotsResponse>(
    'overview:hotspots',
    getHotspots,
    { ttl: 60_000, refetchInterval: 120_000 },
  );
  const { data: metrics } = useApiData<MetricsResponse>(
    'overview:metrics',
    getMetrics,
    { ttl: 300_000 },
  );
  const { data: validation, refetch: refetchValidation } = useApiData<ValidationMetricsResponse>(
    'overview:validation',
    getValidationMetrics,
    { ttl: 30_000, refetchInterval: VALIDATION_REFRESH_INTERVAL_MS },
  );

  const predictionThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLiveStream({
    onConnected: () => refetchValidation(),
    onRetrain: () => refetchValidation(),
    onPrediction: () => {
      if (predictionThrottleRef.current) return;
      predictionThrottleRef.current = setTimeout(() => {
        predictionThrottleRef.current = null;
        refetchValidation();
      }, 5000);
    },
  });

  const activePeriod = useMemo(() => (hotspots ? getActiveHotspotPeriod(hotspots) : null), [hotspots]);
  const hourlyDemand = useMemo(() => forecast?.forecast.map((p) => ({ name: `${p.hour}:00`, value: Math.round(p.total_predicted_demand) })) ?? [], [forecast]);
  const demandBuckets = useMemo(() => forecast
    ? Array.from({ length: 6 }, (_, i) => {
        const slice = forecast.forecast.slice(i * 4, (i + 1) * 4);
        return { name: `${slice[0]?.hour ?? i * 4}:00`, value: Math.round(slice.reduce((s, p) => s + p.total_predicted_demand, 0)) };
      })
    : [], [forecast]);
  const zoneDistribution = useMemo(() => activePeriod?.zones.map((z) => ({ name: z.zone_name, value: Math.round(z.predicted_demand) })) ?? [], [activePeriod]);
  const demandBucketMax = useMemo(() => Math.max(0, ...demandBuckets.map((d) => d.value)), [demandBuckets]);
  const zoneDemandMax = useMemo(() => Math.max(0, ...zoneDistribution.map((d) => d.value)), [zoneDistribution]);
  const hourlyDemandMax = useMemo(() => Math.max(0, ...hourlyDemand.map((d) => d.value)), [hourlyDemand]);

  const demandBucketTooltip = {
    title: 'Predicted Ride Volume', contextLabel: 'Time Window', metricLabel: 'Predicted Rides',
    description: 'An absolute demand count — 450 means ~450 rides forecast in this 4-hour block.',
    details: ['X-axis: 4-hour forecast bucket', 'Y-axis: predicted rides in that bucket'],
    accentColor: '#eab308',
    labelFormatter: (label: string | number | undefined) => formatBucketLabel(label),
    valueFormatter: (value: number | string | undefined) => formatRideCount(value),
    insightFormatter: (item: { value?: number | string }) => getDemandWindowInsight(asNumber(item.value), demandBucketMax),
  };
  const zoneTooltip = {
    title: 'Expected Demand (Trips/hr)', contextLabel: 'Zone', metricLabel: 'Trips / hr',
    description: 'Predicted ride-demand rate per hour for this zone.',
    details: ['X-axis: predicted trips per hour', 'Y-axis: active hotspot zone'],
    accentColor: '#facc15',
    valueFormatter: (value: number | string | undefined) => formatTripsPerHour(value),
    insightFormatter: (item: { value?: number | string }) => getZoneDemandInsight(asNumber(item.value), zoneDemandMax),
  };
  const hourlyDemandTooltip = {
    title: 'Predicted Ride Volume', contextLabel: 'Forecast Hour', metricLabel: 'Predicted Rides',
    description: 'Absolute demand count per hour in the live 24-hour forecast.',
    details: ['X-axis: hour of day', 'Y-axis: predicted rides'],
    accentColor: '#eab308',
    labelFormatter: (label: string | number | undefined) => formatHourLabel(label),
    valueFormatter: (value: number | string | undefined) => formatRideCount(value),
    insightFormatter: (item: { value?: number | string }) => getDemandWindowInsight(asNumber(item.value), hourlyDemandMax),
  };

  const summaryCards = [
    { label: 'Peak Zone', value: forecast?.summary.peak_zone_name ?? '--', meta: `${forecast?.summary.peak_hour ?? '--'}:00`, icon: Car, iconColor: '#facc15' },
    { label: 'Forecast Volume', value: forecast ? forecast.summary.total_horizon_demand.toLocaleString() : '--', meta: '24h horizon', icon: Activity, iconColor: '#fbbf24' },
    { label: 'Top Zone Demand', value: activePeriod?.zones[0] ? activePeriod.zones[0].predicted_demand.toFixed(1) : '--', meta: 'trips/hr', icon: DollarSign, iconColor: '#4ade80' },
    {
      label: 'Model Accuracy',
      value: validation?.validated_predictions
        ? `${(validation.model_state.current_r2 * 100).toFixed(2)}%`
        : metrics?.model_variants[2]
          ? `${(metrics.model_variants[2].test_r2 * 100).toFixed(2)}%`
          : '--',
      meta: validation?.validated_predictions
        ? `${validation.prediction_accuracy_pct.toFixed(1)}% live validation`
        : metrics?.current_model_label ?? 'backend',
      icon: Target,
      iconColor: '#fb923c',
    },
  ];

  const liveKpis = [
    { label: 'Peak Forecast Hour', value: forecast ? `${forecast.summary.peak_hour}:00` : '--', change: activePeriod?.label ?? 'Live', icon: Users },
    { label: 'Recommended Zones', value: String(activePeriod?.recommended_zones.length ?? 0), change: activePeriod?.target_time ?? '--', icon: Activity },
    { label: 'Avoid Zones', value: String(activePeriod?.avoid_zones.length ?? 0), change: 'Low-yield zones', icon: Target },
    { label: 'Weather Signal', value: activePeriod?.zones[0]?.weather_condition ?? '--', change: activePeriod?.zones[0]?.borough ?? '--', icon: CloudRain },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-3xl font-light tracking-tight text-[var(--accent)]" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
          GRID Fleet Dashboard
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
          Live forecast, hotspot, and model-quality telemetry from the FastAPI ML backend.
        </p>
      </div>

      {!forecast && !hotspots && !metrics && (
        <div className="relative overflow-hidden bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.1)] rounded-2xl p-4 text-[var(--text-muted)] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          Loading dashboard data…
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
            className={`${bento} p-5 flex items-center gap-4`}
          >
            <div className={glowLine} />
            <div className="p-2.5 rounded-lg inline-flex shrink-0" style={{ backgroundColor: `${card.iconColor}18` }}>
              <card.icon size={20} style={{ color: card.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={eyebrow}>{card.label}</p>
              <p className="text-xl font-light text-[var(--text)] mt-1 truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{card.meta}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveKpis.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + idx * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className={`${bento} p-5`}
          >
            <div className={glowLine} />
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className={eyebrow}>{kpi.label}</p>
                <p className="text-2xl font-light text-[var(--text)] mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>{kpi.value}</p>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{kpi.change}</p>
              </div>
              <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex shrink-0 ml-3">
                <kpi.icon size={16} className="text-[var(--accent)]" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Forecast Volume chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className={`${bento} p-6`}
      >
        <div className={glowLine} />
        <div className="mb-5">
          <p className={eyebrow}>Demand</p>
          <h2 className="text-lg font-light text-[var(--text)] mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Forecast Volume</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>4-hour demand buckets across the live 24-hour forecast</p>
        </div>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={demandBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
              <Tooltip content={<InsightTooltip config={demandBucketTooltip} />} cursor={{ stroke: '#facc15', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="basis" dataKey="value" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" activeDot={{ r: 5, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top Live Zones + Hourly Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className={`${bento} p-5`}
        >
          <div className={glowLine} />
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className={eyebrow}>Hotspots</p>
              <h2 className="text-base font-light text-[var(--text)] mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Top Live Zones</h2>
            </div>
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
              <Target size={14} className="text-[var(--accent)]" />
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneDistribution} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' }} width={110} />
                <Tooltip content={<InsightTooltip config={zoneTooltip} />} cursor={{ fill: 'rgba(250,204,21,0.04)' }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
                  {zoneDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className={`${bento} p-5`}
        >
          <div className={glowLine} />
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className={eyebrow}>Patterns</p>
              <h2 className="text-base font-light text-[var(--text)] mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Hourly Patterns</h2>
            </div>
            <div className="p-2 bg-sky-400/10 rounded-lg inline-flex">
              <Activity size={14} className="text-sky-400" />
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyDemand} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip content={<InsightTooltip config={hourlyDemandTooltip} />} cursor={{ stroke: '#facc15', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line type="basis" dataKey="value" stroke="#eab308" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Active Drivers */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className={`${bento} p-6`}
      >
        <div className={glowLine} />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-400/10 rounded-lg inline-flex">
              <Users size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className={eyebrow}>Fleet</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Active Drivers</h2>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] px-3 py-1.5 rounded-full bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.2)] hover:bg-[rgba(250,204,21,0.12)] hover:border-[rgba(250,204,21,0.4)] transition-all duration-200" style={{ fontFamily: 'Inter, sans-serif' }}>
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {ACTIVE_DRIVERS_PREVIEW.map((driver, idx) => (
            <motion.div
              key={driver.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.22 + idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
              className="relative overflow-hidden p-4 rounded-2xl border border-[var(--border)] bg-white/[0.03] hover:bg-white/[0.07] hover:-translate-y-0.5 hover:border-[var(--accent)]/30 transition-all duration-200 group/card"
            >
              <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover/card:opacity-60 transition-all duration-300" />
              <div className="flex items-center gap-3 mb-3">
                <img src={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-full object-cover border border-[var(--border)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{driver.name}</p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{driver.borough}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${driver.tier === 'gold' ? 'bg-yellow-500/15 text-yellow-400' : driver.tier === 'silver' ? 'bg-slate-400/15 text-slate-300' : 'bg-amber-500/15 text-amber-400'}`}>
                  {driver.tier}
                </span>
                <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Online
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
