import React, { useState } from 'react';
import { Search, Star, MapPin, TrendingUp, ShieldCheck, ShieldAlert, Shield, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

type DriverStatus = 'online' | 'driving' | 'offline';
type DriverTier = 'gold' | 'silver' | 'bronze';

interface Driver {
  id: string;
  name: string;
  avatar: string;
  status: DriverStatus;
  borough: string;
  rating: number;
  trips: number;
  earnings: number;
  tier: DriverTier;
}

const MOCK_DRIVERS: Driver[] = [
  {
    id: '1',
    name: 'Alex Thompson',
    avatar: 'https://picsum.photos/seed/alex/100/100',
    status: 'driving',
    borough: 'Manhattan',
    rating: 4.9,
    trips: 1240,
    earnings: 4520,
    tier: 'gold'
  },
  {
    id: '2',
    name: 'Sarah Jenkins',
    avatar: 'https://picsum.photos/seed/sarah/100/100',
    status: 'online',
    borough: 'Brooklyn',
    rating: 4.8,
    trips: 850,
    earnings: 3100,
    tier: 'silver'
  },
  {
    id: '3',
    name: 'Michael Chen',
    avatar: 'https://picsum.photos/seed/michael/100/100',
    status: 'driving',
    borough: 'Queens',
    rating: 4.7,
    trips: 2100,
    earnings: 7800,
    tier: 'gold'
  },
  {
    id: '4',
    name: 'Elena Rodriguez',
    avatar: 'https://picsum.photos/seed/elena/100/100',
    status: 'offline',
    borough: 'Bronx',
    rating: 4.6,
    trips: 420,
    earnings: 1200,
    tier: 'bronze'
  },
  {
    id: '5',
    name: 'David Wilson',
    avatar: 'https://picsum.photos/seed/david/100/100',
    status: 'online',
    borough: 'Manhattan',
    rating: 4.9,
    trips: 1560,
    earnings: 5900,
    tier: 'gold'
  },
  {
    id: '6',
    name: 'Lisa Park',
    avatar: 'https://picsum.photos/seed/lisa/100/100',
    status: 'driving',
    borough: 'Brooklyn',
    rating: 4.8,
    trips: 980,
    earnings: 3400,
    tier: 'silver'
  },
  {
    id: '7',
    name: 'James Miller',
    avatar: 'https://picsum.photos/seed/james/100/100',
    status: 'offline',
    borough: 'Staten Island',
    rating: 4.5,
    trips: 310,
    earnings: 950,
    tier: 'bronze'
  }
];

export default function Drivers() {
  const [filter, setFilter] = useState<'all' | DriverStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDrivers = MOCK_DRIVERS.filter(driver => {
    const matchesFilter = filter === 'all' || driver.status === filter;
    const matchesSearch = driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.borough.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case 'online': return 'bg-success';
      case 'driving': return 'bg-primary';
      case 'offline': return 'bg-[var(--text-secondary)]';
    }
  };

  const getTierBadge = (tier: DriverTier) => {
    switch (tier) {
      case 'gold': return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-bold uppercase tracking-wider border border-warning/20">
          <ShieldCheck size={10} /> Gold
        </span>
      );
      case 'silver': return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-400/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-400/20">
          <Shield size={10} /> Silver
        </span>
      );
      case 'bronze': return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-700/10 text-orange-700 text-[10px] font-bold uppercase tracking-wider border border-orange-700/20">
          <ShieldAlert size={10} /> Bronze
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Fleet Management</h1>
          <p className="text-[var(--text-secondary)] mt-1">Monitor and manage your active driver network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 flex">
            {(['all', 'online', 'driving', 'offline'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wider",
                  filter === t
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-[var(--text-secondary)] hover:text-primary hover:bg-primary/5"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Drivers Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...MOCK_DRIVERS]
          .sort((a, b) => b.earnings - a.earnings)
          .slice(0, 3)
          .map((driver, index) => (
            <motion.div
              key={`top-${driver.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-2xl p-6 border transition-all hover:-translate-y-1",
                index === 0 ? "bg-gradient-to-br from-[#facc15]/20 to-[#eab308]/5 border-[#facc15]/30 shadow-[0_8px_30px_rgba(250,204,21,0.15)]" : "glass-card hover:border-primary/20",
                index === 1 ? "md:mt-4" : "",
                index === 2 ? "md:mt-8" : ""
              )}
            >
              {index === 0 && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#facc15]/10 rounded-full blur-2xl -mr-10 -mt-10" />
              )}

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                  index === 0 ? "bg-[#facc15] text-white shadow-lg shadow-[#facc15]/40" :
                    index === 1 ? "bg-slate-300 text-slate-700 shadow-md shadow-slate-300/40" :
                      "bg-orange-300 text-orange-900 shadow-md shadow-orange-300/40"
                )}>
                  {index === 0 ? <Trophy size={20} /> : `#${index + 1}`}
                </div>
                {getTierBadge(driver.tier)}
              </div>

              <div className="flex items-center gap-4 mb-6 relative z-10">
                <img src={driver.avatar} alt={driver.name} className="w-16 h-16 rounded-full border-4 border-[var(--background)] shadow-lg" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{driver.name}</h3>
                  <p className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {driver.borough}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-[var(--background)]/50 p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Ratings</p>
                  <p className="text-sm font-black text-[var(--text-primary)] flex items-center gap-1">
                    {driver.rating} <Star size={12} className="text-[#facc15] fill-[#facc15]" />
                  </p>
                </div>
                <div className="bg-[var(--background)]/50 p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Earnings</p>
                  <p className="text-sm font-black text-[#eab308]">${driver.earnings.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          ))}
      </div>

      <div className="glass-card overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--card)]/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or borough..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]/30">
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Driver</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Rating</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Trips</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Earnings</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest text-right">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              <AnimatePresence>
                {filteredDrivers.map((driver) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={driver.id}
                    className="hover:bg-primary/5 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={driver.avatar}
                            alt={driver.name}
                            className="w-10 h-10 rounded-full border-2 border-[var(--border)] group-hover:border-primary/30 transition-colors"
                            referrerPolicy="no-referrer"
                          />
                          <span className={cn(
                            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--card)]",
                            getStatusColor(driver.status)
                          )}></span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{driver.name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tighter">{driver.status}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <MapPin size={14} className="text-primary" />
                        <span className="text-sm font-medium">{driver.borough}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-warning fill-warning" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">{driver.rating}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{driver.trips.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-success" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">${driver.earnings.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        {getTierBadge(driver.tier)}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredDrivers.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[var(--text-secondary)] font-medium">No drivers found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
