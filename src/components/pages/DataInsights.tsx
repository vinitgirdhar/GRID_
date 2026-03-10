import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Activity, Info } from 'lucide-react';
import { getActiveHotspotPeriod, getForecast, getHotspots } from '../../services/apiService';
import { ForecastResponse, HotspotsResponse } from '../../types';

const COLORS = ['#F4B000', '#F59E0B', '#2F9E6E', '#3B82F6', '#DC2626'];

export default function DataInsights() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getForecast(), getHotspots()])
      .then(([forecastResponse, hotspotsResponse]) => {
        if (!cancelled) {
          setForecast(forecastResponse);
          setHotspots(hotspotsResponse);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load live forecast and hotspot data. Start the FastAPI backend on port 8000 and refresh.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePeriod = hotspots ? getActiveHotspotPeriod(hotspots) : null;

  const hourlyDemand = forecast?.forecast.map((point) => ({
    name: `${point.hour}:00`,
    value: Number(point.total_predicted_demand.toFixed(0)),
  })) ?? [];

  const topZones = activePeriod?.zones.map((zone) => ({
    name: zone.zone_name,
    value: Number(zone.predicted_demand.toFixed(0)),
  })) ?? [];

  const hotspotShare = activePeriod?.zones.slice(0, 5).map((zone) => ({
    name: zone.zone_name,
    value: Number(zone.predicted_demand.toFixed(0)),
  })) ?? [];

  const periodComparison = hotspots ? [
    {
      name: 'Morning',
      value: Number(hotspots.morning.zones.reduce((sum, zone) => sum + zone.predicted_demand, 0).toFixed(0)),
    },
    {
      name: 'Evening',
      value: Number(hotspots.evening.zones.reduce((sum, zone) => sum + zone.predicted_demand, 0).toFixed(0)),
    },
  ] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Data Insights</h1>
        <p className="text-[var(--text-secondary)] mt-1">24-hour forecast and hotspot positioning streamed from the backend API</p>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">24-Hour Demand Forecast</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: '#3B82F6' }}
                />
                <Line type="stepAfter" dataKey="value" stroke="#F4B000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Active Hotspots</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topZones}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="#F4B000" radius={[4, 4, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Top-Zone Demand Share</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hotspotShare}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {hotspotShare.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Morning vs Evening Intensity</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {periodComparison.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? '#F4B000' : '#2F9E6E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Activity className="text-primary w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Positioning Guidance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Recommended Zones</p>
            <div className="space-y-3">
              {activePeriod?.recommended_zones.slice(0, 5).map((zone) => (
                <div key={zone.zone_id} className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{zone.zone_name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Zone {zone.zone_id}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">{zone.expected_trips_per_hour.toFixed(1)} trips/hr</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Info size={14} className="text-primary" />
              Current Snapshot
            </h4>
            <div className="space-y-3 text-[11px] text-[var(--text-secondary)] leading-relaxed">
              <p>
                Peak forecast hour: <span className="text-[var(--text-primary)] font-bold">{forecast?.summary.peak_hour ?? '--'}:00</span>
                {' '}with top-zone focus on <span className="text-[var(--text-primary)] font-bold">{forecast?.summary.peak_zone_name ?? '--'}</span>.
              </p>
              <p>
                Active positioning window: <span className="text-[var(--text-primary)] font-bold">{activePeriod?.target_time ?? '--'}</span>.
              </p>
              <p>
                Avoid zones: <span className="text-danger font-bold">{activePeriod?.avoid_zones.map((zone) => zone.zone_id).join(', ') || '--'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
