import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudSun,
  LayoutDashboard,
  LineChart as LineChartIcon,
  LogOut,
  TrendingDown,
  Navigation,
  Search,
  ShieldAlert,
  User,
  Users,
  Wifi,
} from 'lucide-react';
import { motion } from 'motion/react';

import OfflineBanner from './components/OfflineBanner';
import DrowsinessMonitor from './components/DrowsinessMonitor';
import LiveDrowsinessCamera from './components/LiveDrowsinessCamera';
import Login from './components/Login';
import SafetyZen from './components/SafetyZen';
import VoicePilot from './components/VoicePilot';
import DataInsights from './components/pages/DataInsights';
import DemandPrediction from './components/pages/DemandPrediction';
import DriverOverview from './components/pages/DriverOverview';
import DriverPerformance from './components/pages/DriverPerformance';
import Drivers from './components/pages/Drivers';
import GoForRide from './components/pages/GoForRide';
import MissedOpportunities from './components/pages/MissedOpportunities';
import ModelPerformance from './components/pages/ModelPerformance';
import Overview from './components/pages/Overview';
import Profile from './components/pages/Profile';
import WeatherInsights from './components/pages/WeatherInsights';
import { OfflineProvider, useOffline } from './OfflineContext';
import { cn } from './lib/utils';
import { Driver, Page, UserRole } from './types';
import {
  getAll,
  startBackgroundScanner,
  subscribe,
} from './services/opportunityService';
import {
  logoutDriver,
  postDriverSession as syncDriverSession,
  updateDriverStatus,
} from './services/apiService';

function postDriverStatus(driverId: string, status: 'online' | 'offline') {
  updateDriverStatus(driverId, status).catch(() => {});
}

function postDriverSession(payload: { is_live: boolean }): Promise<void> {
  return syncDriverSession(payload).then(() => {}).catch(() => {});
}


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
  { id: 'drowsiness-camera', label: 'Drowsiness Camera', icon: ShieldAlert },
  { id: 'driver-performance', label: 'Performance', icon: LineChartIcon },
  { id: 'missed-opportunities', label: 'Missed Opportunities', icon: TrendingDown },
] as const;

function MobileClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <span className="text-sm font-bold">{time}</span>;
}

function AppShell() {
  const { isOnline, isSyncing, pendingCount } = useOffline();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [selectedDriverProfile, setSelectedDriverProfile] = useState<Driver | null>(null);
  const currentDriverRef = useRef<Driver | null>(null);
  const [activePage, setActivePage] = useState<Page>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [copilotDest, setCopilotDest] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [missedCount, setMissedCount] = useState(0);
  // Start opportunity scanner + subscribe to count changes when driver is logged in
  useEffect(() => {
    if (userRole !== 'driver') return;
    const update = () => setMissedCount(getAll().filter((o) => o.resolved).length);
    update();
    const stopScanner = startBackgroundScanner();
    const unsub = subscribe(update);
    return () => { stopScanner(); unsub(); };
  }, [userRole]);

  // Keep ref in sync so event handlers always see the latest driver
  useEffect(() => {
    currentDriverRef.current = currentDriver;
  }, [currentDriver]);

  useEffect(() => {
    const handleCopilotNav = (e: any) => {
      const targetZoneId = e.detail.zoneId;
      setCopilotDest(targetZoneId);
      setActivePage('go-for-ride');
    };

    const handlePageNavigation = (e: any) => {
      if (e.detail?.page) {
        setActivePage(e.detail.page);
      }
    };

    const handleDriverSessionToggle = (e: any) => {
      if (typeof e.detail?.isLive === 'boolean') {
        setIsLive(e.detail.isLive);
        const driver = currentDriverRef.current;
        if (driver) {
          postDriverStatus(driver.id, e.detail.isLive ? 'online' : 'offline');
        }
      }

      if (e.detail?.page) {
        setActivePage(e.detail.page);
      }
    };

    window.addEventListener('grid-copilot-navigate', handleCopilotNav);
    window.addEventListener('grid-navigate-page', handlePageNavigation);
    window.addEventListener('grid-driver-session-toggle', handleDriverSessionToggle);

    return () => {
      window.removeEventListener('grid-copilot-navigate', handleCopilotNav);
      window.removeEventListener('grid-navigate-page', handlePageNavigation);
      window.removeEventListener('grid-driver-session-toggle', handleDriverSessionToggle);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const handleLogin = (role: UserRole, driver?: Driver) => {
    setUserRole(role);
    setCurrentDriver(role === 'driver' ? driver ?? null : null);
    setSelectedDriverProfile(null);
    if (driver) {
      postDriverStatus(driver.id, 'online');
      // Reset the wellness heart timer so this driver starts from zero
      postDriverSession({ is_live: false }).catch(() => {});
    }
    setIsLive(false);
    setActivePage('overview');
  };

  const handleLogout = () => {
    const driver = currentDriverRef.current;
    if (driver) {
      logoutDriver(driver.id).catch(() => {});
    }
    // Reset wellness session so next login always starts fresh
    postDriverSession({ is_live: false }).catch(() => {});
    setIsLive(false);
    setUserRole(null);
    setCurrentDriver(null);
    setSelectedDriverProfile(null);
  };

  const connectivityLabel = isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline';
  const connectivityDotClass = isSyncing
    ? 'bg-sky-500 animate-pulse'
    : isOnline
      ? 'bg-[var(--success)]'
      : 'bg-[var(--warning)]';
  const connectivityTextClass = isSyncing
    ? 'text-sky-600'
    : isOnline
      ? 'text-[var(--success)]'
      : 'text-[var(--warning)]';

  if (!userRole) {
    return (
      <>
        <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  const sidebarItems = userRole === 'admin' ? ADMIN_ITEMS : DRIVER_ITEMS;
  const isSidebarItemActive = (itemId: string) =>
    activePage === itemId || (userRole === 'admin' && activePage === 'profile' && itemId === 'drivers');

  const renderPage = () => {
    if (userRole === 'admin') {
      switch (activePage) {
        case 'overview':
          return <Overview />;
        case 'data-insights':
          return <DataInsights />;
        case 'weather-insights':
          return <WeatherInsights />;
        case 'performance':
          return <ModelPerformance />;
        case 'drivers':
          return (
            <Drivers
              onSelectDriver={(driver) => {
                setSelectedDriverProfile(driver);
                setActivePage('profile');
              }}
            />
          );
        case 'profile':
          return <Profile driver={selectedDriverProfile} viewerRole="admin" onBack={() => setActivePage('drivers')} />;
        default:
          return <Overview />;
      }
    }

    switch (activePage) {
      case 'overview':
        return <DriverOverview currentHour={currentHour} isLive={isLive} setIsLive={setIsLive} />;
      case 'go-for-ride':
        return <GoForRide copilotZoneId={copilotDest} />;
      case 'profile':
        return (
          <Profile
            driver={currentDriver}
            viewerRole="driver"
            onSave={(updates) => {
              setCurrentDriver((prev) => (prev ? { ...prev, ...updates } : prev));
            }}
          />
        );
      case 'drowsiness-camera':
        return <LiveDrowsinessCamera isLive={Boolean(isLive)} onGoLive={() => {
          setIsLive(true);
          postDriverSession({ is_live: true }).catch(() => {});
          const driver = currentDriverRef.current;
          if (driver) postDriverStatus(driver.id, 'online');
        }} />;
      case 'where-next':
        return <DemandPrediction />;
      case 'missed-opportunities':
        return <MissedOpportunities />;
      case 'driver-performance':
        return <DriverPerformance />;
      default:
        return <DriverOverview currentHour={currentHour} isLive={isLive} setIsLive={setIsLive} />;
    }
  };

  return (
    <>
      <OfflineBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        topClassName={userRole === 'driver' ? 'top-20 lg:top-4' : 'top-4'}
      />

      <div className="flex min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-sans overflow-hidden relative">
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, var(--primary-lighter) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, var(--secondary) 0%, transparent 50%)`,
            }}
          ></div>
        </div>

        <motion.aside
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 260 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            'fixed left-0 top-0 h-full bg-[var(--surface)] border-r border-[var(--border)] z-50 flex-col shadow-sm',
            userRole === 'driver' ? 'hidden lg:flex' : 'flex',
          )}
        >
          {/* Sidebar header — layout changes when collapsed */}
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2 pt-5 pb-3 px-3">
              <img src="/grid-logo.png" alt="GRID" className="h-10 w-auto object-contain max-w-[56px]" />
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 hover:bg-[var(--secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ transition: 'background-color 150ms ease-out, color 150ms ease-out' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="p-6 flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <img src="/grid-logo.png" alt="GRID" className="h-14 w-auto object-contain" />
              </motion.div>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-2 hover:bg-[var(--secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ transition: 'background-color 150ms ease-out, color 150ms ease-out' }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}

          <nav className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2 py-6 relative">
            {/* Sliding background indicator */}
            <motion.div
              className="absolute left-4 right-4 h-[46px] top-6 rounded-[16px] bg-[var(--primary)] pointer-events-none"
              animate={{
                y: sidebarItems.findIndex((item) => isSidebarItemActive(item.id)) * 52,
              }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            />
            {sidebarItems.map((item, index) => {
              const isActive = isSidebarItemActive(item.id);

              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActivePage(item.id as Page)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03, ease: [0.23, 1, 0.32, 1] }}
                  className={cn(
                    'w-full relative z-10 flex items-center gap-4 px-4 py-3 rounded-[16px] group',
                    'transition-colors duration-150 ease-out',
                    isActive
                      ? 'text-[var(--text-primary)] shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <div className="relative shrink-0">
                    <item.icon
                      size={20}
                      className={cn(
                        'transition-colors duration-300',
                        isActive ? 'text-[var(--text-primary)]' : 'group-hover:text-[var(--text-primary)]',
                      )}
                    />
                    {isSidebarCollapsed && userRole === 'driver' && item.id === 'overview' && missedCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger border-2 border-[var(--surface)]" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <>
                      <span className="font-medium text-sm truncate">{item.label}</span>
                      {userRole === 'driver' && item.id === 'overview' && missedCount > 0 && (
                        <span className="ml-auto min-w-[1.1rem] h-[1.1rem] rounded-full bg-danger text-white text-[10px] font-black flex items-center justify-center px-1">
                          {missedCount}
                        </span>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[var(--border)] flex flex-col gap-3">
            {userRole === 'driver' && !isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2 py-2 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--primary-dark)]" />
                  <MobileClock />
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--success)]">
                  <Wifi
                    size={12}
                    className={cn(
                      'transition-all duration-300',
                      isOnline
                        ? 'text-[var(--success)] drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                        : 'text-[var(--text-muted)] opacity-65',
                    )}
                  />
                  Live
                </span>
              </div>
            )}
            {userRole === 'driver' && isSidebarCollapsed && (
              <div className="w-10 h-10 mx-auto rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
                <Clock size={14} className="text-[var(--primary-dark)]" />
              </div>
            )}
            {userRole === 'driver' && isLive && (
              <DrowsinessMonitor isLive={isLive} collapsed={isSidebarCollapsed} />
            )}
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">System</span>
                <motion.button
                  className="w-8 h-8 flex items-center justify-center bg-[var(--surface)] shadow-sm hover:shadow-md border border-[var(--border)] rounded-full relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300"
                >
                  <Bell size={14} />
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[var(--danger)] rounded-full border border-[var(--surface)]"></span>
                </motion.button>
              </div>
            )}

            {isSidebarCollapsed ? (
              <div
                onClick={() => setActivePage('profile')}
                className="w-10 h-10 mx-auto rounded-full bg-[var(--primary)]/20 flex items-center justify-center border border-[var(--primary)]/30 cursor-pointer hover:border-[var(--primary)]/60"
                style={{ transition: 'border-color 150ms ease-out' }}
              >
                <User size={18} className="text-[var(--primary-dark)]" />
              </div>
            ) : (
              <div
                onClick={() => setActivePage('profile')}
                className="flex items-center gap-3 p-3 rounded-[16px] bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md hover:border-[var(--primary)]/30 cursor-pointer group relative"
                style={{ transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out' }}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center shrink-0 border border-[var(--primary)]/30">
                  <User size={18} className="text-[var(--primary-dark)]" />
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-sm font-bold truncate text-[var(--text-primary)] capitalize">{currentDriver?.name ?? userRole}</span>
                  <span className={cn('text-xs font-semibold flex items-center gap-1.5 mt-0.5', connectivityTextClass)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', connectivityDotClass)}></span>
                    {connectivityLabel}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                  className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--danger)] rounded-full ml-auto"
                  style={{ transition: 'background-color 150ms ease-out, color 150ms ease-out, transform 100ms ease-out' }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </motion.aside>

        <div
          style={{ transition: 'margin-left 220ms cubic-bezier(0.32, 0.72, 0, 1)' }}
          className={cn(
            'flex-1 flex flex-col min-h-screen relative',
            userRole === 'driver'
              ? isSidebarCollapsed
                ? 'lg:ml-[80px]'
                : 'lg:ml-[260px]'
              : isSidebarCollapsed
                ? 'ml-[80px]'
                : 'ml-[260px]',
          )}
        >
          {userRole === 'driver' && (
            <div className="lg:hidden fixed top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-40 pointer-events-none gap-3">
              <div className="flex items-center gap-2 pointer-events-auto shadow-md bg-white rounded-full p-1 pl-4 pr-1">
                <MobileClock />
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <Search size={16} className="text-[var(--accent)]" />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-full shadow-md pointer-events-auto">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center">
                    <Navigation size={10} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">120</span>
                </div>
                <div className="w-px h-4 bg-[var(--border)]"></div>
                <div className="flex items-center gap-1">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center',
                      isOnline ? 'bg-[var(--success)]' : 'bg-[var(--warning)]',
                    )}
                  >
                    <Activity size={10} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          )}

          <main
            className={cn(
              'flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 overflow-y-auto',
              userRole === 'driver' ? 'pt-24 pb-32 lg:pb-8 lg:pt-12' : 'pt-12 pb-8',
            )}
          >
            <motion.div
                key={`${userRole}-${activePage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="h-full"
              >
                {renderPage()}
              </motion.div>
          </main>

          {userRole === 'driver' && (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="nav-pill pointer-events-auto relative">
                {/* Sliding background for active item — x:10 = pill left padding, 44 = item width(40) + gap(4) */}
                <motion.div
                  className="absolute top-[6px] left-0 w-10 h-10 rounded-full bg-[var(--primary)] pointer-events-none"
                  animate={{
                    x: 10 + DRIVER_ITEMS.findIndex((item) => activePage === item.id) * 44,
                  }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                />
                {DRIVER_ITEMS.map((item) => (
                  <motion.div
                    key={item.id}
                    className={cn(
                      'nav-pill-item relative z-10',
                      activePage === item.id ? 'text-white' : 'text-[var(--text-secondary)]',
                    )}
                    onClick={() => setActivePage(item.id as Page)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <item.icon size={20} strokeWidth={activePage === item.id ? 2.5 : 2} className="transition-colors" />
                    {item.id === 'overview' && missedCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--danger)] border-2 border-white" />
                    )}
                  </motion.div>
                ))}
                <motion.div
                  className="w-10 h-10 ml-2 rounded-full border-2 border-[var(--primary)] overflow-hidden cursor-pointer relative z-10"
                  onClick={() => setActivePage('profile')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img src="https://picsum.photos/seed/driver/100/100" alt="Profile" className="w-full h-full object-cover" />
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {userRole === 'driver' && <VoicePilot />}
        {userRole === 'driver' && <SafetyZen isLive={isLive} />}
      </div>
    </>
  );
}

export default function App() {
  return (
    <OfflineProvider>
      <AppShell />
    </OfflineProvider>
  );
}
