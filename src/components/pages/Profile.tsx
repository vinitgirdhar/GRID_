import { startTransition, useEffect, useState, type ElementType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Car,
  Clock,
  DollarSign,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
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

const PANEL = 'rounded-[28px] border border-white/70 bg-white/72 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl';
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
    <div className="rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
        Earnings <span className="font-black text-[var(--primary-dark)]">{money(payload[0].value)}</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
        Online <span className="font-black text-sky-600">{payload[1]?.value ?? 0} hrs</span>
      </p>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return (
    <div className="rounded-[24px] border border-[var(--border)]/80 bg-white/78 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon size={15} />
        <span className="text-[11px] font-black uppercase tracking-[0.24em]">{label}</span>
      </div>
      <p className="mt-4 text-base font-bold text-[var(--text-primary)]">{value}</p>
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
      <div className={cn(PANEL, 'flex min-h-[360px] flex-col items-center justify-center text-center')}>
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
      ? 'bg-emerald-400/20 text-emerald-700 border-emerald-500/30'
      : driver.status === 'driving'
        ? 'bg-sky-400/20 text-sky-700 border-sky-500/30'
        : 'bg-[var(--secondary)] text-[var(--text-secondary)] border-[var(--border)]';
  const tierTone =
    driver.tier === 'gold'
      ? 'bg-[#facc15]/20 text-[#ca8a04] border-[#facc15]/40'
      : driver.tier === 'silver'
        ? 'bg-slate-200/60 text-slate-700 border-slate-300'
        : 'bg-orange-400/20 text-orange-700 border-orange-500/30';

  const summary = [
    { label: 'Monthly Earnings', value: money(driver.earnings), detail: `Best day ${bestDay.day}`, icon: DollarSign, glow: 'bg-[#facc15]/18' },
    { label: 'Driver Rating', value: driver.rating.toFixed(1), detail: `${(100 - driver.cancellationRate).toFixed(1)}% quality`, icon: Star, glow: 'bg-emerald-400/18' },
    { label: 'Completed Trips', value: driver.completedTrips.toLocaleString(), detail: `${driver.experience} years on platform`, icon: TrendingUp, glow: 'bg-sky-400/18' },
    { label: 'Online Hours', value: `${driver.onlineHours.toFixed(1)} hrs`, detail: `${averageHours} hrs daily avg`, icon: Clock, glow: 'bg-violet-400/18' },
  ];

  const documents = [
    { title: 'Driver License', subtitle: 'Verified and active for dispatch', meta: `Plate ${driver.licensePlate}` },
    { title: 'Commercial Insurance', subtitle: 'Active policy attached to current vehicle', meta: driver.carModel },
    { title: 'Vehicle Registration', subtitle: `Verified for ${driver.carModel}`, meta: driver.licensePlate },
    { title: 'Background Screening', subtitle: `Last reviewed ${longDate(driver.joinedDate)}`, meta: 'Cleared for rider operations' },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[34px] border border-[var(--border)] bg-[var(--surface)] px-6 py-7 shadow-[0_20px_70px_rgba(15,23,42,0.05)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'linear-gradient(rgba(250,204,21,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,0.1) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-[#facc15]/20 blur-[120px]" />
        <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-sky-400/20 blur-[130px]" />

        <div className="relative space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {viewerRole === 'admin' && onBack ? (
                <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--secondary)]">
                  <ArrowLeft size={15} />
                  Fleet Management
                </button>
              ) : null}
              <span className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                {viewerRole === 'admin' ? 'Admin View' : 'Driver Profile'}
              </span>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              {viewerRole === 'admin' ? 'Read only for now' : 'Editable bio and phone'}
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_340px]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-md">
                  <img src={driver.avatar} alt={driver.name} referrerPolicy="no-referrer" className="h-full w-full rounded-[24px] object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={cn('rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em]', statusTone)}>{driver.status}</span>
                    <span className={cn('rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em]', tierTone)}>{driver.tier} tier</span>
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">{driver.name}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">{driver.bio}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"><MapPin size={14} />{driver.borough}</span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"><Calendar size={14} />Joined {longDate(driver.joinedDate)}</span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"><Car size={14} />{driver.carModel}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summary.map((card, index) => (
                  <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }} className="group relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-xl transition-[border-color,box-shadow] hover:border-[var(--border-hover)] hover:shadow-md">
                    <div className={cn('absolute right-0 top-0 h-28 w-28 rounded-full blur-3xl', card.glow)} />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">{card.label}</span>
                        <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-2 text-[var(--text-secondary)]"><card.icon size={16} /></div>
                      </div>
                      <p className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{card.value}</p>
                      <p className="mt-4 text-xs leading-6 text-[var(--text-secondary)] transition-opacity duration-200 ease-out md:opacity-0 md:group-hover:opacity-100">{card.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">At a glance</p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Profile signal</h2>
                </div>
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Verified</div>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-[22px] border border-[var(--border)] bg-[var(--secondary)]/60 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Contact</p>
                  <div className="mt-3 space-y-3 text-[var(--text-secondary)]">
                    <p className="flex items-center gap-2"><Phone size={14} className="text-[var(--text-muted)]" />{driver.phone}</p>
                    <p className="flex items-center gap-2"><Mail size={14} className="text-[var(--text-muted)]" />{driver.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-[var(--border)] bg-[var(--secondary)]/60 p-4"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Experience</p><p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{driver.experience} yrs</p></div>
                  <div className="rounded-[22px] border border-[var(--border)] bg-[var(--secondary)]/60 p-4"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Cancellations</p><p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{driver.cancellationRate}%</p></div>
                </div>
                <div className="rounded-[22px] border border-[var(--border)] bg-[var(--secondary)]/60 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Vehicle</p>
                  <p className="mt-3 text-base font-bold text-[var(--text-primary)]">{driver.carModel}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Plate {driver.licensePlate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => startTransition(() => setActiveTab(tab.id))} className={cn('relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-bold transition-colors duration-150 ease-out', activeTab === tab.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
            {activeTab === tab.id ? <motion.span layoutId="profile-tab-pill" className="absolute inset-0 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/18 shadow-[0_12px_30px_rgba(250,204,21,0.22)]" /> : <span className="absolute inset-0 rounded-full border border-transparent bg-[var(--surface)]" />}
            <span className="relative"><tab.icon size={16} /></span>
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
          {activeTab === 'general' ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
              <div className={PANEL}>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">General</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Identity and vehicle setup</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <InfoCard label="Full name" value={driver.name} icon={User} />
                  <InfoCard label="Primary borough" value={driver.borough} icon={MapPin} />
                  <InfoCard label="Joined GRID" value={longDate(driver.joinedDate)} icon={Calendar} />
                  <InfoCard label="Experience" value={`${driver.experience} years`} icon={TrendingUp} />
                  <InfoCard label="Vehicle" value={driver.carModel} icon={Car} />
                  <InfoCard label="Plate number" value={driver.licensePlate} icon={ShieldCheck} />
                  <InfoCard label="Phone" value={driver.phone} icon={Phone} />
                  <InfoCard label="Email" value={driver.email} icon={Mail} />
                </div>
              </div>

              <div className="space-y-6">
                <div className={PANEL}>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    {viewerRole === 'admin' ? 'Admin access' : 'Edit mode'}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">
                    {viewerRole === 'admin' ? 'Read-only controls' : 'Keep your profile current'}
                  </h2>

                  {viewerRole === 'admin' ? (
                    <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--secondary)]/70 p-5">
                      <p className="text-sm font-semibold leading-7 text-[var(--text-secondary)]">
                        This release keeps the admin profile page observational. Status and tier are visible here, but edits are intentionally deferred until dedicated management actions are defined.
                      </p>
                    </div>
                  ) : !editing ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--secondary)]/70 p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Current bio</p>
                        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{driver.bio}</p>
                      </div>
                      <button onClick={() => setEditing(true)} className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white">
                        Edit phone and bio
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Phone</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={draftPhone}
                          onChange={(event) => setDraftPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="mt-2 w-full rounded-[20px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]/60"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Bio</label>
                        <textarea
                          rows={5}
                          value={draftBio}
                          onChange={(event) => setDraftBio(event.target.value)}
                          className="mt-2 w-full rounded-[20px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold leading-7 text-[var(--text-primary)] outline-none focus:border-[var(--primary)]/60"
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
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--text-secondary)]"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs leading-6 text-[var(--text-muted)]">
                        Session-only editing for now. It updates the current app state until the persistence API is added.
                      </p>
                    </div>
                  )}
                </div>

                <div className={PANEL}>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Performance snapshot</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Daily avg</p>
                      <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{money(averageEarnings)}</p>
                    </div>
                    <div className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Best day</p>
                      <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{bestDay.day}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'performance' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
              <div className={PANEL}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Performance</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Daily earnings and online hours</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      A rolling weekly trend that pairs payout strength with availability, so the profile reads like a true operating snapshot instead of a flat stat sheet.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--primary)]/20 bg-[var(--primary)]/12 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--primary-dark)]">Weekly avg</p>
                    <p className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{money(averageEarnings)}</p>
                  </div>
                </div>

                <div className="mt-8 h-[340px] w-full">
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
              </div>

              <div className="space-y-6">
                <div className={PANEL}>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Highlights</p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--secondary)]/70 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Peak output</p>
                      <p className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{bestDay.day}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Highest projected earning day this week at {money(bestDay.earnings)} across {bestDay.hours} online hours.
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Completion rate</p>
                      <p className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{(100 - driver.cancellationRate).toFixed(1)}%</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">This profile stays inside healthy cancellation bounds for marketplace quality.</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--border)] bg-white/80 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">7-day cadence</p>
                      <p className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{averageHours} hrs/day</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Rolling weekly availability aligned with {driver.tier} tier service expectations.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'documents' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                {documents.map((document, index) => (
                  <motion.div key={document.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }} className={cn(PANEL, 'relative overflow-hidden')}>
                    <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[var(--primary)]/12 blur-3xl" />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600"><ShieldCheck size={18} /></div>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">Verified</span>
                      </div>
                      <h2 className="mt-6 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{document.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{document.subtitle}</p>
                      <div className="mt-6 rounded-[20px] border border-[var(--border)] bg-white/80 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Reference</p>
                        <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{document.meta}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-6">
                <div className={PANEL}>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Compliance</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Document health</h2>
                  <div className="mt-5 rounded-[26px] border border-[var(--primary)]/20 bg-[var(--primary)]/10 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--primary-dark)]">Clearance score</p>
                    <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--text-primary)]">100%</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                      Every required document is present in this mock profile. This tab is optimized for quick admin inspection and reassuring driver self-checks before going live.
                    </p>
                  </div>
                </div>

                <div className={PANEL}>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Review note</p>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                    Password and security settings are intentionally excluded from this first release because authentication is still mock-based. The page is ready for a future settings block once real identity flows land.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
