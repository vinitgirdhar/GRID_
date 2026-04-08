import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'motion/react';
import { Activity, Award, Clock3, DollarSign, Gauge, Medal, Plus, Sparkles, Star, Target, TrendingUp, Trophy, X, Zap } from 'lucide-react';
import PlanMyShift from './PlanMyShift';
import { DRIVER_EARNINGS } from '../../constants';
import { cn } from '../../lib/utils';
import { getActiveHotspotPeriod, getHotspots } from '../../services/apiService';
import { HotspotPeriod, HotspotsResponse, RecommendedZone } from '../../types';

type ShiftTrip = {
  id: string;
  fare: number;
  zoneId: string;
  zoneName: string;
  borough: string;
  loggedAt: string;
};

type ShiftSession = {
  goalAmount: number;
  shiftHours: number;
  startedAt: string;
  trips: ShiftTrip[];
};

type PaceStatus = 'ahead' | 'on-track' | 'behind';

const STORAGE_KEY = 'grid-shift-optimizer-session';

const FALLBACK_ZONES = [
  { zone_id: '132', zone_name: 'Times Square', borough: 'Manhattan', expected_trips_per_hour: 92 },
  { zone_id: '230', zone_name: 'Grand Central', borough: 'Manhattan', expected_trips_per_hour: 88 },
  { zone_id: '186', zone_name: 'Penn Station', borough: 'Manhattan', expected_trips_per_hour: 85 },
  { zone_id: '142', zone_name: 'Midtown East', borough: 'Manhattan', expected_trips_per_hour: 78 },
  { zone_id: '68', zone_name: 'Downtown Brooklyn', borough: 'Brooklyn', expected_trips_per_hour: 72 },
];

const FALLBACK_RECOMMENDED_ZONES: RecommendedZone[] = FALLBACK_ZONES.map((zone, index) => ({
  zone_id: zone.zone_id,
  zone_name: zone.zone_name,
  rank: index + 1,
  expected_trips_per_hour: zone.expected_trips_per_hour,
}));

const ZONE_FARE_GUIDE: Record<string, number> = {
  '68': 19,
  '132': 22,
  '138': 30,
  '142': 18,
  '161': 18,
  '162': 17,
  '186': 20,
  '230': 21,
  '239': 18,
  '249': 19,
};

const LEADERBOARD = [
  { rank: 1, name: 'Alex R.', score: 9.7, earnings: 1842, goalHit: true, highlight: false },
  { rank: 2, name: 'Maria C.', score: 9.4, earnings: 1710, goalHit: true, highlight: false },
  { rank: 3, name: 'You', score: 8.8, earnings: 1540, goalHit: false, highlight: true },
  { rank: 4, name: 'James K.', score: 8.6, earnings: 1498, goalHit: false, highlight: false },
  { rank: 5, name: 'Priya S.', score: 8.1, earnings: 1320, goalHit: true, highlight: false },
];

function readStoredSession(): ShiftSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ShiftSession;
    if (!parsed.goalAmount || !parsed.shiftHours || !parsed.startedAt || !Array.isArray(parsed.trips)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: ShiftSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyPrecise(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDistance(value: number) {
  return `${value.toFixed(1)} km`;
}

function getProgressStroke(progress: number) {
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  return circumference - circumference * progress;
}

function getStatusVisual(status: PaceStatus) {
  if (status === 'ahead') {
    return {
      label: 'Ahead of Pace',
      badge: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20',
      ring: '#2F9E6E',
      panel: 'bg-emerald-500/6 border-emerald-500/15',
      copy: 'You are outperforming the goal curve. Keep exploiting the current zone while demand holds.',
    };
  }

  if (status === 'behind') {
    return {
      label: 'Falling Behind',
      badge: 'bg-rose-500/12 text-rose-500 border-rose-500/20',
      ring: '#DC5A5A',
      panel: 'bg-rose-500/6 border-rose-500/15',
      copy: 'The current pace is below target. You need a higher-yield zone or a faster trip cadence.',
    };
  }

  return {
    label: 'On Track',
    badge: 'bg-amber-500/12 text-amber-500 border-amber-500/20',
    ring: '#F4B000',
    panel: 'bg-amber-500/6 border-amber-500/15',
    copy: 'You are close to the planned earnings curve. A small lift over the next hour keeps the shift healthy.',
  };
}

function buildFallbackPeriod(): HotspotPeriod {
  return {
    label: 'Live Demand Window',
    target_time: 'Next 60 minutes',
    zones: FALLBACK_ZONES.map((zone) => ({
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      borough: zone.borough,
      lat: 0,
      lng: 0,
      predicted_demand: zone.expected_trips_per_hour,
      demand_level: zone.expected_trips_per_hour >= 85 ? 'High' : zone.expected_trips_per_hour >= 70 ? 'Medium' : 'Low',
      event_intensity: zone.expected_trips_per_hour >= 85 ? 'High' : 'Medium',
      weather_condition: 'Cloudy',
    })),
    recommended_zones: FALLBACK_RECOMMENDED_ZONES,
    avoid_zones: [],
  };
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-sm font-bold text-primary">{formatCurrencyPrecise(payload[0].value)}</p>
      </div>
    );
  }

  return null;
}

function InfoDot() {
  return (
    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-[11px] font-black text-primary">i</span>
    </div>
  );
}

function TaxiBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-2xl bg-[#1f1a1c] text-white border border-white/10 shadow-lg', compact ? 'px-2.5 py-2' : 'px-4 py-3')}>
      <div className={cn('rounded-xl bg-white text-black font-black flex items-center justify-center', compact ? 'w-8 h-8 text-[9px]' : 'w-12 h-12 text-xs')}>
        NYC
      </div>
      <span className={cn('font-black tracking-tight leading-none', compact ? 'text-lg' : 'text-2xl sm:text-[2rem]')}>TAXI</span>
    </div>
  );
}

function ShiftSetupModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (goalAmount: number, shiftHours: number) => void;
}) {
  const [goalAmount, setGoalAmount] = useState('150');
  const [shiftHours, setShiftHours] = useState('6');

  useEffect(() => {
    if (!open) {
      return;
    }

    setGoalAmount('150');
    setShiftHours('6');
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg glass-card p-6 sm:p-7 border border-[var(--primary)]/15 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--primary)]">Start Shift</p>
            <h2 className="text-2xl font-black text-[var(--text-primary)] mt-2">Set today's earnings target</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Configure the shift once, then log each completed fare from the Performance page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Daily Goal</span>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="number"
                min="1"
                step="1"
                value={goalAmount}
                onChange={(event) => setGoalAmount(event.target.value)}
                className="w-full bg-white/5 border border-[rgba(250,204,21,0.15)] rounded-xl py-3 pl-10 pr-4 text-sm text-[#e8edf3] focus:outline-none focus:border-[rgba(250,204,21,0.4)]"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Shift Length</span>
            <div className="relative">
              <Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="number"
                min="1"
                max="16"
                step="0.5"
                value={shiftHours}
                onChange={(event) => setShiftHours(event.target.value)}
                className="w-full bg-white/5 border border-[rgba(250,204,21,0.15)] rounded-xl py-3 pl-10 pr-4 text-sm text-[#e8edf3] focus:outline-none focus:border-[rgba(250,204,21,0.4)]"
              />
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onSave(Number(goalAmount), Number(shiftHours))}
            className="flex-1 px-5 py-3 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20"
          >
            Start Tracking
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] font-bold"
          >
            Later
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddEarningsModal({
  open,
  onClose,
  zones,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  zones: Array<{ zone_id: string; zone_name: string; borough: string }>;
  onSave: (fare: number, zoneId: string) => void;
}) {
  const [fare, setFare] = useState('');
  const [zoneId, setZoneId] = useState(zones[0]?.zone_id ?? '');

  useEffect(() => {
    if (!open) {
      return;
    }

    setFare('');
    setZoneId(zones[0]?.zone_id ?? '');
  }, [open, zones]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md glass-card p-6 border border-[var(--primary)]/15 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <TaxiBrandMark compact />
            <h2 className="text-xl font-black text-[var(--text-primary)] mt-3">Preview synced trips</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Meter Fare</span>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="number"
                min="1"
                step="0.01"
                value={fare}
                onChange={(event) => setFare(event.target.value)}
                placeholder="20.00"
                className="w-full bg-white/5 border border-[rgba(250,204,21,0.15)] rounded-xl py-3 pl-10 pr-4 text-sm text-[#e8edf3] focus:outline-none focus:border-[rgba(250,204,21,0.4)]"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Meter Zone</span>
            <select
              value={zoneId}
              onChange={(event) => setZoneId(event.target.value)}
              className="w-full bg-white/5 border border-[rgba(250,204,21,0.15)] rounded-xl py-3 px-4 text-sm text-[#e8edf3] focus:outline-none focus:border-[rgba(250,204,21,0.4)]"
            >
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.zone_name} ({zone.borough})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => onSave(Number(fare), zoneId)}
            className="flex-1 px-5 py-3 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20"
          >
            Add Meter Trip
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] font-bold"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function DriverPerformance() {
  const [shiftSession, setShiftSession] = useState<ShiftSession | null>(() => readStoredSession());
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [hotspotError, setHotspotError] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(() => !readStoredSession());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    writeStoredSession(shiftSession);
  }, [shiftSession]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getHotspots()
      .then((response) => {
        if (!cancelled) {
          setHotspots(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHotspotError('Live hotspot intelligence is unavailable, so GRID is using the built-in demo zone model.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePeriod = hotspots ? getActiveHotspotPeriod(hotspots) : buildFallbackPeriod();
  const availableZones = activePeriod.zones.length ? activePeriod.zones : buildFallbackPeriod().zones;
  const trips = shiftSession?.trips ?? [];
  const totalEarned = trips.reduce((sum, trip) => sum + trip.fare, 0);
  const tripCount = trips.length;
  const goalAmount = shiftSession?.goalAmount ?? 0;
  const shiftHours = shiftSession?.shiftHours ?? 0;
  const elapsedHoursRaw = shiftSession ? (now - new Date(shiftSession.startedAt).getTime()) / 3600000 : 0;
  const elapsedHours = Math.max(0, Math.min(shiftHours || 0, elapsedHoursRaw));
  const shiftProgress = shiftHours > 0 ? Math.min(elapsedHours / shiftHours, 1) : 0;
  const earningsProgress = goalAmount > 0 ? Math.min(totalEarned / goalAmount, 1) : 0;
  const expectedNow = goalAmount * shiftProgress;
  const remainingGoal = Math.max(goalAmount - totalEarned, 0);
  const remainingHours = Math.max(shiftHours - elapsedHours, 0);
  const requiredHourlyRate = remainingHours > 0 ? remainingGoal / remainingHours : remainingGoal;
  const averageFare = tripCount > 0 ? totalEarned / tripCount : 0;
  const totalDistance = trips.reduce((sum, trip) => sum + Math.max(1.2, trip.fare / 4.4), 0);
  const paceDelta = totalEarned - expectedNow;
  const paceRatio = expectedNow > 0 ? totalEarned / expectedNow : tripCount > 0 ? 1.05 : 1;
  const status: PaceStatus = shiftSession ? (paceRatio >= 1.1 ? 'ahead' : paceRatio >= 0.9 ? 'on-track' : 'behind') : 'on-track';
  const statusVisual = getStatusVisual(status);
  const leadZone = activePeriod.recommended_zones[0] ?? FALLBACK_RECOMMENDED_ZONES[0];
  const supportZone = activePeriod.recommended_zones[1] ?? FALLBACK_RECOMMENDED_ZONES[1];
  const leadZoneFare = ZONE_FARE_GUIDE[leadZone.zone_id] ?? 20;
  const supportZoneFare = ZONE_FARE_GUIDE[supportZone.zone_id] ?? 18;
  const goalReached = goalAmount > 0 && totalEarned >= goalAmount;
  const recentTrips = [...trips].sort((left, right) => right.loggedAt.localeCompare(left.loggedAt)).slice(0, 5);
  const weeklyChart = DRIVER_EARNINGS.map((entry) => ({ ...entry, value: entry.value }));

  const dynamicBadges = [
    { id: 'goal-crusher', label: 'Goal Crusher', desc: 'Finish the shift at or above your configured goal.', icon: Trophy, earned: goalReached, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    { id: 'consistency', label: 'Consistency', desc: 'Log at least 4 trips and stay on pace all shift.', icon: Award, earned: tripCount >= 4 && status !== 'behind', color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20' },
    { id: 'pace-surfer', label: 'Pace Surfer', desc: 'Move into ahead-of-pace territory during the active shift.', icon: Zap, earned: tripCount >= 2 && status === 'ahead', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
    { id: 'night-owl', label: 'Night Owl', desc: 'Complete a late shift with strong earnings density.', icon: Star, earned: shiftSession ? new Date(shiftSession.startedAt).getHours() >= 18 && averageFare >= 20 : false, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  ];

  const leaderboard = LEADERBOARD.map((driver) => driver.highlight ? { ...driver, score: goalReached ? 9.1 : driver.score, goalHit: goalReached } : driver);
  const strategyTitle = status === 'behind' ? 'Corrective Move' : status === 'ahead' ? 'Press the Advantage' : 'Hold the Line';
  const strategyCopy = status === 'behind'
    ? `Move toward ${leadZone.zone_name} now. Recorded fares there are averaging ${formatCurrency(leadZoneFare)} and demand is running at ${leadZone.expected_trips_per_hour.toFixed(0)} trips per hour.`
    : status === 'ahead'
      ? `Stay close to ${leadZone.zone_name}. The zone is still producing strong pickup density, so protect the lead instead of chasing a long reposition.`
      : `Keep working between ${leadZone.zone_name} and ${supportZone.zone_name}. That corridor should keep you on pace while the next peak window builds.`;
  const strategyFooter = status === 'behind'
    ? `You need about ${formatCurrency(requiredHourlyRate || leadZoneFare)} per remaining hour to recover the target.`
    : status === 'ahead'
      ? `At this pace you are beating the plan by ${formatCurrency(Math.max(paceDelta, 0))}.`
      : `A couple of fares around ${formatCurrency(supportZoneFare)} keeps the curve stable.`;

  const performanceKpis = [
    { label: 'Target Remaining', value: formatCurrency(remainingGoal), meta: remainingHours > 0 ? `${remainingHours.toFixed(1)} hrs left` : 'Shift complete', icon: Target, tone: 'text-[var(--primary-dark)]', panel: 'bg-[var(--primary)]/10 border-[var(--primary)]/20' },
    { label: 'Average Fare', value: tripCount > 0 ? formatCurrencyPrecise(averageFare) : '$0.00', meta: tripCount > 0 ? `${tripCount} logged trips` : 'No entries yet', icon: DollarSign, tone: 'text-[var(--success)]', panel: 'bg-[var(--success)]/10 border-[var(--success)]/20' },
    { label: 'Expected By Now', value: formatCurrency(expectedNow), meta: `${Math.round(shiftProgress * 100)}% of shift elapsed`, icon: Gauge, tone: 'text-[var(--warning)]', panel: 'bg-[var(--warning)]/10 border-[var(--warning)]/20' },
    { label: 'Current Pace', value: paceDelta >= 0 ? `+${formatCurrency(paceDelta)}` : `-${formatCurrency(Math.abs(paceDelta))}`, meta: statusVisual.label, icon: TrendingUp, tone: status === 'behind' ? 'text-[var(--danger)]' : 'text-[var(--success)]', panel: status === 'behind' ? 'bg-[var(--danger)]/10 border-[var(--danger)]/20' : 'bg-[var(--success)]/10 border-[var(--success)]/20' },
  ];

  const shiftQuickStats = [
    { label: 'Earned', value: formatCurrency(totalEarned) },
    { label: 'Distance', value: formatDistance(totalDistance) },
    { label: 'Remaining', value: formatCurrency(remainingGoal) },
    { label: 'Meter Trips', value: String(tripCount) },
  ];

  const openManualLogging = () => {
    if (!shiftSession) {
      setShowSetupModal(true);
      return;
    }

    setShowEntryModal(true);
  };

  const startShift = (nextGoalAmount: number, nextShiftHours: number) => {
    if (!Number.isFinite(nextGoalAmount) || !Number.isFinite(nextShiftHours) || nextGoalAmount <= 0 || nextShiftHours <= 0) {
      return;
    }

    setShiftSession({ goalAmount: nextGoalAmount, shiftHours: nextShiftHours, startedAt: new Date().toISOString(), trips: [] });
    setShowSetupModal(false);
  };

  const resetShift = () => {
    setShiftSession(null);
    writeStoredSession(null);
    setShowEntryModal(false);
    setShowSetupModal(true);
  };

  const logTrip = (fare: number, zoneId: string) => {
    if (!shiftSession || !Number.isFinite(fare) || fare <= 0) {
      return;
    }

    const zone = availableZones.find((entry) => entry.zone_id === zoneId) ?? availableZones[0];
    const nextTrip: ShiftTrip = {
      id: `${Date.now()}`,
      fare,
      zoneId: zone.zone_id,
      zoneName: zone.zone_name,
      borough: zone.borough,
      loggedAt: new Date().toISOString(),
    };

    setShiftSession({ ...shiftSession, trips: [...shiftSession.trips, nextTrip] });
    setShowEntryModal(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#facc15]" style={{fontFamily:'Outfit,sans-serif',letterSpacing:'-0.03em'}}>Performance Analytics</h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
          <button type="button" onClick={() => setShowSetupModal(true)} className="px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] font-bold text-sm">
            {shiftSession ? 'Update Goal' : 'Start Shift'}
          </button>
          <button
            type="button"
            onClick={openManualLogging}
            className="px-4 py-3 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={14} />
            {shiftSession ? 'Log Trip' : 'Set Goal'}
          </button>
          <button type="button" onClick={resetShift} className="px-4 py-3 rounded-xl bg-white/5 border border-[rgba(250,204,21,0.1)] text-[var(--text-secondary)] font-bold text-sm">
            Reset
          </button>
        </div>
      </div>

      {hotspotError && <div className="glass-card p-4 border border-[var(--warning)]/15 text-sm text-[var(--text-secondary)]">{hotspotError}</div>}

      {!shiftSession && (
        <div className="glass-card p-5 sm:p-8 border border-[var(--primary)]/15 bg-[radial-gradient(circle_at_top_left,rgba(244,176,0,0.14),transparent_52%)]">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--primary)]">Shift Initialization</p>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-3">Set a goal before you start the shift</h2>
            </div>
            <button type="button" onClick={() => setShowSetupModal(true)} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20">
              Configure Shift
            </button>
          </div>
        </div>
      )}

      {shiftSession && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.7fr)] gap-6">
            <div className="glass-card p-4 sm:p-6 lg:p-8 overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,176,0,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(47,158,110,0.12),transparent_35%)] pointer-events-none" />
              <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-center">
                <div className="relative w-full max-w-[220px] sm:max-w-[250px] mx-auto lg:mx-0 aspect-square">
                  <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
                    <circle cx="110" cy="110" r="86" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="18" />
                    <motion.circle
                      cx="110"
                      cy="110"
                      r="86"
                      fill="none"
                      stroke={statusVisual.ring}
                      strokeWidth="18"
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: getProgressStroke(0) }}
                      animate={{ strokeDashoffset: getProgressStroke(earningsProgress) }}
                      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                      strokeDasharray={2 * Math.PI * 86}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Earned / Goal</p>
                    <p className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] mt-2">{Math.round(earningsProgress * 100)}%</p>
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-secondary)] mt-2">{formatCurrency(totalEarned)} of {formatCurrency(goalAmount)}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn('px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-[0.18em]', statusVisual.badge)}>{statusVisual.label}</span>
                    <span className="px-3 py-1.5 rounded-full bg-white/5 border border-[rgba(250,204,21,0.1)] text-xs font-bold text-[var(--text-secondary)]">Meter live since {formatClock(shiftSession.startedAt)}</span>
                    <span className="px-3 py-1.5 rounded-full bg-white/5 border border-[rgba(250,204,21,0.1)] text-xs font-bold text-[var(--text-secondary)]">{shiftHours} hr plan</span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-3xl font-black text-[var(--text-primary)]">Live Shift Tracker</h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-2xl">{statusVisual.copy}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {performanceKpis.map((kpi) => (
                      <div key={kpi.label} className={cn('rounded-2xl border p-3 sm:p-4', kpi.panel)}>
                        <p className="text-[10px] uppercase tracking-[0.16em] font-black text-[var(--text-secondary)]">{kpi.label}</p>
                        <p className={cn('text-base sm:text-lg font-black mt-2 break-words', kpi.tone)}>{kpi.value}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">{kpi.meta}</p>
                      </div>
                    ))}
                  </div>

                  <div className={cn('rounded-2xl border p-4', statusVisual.panel)}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] font-black text-[var(--text-secondary)]">Pace Snapshot</p>
                        <p className="text-base sm:text-lg font-black text-[var(--text-primary)] mt-1">{paceDelta >= 0 ? 'Meter totals are ahead of target' : 'Meter totals are below target'}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs font-bold text-[var(--text-secondary)]">Required from here</p>
                        <p className="text-lg sm:text-xl font-black text-[var(--text-primary)]">{remainingHours > 0 ? `${formatCurrency(requiredHourlyRate)}/hr` : formatCurrency(remainingGoal)}</p>
                      </div>
                    </div>
                    <div className="mt-4 w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, shiftProgress * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>Shift time elapsed</span>
                      <span>{Math.round(shiftProgress * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="p-2 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                  <Sparkles className="w-4 h-4 text-[var(--primary-dark)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">AI Strategy Dispatcher</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{activePeriod.label} guidance</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className={cn('rounded-2xl border p-4', statusVisual.panel)}>
                  <p className="text-xs uppercase tracking-[0.18em] font-black text-[var(--text-secondary)]">{strategyTitle}</p>
                  <p className="text-base font-bold text-[var(--text-primary)] mt-2 leading-relaxed">{strategyCopy}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[rgba(250,204,21,0.1)] bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-black text-[var(--text-secondary)]">Best Zone</p>
                    <p className="text-sm font-black text-[var(--text-primary)] mt-2">{leadZone.zone_name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Meter avg fare {formatCurrency(leadZoneFare)}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(250,204,21,0.1)] bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-black text-[var(--text-secondary)]">Next Support</p>
                    <p className="text-sm font-black text-[var(--text-primary)] mt-2">{supportZone.zone_name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Peak in about 15 min</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/10 flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[var(--primary-dark)] shrink-0 mt-0.5" />
                  <p className="text-sm text-[var(--text-secondary)]"><span className="font-bold text-[var(--text-primary)]">GRID advisory:</span> {strategyFooter}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="glass-card p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <DollarSign className="text-primary w-5 h-5" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Weekly Earnings Trend</h2>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/5 border border-[rgba(250,204,21,0.1)] text-xs font-bold text-[var(--text-secondary)]">Historical reference</div>
          </div>
          <div className="h-[240px] sm:h-[330px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyChart}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={4} fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
            <InfoDot />
            <p className="text-sm text-[var(--text-secondary)] italic">
              <span className="font-bold text-[var(--text-primary)] not-italic">Benchmark:</span> Use the manual shift tracker above for live decisions and this weekly curve as the baseline earnings context.
            </p>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20">
              <Clock3 className="w-4 h-4 text-[var(--primary-dark)]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Trip Feed</h3>
              <p className="text-xs text-[var(--text-secondary)]">Recent trip updates</p>
            </div>
          </div>

          {recentTrips.length > 0 ? (
            <div className="space-y-3">
              {recentTrips.map((trip) => (
                <div key={trip.id} className="p-4 rounded-2xl border border-[rgba(250,204,21,0.1)] bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">{trip.zoneName}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{trip.borough}, {formatClock(trip.loggedAt)}, distance {formatDistance(Math.max(1.2, trip.fare / 4.4))}</p>
                    </div>
                    <p className="text-base font-black text-[var(--primary-dark)]">{formatCurrencyPrecise(trip.fare)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm font-bold text-[var(--text-primary)]">No trips yet</p>
              <button
                type="button"
                onClick={openManualLogging}
                className="mt-4 px-4 py-2.5 rounded-xl bg-primary text-white font-black inline-flex items-center gap-2"
              >
                <Plus size={14} />
                {shiftSession ? 'Add First Trip' : 'Set Goal First'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Top Suggested Zones</h3>
          <div className="h-[220px] sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={availableZones.slice(0, 5).map((zone) => ({ name: zone.zone_name, value: zone.predicted_demand }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                  {availableZones.slice(0, 5).map((zone, index) => (
                    <Cell key={zone.zone_id} fill={index === 0 ? '#2F9E6E' : '#F4B000'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-success/5 border border-success/10 rounded-2xl flex items-start gap-3">
            <Sparkles className="text-success w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)] italic">
              <span className="font-bold text-[var(--text-primary)] not-italic">AI Tip:</span> {leadZone.zone_name} is the strongest live opportunity right now, with an estimated {leadZone.expected_trips_per_hour.toFixed(0)} trips per hour.
            </p>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Achievements & Badges</h3>
              <p className="text-xs text-[var(--text-secondary)]">{dynamicBadges.filter((badge) => badge.earned).length} of {dynamicBadges.length} unlocked</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dynamicBadges.map((badge) => (
              <div
                key={badge.id}
                className={cn('p-4 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all', badge.earned ? badge.bg : 'bg-white/5 border-[rgba(250,204,21,0.1)] opacity-45 grayscale')}
              >
                <div className={cn('p-2 rounded-xl', badge.earned ? badge.bg : 'bg-white/10')}>
                  <badge.icon size={20} className={badge.earned ? badge.color : 'text-[var(--text-muted)]'} />
                </div>
                <p className={cn('text-xs font-black', badge.earned ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>{badge.label}</p>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{badge.desc}</p>
                {badge.earned && <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full border', badge.bg, badge.color)}>UNLOCKED</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-[var(--primary)]/10 rounded-xl">
            <Medal className="w-5 h-5 text-[var(--primary-dark)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Fleet Leaderboard</h3>
            <p className="text-xs text-[var(--text-secondary)]">Goal-tracking markers for today's active drivers</p>
          </div>
        </div>

        <div className="space-y-2">
          {leaderboard.map((driver, idx) => (
            <motion.div
              key={driver.rank}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn('flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all', driver.highlight ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-sm' : 'bg-white/5 border-[rgba(250,204,21,0.1)]')}
            >
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0', driver.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' : driver.rank === 2 ? 'bg-slate-300/20 text-slate-400' : driver.rank === 3 ? 'bg-orange-400/20 text-orange-400' : 'bg-white/10 text-[var(--text-muted)]')}>
                {driver.rank}
              </div>

              <div className="flex-1">
                <p className={cn('text-sm font-bold flex flex-wrap items-center gap-2', driver.highlight ? 'text-[var(--primary-dark)]' : 'text-[var(--text-primary)]')}>
                  <span>{driver.name}</span>
                  {driver.highlight && <span className="text-[10px] text-[var(--primary)] font-black uppercase tracking-[0.16em]">You</span>}
                  {driver.goalHit && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase tracking-[0.14em]">
                      <Target size={10} />
                      Goal Hit
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Score: {driver.score.toFixed(1)}</p>
              </div>

              <p className={cn('text-sm font-black shrink-0', driver.highlight ? 'text-[var(--primary-dark)]' : 'text-[var(--text-primary)]')}>{formatCurrency(driver.earnings)}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/10 rounded-2xl flex items-start gap-3">
          <Sparkles className="text-[var(--primary-dark)] w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)] italic">
            <span className="font-bold text-[var(--text-primary)] not-italic">GRID Challenge:</span> Hit your configured goal today to light up the leaderboard marker and unlock the Goal Crusher badge.
          </p>
        </div>
      </div>

      <ShiftSetupModal open={showSetupModal} onClose={() => setShowSetupModal(false)} onSave={startShift} />
      <AddEarningsModal open={showEntryModal} onClose={() => setShowEntryModal(false)} zones={availableZones} onSave={logTrip} />

      <PlanMyShift />
    </div>
  );
}
