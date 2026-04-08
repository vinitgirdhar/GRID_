import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Clock, DollarSign, MapPin, ChevronRight, Loader2, Sparkles } from 'lucide-react';
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
      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-[rgba(250,204,21,0.1)]"
    >
      <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-white font-black text-sm">
        {zone.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-[var(--text-primary)] truncate">{zone.zone_name}</p>
          <span className="text-[10px] text-[#94a3b8] bg-white/10 px-1.5 py-0.5 rounded font-medium shrink-0">
            {zone.borough}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          ~{zone.estimated_trips} pickups · ~{zone.estimated_minutes} min
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-black text-[var(--success)] text-sm">${zone.estimated_earnings.toFixed(0)}</p>
        <p className="text-[10px] text-[var(--text-secondary)]">est. earned</p>
      </div>
      {index < 2 && (
        <ChevronRight size={14} className="text-[var(--text-secondary)] shrink-0" />
      )}
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
    if (!effectiveTime || !effectiveEarnings) return;
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-[#facc15]" style={{fontFamily:'Outfit,sans-serif',letterSpacing:'-0.03em'}}>Plan My Shift</h1>
        <p className="text-[var(--text-secondary)] mt-1">Tell us your time &amp; money goal — we'll find the best zones for you</p>
      </div>

      {/* Input card */}
      <div className="glass-card p-6 space-y-6">
        {/* Time budget */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--primary-dark)]" />
            <p className="font-semibold text-[var(--text-primary)]">How long are you driving?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setTimeHours(opt.value); setCustomTime(''); }}
                className={cn(
                  'px-4 py-2 rounded-xl border text-sm font-bold transition-all duration-150',
                  timeHours === opt.value && !customTime
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/20'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40',
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
              onChange={(e) => setCustomTime(e.target.value)}
              className={cn(
                'w-28 px-3 py-2 rounded-xl border text-sm transition-all duration-150 bg-white/5 text-[#e8edf3] focus:outline-none',
                customTime
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] focus:border-[var(--primary)]/50',
              )}
            />
          </div>
        </div>

        {/* Earnings target */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[var(--success)]" />
            <p className="font-semibold text-[var(--text-primary)]">How much do you want to earn?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EARNINGS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setEarnings(opt.value); setCustomEarnings(''); }}
                className={cn(
                  'px-4 py-2 rounded-xl border text-sm font-bold transition-all duration-150',
                  earnings === opt.value && !customEarnings
                    ? 'bg-[var(--success)] text-white border-[var(--success)] shadow-md shadow-[var(--success)]/20'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--success)]/40',
                )}
              >
                {opt.label}
              </button>
            ))}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)] font-bold">$</span>
              <input
                type="number"
                min="1"
                max="1000"
                placeholder="Custom"
                value={customEarnings}
                onChange={(e) => setCustomEarnings(e.target.value)}
                className={cn(
                  'w-28 pl-6 pr-3 py-2 rounded-xl border text-sm transition-all duration-150 bg-white/5 text-[#e8edf3] focus:outline-none',
                  customEarnings
                    ? 'border-[var(--success)] bg-[var(--success)]/5'
                    : 'border-[var(--border)] focus:border-[var(--success)]/50',
                )}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handlePlan}
          disabled={isLoading || !effectiveTime || !effectiveEarnings}
          className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--primary)]/20 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Planning your shift...
            </>
          ) : (
            <>
              <Target size={16} />
              🚀 Plan My Shift
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="glass-card p-4 border border-[var(--danger)]/20 text-[var(--danger)] text-sm">
          {error}
        </div>
      )}

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="glass-card p-6 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[var(--primary-dark)] w-5 h-5" />
                <h2 className="font-bold text-[var(--text-primary)]">✅ Your Shift Plan</h2>
              </div>
              <span className={cn(
                'px-2 py-1 text-[10px] font-black rounded uppercase border',
                result.meets_target
                  ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20'
                  : 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
              )}>
                {result.meets_target ? 'Target Met ✓' : 'Close to Target'}
              </span>
            </div>

            {/* Earnings progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Projected earnings</span>
                <span className="font-black text-[var(--success)] text-lg">${result.projected_earnings.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Target: ${result.earnings_target.toFixed(0)}</span>
                <span>{progressPct.toFixed(0)}% of goal</span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-[rgba(250,204,21,0.1)]">
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

            {/* Zone sequence */}
            <div className="space-y-2">
              {result.zones.map((zone, i) => (
                <ZoneRow key={zone.zone_id} zone={zone} index={i} />
              ))}
            </div>

            {/* AI summary */}
            <div className="p-4 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 flex items-start gap-3">
              <MapPin size={16} className="text-[var(--primary-dark)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                <span className="font-bold text-[var(--text-primary)]">💬 </span>
                {result.summary_text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
