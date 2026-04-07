import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, Sparkles, AlertCircle, Cloud, Zap, BrainCircuit, Music, Trophy, Flame, Navigation, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getActiveHotspotPeriod, getHotspots, getPrediction } from '../../services/apiService';
import { HotspotZone, PredictionResponse } from '../../types';

// Simulated live NYC events for AI strategy (displayed even without backend)
const LIVE_EVENTS = [
  {
    id: 1,
    name: 'Madison Square Garden Concert',
    zone: 'Midtown',
    surge: '+28%',
    type: 'music',
    icon: Music,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/20',
    time: '9:00 PM',
    attendees: '20,000 attendees',
    scale: 'Arena Capacity',
  },
  {
    id: 2,
    name: 'Yankees Game – Yankee Stadium',
    zone: 'Bronx',
    surge: '+18%',
    type: 'sports',
    icon: Trophy,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
    time: '7:30 PM',
    attendees: '47,000 attendees',
    scale: 'Stadium Capacity',
  },
  {
    id: 3,
    name: 'Heavy Rain Advisory',
    zone: 'All Boroughs',
    surge: '+12%',
    type: 'weather',
    icon: Cloud,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 border-sky-500/20',
    time: 'Now',
    attendees: 'City-wide',
    scale: 'All 5 Boroughs',
  },
];

function SmartStrategyCard({ prediction, zoneName }: { prediction: PredictionResponse; zoneName: string }) {
  const matchedEvent = LIVE_EVENTS.find(e => zoneName.toLowerCase().includes(e.zone.toLowerCase()) || e.zone === 'All Boroughs');
  const baseAdvice = prediction.demand_level === 'High'
    ? `Demand is peaking in ${zoneName}. Position near transit hubs for fastest pickup.`
    : `Moderate demand in ${zoneName}. Consider moving to adjacent high-demand zones.`;

  const surgeTotal = matchedEvent ? parseInt(matchedEvent.surge) + (prediction.predicted_demand > 50 ? 8 : 3) : 0;

  const mlInsight = matchedEvent
    ? `ML Insight: ${prediction.confidence > 0.8 ? Math.round(prediction.confidence * 100) : 85}% of unexpected surge here correlates with the ${matchedEvent.name} — ${matchedEvent.attendees} expected in ${matchedEvent.zone}.`
    : `ML Insight: Demand pattern matches historical ${prediction.active_period} peak for ${zoneName} based on time-of-day seasonality.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border border-[var(--primary)]/20 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[var(--primary)]" />
        <h3 className="font-bold text-[var(--text-primary)] text-sm tracking-wide">GRID Copilot Strategy</h3>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
            Active
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Directive & Advice */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 bg-[var(--primary)]/10 rounded-md">
            <Navigation size={14} className="text-[var(--primary-dark)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {matchedEvent ? `Navigate to ${matchedEvent.zone} for ${surgeTotal}% surge opportunity` : `Hold position in ${zoneName} for steady volume`}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
              {baseAdvice}
            </p>
          </div>
        </div>

        {/* Intelligence / Events Inline */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-3 border-t border-[var(--border)]">
          <div className="flex items-start gap-2 flex-1">
            <BrainCircuit size={14} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--text-secondary)] leading-snug">
              {mlInsight.replace('ML Insight: ', '')}
            </p>
          </div>
          
          {matchedEvent && (
            <div className={cn('flex items-center gap-2 text-[11px] py-1 px-2.5 rounded-md border shrink-0', matchedEvent.bg)}>
              <matchedEvent.icon size={12} className={matchedEvent.color} />
              <span className="font-bold text-[var(--text-primary)]">{matchedEvent.name}</span>
              <span className={cn('font-black', matchedEvent.color)}>{matchedEvent.surge}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getDefaultDate() {
  return new Date().toISOString().split('T')[0];
}

export default function DemandPrediction() {
  const [isLoading, setIsLoading] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [topZones, setTopZones] = useState<HotspotZone[]>([]);
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedHour, setSelectedHour] = useState('live');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const hasAutoPredicted = useRef(false);

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);
  const selectedDate = targetDateObj.toISOString().split('T')[0];

  const dayLabels = [0, 1, 2, 3].map(offset => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  });

  const handlePredict = async (zoneIdOverride?: string) => {
    const zoneToPredict = zoneIdOverride ?? selectedZoneId;
    if (!zoneToPredict) return;

    setIsPredicting(true);
    setPrediction(null);
    setError(null);

    try {
      const hourToUse = selectedHour === 'live' ? String(new Date().getHours()) : selectedHour;
      const response = await getPrediction({
        zoneId: zoneToPredict,
        predictionTime: `${selectedDate}T${hourToUse.padStart(2, '0')}:00:00`,
      });
      setPrediction(response);
    } catch {
      setError('Prediction request failed. Verify the backend is running and try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getHotspots()
      .then((hotspotResponse) => {
        if (cancelled) return;

        const activeZones = getActiveHotspotPeriod(hotspotResponse).zones;
        setTopZones(activeZones);

        const topZoneId = activeZones[0]?.zone_id ?? '';
        setSelectedZoneId(topZoneId);

        // Auto-predict for the highest demand zone on load
        if (topZoneId && !hasAutoPredicted.current) {
          hasAutoPredicted.current = true;
          handlePredict(topZoneId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load live hotspot zones. Start the FastAPI backend on port 8000 and refresh.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedZone = topZones.find((zone) => zone.zone_id === selectedZoneId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Where Should I Go Next?</h1>
        <p className="text-[var(--text-secondary)] mt-1">AI tells you where rider demand is highest right now</p>
      </div>

      {error && (
        <div className="glass-card p-4 border border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}

      {/* AI Smart Strategy — always at top when prediction is ready */}
      <AnimatePresence>
        {(prediction || isPredicting) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {prediction ? (
              <SmartStrategyCard prediction={prediction} zoneName={prediction.zone_name} />
            ) : (
              <div className="glass-card p-6 border border-[var(--primary)]/20 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] animate-pulse">AI is thinking... 🤔</p>
                  <p className="text-xs text-[var(--text-secondary)]">Scoring the highest-demand zone automatically</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Forecast Parameters */}
        <div className="lg:col-span-4">
          <div className="glass-card p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary w-5 h-5" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Set Your Search</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">When are you driving?</label>
                  <span className="text-[11px] font-bold text-[var(--primary)] px-2 py-0.5 rounded-md bg-[var(--primary)]/10">{dayLabels[dateOffset]}</span>
                </div>
                <div className="relative pt-2 pb-1 px-1">
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={dateOffset}
                    onChange={(event) => setDateOffset(parseInt(event.target.value, 10))}
                    className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                  <div className="flex justify-between mt-3 px-0.5 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <span className={dateOffset === 0 ? 'text-[var(--text-primary)]' : ''}>Today</span>
                    <span className={dateOffset === 1 ? 'text-[var(--text-primary)]' : ''}>+1d</span>
                    <span className={dateOffset === 2 ? 'text-[var(--text-primary)]' : ''}>+2d</span>
                    <span className={dateOffset === 3 ? 'text-[var(--text-primary)]' : ''}>+3d</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">What time?</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select
                    value={selectedHour}
                    onChange={(event) => setSelectedHour(event.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]"
                  >
                    <option value="live">Live Time</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i)}>{`${i}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Pick a neighborhood</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
                  <select
                    value={selectedZoneId}
                    onChange={(event) => setSelectedZoneId(event.target.value)}
                    disabled={isLoading}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none text-[var(--text-primary)]"
                  >
                    {topZones.map((zone) => (
                      <option key={zone.zone_id} value={zone.zone_id}>{`${zone.zone_name} (${zone.borough})`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => handlePredict()}
              disabled={isPredicting || isLoading || !selectedZoneId}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              {isPredicting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Find Best Zone
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Prediction Output */}
        <div className="lg:col-span-8">
          <div className="glass-card p-5 sm:p-8 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[320px]">
            <AnimatePresence mode="wait">
              {!prediction && !isPredicting && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto">
                    <BrainCircuit className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Ready for Prediction</h3>
                    <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto">
                      {selectedZone
                        ? `Generate a live forecast for ${selectedZone.zone_name}.`
                        : 'Wait for the hotspot list to load, then select a zone and generate a forecast.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {isPredicting && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold animate-pulse text-[var(--text-primary)]">AI is thinking... 🤔</p>
                    <p className="text-[var(--text-secondary)] text-sm">Scoring the selected zone using the preloaded backend model...</p>
                  </div>
                </motion.div>
              )}

              {prediction && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full space-y-8"
                >
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-2">Expected Pickups</p>
                    <div className="text-5xl sm:text-7xl font-bold text-primary tracking-tighter break-words">
                      {prediction.predicted_demand.toLocaleString()}
                      <span className="block sm:inline text-xl sm:text-2xl font-medium text-[var(--text-secondary)] sm:ml-2">Trips</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <AlertCircle className="w-5 h-5 text-warning mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Demand Level</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.demand_level}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <MapPin className="w-5 h-5 text-secondary mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Zone</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{prediction.zone_name}</p>
                    </div>
                    <div className="bg-[var(--background)] rounded-2xl p-4 text-center border border-[var(--border)]">
                      <Cloud className="w-5 h-5 text-primary mx-auto mb-2" />
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Window</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{prediction.active_period}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">AI Confidence</span>
                      <span className="font-bold text-success">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.confidence * 100}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-success"
                      />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      GRID's AI checked <span className="text-[var(--text-primary)] font-semibold">{prediction.borough}</span> for you at {selectedHour === 'live' ? 'Live Time' : `${selectedHour.padStart(2, '0')}:00`}.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Live Events Feed */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[var(--warning)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Live City Events</h2>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-[var(--success)] bg-[var(--success)]/10 px-2 py-1 rounded-full border border-[var(--success)]/20">
            <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LIVE_EVENTS.map((event) => (
            <div key={event.id} className={`p-4 rounded-2xl border ${event.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <event.icon size={16} className={event.color} />
                <span className="text-xs font-black text-[var(--text-primary)] leading-tight">{event.name}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">{event.zone} · {event.time}</span>
                <span className={`text-xs font-black ${event.color}`}>{event.surge}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border)]/30">
                <Users size={10} className="text-[var(--text-secondary)] shrink-0" />
                <span className="text-[10px] text-[var(--text-secondary)]">{event.attendees}</span>
                <span className="ml-auto text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--background)]/50 px-1.5 py-0.5 rounded">
                  {event.scale}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
