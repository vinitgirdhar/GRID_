import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  CloudSun,
  BrainCircuit,
  Map as MapIcon,
  Activity,
  Users,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  User,
  LogOut,
  Moon,
  Sun,
  Navigation,
  Clock,
  LineChart as LineChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Page, UserRole, Theme } from './types';

// Page Components
import Overview from './components/pages/Overview';
import DataInsights from './components/pages/DataInsights';
import WeatherInsights from './components/pages/WeatherInsights';
import DemandPrediction from './components/pages/DemandPrediction';
import ModelPerformance from './components/pages/ModelPerformance';
import Drivers from './components/pages/Drivers';
import DriverOverview from './components/pages/DriverOverview';
import GoForRide from './components/pages/GoForRide';
import DriverPerformance from './components/pages/DriverPerformance';
import Login from './components/Login';
import VoicePilot from './components/VoicePilot';

const ADMIN_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'data-insights', label: 'Data Insights', icon: BarChart3 },
  { id: 'weather-insights', label: 'Weather Insights', icon: CloudSun },
  { id: 'performance', label: 'Model Performance', icon: Activity },
  { id: 'drivers', label: 'Drivers', icon: Users },
] as const;

const DRIVER_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'go-for-ride', label: 'Go For Ride', icon: Navigation },
  { id: 'where-next', label: 'Where should I go next', icon: BrainCircuit },
  { id: 'driver-performance', label: 'Performance', icon: LineChartIcon },
] as const;

function MobileClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="text-sm font-bold">{time}</span>;
}

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activePage, setActivePage] = useState<Page>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Real time: use the current system hour, update every minute
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  
  // Copilot Navigation State
  const [copilotDest, setCopilotDest] = useState<string | null>(null);

  useEffect(() => {
    const handleCopilotNav = (e: any) => {
       const targetZoneId = e.detail.zoneId;
       // For this MVP, we just set it to the generic borough "Manhattan" or let GoForRide lookup the zone.
       // We'll pass it down to GoForRide via props if possible, or just use a global state/search param.
       setCopilotDest(targetZoneId);
       setActivePage('go-for-ride');
    };
    
    window.addEventListener('grid-copilot-navigate', handleCopilotNav);
    return () => window.removeEventListener('grid-copilot-navigate', handleCopilotNav);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // check every minute
    return () => clearInterval(timer);
  }, []);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    setActivePage('overview');
  };

  const handleLogout = () => {
    setUserRole(null);
  };

  if (!userRole) {
    return <Login onLogin={handleLogin} />;
  }

  const sidebarItems = userRole === 'admin' ? ADMIN_ITEMS : DRIVER_ITEMS;

  const renderPage = () => {
    if (userRole === 'admin') {
      switch (activePage) {
        case 'overview': return <Overview />;
        case 'data-insights': return <DataInsights />;
        case 'weather-insights': return <WeatherInsights />;
        case 'performance': return <ModelPerformance />;
        case 'drivers': return <Drivers />;
        default: return <Overview />;
      }
    } else {
      switch (activePage) {
        case 'overview': return <DriverOverview currentHour={currentHour} />;
        case 'go-for-ride': return <GoForRide copilotZoneId={copilotDest} />;
        case 'where-next': return <DemandPrediction />;
        case 'driver-performance': return <DriverPerformance />;
        default: return <DriverOverview currentHour={currentHour} />;
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-sans overflow-hidden relative">
      {/* Clean Background Pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, var(--primary-lighter) 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, var(--secondary) 0%, transparent 50%)`
        }}></div>
      </div>

      {/* Desktop Layout */}
      <div className={cn("w-full min-h-screen", userRole === 'driver' ? "hidden md:flex" : "flex")}>
        {/* Light Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 260 }}
          className="fixed left-0 top-0 h-full bg-[var(--surface)] border-r border-[var(--border)] z-50 flex flex-col shadow-sm"
        >
          <div className="p-6 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-[var(--primary)] rounded-full flex items-center justify-center shadow-sm">
                  <Navigation className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-[var(--text-primary)]">GRID</span>
                </div>
              </motion.div>
            )}
            {isSidebarCollapsed && (
              <div className="w-10 h-10 bg-[var(--primary)] rounded-full flex items-center justify-center shadow-sm mx-auto">
                <Navigation className="w-5 h-5 text-[var(--accent)]" />
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-[var(--secondary)] rounded-full transition-all duration-300 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2 py-6">
            {sidebarItems.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => setActivePage(item.id as Page)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-[16px] transition-all duration-300 group",
                  activePage === item.id
                    ? "bg-[var(--primary)] text-[var(--text-primary)] shadow-sm font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <item.icon size={20} className={cn(
                  "shrink-0 transition-colors duration-300",
                  activePage === item.id ? "text-[var(--text-primary)]" : "group-hover:text-[var(--text-primary)]"
                )} />
                {!isSidebarCollapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </motion.button>
            ))}
          </nav>

          <div className="p-4 border-t border-[var(--border)] flex flex-col gap-3">
            {userRole === 'driver' && !isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2 py-2 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--primary-dark)]" />
                  <MobileClock />
                </div>
                <span className="text-[10px] font-bold text-[var(--success)] uppercase tracking-wider">Live</span>
              </div>
            )}
            {userRole === 'driver' && isSidebarCollapsed && (
              <div className="w-10 h-10 mx-auto rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
                <Clock size={14} className="text-[var(--primary-dark)]" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">System</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 flex items-center justify-center bg-[var(--surface)] shadow-sm hover:shadow-md border border-[var(--border)] rounded-full relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300"
                >
                  <Bell size={14} />
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[var(--danger)] rounded-full border border-[var(--surface)]"></span>
                </motion.button>
              </div>
            )}

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 p-3 rounded-[16px] bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md hover:border-[var(--primary)]/30 transition-all duration-300 cursor-pointer group relative"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center shrink-0 border border-[var(--primary)]/30">
                <User size={18} className="text-[var(--primary-dark)]" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-sm font-bold truncate text-[var(--text-primary)] capitalize">{userRole}</span>
                  <span className="text-xs text-[var(--success)] font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span> Online
                  </span>
                </div>
              )}
              {!isSidebarCollapsed && (
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--danger)', color: 'white' }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-[var(--text-muted)] hover:text-white rounded-full transition-all duration-300 ml-auto"
                >
                  <LogOut size={16} />
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.aside>

        {/* Desktop Main Content */}
        <main
          className={cn(
            "flex-1 transition-all duration-300 min-h-screen flex flex-col relative",
            isSidebarCollapsed ? "ml-[80px]" : "ml-[260px]"
          )}
        >
          <div className="p-8 max-w-7xl mx-auto w-full flex-1 pt-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${userRole}-${activePage}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Driver Mobile-First UI (Reference Image Style) */}
      {userRole === 'driver' && (
        <main className="md:hidden flex-1 min-h-screen relative bg-[var(--background)] flex flex-col w-full h-full">
          {/* Floating Top Elements */}
          <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-40 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto shadow-md bg-white rounded-full p-1 pl-4 pr-1">
              <MobileClock />
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Search size={16} className="text-[var(--accent)]" />
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-full shadow-md pointer-events-auto">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center"><Navigation size={10} className="text-white" /></div>
                <span className="text-xs font-bold text-[var(--text-primary)]">120</span>
              </div>
              <div className="w-px h-4 bg-[var(--border)]"></div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-[var(--success)] flex items-center justify-center"><Activity size={10} className="text-white" /></div>
                <span className="text-xs font-bold text-[var(--text-primary)]">98%</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full h-full pt-20 pb-28 overflow-y-auto px-4 z-10 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${userRole}-${activePage}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Floating Pill Bottom Navigation */}
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="nav-pill pointer-events-auto">
              {DRIVER_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className={cn("nav-pill-item text-[var(--text-secondary)]", activePage === item.id && 'active text-white bg-[var(--primary)]')}
                  onClick={() => setActivePage(item.id)}
                  title={item.label}
                >
                  <item.icon
                    size={20}
                    strokeWidth={activePage === item.id ? 2.5 : 2}
                    className="transition-all"
                  />
                </div>
              ))}

              <div className="w-10 h-10 ml-2 rounded-full border-2 border-[var(--primary)] overflow-hidden cursor-pointer" onClick={handleLogout}>
                <img src="https://picsum.photos/seed/driver/100/100" alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Voice Pilot — rendered for driver on ALL screen sizes */}
      {userRole === 'driver' && <VoicePilot />}
    </div>
  );
}
