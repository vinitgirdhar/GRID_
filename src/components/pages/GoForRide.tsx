import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Navigation,
  DollarSign,
  Clock,
  CloudRain,
  Zap,
  Filter,
  ChevronRight,
  Compass,
  ArrowRight,
  Info
} from 'lucide-react';
import { RIDE_REQUESTS } from '../../constants';
import { cn } from '../../lib/utils';

export default function GoForRide() {
  const [filter, setFilter] = useState({
    direction: 'All',
    borough: 'All',
    minFare: 0,
    maxDistance: 50
  });

  const filteredRides = RIDE_REQUESTS.filter(ride => {
    if (filter.direction !== 'All' && ride.direction !== filter.direction) return false;
    if (filter.borough !== 'All' && ride.borough !== filter.borough) return false;
    if (ride.fare < filter.minFare) return false;
    const dist = parseFloat(ride.distance);
    if (dist > filter.maxDistance) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Go For Ride</h1>
          <p className="text-[var(--text-secondary)] mt-1">Available ride requests tailored to your preferences.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-success bg-success/10 px-4 py-2 rounded-full">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          Live Feed Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters Panel */}
        <div className="lg:col-span-4">
          <div className="glass-card p-6 sticky top-24 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="text-primary w-5 h-5" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Route Filters</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Preferred Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  {['All', 'North', 'South', 'East', 'West'].map(dir => (
                    <button
                      key={dir}
                      onClick={() => setFilter({ ...filter, direction: dir })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                        filter.direction === dir
                          ? "bg-primary text-white border-primary"
                          : "bg-[var(--background)] text-[var(--text-secondary)] border-[var(--border)] hover:border-primary/50"
                      )}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Preferred Borough</label>
                <select
                  value={filter.borough}
                  onChange={(e) => setFilter({ ...filter, borough: e.target.value })}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary/50"
                >
                  <option>All</option>
                  <option>Manhattan</option>
                  <option>Brooklyn</option>
                  <option>Queens</option>
                  <option>Bronx</option>
                  <option>Staten Island</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Min Fare</label>
                  <span className="text-xs font-bold text-primary">${filter.minFare}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={filter.minFare}
                  onChange={(e) => setFilter({ ...filter, minFare: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Max Distance</label>
                  <span className="text-xs font-bold text-primary">{filter.maxDistance} mi</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={filter.maxDistance}
                  onChange={(e) => setFilter({ ...filter, maxDistance: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <button
              onClick={() => setFilter({ direction: 'All', borough: 'All', minFare: 0, maxDistance: 50 })}
              className="w-full py-3 text-xs font-bold text-[var(--text-secondary)] hover:text-primary transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        </div>

        {/* Ride Requests Feed */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredRides.length > 0 ? (
              filteredRides.map((ride, idx) => (
                <motion.div
                  key={ride.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="glass-card p-6 group hover:border-primary/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <p className="text-sm font-bold text-[var(--text-primary)]">{ride.pickup}</p>
                          </div>
                          <div className="w-[1px] h-4 bg-[var(--border)] ml-1"></div>
                          <div className="flex items-center gap-3">
                            <MapPin size={14} className="text-danger" />
                            <p className="text-sm font-bold text-[var(--text-primary)]">{ride.drop}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary">${ride.fare.toFixed(2)}</p>
                          <p className="text-xs text-[var(--text-secondary)] font-medium">{ride.distance}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Navigation size={14} className="text-primary" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.traffic} Traffic</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <CloudRain size={14} className="text-secondary" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.weather}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Zap size={14} className="text-warning" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Impact: {ride.eventScore}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                          <Compass size={14} className="text-success" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{ride.direction}</span>
                        </div>
                      </div>

                      <div className={cn(
                        "p-4 rounded-2xl border flex items-start gap-4",
                        ride.recommendation === 'ACCEPT' ? "bg-success/5 border-success/20" :
                          ride.recommendation === 'CONSIDER' ? "bg-warning/5 border-warning/20" :
                            "bg-danger/5 border-danger/20"
                      )}>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                          ride.recommendation === 'ACCEPT' ? "bg-success text-white" :
                            ride.recommendation === 'CONSIDER' ? "bg-warning text-white" :
                              "bg-danger text-white"
                        )}>
                          {ride.recommendation}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                            <Info size={12} /> AI Reasoning
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                            “{ride.reasoning}”
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col justify-center gap-3">
                      <button className="flex-1 md:flex-none w-full md:w-32 py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group-hover:scale-105">
                        Accept
                        <ArrowRight size={16} />
                      </button>
                      <button className="flex-1 md:flex-none w-full md:w-32 py-4 bg-[var(--background)] border border-[var(--border)] hover:bg-danger/10 hover:border-danger/30 text-[var(--text-secondary)] hover:text-danger font-bold rounded-2xl transition-all">
                        Decline
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="glass-card p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--background)] rounded-full flex items-center justify-center mx-auto">
                  <Filter className="text-[var(--text-secondary)] opacity-30" size={32} />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">No rides match your filters</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">Try adjusting your direction or minimum fare to see more requests.</p>
                <button
                  onClick={() => setFilter({ direction: 'All', borough: 'All', minFare: 0, maxDistance: 50 })}
                  className="text-primary font-bold text-sm hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
