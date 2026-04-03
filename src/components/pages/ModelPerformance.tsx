import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import { Shield, Target, Zap, Info, CheckCircle, TrendingUp, Clock, Users, RefreshCw } from 'lucide-react';
import { InsightTooltip } from '../charts/InsightTooltip';
import {
  asNumber,
  formatInfluenceScore,
  formatR2Score,
  getFeatureInfluenceInsight,
  getR2Insight,
} from '../charts/insightTooltipUtils';
import { getMetrics, getValidationMetrics } from '../../services/apiService';
import { MetricsResponse, ValidationMetricsResponse } from '../../types';

const formatFeatureName = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const REFRESH_INTERVAL_MS = 30000;

function formatRefreshAge(generatedAt?: string) {
  if (!generatedAt) return 'Waiting for metrics';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(generatedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [validation, setValidation] = useState<ValidationMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [m, v] = await Promise.all([getMetrics(), getValidationMetrics()]);
        if (!cancelled) {
          setMetrics(m);
          setValidation(v);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load metrics. Start the FastAPI backend on port 8000 and refresh.');
        }
      }
    };

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── Section 1 data ──────────────────────────────────────────────────────────
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
  const featureMax = Math.max(0, ...featureImportance.map((item) => item.value));

  const r2Tooltip = {
    title: 'R² Accuracy Score',
    contextLabel: 'Model Variant',
    metricLabel: 'R² Accuracy',
    description: 'A normalized fit score, so 0.8900 means the model explains about 89% of demand variance in evaluation.',
    details: [
      'X-axis: evaluated model version in the rollout progression',
      'Y-axis: R² score on a 0 to 1 scale',
    ],
    accentColor: '#F4B000',
    labelFormatter: (label: string | number | undefined, item: { payload?: Record<string, unknown> }) => {
      const variantLabel = typeof label === 'string'
        ? label
        : typeof item.payload?.label === 'string'
          ? item.payload.label
          : 'Model';
      const iterationLabel = typeof item.payload?.name === 'string' ? item.payload.name : null;
      return iterationLabel ? `${variantLabel} (${iterationLabel})` : variantLabel;
    },
    valueFormatter: (value: number | string | undefined) => formatR2Score(value),
    insightFormatter: (item: { value?: number | string }) => getR2Insight(asNumber(item.value)),
  };

  const featureTooltip = {
    title: 'Influence Score',
    contextLabel: 'Feature',
    metricLabel: 'Influence Score',
    description: 'A normalized importance score, so 0.240 means this feature materially shapes the model output.',
    details: [
      'X-axis: relative influence score used by the model',
      'Y-axis: feature contributing to the demand forecast',
    ],
    accentColor: '#F4B000',
    valueFormatter: (value: number | string | undefined) => formatInfluenceScore(value),
    insightFormatter: (item: { value?: number | string }) => getFeatureInfluenceInsight(asNumber(item.value), featureMax),
  };

  // ── Section 2 KPI cards ─────────────────────────────────────────────────────
  const liveKPIs = [
    {
      label: 'Prediction Accuracy',
      value: validation ? `${validation.prediction_accuracy_pct}%` : '--',
      icon: <CheckCircle size={20} className="text-[#10B981]" />,
      color: '#10B981',
      sub: `${validation?.validated_predictions ?? 0} validated`,
    },
    {
      label: 'Hit Rate',
      value: validation ? `${validation.hit_rate_pct}%` : '--',
      icon: <TrendingUp size={20} className="text-[#3B82F6]" />,
      color: '#3B82F6',
      sub: 'Predictions that matched demand',
    },
    {
      label: 'Driver Success Rate',
      value: validation ? `${validation.driver_success_rate_pct}%` : '--',
      icon: <Users size={20} className="text-[#F4B000]" />,
      color: '#F4B000',
      sub: 'Drivers who got a ride',
    },
    {
      label: 'Avg Pickup Time',
      value: validation ? `${validation.avg_pickup_time_min} min` : '--',
      icon: <Clock size={20} className="text-[#A78BFA]" />,
      color: '#A78BFA',
      sub: 'Time from zone arrival to pickup',
    },
  ];

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Model Performance</h1>
        <div className="text-sm text-[var(--text-secondary)]">
          <p>Live evaluation metrics and validation KPIs from the FastAPI ML backend</p>
          <p className="text-xs mt-1">
            Last refresh:{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {formatRefreshAge(metrics?.generated_at)}
            </span>{' '}
            (auto every 20s)
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-card p-6 border border-danger/20 text-danger">{error}</div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — MODEL HEALTH
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Model Health
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rmseData.map((item, index) => (
            <div key={item.label} className="glass-card p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20` }}>
                  {index === 0 && <Shield size={20} style={{ color: item.color }} />}
                  {index === 1 && <Target size={20} style={{ color: item.color }} />}
                  {index === 2 && <Zap size={20} style={{ color: item.color }} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  Test RMSE
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium">{item.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
              <div
                className="absolute bottom-0 left-0 h-1 w-full"
                style={{ backgroundColor: item.color, opacity: 0.3 }}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)]">R² Accuracy Progression</h3>
            <div className="h-[280px]" style={{ minWidth: 0 }}>
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
                  <Tooltip content={<InsightTooltip config={r2Tooltip} />} />
                  <Area type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={3} fillOpacity={1} fill="url(#colorR2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)]">Feature Importance</h3>
            <div className="h-[280px]" style={{ minWidth: 0 }}>
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
                  <Tooltip content={<InsightTooltip config={featureTooltip} />} />
                  <Bar dataKey="value" fill="#F4B000" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — LIVE VALIDATION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Live Validation
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {liveKPIs.map((kpi) => (
            <div key={kpi.label} className="glass-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                {kpi.icon}
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: kpi.color }}
                >
                  Live
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">{kpi.sub}</p>
              <div
                className="absolute bottom-0 left-0 h-0.5 w-full"
                style={{ backgroundColor: kpi.color, opacity: 0.4 }}
              />
            </div>
          ))}
        </div>

        {/* Graph 1 — Predicted vs Actual */}
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)]">
            Predicted vs Actual Demand
          </h3>
          <div className="h-[260px]" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={validation?.predicted_vs_actual ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                <Line type="monotone" dataKey="predicted" stroke="#F4B000" strokeWidth={2} dot={{ r: 4 }} name="Predicted" />
                <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2 & 3 side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 2 — Prediction Success Breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)]">
              Prediction Success Breakdown
            </h3>
            <div className="h-[240px]" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={validation?.prediction_breakdown ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: number, name: string) =>
                      name === 'hit_rate' ? [`${value}%`, 'Hit Rate'] : [value, name === 'total' ? 'Total' : 'Hits']
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={28} name="Total" />
                  <Bar dataKey="hits" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} name="Hits" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graph 3 — Driver Impact */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold mb-6 text-[var(--text-primary)]">
              Driver Impact
            </h3>
            <div className="h-[240px]" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={validation?.driver_impact ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: number, name: string) =>
                      name === 'success_rate' ? [`${value}%`, 'Success Rate'] : [`${value} min`, 'Avg Pickup']
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Line type="monotone" dataKey="success_rate" stroke="#F4B000" strokeWidth={2} dot={{ r: 4 }} name="success_rate" />
                  <Line type="monotone" dataKey="avg_pickup_min" stroke="#A78BFA" strokeWidth={2} dot={{ r: 4 }} name="avg_pickup_min" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — FEEDBACK LOOP & MODEL LEARNING
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Feedback Loop &amp; Model Learning
        </h2>

        {/* Live model state bar */}
        {validation?.model_state && (() => {
          const ms = validation.model_state;
          const rmseRange = ms.rmse_floor;
          const rmseStart = 9.74;
          const rmseProgress = Math.max(0, Math.min(1, (rmseStart - ms.current_rmse) / (rmseStart - rmseRange)));
          const nextIn = ms.next_retrain_in;
          const cycleSize = 10;
          const cycleProgress = ((cycleSize - nextIn) / cycleSize) * 100;

          return (
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-[#10B981]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Generation {ms.generation} — Live Learning
                  </span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  Next retrain in <span className="font-bold text-[var(--text-primary)]">{nextIn}</span> validation{nextIn !== 1 ? 's' : ''}
                </span>
              </div>

              {/* RMSE improvement bar */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>RMSE: <span className="font-bold text-[#10B981]">{ms.current_rmse.toFixed(2)}</span></span>
                  <span>Floor: {ms.rmse_floor}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${rmseProgress * 100}%`, background: 'linear-gradient(90deg, #3B82F6, #10B981)' }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {(rmseProgress * 100).toFixed(1)}% toward minimum error floor
                </p>
              </div>

              {/* R² improvement bar */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>R²: <span className="font-bold text-[#F4B000]">{ms.current_r2.toFixed(4)}</span></span>
                  <span>Ceiling: {ms.r2_ceiling}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${((ms.current_r2 - 0.92) / (ms.r2_ceiling - 0.92)) * 100}%`,
                      background: 'linear-gradient(90deg, #F4B000, #10B981)',
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {(((ms.current_r2 - 0.92) / (ms.r2_ceiling - 0.92)) * 100).toFixed(1)}% toward accuracy ceiling
                </p>
              </div>

              {/* Next retrain progress */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>Current cycle progress</span>
                  <span>{cycleSize - nextIn} / {cycleSize} validations</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#A78BFA] transition-all duration-700"
                    style={{ width: `${cycleProgress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Retrain log */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-[var(--text-secondary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Retrain History</h3>
            <span className="ml-auto text-[11px] text-[var(--text-secondary)]">
              {validation?.retrain_log?.length ?? 0} retrain{(validation?.retrain_log?.length ?? 0) !== 1 ? 's' : ''} completed
            </span>
          </div>

          {!validation?.retrain_log?.length ? (
            <p className="text-sm text-[var(--text-secondary)]">No retrains yet. The model will retrain automatically after 10 new validations.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...validation.retrain_log].reverse().map((evt) => (
                <div
                  key={evt.generation}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #10B981)' }}>
                    <span className="text-[10px] font-bold text-white">G{evt.generation}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        RMSE {evt.rmse_before} → <span className="text-[#10B981]">{evt.rmse_after}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] font-bold">
                        -{evt.improvement_pct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      R² {evt.r2_before} → {evt.r2_after} · {evt.logs_used} validation logs used
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
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
