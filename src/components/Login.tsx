import React from 'react';
import { motion } from 'motion/react';
import { Navigation, BarChart3, Shield, Zap, Globe, TrendingUp, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

/* ─── Animated grid background for the branding panel ─── */
const GridBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Base dark gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#0f172a]" />

    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: `linear-gradient(rgba(250,204,21,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,0.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }}
    />

    {/* Animated glowing routes */}
    <motion.div
      animate={{ opacity: [0.15, 0.35, 0.15] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[20%] left-[10%] w-[80%] h-[60%]"
    >
      <svg viewBox="0 0 400 300" className="w-full h-full" fill="none">
        <motion.path
          d="M 50 250 Q 100 100 200 150 T 350 80"
          stroke="rgba(250,204,21,0.3)"
          strokeWidth="2"
          strokeDasharray="8 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M 30 80 Q 150 200 250 120 T 380 200"
          stroke="rgba(250,204,21,0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 4, delay: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M 100 30 C 180 100 220 200 350 150"
          stroke="rgba(250,204,21,0.15)"
          strokeWidth="1"
          strokeDasharray="4 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 5, delay: 2, repeat: Infinity, ease: "linear" }}
        />
        {/* Glow nodes at intersections */}
        <motion.circle
          cx="200" cy="150" r="4"
          fill="rgba(250,204,21,0.5)"
          animate={{ r: [3, 6, 3], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.circle
          cx="100" cy="80" r="3"
          fill="rgba(250,204,21,0.4)"
          animate={{ r: [2, 5, 2], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, delay: 0.5, repeat: Infinity }}
        />
        <motion.circle
          cx="320" cy="120" r="3"
          fill="rgba(250,204,21,0.4)"
          animate={{ r: [2, 5, 2], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, delay: 1, repeat: Infinity }}
        />
      </svg>
    </motion.div>

    {/* Radial glow from center */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#facc15]/5 blur-[120px] rounded-full" />
  </div>
);

/* ─── Feature pill ─── */
const FeaturePill = ({ icon: Icon, text, delay }: { icon: React.ElementType; text: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm"
  >
    <Icon size={14} className="text-[#facc15]" />
    <span className="text-xs font-medium text-white/70">{text}</span>
  </motion.div>
);

/* ─── Main Login Component ─── */
export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ═══ Left Panel — Branding ═══ */}
      <div className="relative flex-1 lg:flex-[3] flex flex-col justify-between p-8 lg:p-16 overflow-hidden min-h-[40vh] lg:min-h-screen">
        <GridBackground />

        {/* Logo + tagline */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-[#facc15] rounded-xl flex items-center justify-center shadow-lg shadow-[#facc15]/20">
              <Navigation size={20} className="text-[#0f172a]" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">GRID</span>
          </motion.div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 my-auto py-12 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="space-y-6 max-w-lg"
          >
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              The Operating System for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#facc15] to-[#fbbf24]">
                Modern Mobility
              </span>
            </h1>
            <p className="text-base lg:text-lg text-white/50 leading-relaxed max-w-md">
              Command your fleet. Empower your drivers. Predict demand before it happens with AI-powered intelligence.
            </p>
          </motion.div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 mt-8">
            <FeaturePill icon={Globe} text="Live Fleet Tracking" delay={0.5} />
            <FeaturePill icon={TrendingUp} text="Demand Prediction" delay={0.6} />
            <FeaturePill icon={Shield} text="Enterprise Security" delay={0.7} />
            <FeaturePill icon={Zap} text="Real-time Analytics" delay={0.8} />
          </div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="relative z-10 flex items-center gap-8 text-white/30 text-xs font-medium"
        >
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white/80">1.2M+</span>
            <span>Rides Managed</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white/80">99.9%</span>
            <span>Uptime SLA</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white/80">24/7</span>
            <span>Live Support</span>
          </div>
        </motion.div>
      </div>

      {/* ═══ Right Panel — Access ═══ */}
      <div className="flex-1 lg:flex-[2] bg-[var(--background)] flex items-center justify-center p-8 lg:p-16 relative">
        {/* Subtle top-right pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 blur-[100px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-md space-y-10 relative z-10"
        >
          {/* Welcome text */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Welcome back</h2>
            <p className="text-[var(--text-secondary)] text-sm">Select your role to continue to the dashboard.</p>
          </div>

          {/* Role cards */}
          <div className="space-y-4">
            {/* Driver Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onLogin('driver')}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--primary)] transition-all duration-300">
                <Navigation size={22} className="text-[var(--primary)] group-hover:text-[#0f172a] transition-colors duration-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)] text-base group-hover:text-[var(--primary-dark)] transition-colors">Driver Mode</p>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">Start accepting ride requests</p>
              </div>
              <ArrowRight size={18} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all duration-300" />
            </motion.button>

            {/* Admin Card */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onLogin('admin')}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--primary)] transition-all duration-300">
                <BarChart3 size={22} className="text-[var(--primary)] group-hover:text-[#0f172a] transition-colors duration-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)] text-base group-hover:text-[var(--primary-dark)] transition-colors">Admin Mode</p>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage fleet and analytics</p>
              </div>
              <ArrowRight size={18} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all duration-300" />
            </motion.button>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="pt-6 border-t border-[var(--border)] flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
              <span className="text-xs text-[var(--text-muted)] font-medium">All systems operational</span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">v2.0</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
