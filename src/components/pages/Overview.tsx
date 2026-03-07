import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Users, Calendar, CloudRain, Activity, DollarSign, Car, Target, ChevronRight, ShieldCheck, Shield, ShieldAlert } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { KPIS, DEMAND_OVER_TIME, BOROUGH_DEMAND, HOURLY_DEMAND } from '../../constants';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-4 rounded-xl shadow-2xl border border-[var(--primary)]/20">
        <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-[var(--primary)]">
          {payload[0].value.toLocaleString()} Rides
        </p>
      </div>
    );
  }
  return null;
};

const ACTIVE_DRIVERS_PREVIEW = [
  { name: 'Alex Thompson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/alex/100/100' },
  { name: 'Sarah Jenkins', borough: 'Brooklyn', tier: 'silver', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { name: 'Michael Chen', borough: 'Queens', tier: 'gold', avatar: 'https://picsum.photos/seed/michael/100/100' },
  { name: 'Elena Rodriguez', borough: 'Bronx', tier: 'bronze', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { name: 'David Wilson', borough: 'Manhattan', tier: 'gold', avatar: 'https://picsum.photos/seed/david/100/100' },
];

export default function Overview() {
  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-6"
      >
        <h1 className="text-3xl font-bold tracking-tight text-gradient mb-2">GRID Cab Dashboard</h1>
        <p className="text-[var(--text-secondary)] text-base font-medium max-w-2xl mx-auto leading-relaxed">
          Real-time ride management and fleet analytics
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
            <span className="w-2 h-2 bg-[var(--success)] rounded-full"></span>
            <span className="text-sm font-semibold text-[var(--success)]">System Online</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span className="text-sm">Updated:</span>
            <span className="text-sm font-semibold">2 min ago</span>
          </div>
        </div>
      </motion.div>

      {/* Professional KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <Car size={20} className="text-[var(--primary)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Active Rides</p>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-1">1,248</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
              <span className="text-[10px] text-[var(--success)] font-medium">+12%</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5 flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--secondary)]/10 flex items-center justify-center">
            <Activity size={20} className="text-[var(--secondary)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Trips Today</p>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-1">8,420</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
              <span className="text-[10px] text-[var(--success)] font-medium">+8%</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--success)]/10 flex items-center justify-center">
            <DollarSign size={20} className="text-[var(--success)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Today's Earnings</p>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-1">$42,150</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
              <span className="text-[10px] text-[var(--success)] font-medium">+15%</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--warning)]/10 flex items-center justify-center">
            <Target size={20} className="text-[var(--warning)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Model Accuracy</p>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-1">94.8%</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[var(--warning)] rounded-full"></span>
              <span className="text-[10px] text-[var(--warning)] font-medium">+2.1%</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Premium KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + idx * 0.1 }}
            className="kpi-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-value">{kpi.value}</div>
                <div className={`kpi-trend ${kpi.trend === 'up' ? 'positive' : 'negative'}`}>
                  {kpi.change} <span className="kpi-trend-text">vs last hour</span>
                </div>
              </div>
              <div className="kpi-icon-container">
                {idx === 0 && <Users className="kpi-icon" />}
                {idx === 1 && <Activity className="kpi-icon" />}
                {idx === 2 && <Calendar className="kpi-icon" />}
                {idx === 3 && <CloudRain className="kpi-icon" />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Professional Demand Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Ride Demand</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">Real-time ride patterns</p>
          </div>
          <div className="flex gap-2">
            {['1W', '1M', '3M', '6M', '1Y'].map(t => (
              <motion.button
                key={t}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all duration-200 ${t === '6M'
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--surface)] hover:bg-[var(--primary)]/10 text-[var(--text-secondary)] hover:text-[var(--primary)] border border-[var(--border)] hover:border-[var(--primary)]/20'
                  }`}
              >
                {t}
              </motion.button>
            ))}
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DEMAND_OVER_TIME}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4B000" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F4B000" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#F4B000"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Professional Two half-width charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Borough Analytics</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Demand by area</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20">
              <Target size={14} className="text-[var(--primary)]" />
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BOROUGH_DEMAND} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                  {BOROUGH_DEMAND.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#F4B000' : '#F4B00040'} stroke={index === 0 ? 'none' : '#F4B000'} strokeWidth={index === 0 ? 0 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Hourly Patterns</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">24-hour cycle</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--secondary)]/10 border border-[var(--secondary)]/20">
              <Activity size={14} className="text-[var(--secondary)]" />
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HOURLY_DEMAND}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  interval={3}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#F4B000"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#F4B000', stroke: 'var(--surface)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Professional Active Drivers Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
              <Users size={18} className="text-[var(--success)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight">Active Drivers</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Real-time driver status</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] text-[10px] font-bold uppercase tracking-wider border border-[var(--success)]/20 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
              5 online
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-light)] flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--primary)]/5 transition-all duration-200 border border-transparent hover:border-[var(--primary)]/20"
          >
            View All Drivers <ChevronRight size={14} />
          </motion.button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {ACTIVE_DRIVERS_PREVIEW.map((driver, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 + idx * 0.1 }}
              className="p-4 rounded-lg bg-[var(--surface)]/50 border border-[var(--border)] hover:border-[var(--primary)]/30 hover:shadow-md hover:shadow-[var(--primary)]/10 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={driver.avatar}
                    alt={driver.name}
                    className="w-10 h-10 rounded-full border-2 border-[var(--border)] group-hover:border-[var(--primary)]/50 transition-all duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--success)] border-2 border-[var(--surface)]"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--primary)] transition-colors">{driver.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-tighter">{driver.borough}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                {driver.tier === 'gold' && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] text-[9px] font-bold uppercase tracking-wider border border-[var(--warning)]/20">
                    <ShieldCheck size={10} /> Gold
                  </span>
                )}
                {driver.tier === 'silver' && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-400/10 text-slate-400 text-[9px] font-bold uppercase tracking-wider border border-slate-400/20">
                    <Shield size={10} /> Silver
                  </span>
                )}
                {driver.tier === 'bronze' && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-700/10 text-orange-700 text-[9px] font-bold uppercase tracking-wider border border-orange-700/20">
                    <ShieldAlert size={10} /> Bronze
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
