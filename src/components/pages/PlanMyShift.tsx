import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Clock, DollarSign, Loader2, MapPin, Sparkles, Target } from 'lucide-react';

import { computeGoalRoute, GoalRouteResponse, GoalRouteZone } from '../../services/apiService';
import { cn } from '../../lib/utils';

const TIME_OPTIONS = [
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
  { label: '3h', value: 3 },
  { label: '4h', value: 4 },
];

const EARNINGS_OPTIONS = [
  { label: '$50', value: 50 },
  { label: '$80', value: 80 },
  { label: '$120', value: 120 },
  { label: '$150', value: 150 },
];

function ZoneRow({ zone, index }: { zone: GoalRouteZone; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className="flex items-center gap-4 rounded-2xl border border-[rgba(250,204,21,0.1)] bg-white/5 p-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black text-[#0f172a]">
        {zone.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium text-[var(--text-primary)]">{zone.zone_name}</p>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#94a3b8]">
            {zone.borough}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          ~{zone.estimated_trips} pickups | ~{zone.estimated_minutes} min
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="driver-performance-number text-sm text-[var(--success)]">
          ${zone.estimated_earnings.toFixed(0)}
        </p>
        <p className="text-[10px] text-[var(--text-secondary)]">est. earned</p>
      </div>
      {index < 2 && <ChevronRight size={14} className="shrink-0 text-[var(--text-secondary)]" />}
    </motion.div>
  );
}

export default function PlanMyShift() {
  const [timeHours, setTimeHours] = useState<number>(2);
  const [customTime, setCustomTime] = useState('');
  const [earnings, setEarnings] = useState<number>(80);
  const [customEarnings, setCustomEarnings] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GoalRouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveTime = customTime ? parseFloat(customTime) : timeHours;
  const effectiveEarnings = customEarnings ? parseFloat(customEarnings) : earnings;

  const handlePlan = async () => {
    if (!effectiveTime || !effectiveEarnings) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await computeGoalRoute({
        time_hours: effectiveTime,
        earnings_target: effectiveEarnings,
      });
      setResult(response);
    } catch {
      setError('Could not generate your shift plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const progressPct = result
    ? Math.min(100, (result.projected_earnings / result.earnings_target) * 100)
    : 0;

  return (
    <div className="plan-shift-panel max-w-2xl space-y-6">
      <div>
        <p className="grid-eyebrow">Route Planning</p>
        <h1 className="grid-page-title text-3xl sm:text-4xl">Plan My Shift</h1>
        <p className="grid-page-subtitle">
          Tell GRID your time and earnings goal, then follow the cleanest zone
          sequence for the next part of your shift.
        </p>
      </div>

      <div className="glass-card space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--primary-dark)]" />
            <p className="font-medium text-[var(--text-primary)]">How long are you driving?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTimeHours(opt.value);
                  setCustomTime('');
                }}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150',
                  timeHours === opt.value && !customTime
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[#0f172a] shadow-md shadow-[var(--primary)]/20'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40',
                )}
              >
                {opt.label}
              </button>
            ))}
            <input
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              placeholder="Custom (hrs)"
              value={customTime}
              onChange={(event) => setCustomTime(event.target.value)}
              className={cn(
                'w-28 rounded-xl border px-3 py-2 text-sm transition-all duration-150 focus:outline-none',
                customTime
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-white/5 text-[var(--text-primary)] focus:border-[var(--primary)]/50',
              )}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[var(--success)]" />
            <p className="font-medium text-[var(--text-primary)]">How much do you want to earn?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EARNINGS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setEarnings(opt.value);
                  setCustomEarnings('');
                }}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150',
                  earnings === opt.value && !customEarnings
                    ? 'border-[var(--success)] bg-[var(--success)] text-[#04140f] shadow-md shadow-[var(--success)]/20'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--success)]/40',
                )}
              >
                {opt.label}
              </button>
            ))}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-secondary)]">
                $
              </span>
              <input
                type="number"
                min="1"
                max="1000"
                placeholder="Custom"
                value={customEarnings}
                onChange={(event) => setCustomEarnings(event.target.value)}
                className={cn(
                  'w-28 rounded-xl border py-2 pl-6 pr-3 text-sm transition-all duration-150 focus:outline-none',
                  customEarnings
                    ? 'border-[var(--success)] bg-[var(--success)]/5 text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-white/5 text-[var(--text-primary)] focus:border-[var(--success)]/50',
                )}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handlePlan}
          disabled={isLoading || !effectiveTime || !effectiveEarnings}
          className="grid-action-button w-full justify-center py-3.5"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Planning your shift...
            </>
          ) : (
            <>
              <Target size={16} />
              Plan My Shift
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="glass-card border border-[var(--danger)]/20 p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="glass-card space-y-5 p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--primary-dark)]" />
                <h2 className="text-[var(--text-primary)]">Your Shift Plan</h2>
              </div>
              <span
                className={cn(
                  'grid-chip border py-1',
                  result.meets_target
                    ? 'border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]'
                    : 'border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)]',
                )}
              >
                {result.meets_target ? 'Target met' : 'Close to target'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Projected earnings</span>
                <span className="driver-performance-number text-lg text-[var(--success)]">
                  ${result.projected_earnings.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Target: ${result.earnings_target.toFixed(0)}</span>
                <span>{progressPct.toFixed(0)}% of goal</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-[rgba(250,204,21,0.1)] bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    result.meets_target ? 'bg-[var(--success)]' : 'bg-[var(--warning)]',
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              {result.zones.map((zone, index) => (
                <Fragment key={zone.zone_id}>
                  <ZoneRow zone={zone} index={index} />
                </Fragment>
              ))}
            </div>

            <div className="grid-note-panel flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--primary-dark)]" />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">Summary: </span>
                {result.summary_text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
