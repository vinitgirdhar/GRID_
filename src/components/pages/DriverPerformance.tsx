import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Calendar, Activity, Info, Sparkles } from 'lucide-react';
import { DRIVER_EARNINGS, DRIVER_KPIS } from '../../constants';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-sm font-bold text-primary">
          ${payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function DriverPerformance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Performance Analytics</h1>
        <p className="text-[var(--text-secondary)] mt-1">Detailed breakdown of your earnings and efficiency metrics.</p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DRIVER_KPIS.map((kpi, idx) => (
          <div key={idx} className="glass-card p-6">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{kpi.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-black text-[var(--text-primary)]">{kpi.value}</p>
              <div className={`flex items-center gap-1 text-xs font-bold ${kpi.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                {kpi.change}
                {kpi.trend === 'up' ? <TrendingUp size={14} /> : <Activity size={14} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Earnings Chart */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <DollarSign className="text-primary w-5 h-5" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Weekly Earnings Trend</h2>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20">Weekly</button>
            <button className="px-4 py-1.5 bg-[var(--background)] text-[var(--text-secondary)] text-xs font-bold rounded-lg border border-[var(--border)]">Monthly</button>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DRIVER_EARNINGS}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#F4B000"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorEarnings)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI Explanation */}
        <div className="mt-8 p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
          <Info className="text-primary w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)] italic">
            <span className="font-bold text-[var(--text-primary)] not-italic">AI Insight:</span> Your earnings typically peak on Friday and Saturday nights. You earn <span className="text-primary font-bold">12% more</span> during rainy evenings compared to clear ones, suggesting a high sensitivity to weather-driven demand spikes.
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Acceptance Rate by Day</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DRIVER_EARNINGS}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                  {DRIVER_EARNINGS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 4 ? '#2F9E6E' : '#F4B000'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-success/5 border border-success/10 rounded-2xl flex items-start gap-3">
            <Sparkles className="text-success w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)] italic">
              <span className="font-bold text-[var(--text-primary)] not-italic">AI Tip:</span> Your acceptance rate is highest on weekends. Maintaining this consistency during weekday morning peaks could increase your monthly revenue by an estimated <span className="text-success font-bold">$450</span>.
            </p>
          </div>
        </div>

        <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 rounded-full border-8 border-primary/10 border-t-primary flex items-center justify-center relative">
            <span className="text-2xl font-black text-primary">8.8</span>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center border-4 border-[var(--card)] shadow-lg">
              <TrendingUp size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Productivity Score</h3>
            <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto mt-2">
              Based on your ride density, route efficiency, and idle time. You are in the <span className="text-primary font-bold">top 5%</span> of drivers in your region.
            </p>
          </div>
          <button className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            View Detailed Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
