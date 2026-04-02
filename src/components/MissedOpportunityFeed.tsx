import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  MissedOpportunity,
  clearOpportunity,
  getAll,
  subscribe,
} from '../services/opportunityService';
import { cn } from '../lib/utils';

interface Props {
  onCountChange: (count: number) => void;
}

function SeverityDot({ opp }: { opp: MissedOpportunity }) {
  const goodCall = opp.estimated_lost === 0;
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        goodCall
          ? 'bg-[var(--success)]/15 text-[var(--success)]'
          : opp.severity === 'high'
            ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
            : opp.severity === 'medium'
              ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
              : 'bg-[var(--border)] text-[var(--text-muted)]',
      )}
    >
      {goodCall ? (
        <CheckCircle2 size={16} />
      ) : opp.severity === 'high' ? (
        <AlertTriangle size={16} />
      ) : (
        <TrendingDown size={16} />
      )}
    </div>
  );
}

export default function MissedOpportunityFeed({ onCountChange }: Props) {
  const [opportunities, setOpportunities] = useState<MissedOpportunity[]>([]);

  useEffect(() => {
    const refresh = () => {
      const items = getAll();
      setOpportunities(items);
      onCountChange(items.filter((o) => o.resolved).length);
    };
    refresh();
    return subscribe(refresh);
  }, [onCountChange]);

  const resolved = opportunities.filter((o) => o.resolved);
  const pending = opportunities.filter((o) => !o.resolved);

  if (opportunities.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2.5">
          Missed Opportunity Log
          {resolved.length > 0 && (
            <motion.span
              key={resolved.length}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-2 py-0.5 rounded-full bg-[var(--danger)] text-white text-xs font-black min-w-[1.25rem] text-center"
            >
              {resolved.length}
            </motion.span>
          )}
        </h2>
        {pending.length > 0 && (
          <span className="text-xs text-[var(--text-muted)] font-medium">
            {pending.length} resolving in ~2 min…
          </span>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {/* Resolved cards */}
          {resolved.map((opp) => {
            const goodCall = opp.estimated_lost === 0;
            const skippedTime = new Date(opp.skipped_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <motion.div
                key={opp.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                className={cn(
                  'p-4 rounded-2xl border flex items-start gap-4',
                  goodCall
                    ? 'bg-[var(--success)]/5 border-[var(--success)]/20'
                    : opp.severity === 'high'
                      ? 'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                      : opp.severity === 'medium'
                        ? 'bg-[var(--warning)]/5 border-[var(--warning)]/20'
                        : 'bg-[var(--surface)] border-[var(--border)]',
                )}
              >
                <SeverityDot opp={opp} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {opp.zone_name} · Skipped {skippedTime}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Zone hit{' '}
                    <span className="font-bold">{opp.actual_demand?.toFixed(0)} trips/hr</span>
                    {!goodCall && (
                      <> vs your {opp.predicted_demand.toFixed(0)} predicted</>
                    )}
                  </p>
                  <p
                    className={cn(
                      'text-xs font-bold mt-1',
                      goodCall
                        ? 'text-[var(--success)]'
                        : opp.severity === 'high'
                          ? 'text-[var(--danger)]'
                          : 'text-[var(--warning)]',
                    )}
                  >
                    {goodCall
                      ? 'Good call — demand dropped. You saved time. ✓'
                      : `Est. missed: $${opp.estimated_lost.toFixed(2)}`}
                  </p>
                </div>

                <button
                  onClick={() => clearOpportunity(opp.id)}
                  className="shrink-0 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-all"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}

          {/* Pending (unresolved) cards — subtle pulse */}
          {pending.map((opp) => (
            <motion.div
              key={opp.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center shrink-0 animate-pulse">
                <TrendingUp size={16} className="text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)]">{opp.zone_name}</p>
                <p className="text-xs text-[var(--text-muted)]">Skipped — tracking outcome…</p>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
                Pending
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
