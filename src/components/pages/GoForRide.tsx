import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion } from 'motion/react';
import { ArrowRight, Compass, Info, MapPin, Navigation, Play, SquareCheckBig } from 'lucide-react';

import { useOffline } from '../../OfflineContext';
import { cn } from '../../lib/utils';
import MapComponent, { MapRidePin, MapRoute } from '../MapComponent';
import { useDriverStore } from '../../stores/driverStore';

const DRIVER_START: [number, number] = [40.7580, -73.9855];

function estimateDirection(start: [number, number], end: [number, number]) {
  const latDelta = end[0] - start[0];
  const lngDelta = end[1] - start[1];
  if (Math.abs(lngDelta) > Math.abs(latDelta)) {
    return lngDelta >= 0 ? 'East' : 'West';
  }
  return latDelta >= 0 ? 'North' : 'South';
}

export default function GoForRide() {
  const { isOnline } = useOffline();
  const {
    offers,
    activeTrip,
    refreshTrips,
    acceptOffer,
    startCurrentTrip,
    completeCurrentTrip,
  } = useDriverStore();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [destination, setDestination] = useState('');

  function pulseHaptics(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  useEffect(() => {
    void refreshTrips();
  }, [refreshTrips]);

  const filteredOffers = useMemo(() => {
    if (!destination.trim()) {
      return offers;
    }

    const query = destination.trim().toLowerCase();
    return offers.filter((offer) =>
      offer.pickup_label.toLowerCase().includes(query) ||
      offer.dropoff_label.toLowerCase().includes(query) ||
      (offer.borough ?? '').toLowerCase().includes(query),
    );
  }, [destination, offers]);

  const ridePins: MapRidePin[] = filteredOffers.map((offer) => ({
    id: offer.id,
    position: [offer.pickup_lat, offer.pickup_lng],
    label: offer.pickup_label,
    fare: offer.estimated_fare,
  }));

  const mapRoute: MapRoute | undefined = activeTrip
    ? {
        start: [activeTrip.pickup_lat, activeTrip.pickup_lng],
        end: [activeTrip.dropoff_lat, activeTrip.dropoff_lng],
      }
    : filteredOffers[0]
      ? {
          start: DRIVER_START,
          end: [filteredOffers[0].pickup_lat, filteredOffers[0].pickup_lng],
        }
      : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Trip Dispatch</p>
          <h1 className={cn('font-black tracking-tight text-[var(--text-primary)]', Capacitor.isNativePlatform() ? 'text-xl mt-1' : 'mt-2 text-3xl')}>Go For Ride</h1>
          <p className="mt-1 text-[var(--text-secondary)]">
            {isOnline ? 'Live server-generated trip offers for the authenticated driver.' : 'Cached UI is active, but accepting new server offers requires connectivity.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn('rounded-full px-4 py-2 text-sm font-bold', isOnline ? 'bg-green-500/10 text-green-700' : 'bg-amber-100 text-amber-700')}>
            {isOnline ? `${offers.length} offers live` : 'Offline'}
          </div>
          <button
            onClick={() => void refreshTrips()}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--primary)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {activeTrip && (
        <div className="rounded-[28px] border border-[var(--primary)]/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(255,255,255,0.96))] p-6 shadow-[0_20px_50px_rgba(250,204,21,0.12)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Active Trip</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{activeTrip.pickup_label} to {activeTrip.dropoff_label}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Status: <span className="font-bold text-[var(--text-primary)]">{activeTrip.status}</span></p>
            </div>
            <div className="flex gap-3">
              <button
                disabled={activeTrip.status !== 'accepted' || loadingAction !== null}
                onClick={async () => {
                  pulseHaptics(24);
                  setLoadingAction('start');
                  try {
                    await startCurrentTrip();
                  } finally {
                    setLoadingAction(null);
                  }
                }}
                className="flex items-center gap-2 rounded-2xl bg-[var(--text-primary)] px-5 py-3 text-sm font-black text-[var(--background)] disabled:opacity-50"
              >
                <Play size={16} />
                {loadingAction === 'start' ? 'Starting...' : 'Start Trip'}
              </button>
              <button
                disabled={loadingAction !== null}
                onClick={async () => {
                  pulseHaptics([18, 30, 18]);
                  setLoadingAction('complete');
                  try {
                    await completeCurrentTrip();
                  } finally {
                    setLoadingAction(null);
                  }
                }}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                <SquareCheckBig size={16} />
                {loadingAction === 'complete' ? 'Completing...' : 'Complete Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_20px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--primary)]/15 p-3 text-[var(--text-primary)]">
              <Compass size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--text-primary)]">Offer Filter</h2>
              <p className="text-sm text-[var(--text-secondary)]">Search by pickup, dropoff, or borough corridor.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Search area or destination"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)]"
            />
            <div className={cn(
              Capacitor.isNativePlatform()
                ? 'flex gap-2 overflow-x-auto hide-scrollbar pb-1'
                : 'grid grid-cols-2 gap-2'
            )}>
              {['Airport', 'Brooklyn', 'Manhattan', 'Queens'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDestination(preset)}
                  className={cn(
                    'rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--text-primary)]',
                    Capacitor.isNativePlatform() && 'whitespace-nowrap shrink-0',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_20px_40px_rgba(15,23,42,0.05)]">
            <MapComponent
              theme="light"
              height={Capacitor.isNativePlatform() ? '200px' : '340px'}
              simplified={false}
              route={mapRoute}
              ridePins={ridePins}
              offlineMode={!isOnline}
            />
          </div>

          <div className="space-y-4">
            {filteredOffers.length > 0 ? filteredOffers.map((offer) => {
              const direction = estimateDirection(DRIVER_START, [offer.pickup_lat, offer.pickup_lng]);
              return (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_20px_40px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm font-bold text-[var(--text-primary)]">
                          <Navigation size={15} className="text-[var(--primary)]" />
                          {offer.pickup_label}
                        </div>
                        <div className="ml-[7px] h-5 w-px bg-[var(--border)]" />
                        <div className="flex items-center gap-3 text-sm font-bold text-[var(--text-primary)]">
                          <MapPin size={15} className="text-red-500" />
                          {offer.dropoff_label}
                        </div>
                      </div>

                      <div className={cn(
                        'grid gap-3',
                        Capacitor.isNativePlatform() ? 'grid-cols-3' : 'sm:grid-cols-3'
                      )}>
                        <div className={cn('rounded-2xl bg-[var(--background)]', Capacitor.isNativePlatform() ? 'px-3 py-2' : 'px-4 py-3')}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Fare</p>
                          <p className={cn('font-black text-[var(--text-primary)]', Capacitor.isNativePlatform() ? 'text-base mt-0.5' : 'mt-1 text-xl')}>${offer.estimated_fare.toFixed(2)}</p>
                        </div>
                        <div className={cn('rounded-2xl bg-[var(--background)]', Capacitor.isNativePlatform() ? 'px-3 py-2' : 'px-4 py-3')}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Distance</p>
                          <p className={cn('font-black text-[var(--text-primary)]', Capacitor.isNativePlatform() ? 'text-base mt-0.5' : 'mt-1 text-xl')}>{offer.distance_km.toFixed(1)} km</p>
                        </div>
                        <div className={cn('rounded-2xl bg-[var(--background)]', Capacitor.isNativePlatform() ? 'px-3 py-2' : 'px-4 py-3')}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Direction</p>
                          <p className={cn('font-black text-[var(--text-primary)]', Capacitor.isNativePlatform() ? 'text-base mt-0.5' : 'mt-1 text-xl')}>{direction}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          <Info size={12} />
                          Dispatch reasoning
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          Offer sourced from the backend dispatch queue for {offer.borough ?? 'the current corridor'} with expiry at {new Date(offer.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                        </p>
                      </div>
                    </div>

                    <button
                      disabled={Boolean(activeTrip) || loadingAction !== null}
                      onClick={async () => {
                        pulseHaptics(18);
                        setLoadingAction(offer.id);
                        try {
                          await acceptOffer(offer.id);
                        } finally {
                          setLoadingAction(null);
                        }
                      }}
                      className="flex min-w-[160px] items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-4 text-sm font-black text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingAction === offer.id ? 'Accepting...' : 'Accept'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            }) : (
              <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
                <p className="text-lg font-black text-[var(--text-primary)]">No offers match the current filter</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Refresh the dispatch queue or clear the search term.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
