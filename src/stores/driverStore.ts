import { create } from 'zustand';

import {
  acceptTripOffer,
  completeTrip,
  getCurrentDriver,
  getNotifications,
  getTripOffers,
  getTripState,
  loginDriver,
  logoutDriver,
  startTrip,
} from '../services/apiService';
import { readAuthTokens } from '../services/secureStorage';
import { DriverProfile, NotificationItem, TripItem, TripOffer } from '../types';

type DriverStore = {
  initialized: boolean;
  loading: boolean;
  authError: string | null;
  driver: DriverProfile | null;
  isLive: boolean;
  offers: TripOffer[];
  activeTrip: TripItem | null;
  recentTrips: TripItem[];
  notifications: NotificationItem[];
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setLive: (next: boolean) => void;
  refreshTrips: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  acceptOffer: (offerId: string) => Promise<void>;
  startCurrentTrip: () => Promise<void>;
  completeCurrentTrip: () => Promise<void>;
};

export const useDriverStore = create<DriverStore>((set, get) => ({
  initialized: false,
  loading: false,
  authError: null,
  driver: null,
  isLive: true,
  offers: [],
  activeTrip: null,
  recentTrips: [],
  notifications: [],

  async initialize() {
    if (get().initialized) {
      return;
    }

    const tokens = await readAuthTokens();
    if (!tokens) {
      set({ initialized: true });
      return;
    }

    set({ loading: true, authError: null });
    try {
      const [driver, tripState, notificationState] = await Promise.all([
        getCurrentDriver(),
        getTripState(),
        getNotifications(),
      ]);
      set({
        initialized: true,
        loading: false,
        driver,
        activeTrip: tripState.active_trip ?? null,
        recentTrips: tripState.recent_trips,
        notifications: notificationState.notifications,
      });
      await get().refreshTrips();
    } catch (error) {
      await logoutDriver().catch(() => undefined);
      set({
        initialized: true,
        loading: false,
        driver: null,
        offers: [],
        activeTrip: null,
        recentTrips: [],
        notifications: [],
        authError: error instanceof Error ? error.message : 'Unable to restore driver session.',
      });
    }
  },

  async login(email: string, password: string) {
    set({ loading: true, authError: null });
    try {
      const response = await loginDriver(email, password);
      set({
        driver: response.driver,
        loading: false,
        authError: null,
        initialized: true,
      });
      console.log('Login successful, refreshing trips and notifications...');
      await Promise.all([get().refreshTrips(), get().refreshNotifications()]);
      console.log('Refresh complete.');
    } catch (error) {
      console.error('Login or refresh failed:', error);
      set({
        loading: false,
        authError: error instanceof Error ? error.message : 'Login failed.',
      });
      throw error;
    }
  },

  async logout() {
    set({ loading: true });
    await logoutDriver().catch(() => undefined);
    set({
      loading: false,
      driver: null,
      offers: [],
      activeTrip: null,
      recentTrips: [],
      notifications: [],
      authError: null,
      initialized: true,
    });
  },

  setLive(next) {
    set({ isLive: next });
  },

  async refreshTrips() {
    if (!get().driver) {
      return;
    }

    const [offerState, tripState] = await Promise.all([getTripOffers(), getTripState()]);
    set({
      offers: offerState.offers,
      activeTrip: tripState.active_trip ?? null,
      recentTrips: tripState.recent_trips,
    });
  },

  async refreshNotifications() {
    if (!get().driver) {
      return;
    }

    const notificationState = await getNotifications();
    set({ notifications: notificationState.notifications });
  },

  async acceptOffer(offerId) {
    const trip = await acceptTripOffer(offerId);
    set((state) => ({
      activeTrip: trip,
      offers: state.offers.filter((offer) => offer.id !== offerId),
    }));
    await get().refreshNotifications();
  },

  async startCurrentTrip() {
    const current = get().activeTrip;
    if (!current) {
      return;
    }

    const next = await startTrip(current.id);
    set({ activeTrip: next });
  },

  async completeCurrentTrip() {
    const current = get().activeTrip;
    if (!current) {
      return;
    }

    const next = await completeTrip(current.id);
    set({ activeTrip: next });
    await get().refreshTrips();
  },
}));
