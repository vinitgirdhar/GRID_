import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Navigation,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { getHotspots, getActiveHotspotPeriod } from '../../services/apiService';
import { getAll, subscribe, MissedOpportunity, seedMockData } from '../../services/opportunityService';
import { HotspotsResponse, HotspotZone } from '../../types';
import MissedOpportunityFeed from '../MissedOpportunityFeed';
import { cn } from '../../lib/utils';

function navigateToRide() {
  window.dispatchEvent(new CustomEvent('grid-navigate-page', { detail: { page: 'go-for-ride' } }));
}

export default function MissedOpportunities() {
  const [opportunities, setOpportunities] = useState<MissedOpportunity[]>(() => {
    seedMockData();
    return getAll();
  });
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [loadingHotspots, setLoadingHotspots] = useState(true);

  useEffect(() => {
    return subscribe(() => setOpportunities(getAll()));
  }, []);

  useEffect(() => {
    getHotspots()
      .then((data) => { setHotspots(data); setLoadingHotspots(false); })
      .catch(() => setLoadingHotspots(false));
  }, []);

  const resolved = opportunities.filter((o) => o.resolved);
  const totalLost = resolved.reduce((sum, o) => sum + o.estimated_lost, 0);
  const goodCalls = resolved.filter((o) => o.estimated_lost === 0).length;
  const highSeverity = resolved.filter((o) => o.severity === 'high').length;

  const activePeriod = hotspots ? getActiveHotspotPeriod(hotspots) : null;
  const hotZones: HotspotZone[] = activePeriod?.zones
    .filter((z) => z.demand_level === 'High' || z.demand_level === 'Medium')
    .slice(0, 6) ?? [];

  const maxDemand = hotZones[0]?.predicted_demand ?? 1;

  const stats = [
    {
      label: 'Total Skips',
      value: opportunities.length > 0 ? String(opportunities.length) : '—',
      icon: TrendingDown,
      accent: 'text-danger',
      bg: 'bg-danger/10',
    },
    {
      label: 'Est. Lost',
      value: totalLost > 0 ? `$${totalLost.toFixed(0)}` : '—',
      icon: DollarSign,
      accent: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Good Calls',
      value: goodCalls > 0 ? String(goodCalls) : '—',
      icon: CheckCircle2,
      accent: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'High Impact',
      value: highSeverity > 0 ? String(highSeverity) : '—',
      icon: AlertTriangle,
      accent: 'text-danger',
      bg: 'bg-danger/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0">
          <TrendingDown size={22} className="text-danger" />
        </div>
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#facc15]" style={{fontFamily:'Outfit,sans-serif',letterSpacing:'-0.03em'}}>Missed Opportunities</h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-1.5 leading-relaxed bg-[var(--primary)]/5 p-3 rounded-lg border border-[var(--primary)]/10">
            {opportunities.length > 0 
              ? `Shift Insight: You've skipped ${opportunities.length} rides (roughly $${totalLost.toFixed(0)} in lost earnings) but made ${goodCalls} smart passes. ${hotZones[0] ? `Right now, ${hotZones[0].zone_name} is your best-performing zone.` : ''}`
              : `Shift Insight: You haven't passed on any rides yet. ${hotZones[0] ? `Right now, ${hotZones[0].zone_name} is the most lucrative area to head towards.` : 'Review live demand below to plan your next move.'}`
            }
          </p>
        </div>
      </motion.div>

      {/* Stats strip — always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card p-4 flex items-center gap-3"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', stat.bg)}>
              <stat.icon size={16} className={stat.accent} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{stat.label}</p>
              <p className="text-xl font-black text-[var(--text-primary)] leading-tight">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live demand — hot zones right now */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse shrink-0" />
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
            {activePeriod?.label ?? 'Live'} — Active Demand Zones
          </h2>
          {activePeriod?.target_time && (
            <span className="ml-auto text-xs font-medium text-[var(--text-muted)]">
              {activePeriod.target_time}
            </span>
          )}
        </div>

        {loadingHotspots ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : hotZones.length > 0 ? (
          <div className="space-y-2">
            {hotZones.map((zone, idx) => {
              const pct = Math.round((zone.predicted_demand / maxDemand) * 100);
              const isHigh = zone.demand_level === 'High';
              return (
                <motion.div
                  key={zone.zone_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 + idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)]"
                >
                  {/* Demand bar accent */}
                  <div
                    className={cn('w-1 h-8 rounded-full shrink-0', isHigh ? 'bg-danger' : 'bg-warning')}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{zone.zone_name}</p>
                      <span className={cn(
                        'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
                        isHigh ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning',
                      )}>
                        {zone.demand_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', isHigh ? 'bg-danger' : 'bg-warning')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-medium shrink-0">{zone.borough}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 mr-1">
                    <p className={cn('text-base font-black tabular-nums', isHigh ? 'text-danger' : 'text-warning')}>
                      {zone.predicted_demand.toFixed(0)}
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)] font-medium">trips/hr</p>
                  </div>

                  <button
                    onClick={navigateToRide}
                    className="shrink-0 w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center active:scale-90"
                    style={{ transition: 'opacity 150ms ease-out, transform 100ms ease-out' }}
                    title="Go for a ride in this zone"
                  >
                    <Navigation size={13} className="text-[var(--accent)]" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Zap size={24} className="mx-auto text-[var(--text-muted)] opacity-30 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No high-demand zones detected right now.</p>
          </div>
        )}
      </motion.div>

      {/* Skip history feed */}
      {opportunities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.12, ease: [0.23, 1, 0.32, 1] }}
        >
          <MissedOpportunityFeed onCountChange={() => {}} />
        </motion.div>
      )}

      {/* Empty skip history hint */}
      {opportunities.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-xs text-[var(--text-muted)] text-center pb-2"
        >
          Skip history is empty. Rides you pass on in Go For Ride will appear here with demand outcomes after 2 minutes.
        </motion.p>
      )}
    </div>
  );
}
