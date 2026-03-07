import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { Shield, Target, Zap, Info } from 'lucide-react';
import { FEATURE_IMPORTANCE } from '../../constants';

const RMSE_DATA = [
  { label: 'Base Model', value: 450, color: '#94A3B8' },
  { label: '+ Event Data', value: 320, color: '#3B82F6' },
  { label: '+ Weather Data', value: 210, color: '#10B981' },
];

const R2_DATA = [
  { name: 'Iter 1', value: 0.65 },
  { name: 'Iter 2', value: 0.72 },
  { name: 'Iter 3', value: 0.78 },
  { name: 'Iter 4', value: 0.85 },
  { name: 'Iter 5', value: 0.91 },
  { name: 'Iter 6', value: 0.94 },
];

export default function ModelPerformance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Model Performance</h1>
        <p className="text-[var(--text-secondary)] mt-1">Evaluation metrics and feature importance analysis</p>
      </div>

      {/* Top: RMSE Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {RMSE_DATA.map((item, i) => (
          <div key={i} className="glass-card p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20` }}>
                {i === 0 && <Shield size={20} style={{ color: item.color }} />}
                {i === 1 && <Target size={20} style={{ color: item.color }} />}
                {i === 2 && <Zap size={20} style={{ color: item.color }} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">RMSE Score</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">{item.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
            <div className="absolute bottom-0 left-0 h-1 w-full" style={{ backgroundColor: item.color, opacity: 0.3 }}></div>
          </div>
        ))}
      </div>

      {/* Middle: R2 and Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">R² Accuracy Progression</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={R2_DATA}>
                <defs>
                  <linearGradient id="colorR2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={3} fillOpacity={1} fill="url(#colorR2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">Feature Importance</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FEATURE_IMPORTANCE} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" fill="#F4B000" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Explanation */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-4">
          <Info className="text-primary w-5 h-5" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Model Methodology</h2>
        </div>
        <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
          <p>
            Our forecasting engine utilizes a <span className="text-[var(--text-primary)] font-medium">Gradient Boosted Decision Tree (XGBoost)</span> architecture, optimized for time-series tabular data. By integrating multi-modal data sources—including historical yellow/green taxi records, real-time weather feeds from NOAA, and a curated database of NYC public events—the model achieves a significant reduction in error compared to baseline seasonal models.
          </p>
          <p>
            The current production version (v3.4.2) focuses on <span className="text-[var(--text-primary)] font-medium">short-term demand spikes</span>. Feature engineering plays a critical role, with "Hour-Borough Interaction" and "Precipitation Intensity" emerging as the most predictive variables. We employ a rolling-window cross-validation strategy to ensure the model remains robust against shifting urban mobility patterns.
          </p>
        </div>
      </div>
    </div>
  );
}
