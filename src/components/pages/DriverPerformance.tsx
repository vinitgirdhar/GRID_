import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Activity, Info, Sparkles, Trophy, Medal, Star, Award, Zap, Target } from 'lucide-react';
import { DRIVER_EARNINGS, DRIVER_KPIS } from '../../constants';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-sm font-bold text-primary">
          ${payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const BADGES = [
  { id: 'night_owl', label: 'Night Owl', desc: '50+ rides after midnight', icon: Star, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', earned: true },
  { id: 'rain_master', label: 'Rain Master', desc: '20 rides in rainy weather', icon: Zap, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', earned: true },
  { id: 'top_earner', label: 'Top Earner', desc: 'Top 10% fleet earnings', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', earned: true },
  { id: 'surge_hunter', label: 'Surge Hunter', desc: '15 rides during surge', icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', earned: false },
  { id: 'marathon', label: 'Marathon Driver', desc: '10hr+ shift completed', icon: Medal, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', earned: false },
  { id: 'consistent', label: 'Consistent Pro', desc: '7-day perfect streak', icon: Award, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', earned: false },
];

const LEADERBOARD = [
  { rank: 1, name: 'Alex R.', score: 9.7, earnings: '$1,842', highlight: false },
  { rank: 2, name: 'Maria C.', score: 9.4, earnings: '$1,710', highlight: false },
  { rank: 3, name: 'You', score: 8.8, earnings: '$1,540', highlight: true },
  { rank: 4, name: 'James K.', score: 8.6, earnings: '$1,498', highlight: false },
  { rank: 5, name: 'Priya S.', score: 8.1, earnings: '$1,320', highlight: false },
];

export default function DriverPerformance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Performance Analytics</h1>
        <p className="text-[var(--text-secondary)] mt-1">Detailed breakdown of your earnings and efficiency metrics.</p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DRIVER_KPIS.map((kpi, idx) => (
          <div key={idx} className="glass-card p-6">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{kpi.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-black text-[var(--text-primary)]">{kpi.value}</p>
              <div className={`flex items-center gap-1 text-xs font-bold ${kpi.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                {kpi.change}
                {kpi.trend === 'up' ? <TrendingUp size={14} /> : <Activity size={14} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Earnings Chart */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <DollarSign className="text-primary w-5 h-5" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Weekly Earnings Trend</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20">Weekly</button>
            <button className="px-4 py-1.5 bg-[var(--background)] text-[var(--text-secondary)] text-xs font-bold rounded-lg border border-[var(--border)]">Monthly</button>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DRIVER_EARNINGS}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F4B000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={4} fillOpacity={1} fill="url(#colorEarnings)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-8 p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
          <Info className="text-primary w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)] italic">
            <span className="font-bold text-[var(--text-primary)] not-italic">AI Insight:</span> Your earnings typically peak on Friday and Saturday nights. You earn <span className="text-primary font-bold">12% more</span> during rainy evenings compared to clear ones, suggesting a high sensitivity to weather-driven demand spikes.
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Acceptance Rate by Day</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DRIVER_EARNINGS}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                  {DRIVER_EARNINGS.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 4 ? '#2F9E6E' : '#F4B000'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-success/5 border border-success/10 rounded-2xl flex items-start gap-3">
            <Sparkles className="text-success w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)] italic">
              <span className="font-bold text-[var(--text-primary)] not-italic">AI Tip:</span> Your acceptance rate is highest on weekends. Maintaining this could increase monthly revenue by an estimated <span className="text-success font-bold">$450</span>.
            </p>
          </div>
        </div>

        <div className="glass-card p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 rounded-full border-8 border-primary/10 border-t-primary flex items-center justify-center relative">
            <span className="text-2xl font-black text-primary">8.8</span>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center border-4 border-[var(--card)] shadow-lg">
              <TrendingUp size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Productivity Score</h3>
            <p className="text-[var(--text-secondary)] text-sm max-w-xs mx-auto mt-2">
              Based on ride density, route efficiency, and idle time. You are in the <span className="text-primary font-bold">top 5%</span> of drivers in your region.
            </p>
          </div>
          <button className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            View Detailed Breakdown
          </button>
        </div>
      </div>

      {/* Achievements & Badges */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="p-2 bg-yellow-500/10 rounded-xl">
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Achievements & Badges</h3>
            <p className="text-xs text-[var(--text-secondary)]">3 of 6 unlocked</p>
          </div>
          <div className="sm:ml-auto px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <span className="text-xs font-black text-yellow-500">Level 12 Driver</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BADGES.map((badge, idx) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.06 }}
              className={cn(
                'p-4 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all',
                badge.earned ? badge.bg : 'bg-[var(--background)] border-[var(--border)] opacity-40 grayscale'
              )}
            >
              <div className={cn('p-2 rounded-xl', badge.earned ? badge.bg : 'bg-[var(--border)]')}>
                <badge.icon size={20} className={badge.earned ? badge.color : 'text-[var(--text-muted)]'} />
              </div>
              <p className={cn('text-xs font-black', badge.earned ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
                {badge.label}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{badge.desc}</p>
              {badge.earned && (
                <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full border', badge.bg, badge.color)}>
                  UNLOCKED
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fleet Leaderboard */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-[var(--primary)]/10 rounded-xl">
            <Medal className="w-5 h-5 text-[var(--primary-dark)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Fleet Leaderboard</h3>
            <p className="text-xs text-[var(--text-secondary)]">This week's top performers in your zone</p>
          </div>
        </div>

        <div className="space-y-2">
          {LEADERBOARD.map((driver, idx) => (
            <motion.div
              key={driver.rank}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              className={cn(
                'flex items-center gap-4 p-4 rounded-2xl border transition-all',
                driver.highlight
                  ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-sm'
                  : 'bg-[var(--background)] border-[var(--border)]'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0',
                driver.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                driver.rank === 2 ? 'bg-slate-300/20 text-slate-400' :
                driver.rank === 3 ? 'bg-orange-400/20 text-orange-400' :
                'bg-[var(--border)] text-[var(--text-muted)]'
              )}>
                {driver.rank === 1 ? '🥇' : driver.rank === 2 ? '🥈' : driver.rank === 3 ? '🥉' : driver.rank}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm font-bold', driver.highlight ? 'text-[var(--primary-dark)]' : 'text-[var(--text-primary)]')}>
                  {driver.name} {driver.highlight && <span className="text-[10px] ml-1 text-[var(--primary)] font-black">← You</span>}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Score: {driver.score}</p>
              </div>
              <p className={cn('text-sm font-black', driver.highlight ? 'text-[var(--primary-dark)]' : 'text-[var(--text-primary)]')}>
                {driver.earnings}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/10 rounded-2xl flex items-start gap-3">
          <Sparkles className="text-[var(--primary-dark)] w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)] italic">
            <span className="font-bold text-[var(--text-primary)] not-italic">GRID Challenge:</span> Reach <span className="text-[var(--primary-dark)] font-bold">score 9.0</span> this week to unlock the "<span className="text-yellow-500 font-bold">Surge Hunter</span>" badge and move to rank #2!
          </p>
        </div>
      </div>
    </div>
  );
}
