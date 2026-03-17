import { useEffect } from 'react';

import { postPresenceUpdate } from './apiService';
import { useDriverStore } from '../stores/driverStore';

const DEFAULT_LOCATION = {
  lat: 40.7580,
  lng: -73.9855,
};

async function readCurrentPosition(): Promise<{ lat: number; lng: number; accuracy_m?: number | null }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return DEFAULT_LOCATION;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        });
      },
      () => resolve(DEFAULT_LOCATION),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 8000,
      },
    );
  });
}

export function usePresenceHeartbeat() {
  const driver = useDriverStore((state) => state.driver);
  const isLive = useDriverStore((state) => state.isLive);
  const activeTrip = useDriverStore((state) => state.activeTrip);

  useEffect(() => {
    if (!driver || !isLive) {
      return;
    }

    let disposed = false;

    const sendPresence = async () => {
      try {
        const location = await readCurrentPosition();
        if (disposed) {
          return;
        }

        await postPresenceUpdate({
          ...location,
          status: activeTrip ? activeTrip.status : 'available',
          trip_id: activeTrip?.id ?? null,
          recorded_at: new Date().toISOString(),
        });
      } catch {
        return;
      }
    };

    void sendPresence();
    const timer = window.setInterval(() => {
      void sendPresence();
    }, 30000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeTrip, driver, isLive]);
}
