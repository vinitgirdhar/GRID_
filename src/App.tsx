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
import HotspotMap from './components/pages/HotspotMap';
import ModelPerformance from './components/pages/ModelPerformance';
import Drivers from './components/pages/Drivers';
import DriverOverview from './components/pages/DriverOverview';
import GoForRide from './components/pages/GoForRide';
import DriverPerformance from './components/pages/DriverPerformance';
import Login from './components/Login';

const ADMIN_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'data-insights', label: 'Data Insights', icon: BarChart3 },
  { id: 'weather-insights', label: 'Weather Insights', icon: CloudSun },
  { id: 'prediction', label: 'Demand Prediction', icon: BrainCircuit },
  { id: 'hotspot-map', label: 'Hotspot Map', icon: MapIcon },
  { id: 'performance', label: 'Model Performance', icon: Activity },
  { id: 'drivers', label: 'Drivers', icon: Users },
] as const;

const DRIVER_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'go-for-ride', label: 'Go For Ride', icon: Navigation },
  { id: 'driver-performance', label: 'Performance', icon: LineChartIcon },
] as const;

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activePage, setActivePage] = useState<Page>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        case 'prediction': return <DemandPrediction />;
        case 'hotspot-map': return <HotspotMap />;
        case 'performance': return <ModelPerformance />;
        case 'drivers': return <Drivers />;
        default: return <Overview />;
      }
    } else {
      switch (activePage) {
        case 'overview': return <DriverOverview />;
        case 'go-for-ride': return <GoForRide />;
        case 'driver-performance': return <DriverPerformance />;
        default: return <DriverOverview />;
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden">
      {/* Clean Background Pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, var(--primary-lighter) 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, var(--secondary) 0%, transparent 50%)`
        }}></div>
      </div>
      {/* Dark Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 70 : 250 }}
        className="fixed left-0 top-0 h-full bg-[var(--accent)] border-r border-[var(--border)] z-50 flex flex-col shadow-lg"
      >
        <div className="p-5 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-md">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white">GRID</span>
                <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Cab Booking</span>
              </div>
            </motion.div>
          )}
          {isSidebarCollapsed && (
            <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-md mx-auto">
              <Navigation className="w-5 h-5 text-white" />
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-300 text-[var(--text-muted)] hover:text-white"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 py-5">
          {sidebarItems.map((item, index) => (
            <motion.button
              key={item.id}
              onClick={() => setActivePage(item.id as Page)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group relative",
                activePage === item.id
                  ? "bg-[var(--primary)] text-[var(--accent)] border-l-3 border-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-white"
              )}
            >
              <item.icon size={18} className={cn(
                "shrink-0 transition-colors duration-300",
                activePage === item.id ? "text-[var(--accent)]" : "group-hover:text-white"
              )} />
              {!isSidebarCollapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </motion.button>
          ))}
        </nav>

        <div className="p-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--primary)]/10 transition-all duration-300 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0 shadow-md">
              <User size={16} className="text-[var(--accent)]" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate text-white">{userRole === 'admin' ? 'Admin' : 'Driver'}</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase font-medium">Active</span>
                </div>
              </div>
            )}
            {!isSidebarCollapsed && (
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1.5 hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] rounded-lg transition-all duration-300"
              >
                <LogOut size={14} />
              </motion.button>
            )}
          </motion.div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 min-h-screen flex flex-col relative",
          isSidebarCollapsed ? "ml-[70px]" : "ml-[250px]"
        )}
      >
        {/* Clean Header */}
        <header className="h-16 border-b border-[var(--border)] flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur-md z-40">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="text"
                placeholder="Search rides, drivers, locations..."
                className="input-clean w-full pl-10 pr-4"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-[var(--primary)]/10 rounded-lg relative text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all duration-300"
            >
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full border-2 border-white"></span>
            </motion.button>
            <div className="h-6 w-[1px] bg-[var(--border)]"></div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
              <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></span>
              <span className="text-xs text-[var(--success)] font-medium">
                {userRole === 'admin' ? 'Online' : 'Available'}
              </span>
            </div>
          </div>
        </header>

        {/* Spacious Page Content */}
        <div className="p-6 max-w-7xl mx-auto w-full flex-1">
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
  );
}
