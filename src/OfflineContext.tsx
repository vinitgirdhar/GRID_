import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { OFFLINE_QUEUE_EVENT, offlineService } from './services/offlineService';

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  sync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

function getInitialOnlineState() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const wasOnlineRef = useRef(isOnline);
  const syncInFlightRef = useRef(false);

  async function refreshPendingCount() {
    try {
      setPendingCount(await offlineService.getSyncQueueSize());
    } catch {
      setPendingCount(0);
    }
  }

  async function sync() {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const result = await offlineService.processSyncQueue();
      if (result.synced > 0) {
        setLastSyncAt(new Date().toISOString());
      }
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }

  useEffect(() => {
    void refreshPendingCount();

    if (getInitialOnlineState()) {
      void sync();
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => {
      void refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    };
  }, []);

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      void sync();
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncAt,
        sync,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);

  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider.');
  }

  return context;
}
