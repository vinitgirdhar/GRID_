import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import { Shield, Target, Zap, Info, CheckCircle, TrendingUp, Clock, Users, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { InsightTooltip } from '../charts/InsightTooltip';
import {
  asNumber, formatInfluenceScore, formatR2Score,
  getFeatureInfluenceInsight, getR2Insight,
} from '../charts/insightTooltipUtils';
import { getMetrics, getValidationMetrics } from '../../services/apiService';
import { MetricsResponse, ValidationMetricsResponse } from '../../types';
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
const chartStyle = { backgroundColor: '#0a0a1e', border: '1px solid rgba(250,204,21,0.15)', borderRadius: '12px', color: '#e8edf3', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 };
const tickStyle = { fill: '#4b5e78', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' };

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [validation, setValidation] = useState<ValidationMetricsResponse | null>(null);
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
        const [m, v] = await Promise.all([getMetrics(), getValidationMetrics()]);
        if (!cancelled) { setMetrics(m); setValidation(v); setError(null); }
      } catch {
        if (!cancelled) setError('Unable to load metrics. Start the FastAPI backend on port 8000 and refresh.');
      }
    };
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const predictionThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshValidation = useRef(() => { getValidationMetrics().then(setValidation).catch(() => null); });

  useLiveStream({
    onConnected: () => setLive(true),
    onDisconnected: () => setLive(false),
    onRetrain: () => { refreshValidation.current(); },
    onPrediction: () => {
      if (predictionThrottleRef.current) return;
      predictionThrottleRef.current = setTimeout(() => { predictionThrottleRef.current = null; refreshValidation.current(); }, 10_000);
    },
  });

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

  const liveKPIs = [
    { label: 'Prediction Accuracy', value: validation ? `${validation.prediction_accuracy_pct}%` : '--', icon: CheckCircle, color: '#34d399', sub: `${validation?.validated_predictions ?? 0} validated` },
    { label: 'Hit Rate', value: validation ? `${validation.hit_rate_pct}%` : '--', icon: TrendingUp, color: '#38bdf8', sub: 'Predictions matching demand' },
    { label: 'Driver Success Rate', value: validation ? `${validation.driver_success_rate_pct}%` : '--', icon: Users, color: '#facc15', sub: 'Drivers who got a ride' },
    { label: 'Avg Pickup Time', value: validation ? `${validation.avg_pickup_time_min} min` : '--', icon: Clock, color: '#a78bfa', sub: 'Zone arrival to pickup' },
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
            Live evaluation metrics and validation KPIs from the FastAPI ML backend
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

      {/* ── SECTION 1 — LIVE VALIDATION ── */}
      <section className="space-y-6">
        <p className={`${eyebrow} border-b border-[var(--border)] pb-2`}>Live Validation</p>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {liveKPIs.map((kpi) => (
            <div key={kpi.label} className={`${bento} p-5`}>
              <div className={glowLine} />
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg inline-flex" style={{ backgroundColor: `${kpi.color}18` }}>
                  <kpi.icon size={16} style={{ color: kpi.color }} />
                </div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: kpi.color }}>Live</p>
              </div>
              <p className={eyebrow}>{kpi.label}</p>
              <p className="text-2xl font-light mt-1" style={{ color: kpi.color, fontFamily: 'Outfit, sans-serif' }}>{kpi.value}</p>
              <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{kpi.sub}</p>
              <div className="absolute bottom-0 left-0 h-[2px] w-full" style={{ backgroundColor: kpi.color, opacity: 0.2 }} />
            </div>
          ))}
        </div>

        {/* Predicted vs Actual */}
        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="mb-5">
            <p className={eyebrow}>Accuracy</p>
            <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Predicted vs Actual Demand</h3>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={validation?.predicted_vs_actual ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={tickStyle} />
                <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                <Tooltip contentStyle={chartStyle} labelStyle={{ color: '#e8edf3', fontWeight: 600 }} itemStyle={{ color: '#94a3b8' }} cursor={{ stroke: 'rgba(250,204,21,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }} />
                <Line type="monotone" dataKey="predicted" stroke="#facc15" strokeWidth={2} dot={validation?.predicted_vs_actual?.length ? { r: 3, strokeWidth: 2, fill: '#facc15' } : false} activeDot={{ r: 4 }} name="Predicted" />
                <Line type="monotone" dataKey="actual" stroke="#34d399" strokeWidth={2} dot={validation?.predicted_vs_actual?.length ? { r: 3, strokeWidth: 2, fill: '#34d399' } : false} activeDot={{ r: 4 }} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success Breakdown + Driver Impact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${bento} p-6`}>
            <div className={glowLine} />
            <div className="mb-5">
              <p className={eyebrow}>Breakdown</p>
              <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Prediction Success Breakdown</h3>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={validation?.prediction_breakdown ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                  <XAxis dataKey="level" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                  <Tooltip contentStyle={chartStyle} labelStyle={{ color: '#e8edf3', fontWeight: 600 }} itemStyle={{ color: '#94a3b8' }} cursor={{ fill: 'rgba(250,204,21,0.04)' }}
                    formatter={(value: number, name: string) => name === 'hit_rate' ? [`${value}%`, 'Hit Rate'] : [value, name === 'total' ? 'Total' : 'Hits']} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }} />
                  <Bar dataKey="total" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={24} name="Total" />
                  <Bar dataKey="hits" fill="#34d399" radius={[4, 4, 0, 0]} barSize={24} name="Hits" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${bento} p-6`}>
            <div className={glowLine} />
            <div className="mb-5">
              <p className={eyebrow}>Fleet</p>
              <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Driver Impact</h3>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={validation?.driver_impact ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(250,204,21,0.08)" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                  <Tooltip contentStyle={chartStyle} labelStyle={{ color: '#e8edf3', fontWeight: 600 }} itemStyle={{ color: '#94a3b8' }} cursor={{ stroke: 'rgba(250,204,21,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    formatter={(value: number, name: string) => name === 'success_rate' ? [`${value}%`, 'Success Rate'] : [`${value} min`, 'Avg Pickup']} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }} />
                  <Line type="monotone" dataKey="success_rate" stroke="#facc15" strokeWidth={2} dot={validation?.driver_impact?.length ? { r: 3, fill: '#facc15' } : false} activeDot={{ r: 4 }} name="success_rate" />
                  <Line type="monotone" dataKey="avg_pickup_min" stroke="#a78bfa" strokeWidth={2} dot={validation?.driver_impact?.length ? { r: 3, fill: '#a78bfa' } : false} activeDot={{ r: 4 }} name="avg_pickup_min" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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

      {/* ── SECTION 3 — FEEDBACK LOOP ── */}
      <section className="space-y-6">
        <p className={`${eyebrow} border-b border-[var(--border)] pb-2`}>Feedback Loop &amp; Model Learning</p>

        {validation?.model_state && (() => {
          const ms = validation.model_state;
          const rmseStart = 9.74;
          const rmseProgress = Math.max(0, Math.min(1, (rmseStart - ms.current_rmse) / (rmseStart - ms.rmse_floor)));
          const cycleProgress = ((10 - ms.next_retrain_in) / 10) * 100;

          return (
            <div className={`${bento} p-6 space-y-5`}>
              <div className={glowLine} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-400/10 rounded-lg inline-flex">
                    <RefreshCw size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Generation {ms.generation} — Live Learning
                  </span>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Next retrain in <span className="font-bold text-[var(--text)]">{ms.next_retrain_in}</span> validation{ms.next_retrain_in !== 1 ? 's' : ''}
                </span>
              </div>

              {[
                { label: 'RMSE', current: ms.current_rmse.toFixed(2), target: String(ms.rmse_floor), progress: rmseProgress * 100, color: 'linear-gradient(90deg, #38bdf8, #34d399)', pctLabel: `${(rmseProgress * 100).toFixed(1)}% toward minimum error floor`, valueColor: '#34d399' },
                { label: 'R²', current: ms.current_r2.toFixed(4), target: String(ms.r2_ceiling), progress: ((ms.current_r2 - 0.92) / (ms.r2_ceiling - 0.92)) * 100, color: 'linear-gradient(90deg, #facc15, #34d399)', pctLabel: `${(((ms.current_r2 - 0.92) / (ms.r2_ceiling - 0.92)) * 100).toFixed(1)}% toward accuracy ceiling`, valueColor: '#facc15' },
              ].map(({ label, current, target, progress, color, pctLabel, valueColor }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-mono text-[var(--text-muted)] mb-1.5">
                    <span>{label}: <span className="font-bold" style={{ color: valueColor }}>{current}</span></span>
                    <span>Target: {target}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 border border-[var(--border)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: color }} />
                  </div>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{pctLabel}</p>
                </div>
              ))}

              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--text-muted)] mb-1.5">
                  <span>Cycle progress</span>
                  <span>{10 - ms.next_retrain_in} / 10 validations</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 border border-[var(--border)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#a78bfa] transition-all duration-700" style={{ width: `${cycleProgress}%` }} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Retrain log */}
        <div className={`${bento} p-6`}>
          <div className={glowLine} />
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[var(--text-muted)]/10 rounded-lg inline-flex">
              <Info size={14} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className={eyebrow}>History</p>
                <h3 className="text-base font-light text-[var(--text)] mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Retrain Log</h3>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {validation?.retrain_log?.length ?? 0} retrain{(validation?.retrain_log?.length ?? 0) !== 1 ? 's' : ''} completed
              </span>
            </div>
          </div>

          {!validation?.retrain_log?.length ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              No retrains yet. The model retrains automatically after 10 new validations.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...validation.retrain_log].reverse().map((evt) => (
                <div key={evt.generation} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-[var(--border)]">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #38bdf8, #34d399)' }}>
                    <span className="text-[10px] font-mono font-bold text-white">G{evt.generation}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        RMSE {evt.rmse_before} → <span className="text-emerald-400 font-mono">{evt.rmse_after}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 font-bold">
                        -{evt.improvement_pct}%
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                      R² {evt.r2_before} → {evt.r2_after} · {evt.logs_used} validation logs
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
