import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { Shield, Target, Zap, CheckCircle, Gauge, Ruler, Sigma, Wifi, WifiOff } from 'lucide-react';
import { InsightTooltip } from '../charts/InsightTooltip';
import {
  asNumber, formatInfluenceScore, formatR2Score,
  getFeatureInfluenceInsight, getR2Insight,
} from '../charts/insightTooltipUtils';
import { getMetrics } from '../../services/apiService';
import { MetricsResponse } from '../../types';
import { useLiveStream } from '../../hooks/useLiveStream';

const formatFeatureName = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const REFRESH_INTERVAL_MS = 600000;

function parseUtcTimestamp(ts: string): number {
  if (!ts.endsWith('Z') && !ts.includes('+')) return new Date(ts + 'Z').getTime();
  return new Date(ts).getTime();
}
function formatRefreshAge(generatedAt?: string) {
  if (!generatedAt) return 'Waiting for metrics';
  const minutes = Math.floor(Math.max(0, Date.now() - parseUtcTimestamp(generatedAt)) / 60000);
  return minutes === 0 ? 'just now' : `${minutes}m ago`;
}

const bento = 'relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group';
const glowLine = 'absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300';
const eyebrow = 'text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest';
const tickStyle = { fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' };

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const m = await getMetrics();
        if (!cancelled) { setMetrics(m); setError(null); }
      } catch {
        if (!cancelled) setError('Unable to load metrics. Start the FastAPI backend on port 8000 and refresh.');
      }
    };
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useLiveStream({
    onConnected: () => setLive(true),
    onDisconnected: () => setLive(false),
  });

  // Production model = the trained artifact evaluated on the held-out test set
  const prod = metrics?.model_variants[0] ?? null;
  const accuracyPct = prod?.test_mape != null ? Math.max(0, 100 - prod.test_mape) : null;

  const rmseData = metrics?.model_variants.map((item) => ({
    label: item.label, value: Number(item.test_rmse.toFixed(2)),
    color: item.key === 'baseline' ? '#94a3b8' : item.key === 'events' ? '#38bdf8' : '#34d399',
  })) ?? [];

  const r2Data = metrics?.model_variants.map((item, i) => ({
    name: `Iter ${i + 1}`, value: Number(item.test_r2.toFixed(4)), label: item.label,
  })) ?? [];

  const featureImportance = metrics?.feature_importance.map((item) => ({
    name: formatFeatureName(item.name), value: Number(item.value.toFixed(3)),
  })) ?? [];
  const featureMax = Math.max(0, ...featureImportance.map((d) => d.value));

  const r2Tooltip = {
    title: 'R² Accuracy Score', contextLabel: 'Model Variant', metricLabel: 'R² Accuracy',
    description: '0.8900 means the model explains ~89% of demand variance.',
    details: ['X-axis: model version', 'Y-axis: R² score (0–1)'],
    accentColor: '#facc15',
    labelFormatter: (label: string | number | undefined, item: { payload?: Record<string, unknown> }) => {
      const v = typeof label === 'string' ? label : typeof item.payload?.label === 'string' ? item.payload.label : 'Model';
      const n = typeof item.payload?.name === 'string' ? item.payload.name : null;
      return n ? `${v} (${n})` : v;
    },
    valueFormatter: (value: number | string | undefined) => formatR2Score(value),
    insightFormatter: (item: { value?: number | string }) => getR2Insight(asNumber(item.value)),
  };

  const featureTooltip = {
    title: 'Influence Score', contextLabel: 'Feature', metricLabel: 'Influence Score',
    description: '0.240 means this feature materially shapes the model output.',
    details: ['X-axis: influence score', 'Y-axis: feature name'],
    accentColor: '#facc15',
    valueFormatter: (value: number | string | undefined) => formatInfluenceScore(value),
    insightFormatter: (item: { value?: number | string }) => getFeatureInfluenceInsight(asNumber(item.value), featureMax),
  };

  // Validation methodology — real split sizes + per-split metrics from training metadata
  const totalRows = (prod?.train_size ?? 0) + (prod?.val_size ?? 0) + (prod?.test_size ?? 0);
  const splits = prod && totalRows > 0 ? [
    { name: 'Train', rows: prod.train_size ?? 0, color: '#38bdf8', desc: 'Model learns patterns' },
    { name: 'Validation', rows: prod.val_size ?? 0, color: '#facc15', desc: 'Early stopping / tuning' },
    { name: 'Test', rows: prod.test_size ?? 0, color: '#34d399', desc: 'Final unseen evaluation' },
  ] : [];
  const splitMetrics = prod ? [
    { split: 'Train', rmse: prod.train_rmse, mae: prod.train_mae, r2: prod.train_r2 },
    { split: 'Validation', rmse: prod.val_rmse, mae: prod.val_mae, r2: prod.val_r2 },
    { split: 'Test', rmse: prod.test_rmse, mae: prod.test_mae, r2: prod.test_r2 },
  ] : [];

  // Real test-set KPIs from the trained model's metadata (fixed artifact)
  const testKPIs = [
    { label: 'Prediction Accuracy', value: accuracyPct != null ? `${accuracyPct.toFixed(1)}%` : '--', icon: CheckCircle, color: '#34d399', sub: '100 − MAPE on held-out test set' },
    { label: 'R² Score', value: prod ? prod.test_r2.toFixed(4) : '--', icon: Gauge, color: '#38bdf8', sub: 'Demand variance explained' },
    { label: 'Test RMSE', value: prod ? prod.test_rmse.toFixed(2) : '--', icon: Ruler, color: '#facc15', sub: 'Root mean squared error (trips/hr)' },
    { label: 'Test MAE', value: prod?.test_mae != null ? prod.test_mae.toFixed(2) : '--', icon: Sigma, color: '#a78bfa', sub: 'Mean absolute error (trips/hr)' },
  ];

  const rmseIcons = [Shield, Target, Zap];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-light tracking-tight text-[var(--accent)]" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
              Model Performance
            </h1>
            {live
              ? <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full"><Wifi size={10} /> Live</span>
              : <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] bg-white/5 border border-[var(--border)] px-2 py-0.5 rounded-full"><WifiOff size={10} /> Polling</span>
            }
          </div>
          <p className="text-[var(--text-muted)] text-sm mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Evaluation metrics of the trained production model on real held-out NYC taxi data
          </p>
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono">
          Last refresh: <span className="text-[var(--text)] font-bold">{formatRefreshAge(metrics?.generated_at)}</span> (auto every 10m)
        </p>
      </div>

      {error && (
        <div className="relative overflow-hidden bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          {error}
        </div>
      )}

      {/* ── SECTION 1 — TEST-SET PERFORMANCE ── */}
      <section className="space-y-6">
        <p className={`${eyebrow} border-b border-[var(--border)] pb-2`}>Test-Set Performance</p>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {testKPIs.map((kpi) => (
            <div key={kpi.label} className={`${bento} p-5`}>
              <div className={glowLine} />
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg inline-flex" style={{ backgroundColor: `${kpi.color}18` }}>
                  <kpi.icon size={16} style={{ color: kpi.color }} />
                </div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: kpi.color }}>Test Set</p>
              </div>
              <p className={eyebrow}>{kpi.label}</p>
              <p className="text-2xl font-light mt-1" style={{ color: kpi.color, fontFamily: 'Outfit, sans-serif' }}>{kpi.value}</p>
              <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{kpi.sub}</p>
              <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ backgroundColor: kpi.color, opacity: 0.2 }} />
            </div>
          ))}
        </div>

        {/* How We Validate */}
        {prod && totalRows > 0 && (
          <div className={`${bento} p-6`}>
            <div className={glowLine} />
            <div className="mb-5">
              <p className={eyebrow}>Methodology</p>
              <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>How We Validate</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                {totalRows.toLocaleString()} real NYC taxi records are split chronologically — the model never sees the future during training,
                and the test set is touched exactly once, after training is complete.
              </p>
            </div>

            {/* Split bar */}
            <div className="flex h-3 rounded-full overflow-hidden border border-[var(--border)] mb-3">
              {splits.map((s) => (
                <div key={s.name} style={{ width: `${(s.rows / totalRows) * 100}%`, backgroundColor: s.color, opacity: 0.85 }} title={`${s.name}: ${s.rows.toLocaleString()} rows`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {splits.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                    <span className="text-xs font-medium text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{s.name}</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{((s.rows / totalRows) * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{s.rows.toLocaleString()} rows — {s.desc}</p>
                </div>
              ))}
            </div>

            {/* Per-split metrics table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className={`${eyebrow} py-2 pr-4`}>Split</th>
                    <th className={`${eyebrow} py-2 pr-4`}>RMSE</th>
                    <th className={`${eyebrow} py-2 pr-4`}>MAE</th>
                    <th className={`${eyebrow} py-2`}>R²</th>
                  </tr>
                </thead>
                <tbody>
                  {splitMetrics.map((row) => (
                    <tr key={row.split} className="border-b border-[var(--border)]/50 last:border-0">
                      <td className="py-2 pr-4 text-xs text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{row.split}</td>
                      <td className="py-2 pr-4 text-xs font-mono text-[var(--text-muted)]">{row.rmse != null ? row.rmse.toFixed(2) : '--'}</td>
                      <td className="py-2 pr-4 text-xs font-mono text-[var(--text-muted)]">{row.mae != null ? row.mae.toFixed(2) : '--'}</td>
                      <td className="py-2 text-xs font-mono text-[var(--text-muted)]">{row.r2 != null ? row.r2.toFixed(4) : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-3">
              Small train→test gap (RMSE {prod.train_rmse?.toFixed(2)} → {prod.test_rmse.toFixed(2)}) = the model generalizes instead of memorizing.
            </p>
          </div>
        )}
      </section>

      {/* ── SECTION 2 — MODEL HEALTH ── */}
      <section className="space-y-6">
        <p className={`${eyebrow} border-b border-[var(--border)] pb-2`}>Model Health</p>

        {/* RMSE cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {rmseData.map((item, index) => {
            const Icon = rmseIcons[index];
            return (
              <div key={item.label} className={`${bento} p-6`}>
                <div className={glowLine} />
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg inline-flex" style={{ backgroundColor: `${item.color}18` }}>
                    <Icon size={18} style={{ color: item.color }} />
                  </div>
                  <p className={eyebrow}>Test RMSE</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-mono">{item.label}</p>
                <p className="text-3xl font-light mt-1" style={{ color: item.color, fontFamily: 'Outfit, sans-serif' }}>{item.value}</p>
                <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ backgroundColor: item.color, opacity: 0.25 }} />
              </div>
            );
          })}
        </div>

        {/* R² + Feature Importance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${bento} p-6`}>
            <div className={glowLine} />
            <div className="mb-5">
              <p className={eyebrow}>Accuracy</p>
              <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>R² Progression</h3>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r2Data}>
                  <defs>
                    <linearGradient id="colorR2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis axisLine={false} tickLine={false} tick={tickStyle} domain={[0.9, 1]} />
                  <Tooltip content={<InsightTooltip config={r2Tooltip} />} cursor={{ stroke: 'rgba(250,204,21,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} fillOpacity={1} fill="url(#colorR2)" activeDot={{ r: 4, fill: '#facc15', stroke: '#050514', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${bento} p-6`}>
            <div className={glowLine} />
            <div className="mb-5">
              <p className={eyebrow}>Signals</p>
              <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Feature Importance</h3>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImportance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(250,204,21,0.08)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter, sans-serif' }} width={150} />
                  <Tooltip content={<InsightTooltip config={featureTooltip} />} cursor={{ fill: 'rgba(250,204,21,0.04)' }} />
                  <Bar dataKey="value" fill="#facc15" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
