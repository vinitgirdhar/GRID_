import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Car, ChevronRight, CloudRain, DollarSign, Target, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getActiveHotspotPeriod, getForecast, getHotspots, getMetrics } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse, MetricsResponse } from '../../types';

const BAR_COLORS = ['#facc15', '#eab308', '#d4a017', '#b8860b', '#8b6914', '#6b5310'];

const ACTIVE_DRIVERS_PREVIEW = [
  { name: 'Alex Thompson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/alex/100/100' },
  { name: 'Sarah Jenkins', borough: 'Brooklyn', tier: 'silver', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { name: 'Michael Chen', borough: 'Queens', tier: 'gold', avatar: 'https://picsum.photos/seed/michael/100/100' },
  { name: 'Elena Rodriguez', borough: 'Bronx', tier: 'bronze', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { name: 'David Wilson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/david/100/100' },
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-5 py-4 rounded-2xl shadow-xl border border-gray-100">
        <p className="text-sm font-bold text-gray-800 mb-1">{label}</p>
        <p className="text-sm text-gray-600">
          Rides : <span className="font-bold text-gray-900">{payload[0].value.toLocaleString()}</span>
        </p>
      </div>
    );
  }

  return null;
}

export default function Overview() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getForecast(), getHotspots(), getMetrics()])
      .then(([forecastResponse, hotspotResponse, metricsResponse]) => {
        if (cancelled) {
          return;
        }

        setForecast(forecastResponse);
        setHotspots(hotspotResponse);
        setMetrics(metricsResponse);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load the admin dashboard from the backend API. Start FastAPI on port 8000 and refresh.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePeriod = hotspots ? getActiveHotspotPeriod(hotspots) : null;
  const hourlyDemand = forecast?.forecast.map((point) => ({
    name: `${point.hour}:00`,
    value: Math.round(point.total_predicted_demand),
  })) ?? [];
  const demandBuckets = forecast
    ? Array.from({ length: 6 }, (_, bucketIndex) => {
        const slice = forecast.forecast.slice(bucketIndex * 4, (bucketIndex + 1) * 4);

        return {
          name: `${slice[0]?.hour ?? bucketIndex * 4}:00`,
          value: Math.round(slice.reduce((sum, point) => sum + point.total_predicted_demand, 0)),
        };
      })
    : [];
  const zoneDistribution = activePeriod?.zones.map((zone) => ({
    name: zone.zone_name,
    value: Math.round(zone.predicted_demand),
  })) ?? [];

  const summaryCards = [
    {
      label: 'Peak Zone',
      value: forecast?.summary.peak_zone_name ?? '--',
      meta: `${forecast?.summary.peak_hour ?? '--'}:00`,
      icon: Car,
      color: 'var(--primary)',
    },
    {
      label: 'Forecast Volume',
      value: forecast ? forecast.summary.total_horizon_demand.toLocaleString() : '--',
      meta: '24h horizon',
      icon: Activity,
      color: 'var(--secondary)',
    },
    {
      label: 'Top Zone Demand',
      value: activePeriod?.zones[0] ? activePeriod.zones[0].predicted_demand.toFixed(1) : '--',
      meta: 'trips/hr',
      icon: DollarSign,
      color: 'var(--success)',
    },
    {
      label: 'Model Accuracy',
      value: metrics?.model_variants[2] ? `${(metrics.model_variants[2].test_r2 * 100).toFixed(2)}%` : '--',
      meta: metrics?.current_model_label ?? 'backend',
      icon: Target,
      color: 'var(--warning)',
    },
  ];

  const liveKpis = [
    {
      label: 'Peak Forecast Hour',
      value: forecast ? `${forecast.summary.peak_hour}:00` : '--',
      change: activePeriod?.label ?? 'Live',
      trend: 'up' as const,
      icon: Users,
    },
    {
      label: 'Recommended Zones',
      value: String(activePeriod?.recommended_zones.length ?? 0),
      change: activePeriod?.target_time ?? '--',
      trend: 'up' as const,
      icon: Activity,
    },
    {
      label: 'Avoid Zones',
      value: String(activePeriod?.avoid_zones.length ?? 0),
      change: 'Low-yield zones',
      trend: 'down' as const,
      icon: Target,
    },
    {
      label: 'Weather Signal',
      value: activePeriod?.zones[0]?.weather_condition ?? '--',
      change: activePeriod?.zones[0]?.borough ?? '--',
      trend: 'up' as const,
      icon: CloudRain,
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
        <h1 className="text-3xl font-bold tracking-tight text-gradient mb-2">GRID Cab Dashboard</h1>
        <p className="text-[var(--text-secondary)] text-base font-medium max-w-2xl mx-auto leading-relaxed">
          Live forecast, hotspot, and model-quality telemetry from the FastAPI ML backend.
        </p>
      </motion.div>

      {error && <div className="glass-card p-6 border border-danger/20 text-danger">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + (index * 0.1) }}
            className="glass-card p-5 flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}20` }}>
              <card.icon size={20} style={{ color: card.color }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">{card.label}</p>
              <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">{card.meta}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveKpis.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + idx * 0.1 }}
            className="kpi-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-value">{kpi.value}</div>
                <div className={`kpi-trend ${kpi.trend === 'up' ? 'positive' : 'negative'}`}>
                  {kpi.change} <span className="kpi-trend-text">live backend</span>
                </div>
              </div>
              <div className="kpi-icon-container">
                <kpi.icon className="kpi-icon" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Forecast Volume</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">4-hour demand buckets across the live 24-hour forecast</p>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={demandBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#facc15', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="basis" dataKey="value" stroke="#eab308" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" activeDot={{ r: 6, fill: '#facc15', stroke: '#fff', strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Top Live Zones</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Highest-demand zones in the active period</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20">
              <Target size={14} className="text-[var(--primary)]" />
            </div>
          </div>
          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneDistribution} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" opacity={0.3} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} width={110} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6', radius: 8 }} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={28}>
                  {zoneDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Hourly Patterns</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Live 24-hour demand curve</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--secondary)]/10 border border-[var(--secondary)]/20">
              <Activity size={14} className="text-[var(--secondary)]" />
            </div>
          </div>
          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyDemand} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#facc15', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line type="basis" dataKey="value" stroke="#eab308" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#facc15', stroke: '#fff', strokeWidth: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
              <Users size={18} className="text-[var(--success)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight">Active Drivers</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Team preview alongside the live dispatch model</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-light)] flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--primary)]/5 transition-all duration-200 border border-transparent hover:border-[var(--primary)]/20">
            View All Drivers <ChevronRight size={14} />
          </motion.button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {ACTIVE_DRIVERS_PREVIEW.map((driver, idx) => (
            <motion.div
              key={driver.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 + idx * 0.05 }}
              className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 hover:bg-[var(--surface)] transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <img src={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{driver.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{driver.borough}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${driver.tier === 'gold' ? 'bg-yellow-100 text-yellow-700' : driver.tier === 'silver' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                  {driver.tier}
                </span>
                <div className="flex items-center gap-1 text-[var(--success)] text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
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
