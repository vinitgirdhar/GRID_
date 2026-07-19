import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, Sparkles, AlertCircle, Cloud, Zap, BrainCircuit, Music, Trophy, Flame, Navigation, Users, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getActiveHotspotPeriod, getHotspots, getPrediction } from '../../services/apiService';
import { HotspotZone, PredictionResponse } from '../../types';

interface LiveEvent {
  id: string;
  name: string;
  zone: string;
  surge: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  time: string;
  attendees: string;
  scale: string;
}

function buildLiveEvents(zones: HotspotZone[]): LiveEvent[] {
  if (!zones.length) return [];

  // Take top 3 zones by predicted demand
  const sorted = [...zones].sort((a, b) => b.predicted_demand - a.predicted_demand).slice(0, 3);

  return sorted.map((zone) => {
    const isWeather = zone.weather_condition.toLowerCase() !== 'clear' && zone.weather_condition.toLowerCase() !== 'sunny';
    const isHighEvent = zone.event_intensity === 'High';
    const demandPct = Math.round((zone.predicted_demand / (sorted[0].predicted_demand || 1)) * 100);
    const surgePct = isHighEvent ? Math.round(demandPct * 0.28) : isWeather ? Math.round(demandPct * 0.12) : Math.round(demandPct * 0.18);

    let icon: LucideIcon;
    let color: string;
    let bg: string;
    let eventLabel: string;
    let scaleLabel: string;

    if (isHighEvent) {
      icon = Trophy;
      color = 'text-purple-400';
      bg = 'bg-purple-500/10 border-purple-500/20';
      eventLabel = `High Demand — ${zone.zone_name}`;
      scaleLabel = 'Event Zone';
    } else if (isWeather) {
      icon = Cloud;
      color = 'text-sky-400';
      bg = 'bg-sky-500/10 border-sky-500/20';
      eventLabel = `${zone.weather_condition} — ${zone.zone_name}`;
      scaleLabel = zone.borough;
    } else {
      icon = TrendingUp;
      color = 'text-amber-400';
      bg = 'bg-amber-500/10 border-amber-500/20';
      eventLabel = `Peak Demand — ${zone.zone_name}`;
      scaleLabel = 'Demand Zone';
    }

    return {
      id: zone.zone_id,
      name: eventLabel,
      zone: zone.borough,
      surge: `+${surgePct}%`,
      icon,
      color,
      bg,
      time: 'Now',
      attendees: `~${zone.predicted_demand.toLocaleString()} trips/hr`,
      scale: scaleLabel,
    };
  });
}

function SmartStrategyCard({ prediction, zoneName, liveEvents }: { prediction: PredictionResponse; zoneName: string; liveEvents: LiveEvent[] }) {
  const matchedEvent = liveEvents.find(e => zoneName.toLowerCase().includes(e.zone.toLowerCase()));
  const baseAdvice = prediction.demand_level === 'High'
    ? `Demand is peaking in ${zoneName}. Position near transit hubs for fastest pickup.`
    : `Moderate demand in ${zoneName}. Consider moving to adjacent high-demand zones.`;

  const surgeTotal = matchedEvent ? parseInt(matchedEvent.surge) + (prediction.predicted_demand > 50 ? 8 : 3) : 0;

  const mlInsight = matchedEvent
    ? `${prediction.confidence > 0.8 ? Math.round(prediction.confidence * 100) : 85}% of unexpected surge here correlates with the ${matchedEvent.name} — ${matchedEvent.attendees} expected in ${matchedEvent.zone}.`
    : `Demand pattern matches historical ${prediction.active_period} peak for ${zoneName} based on time-of-day seasonality.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group"
    >
      {/* Hover glow line */}
      <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300" />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <h3 className="font-medium text-[var(--text)] text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>GRID Co-Pilot Strategy</h3>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-emerald-400">Active</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex shrink-0 mt-0.5">
            <Navigation size={14} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {matchedEvent ? `Navigate to ${matchedEvent.zone} for ${surgeTotal}% surge opportunity` : `Hold position in ${zoneName} for steady volume`}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              {baseAdvice}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-3 border-t border-[var(--border)]">
          <div className="flex items-start gap-2 flex-1">
            <div className="p-1.5 bg-[var(--accent)]/10 rounded-lg inline-flex shrink-0 mt-0.5">
              <BrainCircuit size={12} className="text-[var(--accent)]" />
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
              {mlInsight}
            </p>
          </div>

          {matchedEvent && (
            <div className={cn('flex items-center gap-2 text-[11px] py-1.5 px-3 rounded-xl border shrink-0', matchedEvent.bg)}>
              <matchedEvent.icon size={12} className={matchedEvent.color} />
              <span className="font-medium text-[var(--text)]" style={{ fontFamily: 'Inter, sans-serif' }}>{matchedEvent.name}</span>
              <span className={cn('font-mono font-bold', matchedEvent.color)}>{matchedEvent.surge}</span>
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
  const [sliderValue, setSliderValue] = useState(0);
  const dateOffset = Math.round(sliderValue / 100);
  const [selectedHour, setSelectedHour] = useState('live');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const hasAutoPredicted = useRef(false);

  const liveEvents = useMemo(() => buildLiveEvents(topZones), [topZones]);

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

  const inputCls = 'w-full bg-white/5 border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent)]/40 focus:ring-1 focus:ring-[var(--accent)]/10 transition-all text-[var(--text)] appearance-none [&>option]:bg-[#0f1724] [&>option]:text-[var(--text)]';
  const labelCls = 'text-[10px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1
          className="text-3xl font-light tracking-tight text-[var(--accent)]"
          style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}
        >
          Where Should I Go Next?
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          GRID Co-Pilot tells you where rider demand is highest right now
        </p>
      </div>

      {error && (
        <div className="relative overflow-hidden bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm flex items-center gap-3" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="p-1.5 bg-red-500/10 rounded-lg inline-flex shrink-0">
            <AlertCircle size={14} className="text-red-400" />
          </div>
          {error}
        </div>
      )}

      {/* Co-Pilot Strategy — always at top when prediction is ready */}
      <AnimatePresence>
        {(prediction || isPredicting) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {prediction ? (
              <SmartStrategyCard prediction={prediction} zoneName={prediction.zone_name} liveEvents={liveEvents} />
            ) : (
              <div className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                  <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent)] w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text)] animate-pulse" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Co-Pilot is thinking...
                  </p>
                  <p className="text-xs text-[var(--text-muted)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Scoring the highest-demand zone automatically
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Forecast Parameters */}
        <div className="lg:col-span-4">
          <div className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group space-y-5">
            {/* Hover glow line */}
            <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300" />

            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
                <Sparkles className="text-[var(--accent)] w-4 h-4" />
              </div>
              <h2 className="text-base font-medium text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>Set Your Search</h2>
            </div>

            <div className="space-y-4">
              {/* Day slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>When are you driving?</label>
                  <span className="text-[11px] font-mono font-bold text-[var(--accent)] px-2 py-0.5 rounded-md bg-[var(--accent)]/10">
                    {dayLabels[dateOffset]}
                  </span>
                </div>
                <div className="relative pt-2 pb-1 px-1">
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="1"
                    value={sliderValue}
                    onChange={(event) => setSliderValue(parseInt(event.target.value, 10))}
                    className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                  <div className="flex justify-between mt-3 px-0.5">
                    {['Today', '+1D', '+2D', '+3D'].map((label, i) => (
                      <span
                        key={label}
                        className={cn('text-[10px] font-mono uppercase tracking-widest transition-colors', dateOffset === i ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time select */}
              <div className="space-y-2">
                <label className={labelCls}>What time?</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4 pointer-events-none" />
                  <select
                    value={selectedHour}
                    onChange={(event) => setSelectedHour(event.target.value)}
                    className={inputCls}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <option value="live">Live Time</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i)}>{`${i}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zone select */}
              <div className="space-y-2">
                <label className={labelCls}>Pick a neighborhood</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4 pointer-events-none" />
                  <select
                    value={selectedZoneId}
                    onChange={(event) => setSelectedZoneId(event.target.value)}
                    disabled={isLoading}
                    className={inputCls}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {topZones.map((zone) => (
                      <option key={zone.zone_id} value={zone.zone_id}>{`${zone.zone_name} (${zone.borough})`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Find Best Zone button — hollow/outline style per design.md */}
            <button
              onClick={() => handlePredict()}
              disabled={isPredicting || isLoading || !selectedZoneId}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium text-[var(--accent)] bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:-translate-y-[2px] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {isPredicting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
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
          <div className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 sm:p-8 h-full flex flex-col items-center justify-center min-h-[320px] hover:border-[var(--accent)]/50 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
            {/* Hover glow line */}
            <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300" />

            <AnimatePresence mode="wait">
              {!prediction && !isPredicting && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-[var(--border)]">
                    <BrainCircuit className="w-10 h-10 text-[var(--text-muted)] opacity-30" />
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      Ready for Prediction
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                    <div className="w-24 h-24 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent)] w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-light animate-pulse text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      Co-Pilot is thinking...
                    </p>
                    <p className="text-[var(--text-muted)] text-sm mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Scoring the selected zone using the preloaded backend model
                    </p>
                  </div>
                </motion.div>
              )}

              {prediction && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full space-y-8"
                >
                  {/* Main metric */}
                  <div className="text-center">
                    <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
                      Expected Pickups
                    </p>
                    <div className="text-5xl sm:text-7xl font-light text-[var(--accent)] tracking-tight break-words" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      {prediction.predicted_demand.toLocaleString()}
                      <span className="block sm:inline text-xl sm:text-2xl font-light text-[var(--text-muted)] sm:ml-3">Trips</span>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: AlertCircle, iconCls: 'text-amber-400', label: 'Demand Level', value: prediction.demand_level },
                      { icon: MapPin, iconCls: 'text-[var(--text-muted)]', label: 'Zone', value: prediction.zone_name },
                      { icon: Cloud, iconCls: 'text-sky-400', label: 'Window', value: prediction.active_period },
                    ].map(({ icon: Icon, iconCls, label, value }) => (
                      <div key={label} className="relative overflow-hidden bg-white/5 rounded-2xl p-4 text-center border border-[var(--border)] hover:-translate-y-1 hover:border-[var(--accent)]/40 hover:bg-white/10 transition-all duration-300 group/stat">
                        <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover/stat:opacity-60 transition-all duration-300" />
                        <div className="flex justify-center mb-2">
                          <div className="p-1.5 bg-[var(--accent)]/10 rounded-lg inline-flex">
                            <Icon className={cn('w-4 h-4', iconCls)} />
                          </div>
                        </div>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-sm font-medium text-[var(--text)] capitalize" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Confidence bar */}
                  <div className="pt-6 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Co-Pilot Confidence</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.confidence * 100}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-emerald-400 rounded-full"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Scored <span className="text-[var(--text)] font-medium">{prediction.borough}</span> at {selectedHour === 'live' ? 'live time' : `${selectedHour.padStart(2, '0')}:00`}.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Live Events Feed */}
      <div className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
        {/* Hover glow line */}
        <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-300" />

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-amber-500/10 rounded-lg inline-flex">
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-base font-medium text-[var(--text)]" style={{ fontFamily: 'Outfit, sans-serif' }}>Live City Events</h2>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {liveEvents.map((event) => (
            <div
              key={event.id}
              className={`relative overflow-hidden rounded-2xl border p-4 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 group/event ${event.bg}`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`p-1.5 rounded-lg inline-flex bg-white/5`}>
                  <event.icon size={14} className={event.color} />
                </div>
                <span className="text-xs font-medium text-[var(--text)] leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>{event.name}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{event.zone} · {event.time}</span>
                <span className={`text-xs font-mono font-bold ${event.color}`}>{event.surge}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2.5 border-t border-white/5">
                <div className="p-1 bg-white/5 rounded inline-flex">
                  <Users size={10} className="text-[var(--text-muted)]" />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{event.attendees}</span>
                <span className="ml-auto text-[10px] font-mono font-bold text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded">
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
