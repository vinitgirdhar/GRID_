import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { HOURLY_DEMAND, BOROUGH_DEMAND, EVENT_DISTRIBUTION } from '../../constants';
import { Theme } from '../../types';
import { Activity, Info } from 'lucide-react';

const FEATURES = [
  'ride_count',
  'event_intensity',
  'rain',
  'temperature',
  'wind_speed',
  'hour',
  'is_weekend'
];

const CORRELATION_DATA = [
  [1.00, 0.78, 0.64, 0.12, 0.05, 0.45, 0.22],
  [0.78, 1.00, 0.15, 0.08, 0.02, 0.35, 0.18],
  [0.64, 0.15, 1.00, -0.12, 0.25, 0.12, -0.05],
  [0.12, 0.08, -0.12, 1.00, -0.15, 0.05, 0.12],
  [0.05, 0.02, 0.25, -0.15, 1.00, 0.02, -0.08],
  [0.45, 0.35, 0.12, 0.05, 0.02, 1.00, -0.15],
  [0.22, 0.18, -0.05, 0.12, -0.08, -0.15, 1.00],
];

const getCorrelationColor = (val: number) => {
  if (val > 0) return `rgba(239, 68, 68, ${val})`; // Red for positive
  if (val < 0) return `rgba(59, 130, 246, ${Math.abs(val)})`; // Blue for negative
  return 'transparent';
};

const COLORS = ['#F4B000', '#F59E0B', '#2F9E6E', '#3B82F6', '#DC2626'];

const EVENT_COMPARISON = [
  { name: 'Event Days', value: 9200 },
  { name: 'Non-Event Days', value: 7400 },
];

export default function DataInsights() {
  const [theme, setTheme] = useState<Theme>('dark');

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
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Data Insights</h1>
        <p className="text-[var(--text-secondary)] mt-1">Deep dive into historical ride patterns and event impacts</p>
      </div>

      {/* Section 1: Demand by Hour & Borough */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Demand by Hour</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HOURLY_DEMAND}>
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
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Demand by Borough</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BOROUGH_DEMAND}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="#F4B000" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section 2: Event vs Non-Event */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Event Type Distribution</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={EVENT_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {EVENT_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Demand: Event vs Non-Event</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EVENT_COMPARISON}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 10000]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {EVENT_COMPARISON.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#F4B000' : '#F4B00040'} stroke={index === 0 ? 'none' : '#F4B000'} strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section 3: Correlation Heatmap */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Activity className="text-primary w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Feature Correlation Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Heatmap Grid */}
            <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1">
              {/* Header Row */}
              <div className="h-10"></div>
              {FEATURES.map(f => (
                <div key={f} className="h-10 flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter text-center px-1">
                  {f.replace('_', ' ')}
                </div>
              ))}

              {/* Data Rows */}
              {FEATURES.map((rowFeature, i) => (
                <React.Fragment key={rowFeature}>
                  <div className="h-12 flex items-center pr-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter text-right">
                    {rowFeature.replace('_', ' ')}
                  </div>
                  {FEATURES.map((colFeature, j) => {
                    const val = CORRELATION_DATA[i][j];
                    return (
                      <div
                        key={`${i}-${j}`}
                        className="h-12 rounded-md flex items-center justify-center text-[11px] font-black transition-transform hover:scale-105 cursor-default"
                        style={{
                          backgroundColor: getCorrelationColor(val),
                          color: Math.abs(val) > 0.5 ? 'white' : 'var(--text-primary)',
                          border: '1px solid var(--border)'
                        }}
                        title={`${rowFeature} vs ${colFeature}: ${val}`}
                      >
                        {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Legend & Interpretation */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Correlation Scale</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary">-1.0</span>
              <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-primary via-[var(--background)] to-danger border border-[var(--border)]"></div>
              <span className="text-[10px] font-bold text-danger">+1.0</span>
            </div>
            <div className="flex justify-between mt-1 px-1">
              <span className="text-[9px] text-[var(--text-secondary)]">Strong Negative</span>
              <span className="text-[9px] text-[var(--text-secondary)]">Neutral</span>
              <span className="text-[9px] text-[var(--text-secondary)]">Strong Positive</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <Info size={14} className="text-primary" />
              Interpretation
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Event intensity shows <span className="text-danger font-bold">strong positive correlation (0.78)</span> with ride demand.
              Rainfall has <span className="text-danger font-bold">moderate correlation (0.64)</span>, indicating weather influences taxi usage.
              No severe multicollinearity detected among independent variables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
