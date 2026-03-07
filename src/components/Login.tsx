import React from 'react';
import { motion } from 'motion/react';
import { Navigation, Shield, BarChart3, Car } from 'lucide-react';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Logo = () => (
  <div className="relative w-20 h-20 flex items-center justify-center">
    {/* Glow behind logo */}
    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />

    <svg viewBox="0 0 100 100" className="w-full h-full relative z-10">
      {/* Skyline Silhouette */}
      <path
        d="M10 80 L10 60 L20 60 L20 40 L30 40 L30 20 L40 20 L40 10 L50 10 L50 20 L60 20 L60 40 L70 40 L70 60 L80 60 L80 80 Z"
        fill="currentColor"
        className="text-primary/20"
      />
      {/* Empire State Style Center */}
      <rect x="44" y="15" width="12" height="65" fill="currentColor" className="text-primary/40" />
      <rect x="48" y="5" width="4" height="15" fill="currentColor" className="text-primary" />

      {/* Taxi Icon Hint */}
      <rect x="30" y="70" width="40" height="15" rx="2" fill="#FACC15" />
      <rect x="35" y="65" width="30" height="10" rx="2" fill="#FACC15" />
      <rect x="45" y="62" width="10" height="3" fill="black" /> {/* Taxi Light */}

      {/* Grid Lines / AI Hint */}
      <line x1="10" y1="80" x2="90" y2="80" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
      <line x1="20" y1="10" x2="20" y2="90" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-primary/30" />
      <line x1="80" y1="10" x2="80" y2="90" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-primary/30" />
    </svg>
  </div>
);

const BackgroundDecorations = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Grid Pattern */}
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
      style={{
        backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }}
    />

    {/* Skyline Silhouette (Bottom) */}
    <div className="absolute bottom-0 left-0 right-0 h-64 opacity-10 dark:opacity-20 blur-sm">
      <svg viewBox="0 0 1200 200" className="w-full h-full preserve-aspect-none">
        <path d="M0 200 V150 L50 150 V100 L100 100 V160 L150 160 V80 L200 80 V140 L250 140 V40 L300 40 V120 L350 120 V170 L400 170 V60 L450 60 V130 L500 130 V20 L550 20 V150 L600 150 V90 L650 90 V140 L700 140 V50 L750 50 V110 L800 110 V160 L850 160 V70 L900 70 V130 L950 130 V30 L1000 30 V140 L1050 140 V180 L1100 180 V90 L1150 90 V160 L1200 160 V200 Z" fill="currentColor" className="text-[var(--text-secondary)]" />
      </svg>
    </div>

    {/* Floating Taxi Outlines */}
    <motion.div
      animate={{
        x: [0, 100, 0],
        y: [0, -20, 0],
        rotate: [0, 5, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/4 left-1/4 opacity-5 dark:opacity-10"
    >
      <Car size={120} strokeWidth={0.5} className="text-[var(--text-secondary)]" />
    </motion.div>

    <motion.div
      animate={{
        x: [0, -150, 0],
        y: [0, 30, 0],
        rotate: [0, -10, 0]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-1/4 right-1/4 opacity-5 dark:opacity-10"
    >
      <Car size={160} strokeWidth={0.5} className="text-[var(--text-secondary)]" />
    </motion.div>

    {/* Moving Light Lines */}
    <motion.div
      animate={{ x: ['-100%', '200%'] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/3 left-0 w-64 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
    />
    <motion.div
      animate={{ x: ['200%', '-100%'] }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-1/3 left-0 w-96 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"
    />

    {/* Soft Glow behind center card */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 dark:bg-primary/10 blur-[120px] rounded-full" />
  </div>
);

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6 relative overflow-hidden">
      {/* Clean Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, var(--primary) 0%, transparent 50%), 
                           radial-gradient(circle at 80% 70%, var(--secondary) 0%, transparent 50%)`
        }}></div>
      </div>

      <BackgroundDecorations />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-card p-10 max-w-xl w-full text-center space-y-8 relative z-10"
      >
        <div className="space-y-5 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="animate-float"
          >
            <Logo />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-3"
          >
            <h1 className="text-5xl font-bold tracking-tight text-gradient">GRID</h1>
            <p className="text-[var(--text-secondary)] font-medium tracking-wide uppercase text-sm leading-relaxed max-w-sm mx-auto">
              Smart Cab Booking Platform
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse-soft"></span>
              <span className="text-xs text-[var(--text-muted)] font-medium">Ready to Ride</span>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onLogin('driver')}
            className="group relative flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all duration-200 text-center overflow-hidden shadow-sm hover:shadow-md"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
              className="w-14 h-14 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center group-hover:bg-[var(--primary)] transition-all duration-200"
            >
              <Navigation size={24} className="text-[var(--primary)] group-hover:text-white transition-colors duration-200" />
            </motion.div>
            <div className="space-y-2">
              <p className="font-semibold text-lg text-[var(--text-primary)] tracking-tight group-hover:text-[var(--primary)] transition-colors duration-200">Driver Mode</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Start accepting ride requests
              </p>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onLogin('admin')}
            className="group relative flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--secondary)] hover:bg-[var(--secondary)]/5 transition-all duration-200 text-center overflow-hidden shadow-sm hover:shadow-md"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              transition={{ duration: 0.2 }}
              className="w-14 h-14 rounded-lg bg-[var(--secondary)]/10 flex items-center justify-center group-hover:bg-[var(--secondary)] transition-all duration-200"
            >
              <BarChart3 size={24} className="text-[var(--secondary)] group-hover:text-white transition-colors duration-200" />
            </motion.div>
            <div className="space-y-2">
              <p className="font-semibold text-lg text-[var(--text-primary)] tracking-tight group-hover:text-[var(--secondary)] transition-colors duration-200">Admin Mode</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Manage fleet and analytics
              </p>
            </div>
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="pt-6 border-t border-[var(--border)] space-y-3"
        >
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-medium tracking-[0.2em] leading-relaxed">
            Smart Transportation for Modern Cities
          </p>
          <div className="flex items-center justify-center gap-4 text-[9px] text-[var(--text-muted)] font-medium">
            <span>v2.0</span>
            <span>•</span>
            <span>24/7 Service</span>
            <span>•</span>
            <span>Live Tracking</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
