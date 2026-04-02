import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Layers, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { getPredictionData } from '../../services/predictionService';
import { PredictionState, Theme } from '../../types';
import MapComponent from '../MapComponent';

export default function HotspotMap() {
  const [data, setData] = useState<PredictionState | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setData(getPredictionData());
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          setTheme(isDarkNow ? 'dark' : 'light');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-end justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Hotspot Map</h1>
          <p className="text-[var(--text-secondary)] mt-1">Geospatial visualization of predicted ride demand across NYC</p>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-[var(--card)] hover:bg-primary/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-[var(--text-primary)] border border-[var(--border)] active:scale-[0.97]"
            style={{ transition: 'background-color 150ms ease-out, border-color 150ms ease-out, transform 100ms ease-out' }}
          >
            <Layers size={16} />
            Layers
          </button>
          <button
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.97]"
            style={{ transition: 'opacity 150ms ease-out, transform 100ms ease-out' }}
          >
            <MapPin size={16} />
            Reset View
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.06, ease: [0.23, 1, 0.32, 1] }}
        className="glass-card relative overflow-hidden group p-1"
      >
        <MapComponent zones={data.zones} theme={theme} height="600px" zoom={14} showYouAreHere />

        {/* Legend Overlay */}
        <div className="absolute bottom-6 right-6 glass-card p-4 border-[var(--border)] z-[1000]">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Demand Intensity</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-danger"></div>
              <span className="text-xs font-medium text-[var(--text-primary)]">Critical (&gt; 3k)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-warning"></div>
              <span className="text-xs font-medium text-[var(--text-primary)]">High (1.5k - 3k)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-xs font-medium text-[var(--text-primary)]">Moderate (&lt; 1.5k)</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: AlertCircle, color: 'danger', bg: 'bg-danger/10', label: 'Top Hotspot', value: 'Midtown Manhattan' },
          { icon: TrendingUp, color: 'primary', bg: 'bg-primary/10', label: 'Growth Area', value: 'Williamsburg' },
          { icon: Activity, color: 'success', bg: 'bg-success/10', label: 'Data Freshness', value: 'Updated 2m ago' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.14 + idx * 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
              <stat.icon className={`text-${stat.color} w-5 h-5`} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">{stat.label}</p>
              <p className="text-sm font-bold text-[var(--text-primary)]">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
