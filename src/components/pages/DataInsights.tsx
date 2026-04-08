import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, Info, MapPin, BarChart3, PieChart as PieIcon, Layers } from 'lucide-react';
import { InsightTooltip } from '../charts/InsightTooltip';
import {
  asNumber, formatHourLabel, formatRideCount, formatTripsPerHour,
  getDemandWindowInsight, getPeriodIntensityInsight, getZoneDemandInsight, getZoneShareInsight,
} from '../charts/insightTooltipUtils';
import { getActiveHotspotPeriod, getForecast, getHotspots } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse } from '../../types';

const COLORS = ['#facc15', '#eab308', '#34d399', '#38bdf8', '#f87171'];

const bento = 'relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group';
const glowLine = 'absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300';
const eyebrow = 'text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest';

export default function DataInsights() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getForecast(), getHotspots()])
      .then(([f, h]) => { if (!cancelled) { setForecast(f); setHotspots(h); } })
      .catch(() => { if (!cancelled) setError('Unable to load live forecast and hotspot data. Start the FastAPI backend on port 8000 and refresh.'); });
    return () => { cancelled = true; };
  }, []);

  const activePeriod = hotspots ? getActiveHotspotPeriod(hotspots) : null;

  const hourlyDemand = forecast?.forecast.map((p) => ({ name: `${p.hour}:00`, value: Number(p.total_predicted_demand.toFixed(0)) })) ?? [];
  const topZones = activePeriod?.zones.map((z) => ({ name: z.zone_name, value: Number(z.predicted_demand.toFixed(0)) })) ?? [];
  const hotspotShare = activePeriod?.zones.slice(0, 5).map((z) => ({ name: z.zone_name, value: Number(z.predicted_demand.toFixed(0)) })) ?? [];
  const periodComparison = hotspots ? [
    { name: 'Morning', value: Number(hotspots.morning.zones.reduce((s, z) => s + z.predicted_demand, 0).toFixed(0)) },
    { name: 'Evening', value: Number(hotspots.evening.zones.reduce((s, z) => s + z.predicted_demand, 0).toFixed(0)) },
  ] : [];

  const hourlyDemandMax = Math.max(0, ...hourlyDemand.map((d) => d.value));
  const topZoneMax = Math.max(0, ...topZones.map((d) => d.value));
  const hotspotShareTotal = hotspotShare.reduce((s, d) => s + d.value, 0);
  const periodMax = Math.max(0, ...periodComparison.map((d) => d.value));

  const hourlyTooltip = {
    title: 'Predicted Ride Volume', contextLabel: 'Forecast Hour', metricLabel: 'Predicted Rides',
    description: 'Absolute demand count — 450 means ~450 rides expected in that hour.',
    details: ['X-axis: hour of day', 'Y-axis: predicted rides'],
    accentColor: '#facc15',
    labelFormatter: (label: string | number | undefined) => formatHourLabel(label),
    valueFormatter: (value: number | string | undefined) => formatRideCount(value),
    insightFormatter: (item: { value?: number | string }) => getDemandWindowInsight(asNumber(item.value), hourlyDemandMax),
  };
  const topZonesTooltip = {
    title: 'Expected Demand (Trips/hr)', contextLabel: 'Zone', metricLabel: 'Trips / hr',
    description: 'Predicted ride-demand rate per hour for this zone.',
    details: ['X-axis: zone', 'Y-axis: trips per hour'],
    accentColor: '#facc15',
    valueFormatter: (value: number | string | undefined) => formatTripsPerHour(value),
    insightFormatter: (item: { value?: number | string }) => getZoneDemandInsight(asNumber(item.value), topZoneMax),
  };
  const hotspotShareTooltip = {
    title: 'Hotspot Demand Share', contextLabel: 'Zone', metricLabel: 'Predicted Trips / hr',
    description: 'Each slice shows concentration of demand in this zone vs. the top 5.',
    details: ['Slice: active hotspot zone', 'Size: predicted trips per hour'],
    accentColor: '#facc15',
    valueFormatter: (value: number | string | undefined) => formatTripsPerHour(value),
    insightFormatter: (item: { value?: number | string }) => getZoneShareInsight(asNumber(item.value), hotspotShareTotal),
  };
  const periodTooltip = {
    title: 'Demand Window Intensity', contextLabel: 'Dispatch Window', metricLabel: 'Expected Trips / hr',
    description: 'Total demand across tracked zones — higher means heavier dispatch pressure.',
    details: ['X-axis: morning vs evening', 'Y-axis: total predicted trips per hour'],
    accentColor: '#34d399',
    valueFormatter: (value: number | string | undefined) => formatTripsPerHour(value),
    insightFormatter: (item: { value?: number | string }, label: string | number | undefined) =>
      getPeriodIntensityInsight(String(label ?? 'This window'), asNumber(item.value), periodMax),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-[var(--accent)]" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
          Data Insights
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          24-hour forecast and hotspot positioning streamed from the backend API
        </p>
      </div>

      {error && (
        <div className="relative overflow-hidden bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          {error}
        </div>
      )}

      {/* Row 1 — Demand forecast + Active Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
              <BarChart3 size={14} className="text-[var(--accent)]" />
            </div>
            <div>
              <p className={eyebrow}>Forecast</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>24-Hour Demand Forecast</h2>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip content={<InsightTooltip config={hourlyTooltip} />} />
                <Line type="stepAfter" dataKey="value" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
              <MapPin size={14} className="text-[var(--accent)]" />
            </div>
            <div>
              <p className={eyebrow}>Live</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Active Hotspots</h2>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topZones}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip content={<InsightTooltip config={topZonesTooltip} />} />
                <Bar dataKey="value" fill="#facc15" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 — Demand share + Morning/Evening */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
              <PieIcon size={14} className="text-[var(--accent)]" />
            </div>
            <div>
              <p className={eyebrow}>Distribution</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Top-Zone Demand Share</h2>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hotspotShare} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value">
                  {hotspotShare.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<InsightTooltip config={hotspotShareTooltip} />} />
                <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-400/10 rounded-lg inline-flex">
              <Layers size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className={eyebrow}>Windows</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Morning vs Evening Intensity</h2>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip content={<InsightTooltip config={periodTooltip} />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                  {periodComparison.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? '#facc15' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Positioning Guidance */}
      <div className={`${bento} p-6`}>
        <div className={glowLine} />
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
            <Activity size={14} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className={eyebrow}>Strategy</p>
            <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Positioning Guidance</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className={`${eyebrow} mb-3`}>Recommended Zones</p>
            <div className="space-y-2">
              {activePeriod?.recommended_zones.slice(0, 5).map((zone) => (
                <div key={zone.zone_id} className="relative overflow-hidden p-3.5 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-between gap-4 hover:bg-[var(--accent)]/10 transition-colors duration-150">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{zone.zone_name}</p>
                    <p className="text-[10px] font-mono text-[var(--text-muted)]">Zone {zone.zone_id}</p>
                  </div>
                  <p className="text-sm font-mono font-bold text-[var(--accent)]">{zone.expected_trips_per_hour.toFixed(1)} trips/hr</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden p-5 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[var(--accent)]/10 rounded-lg inline-flex">
                <Info size={13} className="text-[var(--accent)]" />
              </div>
              <p className={eyebrow}>Current Snapshot</p>
            </div>
            <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p>
                Peak forecast hour:{' '}
                <span className="text-[var(--text)] font-medium">{forecast?.summary.peak_hour ?? '--'}:00</span>
                {' '}with top-zone focus on{' '}
                <span className="text-[var(--text)] font-medium">{forecast?.summary.peak_zone_name ?? '--'}</span>.
              </p>
              <p>
                Active positioning window:{' '}
                <span className="text-[var(--text)] font-medium">{activePeriod?.target_time ?? '--'}</span>.
              </p>
              <p>
                Avoid zones:{' '}
                <span className="text-red-400 font-mono font-bold">{activePeriod?.avoid_zones.map((z) => z.zone_id).join(', ') || '--'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
