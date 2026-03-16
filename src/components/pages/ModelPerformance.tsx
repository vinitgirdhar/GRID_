import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Shield, Target, Zap, Info } from 'lucide-react';
import { getMetrics } from '../../services/apiService';
import { MetricsResponse } from '../../types';

const formatFeatureName = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const REFRESH_INTERVAL_MS = 20000;

function formatRefreshAge(generatedAt?: string) {
  if (!generatedAt) {
    return 'Waiting for metrics';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - new Date(generatedAt).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadMetrics = async () => {
      try {
        const response = await getMetrics();
        if (!cancelled) {
          setMetrics(response);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load live model metrics. Start the FastAPI backend on port 8000 and refresh.');
        }
      }
    };

    loadMetrics();
    intervalId = setInterval(loadMetrics, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const rmseData = metrics?.model_variants.map((item) => ({
    label: item.label,
    value: Number(item.test_rmse.toFixed(2)),
    color: item.key === 'baseline' ? '#94A3B8' : item.key === 'events' ? '#3B82F6' : '#10B981',
  })) ?? [];

  const r2Data = metrics?.model_variants.map((item, index) => ({
    name: `Iter ${index + 1}`,
    value: Number(item.test_r2.toFixed(4)),
    label: item.label,
  })) ?? [];

  const featureImportance = metrics?.feature_importance.map((item) => ({
    name: formatFeatureName(item.name),
    value: Number(item.value.toFixed(3)),
  })) ?? [];

  const activeVariant = metrics?.model_variants.find((item) => item.key === metrics.current_model_key);
  const baselineVariant = metrics?.model_variants.find((item) => item.key === 'baseline');
  const rmseGain = baselineVariant && activeVariant
    ? (((baselineVariant.test_rmse - activeVariant.test_rmse) / baselineVariant.test_rmse) * 100)
    : null;
  const r2Gain = baselineVariant && activeVariant
    ? ((activeVariant.test_r2 - baselineVariant.test_r2) * 100)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Model Performance</h1>
        <div className="text-sm text-[var(--text-secondary)]">
          <p>Live evaluation metrics and feature importance from the FastAPI ML backend</p>
          <p className="text-xs mt-1">Last refresh: <span className="font-semibold text-[var(--text-primary)]">{formatRefreshAge(metrics?.generated_at)}</span> (auto every 20s)</p>
        </div>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rmseData.map((item, index) => (
          <div key={item.label} className="glass-card p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20` }}>
                {index === 0 && <Shield size={20} style={{ color: item.color }} />}
                {index === 1 && <Target size={20} style={{ color: item.color }} />}
                {index === 2 && <Zap size={20} style={{ color: item.color }} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Test RMSE</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">{item.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
            <div className="absolute bottom-0 left-0 h-1 w-full" style={{ backgroundColor: item.color, opacity: 0.3 }}></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-6 text-[var(--text-primary)]">R² Accuracy Progression</h2>
          <div className="h-[300px]" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r2Data}>
                <defs>
                  <linearGradient id="colorR2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0.9, 1]} />
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
          <div className="h-[300px]" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  width={150}
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

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Current Model Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Serving Model</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{metrics?.current_model_label ?? '--'}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Type: {activeVariant?.model_type ?? '--'}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Training Date</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{activeVariant?.training_date ?? 'Not provided'}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Features: {activeVariant?.feature_count ?? '--'}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Improvement vs Baseline</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{rmseGain !== null ? `${rmseGain.toFixed(2)}% RMSE` : '--'}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{r2Gain !== null ? `+${r2Gain.toFixed(2)} R² points` : '--'}</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-4">
          <Info className="text-primary w-5 h-5" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Model Methodology</h2>
        </div>
        <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
          <p>
            The backend currently serves the <span className="text-[var(--text-primary)] font-medium">{metrics?.current_model_label ?? 'Improved Model'}</span> through FastAPI, with the XGBoost booster and report artifacts preloaded once at startup for low-latency inference.
          </p>
          <p>
            {activeVariant
              ? `This model exposes ${activeVariant.feature_count} engineered features and is currently reporting a test RMSE of ${activeVariant.test_rmse.toFixed(2)} and test R² of ${activeVariant.test_r2.toFixed(4)}.`
              : 'Once the backend is running, this section will show the live model quality figures pulled from the JSON metadata files.'}
          </p>
        </div>
      </div>
    </div>
  );
}
