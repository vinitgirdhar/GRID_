import { startTransition, useEffect, useState, type ElementType, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Car,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cn } from '../../lib/utils';
import { Driver, UserRole } from '../../types';

type ProfileTab = 'general' | 'performance' | 'documents';

interface ProfileProps {
  driver: Driver | null;
  viewerRole: UserRole;
  onBack?: () => void;
  onSave?: (updates: Pick<Driver, 'bio' | 'phone'>) => void;
}

const CARD = 'rounded-3xl border border-[rgba(250,204,21,0.12)] bg-white/5 shadow-[0_4px_16px_rgba(0,0,0,0.4)]';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEIGHTS = [0.78, 0.86, 0.93, 0.98, 1.1, 1.18, 0.9];
const TABS: Array<{ id: ProfileTab; label: string; icon: ElementType }> = [
  { id: 'general', label: 'General', icon: User },
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'documents', label: 'Documents', icon: FileText },
];

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function longDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function buildSeries(driver: Driver) {
  const seed = Number(driver.id) || 1;
  return DAYS.map((day, index) => {
    const lift = ((seed + index) % 4) * 0.03;
    return {
      day,
      earnings: Math.round((driver.earnings / 6.8) * (WEIGHTS[index] + lift)),
      hours: Number(((driver.onlineHours / 7) * (0.86 + ((index + seed) % 3) * 0.08)).toFixed(1)),
      trips: Math.round((driver.completedTrips / 110) * (WEIGHTS[index] + lift)),
    };
  });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-[rgba(250,204,21,0.15)] bg-[#0d0d20] px-4 py-3 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
        Earnings <span className="font-black text-[var(--primary-dark)]">{money(payload[0].value)}</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
        Online <span className="font-black text-sky-400">{payload[1]?.value ?? 0} hrs</span>
      </p>
    </div>
  );
}

/** One definition row inside an info card — label left, value right, divider below. */
function InfoRow({ label, icon: Icon, children }: { label: string; icon?: ElementType; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[rgba(250,204,21,0.08)] last:border-0">
      <span className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)] shrink-0">
        {Icon && <Icon size={14} className="text-[var(--text-muted)]" />}
        {label}
      </span>
      <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] text-right truncate">{children}</span>
    </div>
  );
}

/** One stat column in the flat hero strip — no sub-card, just a divided column. */
function StatCol({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="px-4 py-3 sm:px-6 sm:py-4">
      <p className={LABEL}>{label}</p>
      <p className="mt-1 text-lg sm:text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] hidden sm:block">{detail}</p>}
    </div>
  );
}

export default function Profile({ driver, viewerRole, onBack, onSave }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('general');
  const [editing, setEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState('');
  const [draftBio, setDraftBio] = useState('');

  useEffect(() => {
    setDraftPhone(driver?.phone ?? '');
    setDraftBio(driver?.bio ?? '');
    setEditing(false);
  }, [driver]);

  if (!driver) {
    return (
      <div className={cn(CARD, 'flex min-h-[360px] flex-col items-center justify-center p-6 text-center')}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/14 text-[var(--primary-dark)]">
          <User size={28} />
        </div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">No driver selected</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
          Pick a driver from Fleet Management to open their profile, or sign in as a driver to access your own dashboard.
        </p>
        {viewerRole === 'admin' && onBack ? (
          <button onClick={onBack} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white">
            <ArrowLeft size={16} />
            Back to Fleet
          </button>
        ) : null}
      </div>
    );
  }

  const series = buildSeries(driver);
  const averageEarnings = Math.round(series.reduce((sum, point) => sum + point.earnings, 0) / series.length);
  const averageHours = (series.reduce((sum, point) => sum + point.hours, 0) / series.length).toFixed(1);
  const bestDay = series.reduce((best, point) => (point.earnings > best.earnings ? point : best), series[0]);
  const canSave = draftPhone.trim().length === 10 && draftBio.trim().length > 0;

  const statusTone =
    driver.status === 'online'
      ? 'bg-emerald-400/15 text-emerald-400 border-emerald-500/25'
      : driver.status === 'driving'
        ? 'bg-sky-400/15 text-sky-400 border-sky-500/25'
        : 'bg-white/5 text-[var(--text-secondary)] border-[rgba(250,204,21,0.1)]';
  const tierTone =
    driver.tier === 'gold'
      ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/30'
      : driver.tier === 'silver'
        ? 'bg-slate-400/15 text-slate-300 border-slate-500/30'
        : 'bg-orange-400/15 text-orange-400 border-orange-500/25';

  const documents = [
    { title: 'Driver License', subtitle: 'Verified and active for dispatch', meta: `Plate ${driver.licensePlate}` },
    { title: 'Commercial Insurance', subtitle: 'Active policy attached to current vehicle', meta: driver.carModel },
    { title: 'Vehicle Registration', subtitle: `Verified for ${driver.carModel}`, meta: driver.licensePlate },
    { title: 'Background Screening', subtitle: `Last reviewed ${longDate(driver.joinedDate)}`, meta: 'Cleared for rider operations' },
  ];

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      {/* ── HERO — one card: identity + flat stat strip ── */}
      <section className={cn(CARD, 'overflow-hidden')}>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            {viewerRole === 'admin' && onBack ? (
              <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[rgba(250,204,21,0.15)] bg-white/5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-white/10">
                <ArrowLeft size={14} />
                Fleet Management
              </button>
            ) : <span className={LABEL}>Driver Profile</span>}
            <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Verified</div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="h-14 w-14 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0.5">
              <img src={driver.avatar} alt={driver.name} referrerPolicy="no-referrer" className="h-full w-full rounded-[14px] object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-3xl font-black tracking-[-0.03em] text-[var(--text-primary)] truncate">{driver.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={cn('rounded-full border px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em]', statusTone)}>{driver.status}</span>
                <span className={cn('rounded-full border px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em]', tierTone)}>{driver.tier}</span>
              </div>
            </div>
          </div>

          {/* Meta line sits below the avatar row at full card width so it wraps instead of clipping */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><MapPin size={13} className="shrink-0" />{driver.borough}</span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Calendar size={13} className="shrink-0" />Joined {longDate(driver.joinedDate)}</span>
            <span className="inline-flex items-center gap-1.5 min-w-0"><Car size={13} className="shrink-0" /><span className="truncate">{driver.carModel}</span></span>
          </div>
          <p className="hidden lg:block mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] truncate">{driver.bio}</p>
        </div>

        {/* Flat stat strip — divided columns, no sub-cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[rgba(250,204,21,0.1)] divide-x divide-y sm:divide-y-0 divide-[rgba(250,204,21,0.08)]">
          <StatCol label="Monthly Earnings" value={money(driver.earnings)} detail={`Best day ${bestDay.day}`} />
          <StatCol label="Rating" value={driver.rating.toFixed(1)} detail={`${(100 - driver.cancellationRate).toFixed(1)}% quality`} />
          <StatCol label="Trips" value={driver.completedTrips.toLocaleString()} detail={`${driver.experience} yrs on platform`} />
          <StatCol label="Online Hours" value={`${driver.onlineHours.toFixed(1)}`} detail={`${averageHours} hrs daily avg`} />
        </div>
      </section>

      {/* ── TABS ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => startTransition(() => setActiveTab(tab.id))} className={cn('relative inline-flex items-center gap-1.5 sm:gap-2 overflow-hidden rounded-full px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-bold transition-colors duration-150 ease-out shrink-0', activeTab === tab.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
            {activeTab === tab.id ? <motion.span layoutId="profile-tab-pill" className="absolute inset-0 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/18" /> : <span className="absolute inset-0 rounded-full border border-transparent bg-[var(--surface)]" />}
            <span className="relative"><tab.icon size={15} /></span>
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>

          {/* ── GENERAL — one card with every detail as rows ── */}
          {activeTab === 'general' ? (
            <div className={cn(CARD, 'p-4 sm:p-6 lg:p-8')}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className={LABEL}>General</p>
                  <h2 className="mt-1 text-lg sm:text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Driver Information</h2>
                </div>
                {viewerRole !== 'admin' && !editing && (
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs sm:text-sm font-bold text-white shrink-0">
                    <Pencil size={13} />
                    Edit
                  </button>
                )}
              </div>

              {!editing ? (
                <>
                  <p className="text-sm leading-6 text-[var(--text-secondary)] border-b border-[rgba(250,204,21,0.08)] pb-4 mb-1">{driver.bio}</p>
                  <div className="sm:grid sm:grid-cols-2 sm:gap-x-10">
                    <div>
                      <InfoRow label="Full name" icon={User}>{driver.name}</InfoRow>
                      <InfoRow label="Phone" icon={Phone}>{driver.phone}</InfoRow>
                      <InfoRow label="Email" icon={Mail}>{driver.email}</InfoRow>
                      <InfoRow label="Borough" icon={MapPin}>{driver.borough}</InfoRow>
                    </div>
                    <div>
                      <InfoRow label="Joined GRID" icon={Calendar}>{longDate(driver.joinedDate)}</InfoRow>
                      <InfoRow label="Experience" icon={Activity}>{driver.experience} years</InfoRow>
                      <InfoRow label="Vehicle" icon={Car}>{driver.carModel}</InfoRow>
                      <InfoRow label="Plate" icon={ShieldCheck}>{driver.licensePlate}</InfoRow>
                    </div>
                  </div>
                  {viewerRole === 'admin' && (
                    <p className="mt-4 text-xs text-[var(--text-muted)]">Admin view is read-only. Management actions land in a later release.</p>
                  )}
                </>
              ) : (
                <div className="mt-4 space-y-4 max-w-xl">
                  <div>
                    <label className={LABEL}>Phone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={draftPhone}
                      onChange={(event) => setDraftPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="mt-2 w-full rounded-2xl border border-[rgba(250,204,21,0.15)] bg-white/5 px-4 py-3 text-sm font-semibold text-[#e8edf3] outline-none focus:border-[rgba(250,204,21,0.4)]"
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Bio</label>
                    <textarea
                      rows={4}
                      value={draftBio}
                      onChange={(event) => setDraftBio(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[rgba(250,204,21,0.15)] bg-white/5 px-4 py-3 text-sm font-semibold leading-6 text-[#e8edf3] outline-none focus:border-[rgba(250,204,21,0.4)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (!canSave) return;
                        onSave?.({ phone: draftPhone.trim(), bio: draftBio.trim() });
                        setEditing(false);
                      }}
                      className={cn('rounded-full px-5 py-2.5 text-sm font-bold text-white', canSave ? 'bg-[var(--accent)]' : 'cursor-not-allowed bg-slate-400')}
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => {
                        setDraftPhone(driver.phone);
                        setDraftBio(driver.bio ?? '');
                        setEditing(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(250,204,21,0.15)] bg-white/5 px-5 py-2.5 text-sm font-bold text-[var(--text-secondary)]"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs leading-6 text-[var(--text-muted)]">Session-only editing for now — persists until the identity API lands.</p>
                </div>
              )}
            </div>
          ) : null}

          {/* ── PERFORMANCE — one card: chart + flat stat strip ── */}
          {activeTab === 'performance' ? (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="p-4 sm:p-6 lg:p-8 pb-0 sm:pb-0 lg:pb-0 flex items-end justify-between gap-3">
                <div>
                  <p className={LABEL}>Performance</p>
                  <h2 className="mt-1 text-lg sm:text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Daily earnings & online hours</h2>
                </div>
                <div className="text-right shrink-0">
                  <p className={LABEL}>Weekly avg</p>
                  <p className="mt-1 text-lg sm:text-xl font-black tracking-[-0.03em] text-[var(--primary-dark)]">{money(averageEarnings)}</p>
                </div>
              </div>

              <div className="h-[240px] sm:h-[320px] w-full px-2 sm:px-4 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profileEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#facc15" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" opacity={0.55} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} />
                    <YAxis yAxisId="earnings" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} tickFormatter={(value: number) => `$${value}`} />
                    <YAxis yAxisId="hours" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} tickFormatter={(value: number) => `${value}h`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }} />
                    <Area yAxisId="earnings" type="monotone" dataKey="earnings" stroke="#eab308" strokeWidth={3} fill="url(#profileEarnings)" />
                    <Bar yAxisId="hours" dataKey="hours" fill="#38bdf8" radius={[10, 10, 0, 0]} barSize={24} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 border-t border-[rgba(250,204,21,0.1)] divide-x divide-[rgba(250,204,21,0.08)] mt-4">
                <StatCol label="Peak day" value={bestDay.day} detail={`${money(bestDay.earnings)} across ${bestDay.hours} hrs`} />
                <StatCol label="Completion" value={`${(100 - driver.cancellationRate).toFixed(1)}%`} detail="Healthy cancellation bounds" />
                <StatCol label="Cadence" value={`${averageHours} h/day`} detail={`${driver.tier} tier availability`} />
              </div>
            </div>
          ) : null}

          {/* ── DOCUMENTS — one card: list of divided rows ── */}
          {activeTab === 'documents' ? (
            <div className={cn(CARD, 'p-4 sm:p-6 lg:p-8')}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className={LABEL}>Documents</p>
                  <h2 className="mt-1 text-lg sm:text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Compliance file</h2>
                </div>
                <div className="text-right shrink-0">
                  <p className={LABEL}>Clearance</p>
                  <p className="mt-1 text-lg sm:text-xl font-black tracking-[-0.03em] text-emerald-400">100%</p>
                </div>
              </div>

              {documents.map((document) => (
                <div key={document.title} className="flex items-center gap-3 sm:gap-4 py-3.5 border-b border-[rgba(250,204,21,0.08)] last:border-0">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400 shrink-0"><ShieldCheck size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{document.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{document.subtitle} · {document.meta}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400 shrink-0">Verified</span>
                </div>
              ))}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
