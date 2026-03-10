import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Thermometer, CloudRain, Wind, Info } from 'lucide-react';
import { getForecast, getWeather } from '../../services/apiService';
import { ForecastResponse, WeatherResponse } from '../../types';

const REFRESH_INTERVAL_MS = 20000;

function buildTemperatureCurve(tempC: number, baselineDemand: number) {
  const points = [0, 5, 10, 15, 20, 25, 30, 35];
  return points.map((point) => {
    const comfortDistance = Math.abs(22 - point);
    const comfortFactor = Math.max(0.7, 1.15 - (comfortDistance * 0.02));
    const rainBoost = tempC < 10 ? 1.05 : 1;
    return {
      name: `${point}°C`,
      value: Math.round(baselineDemand * comfortFactor * rainBoost),
    };
  });
}

function buildRainCurve(precipMm: number, baselineDemand: number) {
  return [
    { name: 'None', value: Math.round(baselineDemand * 0.95) },
    { name: 'Light', value: Math.round(baselineDemand * 1.03) },
    { name: 'Moderate', value: Math.round(baselineDemand * 1.1) },
    { name: 'Heavy', value: Math.round(baselineDemand * Math.max(1.15, 1 + (precipMm * 0.03))) },
  ];
}

function buildWindCurve(windKph: number, baselineDemand: number) {
  const points = [0, 10, 20, 30, 40, 50];
  return points.map((point) => {
    const impact = point >= windKph ? 1 + ((point - windKph) * 0.004) : 1 - ((windKph - point) * 0.002);
    return {
      name: `${point} kph`,
      value: Math.round(baselineDemand * Math.max(0.75, impact)),
    };
  });
}

export default function WeatherInsights() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadData = async () => {
      try {
        const [forecastResponse, weatherResponse] = await Promise.all([
          getForecast(),
          getWeather({ zoneId: forecast?.summary.peak_zone_id ?? '132' }),
        ]);

        if (!cancelled) {
          setForecast(forecastResponse);
          setWeather(weatherResponse);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load live weather intelligence. Check backend and Weather API configuration.');
        }
      }
    };

    loadData();
    intervalId = setInterval(loadData, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [forecast?.summary.peak_zone_id]);

  const baselineDemand = forecast?.summary.peak_zone_demand ?? 8000;
  const tempDemand = useMemo(() => buildTemperatureCurve(weather?.temp_c ?? 22, baselineDemand), [weather?.temp_c, baselineDemand]);
  const rainDemand = useMemo(() => buildRainCurve(weather?.precip_mm ?? 0, baselineDemand), [weather?.precip_mm, baselineDemand]);
  const windDemand = useMemo(() => buildWindCurve(weather?.wind_kph ?? 10, baselineDemand), [weather?.wind_kph, baselineDemand]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Weather Insights</h1>
        <p className="text-[var(--text-secondary)] mt-1">Live weather intelligence powered by WeatherAPI and demand forecast context</p>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[var(--text-secondary)]">Location</p>
            <p className="font-bold text-[var(--text-primary)]">{weather?.location_name ?? '--'}</p>
          </div>
          <div>
            <p className="text-[var(--text-secondary)]">Condition</p>
            <p className="font-bold text-[var(--text-primary)]">{weather?.condition ?? '--'}</p>
          </div>
          <div>
            <p className="text-[var(--text-secondary)]">Temperature</p>
            <p className="font-bold text-[var(--text-primary)]">{weather ? `${weather.temp_c.toFixed(1)}°C / ${weather.temp_f.toFixed(1)}°F` : '--'}</p>
          </div>
          <div>
            <p className="text-[var(--text-secondary)]">Demand Impact</p>
            <p className="font-bold text-[var(--text-primary)]">{weather?.demand_impact ?? '--'} ({weather?.impact_score ?? '--'})</p>
          </div>
        </div>
      </div>

      {/* Top: Temp vs Demand */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Thermometer className="text-warning w-5 h-5" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Temperature vs Demand</h2>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempDemand}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
              <Line type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={3} dot={{ r: 4, fill: '#F4B000' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Below: Rainfall and Wind */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <CloudRain className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Rainfall vs Demand</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rainDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                  {rainDemand.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 1 ? '#F4B000' : '#F4B00040'} stroke="#F4B000" strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Wind className="text-secondary w-5 h-5" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Wind Speed vs Demand</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={windDemand}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insight Card */}
      <div className="bg-primary/10 border border-primary/20 rounded-card p-6 flex items-start gap-4">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Info className="text-primary w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-primary">Key Weather Insight</h3>
          <p className="text-[var(--text-primary)]/80 mt-1">
            The current weather feed indicates <span className="font-bold text-primary">{weather?.condition ?? 'unknown conditions'}</span>
            {' '}in {weather?.location_name ?? 'the active area'}, with a dynamic demand impact score of
            {' '}<span className="font-bold text-primary">{weather?.impact_score ?? '--'}</span>. Charts above recompute demand sensitivity in real time.
          </p>
        </div>
      </div>
    </div>
  );
}
