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
  const [destinationModeActive, setDestinationModeActive] = useState(false);
  const [destination, setDestination] = useState('');

  const filteredRides = RIDE_REQUESTS.filter(ride => {
    if (!destinationModeActive || !destination.trim()) return true;

    // Map common terms to boroughs for demo purposes
    let search = destination.toLowerCase();
    if (search === 'home') search = 'brooklyn';
    if (search === 'jfk' || search === 'airport') search = 'queens';

    return (
      ride.drop.toLowerCase().includes(search) ||
      ride.borough.toLowerCase().includes(search)
    );
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
        {/* Destination Mode Panel */}
        <div className="lg:col-span-4">
          <div className={cn(
            "p-6 rounded-2xl border transition-all duration-300 sticky top-24",
            destinationModeActive
              ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-[0_0_30px_rgba(250,204,21,0.1)]"
              : "glass-card hover:border-[var(--primary)]/20"
          )}>
            <div className="flex items-start gap-4 mb-6">
              <div className={cn(
                "p-3 rounded-xl transition-colors",
                destinationModeActive ? "bg-[var(--primary)] text-[#0f172a]" : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]"
              )}>
                <Compass size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Destination Mode</h2>
                <p className="text-sm text-[var(--text-secondary)] leading-tight mt-1">
                  Only receive requests heading towards your destination or along the same route.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3 relative">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider pl-1">Set Destination</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="e.g. Home, Brooklyn..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    disabled={destinationModeActive}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Quick Destinations */}
                {!destinationModeActive && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setDestination('Home')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => setDestination('Airport')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Airport
                    </button>
                    <button
                      onClick={() => setDestination('Manhattan')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Downtown
                    </button>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDestinationModeActive(!destinationModeActive)}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2",
                  destinationModeActive
                    ? "bg-danger hover:bg-danger/90 text-white shadow-danger/20"
                    : "bg-[var(--text-primary)] hover:bg-[var(--text-primary)]/90 text-[var(--background)] shadow-[var(--border)]"
                )}
              >
                {destinationModeActive ? (
                  <>Stop Destination Mode</>
                ) : (
                  <>Activate Destination Mode <ArrowRight size={16} /></>
                )}
              </motion.button>
            </div>
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
                <h3 className="text-lg font-bold text-[var(--text-primary)]">No rides heading there just yet</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">We'll alert you the moment a ride request matches your destination area.</p>
                <button
                  onClick={() => setDestinationModeActive(false)}
                  className="text-primary font-bold text-sm hover:underline"
                >
                  Cancel Destination Mode
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
