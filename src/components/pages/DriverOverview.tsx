import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
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
  AlertTriangle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DRIVER_KPIS } from '../../constants';
import { getPredictionData } from '../../services/predictionService';
import { PredictionState, Theme } from '../../types';
import MapComponent from '../MapComponent';

export default function DriverOverview() {
  const [data, setData] = useState<PredictionState | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setData(getPredictionData());
    // Detect theme from document class
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          setTheme(isDarkNow ? 'dark' : 'light');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Operational Intelligence</h1>
          <p className="text-[var(--text-secondary)] mt-1">Real-time urban demand and environmental awareness.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-success bg-success/10 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          LIVE UPDATES ACTIVE
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DRIVER_KPIS.map((kpi, idx) => (
          <div key={idx} className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                {idx === 0 && <DollarSign className="text-primary w-5 h-5" />}
                {idx === 1 && <CheckCircle className="text-success w-5 h-5" />}
                {idx === 2 && <Percent className="text-warning w-5 h-5" />}
                {idx === 3 && <Zap className="text-secondary w-5 h-5" />}
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${kpi.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                {kpi.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {kpi.change}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">{kpi.label}</p>
              <p className="text-2xl font-black mt-1 text-[var(--text-primary)]">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1️⃣ Demand Intelligence Section */}
        <div className="glass-card p-6 flex flex-col hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="text-primary w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Demand Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-black text-danger">High Demand Expected</p>
                <span className="px-2 py-1 bg-danger/10 text-danger text-[10px] font-black rounded uppercase">Critical</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Manhattan – Midtown</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">6:00 PM – 8:00 PM</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Predicted Rides</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">5,200</p>
                </div>
              </div>
            </div>

            <div className="h-[100px] w-full">
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mb-2">3 Hour Trend</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.threeHourTrend}>
                  <defs>
                    <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#F4B000" fillOpacity={1} fill="url(#colorDemand)" strokeWidth={2} />
                  <XAxis dataKey="name" hide />
                  <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }}
                    labelStyle={{ display: 'none' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-bold text-primary not-italic">Tip:</span> “Position near Midtown between 6–7 PM to maximize surge fares.”
              </p>
            </div>
          </div>
        </div>

        {/* 2️⃣ Weather Intelligence Section */}
        <div className="glass-card p-6 flex flex-col hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <CloudRain className="text-secondary w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Weather Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-black text-secondary">Rain Expected</p>
                <span className="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-black rounded uppercase">Active Alert</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Brooklyn – Downtown</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">In 30 minutes</p>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">{data.weather.temp}°F</p>
                </div>
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">{data.weather.windSpeed} mph</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                Rain likely to increase ride demand by <span className="text-secondary font-bold">15%</span> in affected zones.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-bold text-secondary not-italic">Tip:</span> “Move toward Downtown Brooklyn before rainfall begins.”
              </p>
            </div>
          </div>
        </div>

        {/* 3️⃣ Event Intelligence Section */}
        <div className="glass-card p-6 flex flex-col hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Calendar className="text-warning w-5 h-5" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">Event Intelligence</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-black text-warning">Concert Ending Soon</p>
                <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-black rounded uppercase">Surge Risk</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Area</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Madison Square Garden – Manhattan</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Time Window</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">10:30 PM</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Expected Surge</p>
                  <p className="text-sm font-bold text-warning">High (1.8x - 2.4x)</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-warning/5 border border-warning/10">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-1">Impact Analysis</p>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                Large crowd dispersal expected. Traffic congestion likely on 7th and 8th Avenues.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-start gap-2">
              <Zap size={14} className="text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                <span className="font-bold text-warning not-italic">Tip:</span> “Arrive near venue exit 15 minutes before event ends.”
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4️⃣ Functional Hotspot Map (Driver View) */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <MapPin className="text-secondary w-5 h-5" />
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

        <MapComponent zones={data.zones} theme={theme} height="450px" simplified={true} />
      </div>
    </div>
  );
}
