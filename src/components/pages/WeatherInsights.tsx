import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Thermometer, CloudRain, Wind, Info } from 'lucide-react';
import { getForecast, getWeather } from '../../services/apiService';
import { ForecastResponse, WeatherResponse } from '../../types';

const REFRESH_INTERVAL_MS = 20000;

const bento = 'relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group';
const glowLine = 'absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300';
const eyebrow = 'text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest';

function buildTemperatureCurve(tempC: number, baselineDemand: number) {
  return [0, 5, 10, 15, 20, 25, 30, 35].map((p) => {
    const comfortFactor = Math.max(0.7, 1.15 - (Math.abs(22 - p) * 0.02));
    return { name: `${p}°C`, value: Math.round(baselineDemand * comfortFactor * (tempC < 10 ? 1.05 : 1)) };
  });
}

function buildRainCurve(precipMm: number, baselineDemand: number) {
  return [
    { name: 'None', value: Math.round(baselineDemand * 0.95) },
    { name: 'Light', value: Math.round(baselineDemand * 1.03) },
    { name: 'Moderate', value: Math.round(baselineDemand * 1.1) },
    { name: 'Heavy', value: Math.round(baselineDemand * Math.max(1.15, 1 + precipMm * 0.03)) },
  ];
}

function buildWindCurve(windKph: number, baselineDemand: number) {
  return [0, 10, 20, 30, 40, 50].map((p) => {
    const impact = p >= windKph ? 1 + (p - windKph) * 0.004 : 1 - (windKph - p) * 0.002;
    return { name: `${p} kph`, value: Math.round(baselineDemand * Math.max(0.75, impact)) };
  });
}

export default function WeatherInsights() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peakZoneRef = useRef('132');

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadData = async () => {
      try {
        const [f, w] = await Promise.all([getForecast(), getWeather({ zoneId: peakZoneRef.current })]);
        if (!cancelled) {
          setForecast(f); setWeather(w); setError(null);
          if (f.summary.peak_zone_id) peakZoneRef.current = f.summary.peak_zone_id;
        }
      } catch {
        if (!cancelled) setError('Unable to load live weather intelligence. Check backend and Weather API configuration.');
      }
    };

    loadData();
    intervalId = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, []);

  const baselineDemand = forecast?.summary.peak_zone_demand ?? 8000;
  const tempDemand = useMemo(() => buildTemperatureCurve(weather?.temp_c ?? 22, baselineDemand), [weather?.temp_c, baselineDemand]);
  const rainDemand = useMemo(() => buildRainCurve(weather?.precip_mm ?? 0, baselineDemand), [weather?.precip_mm, baselineDemand]);
  const windDemand = useMemo(() => buildWindCurve(weather?.wind_kph ?? 10, baselineDemand), [weather?.wind_kph, baselineDemand]);

  const statCls = 'space-y-0.5';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-[var(--accent)]" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
          Weather Insights
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          Live weather intelligence powered by WeatherAPI and demand forecast context
        </p>
      </div>

      {error && (
        <div className="relative overflow-hidden bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          {error}
        </div>
      )}

      {/* Live weather snapshot */}
      <div className={`${bento} p-5`}>
        <div className={glowLine} />
        <p className={`${eyebrow} mb-4`}>Live Conditions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: 'Location', value: weather?.location_name ?? '--' },
            { label: 'Condition', value: weather?.condition ?? '--' },
            { label: 'Temperature', value: weather ? `${weather.temp_c.toFixed(1)}°C / ${weather.temp_f.toFixed(1)}°F` : '--' },
            { label: 'Demand Impact', value: weather ? `${weather.demand_impact} (${weather.impact_score})` : '--' },
          ].map(({ label, value }) => (
            <div key={label} className={statCls}>
              <p className={eyebrow}>{label}</p>
              <p className="text-sm font-medium text-[var(--text)] mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Temperature vs Demand */}
      <div className={`${bento} p-6`}>
        <div className={glowLine} />
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-amber-400/10 rounded-lg inline-flex">
            <Thermometer size={14} className="text-amber-400" />
          </div>
          <div>
            <p className={eyebrow}>Sensitivity</p>
            <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Temperature vs Demand</h2>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempDemand}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0a0a1e', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', color: '#e8edf3', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} dot={tempDemand.length ? { r: 3, fill: '#facc15', stroke: '#050514', strokeWidth: 2 } : false} activeDot={{ r: 5, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rainfall + Wind */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-sky-400/10 rounded-lg inline-flex">
              <CloudRain size={14} className="text-sky-400" />
            </div>
            <div>
              <p className={eyebrow}>Precipitation</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Rainfall vs Demand</h2>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rainDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a1e', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', color: '#e8edf3', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                  {rainDemand.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 1 ? '#facc15' : 'rgba(250,204,21,0.25)'} stroke="#facc15" strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[var(--text-muted)]/10 rounded-lg inline-flex">
              <Wind size={14} className="text-[var(--text-muted)]" />
            </div>
            <div>
              <p className={eyebrow}>Wind</p>
              <h2 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Wind Speed vs Demand</h2>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={windDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a1e', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', color: '#e8edf3', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Key Insight — bento style */}
      <div className={`${bento} p-6`}>
        <div className={glowLine} />
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-[var(--accent)]/10 rounded-lg inline-flex shrink-0">
            <Info size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className={`${eyebrow} mb-1`}>Insight</p>
            <h3 className="text-base font-light text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>Key Weather Insight</h3>
            <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Current conditions indicate{' '}
              <span className="font-medium text-[var(--accent)]">{weather?.condition ?? 'unknown conditions'}</span>
              {' '}in {weather?.location_name ?? 'the active area'}, with a dynamic demand impact score of{' '}
              <span className="font-mono font-bold text-[var(--accent)]">{weather?.impact_score ?? '--'}</span>.
              Charts above recompute demand sensitivity in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
