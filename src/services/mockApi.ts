import {
  CopilotResponse,
  Driver,
  DriverSessionResponse,
  DriverSessionTogglePayload,
  DriverStatus,
  DriverTier,
  DrowsinessResponse,
  DrowsinessUpdatePayload,
  FeatureImportancePoint,
  ForecastPoint,
  ForecastResponse,
  ForecastSummary,
  HotspotPeriod,
  HotspotZone,
  HotspotsResponse,
  MetricsResponse,
  ModelVariantMetric,
  PredictionResponse,
  WeatherResponse,
  WellnessStatus,
} from '../types';

class MockApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DRIVER_SEED: Array<[string, string, DriverTier, number, number, number]> = [
  ['Alex Thompson', 'Manhattan', 'gold', 4.9, 1240, 4520],
  ['Sarah Jenkins', 'Brooklyn', 'silver', 4.8, 850, 3100],
  ['Michael Chen', 'Queens', 'gold', 4.7, 2100, 7800],
  ['Elena Rodriguez', 'Bronx', 'bronze', 4.6, 420, 1200],
  ['David Wilson', 'Manhattan', 'gold', 4.9, 1560, 5900],
  ['Lisa Park', 'Brooklyn', 'silver', 4.8, 980, 3400],
  ['James Miller', 'Staten Island', 'bronze', 4.5, 310, 950],
  ['Priya Sharma', 'Queens', 'silver', 4.7, 730, 2600],
  ['Carlos Rivera', 'Manhattan', 'gold', 4.8, 1890, 6700],
  ['Aisha Johnson', 'Brooklyn', 'silver', 4.6, 640, 2200],
  ['Thomas Brown', 'Bronx', 'bronze', 4.4, 280, 820],
  ['Mei Lin', 'Queens', 'gold', 4.9, 2340, 8900],
  ["Kevin O'Brien", 'Manhattan', 'silver', 4.7, 920, 3300],
  ['Fatima Hassan', 'Brooklyn', 'bronze', 4.5, 380, 1100],
  ['Andre Martin', 'Queens', 'gold', 4.8, 1670, 6200],
  ['Sophie Turner', 'Manhattan', 'silver', 4.7, 810, 2900],
  ['Ravi Patel', 'Staten Island', 'bronze', 4.3, 190, 580],
  ['Naomi Clark', 'Bronx', 'silver', 4.6, 560, 1900],
  ['Omar Khalil', 'Queens', 'gold', 4.9, 3100, 11500],
  ['Yuki Tanaka', 'Brooklyn', 'silver', 4.8, 1050, 3800],
];

const CAR_MODELS = [
  'Toyota Camry Hybrid',
  'Honda Accord',
  'Hyundai Sonata',
  'Tesla Model 3',
  'Nissan Altima',
  'Toyota RAV4 Hybrid',
  'Kia K5',
  'Chevrolet Malibu',
];

const STYLE_SNIPPETS = [
  'airport pickups',
  'late-night demand windows',
  'smooth downtown handoffs',
  'high-density commuter corridors',
  'surge-ready event routing',
  'fast turnaround dispatches',
];

type ZoneProfile = {
  zone_id: string;
  zone_name: string;
  borough: string;
  lat: number;
  lng: number;
  avg_fare: number;
  morningMultiplier: number;
  eveningMultiplier: number;
  weather_condition: string;
  event_intensity: 'High' | 'Medium' | 'Low';
};

const ZONES: ZoneProfile[] = [
  { zone_id: '132', zone_name: 'Times Square', borough: 'Manhattan', lat: 40.758, lng: -73.9855, avg_fare: 19.5, morningMultiplier: 1.15, eveningMultiplier: 1.28, weather_condition: 'Cloudy', event_intensity: 'High' },
  { zone_id: '138', zone_name: 'JFK Airport', borough: 'Queens', lat: 40.7769, lng: -73.874, avg_fare: 28, morningMultiplier: 1.1, eveningMultiplier: 1.08, weather_condition: 'Partly cloudy', event_intensity: 'Medium' },
  { zone_id: '186', zone_name: 'Penn Station', borough: 'Manhattan', lat: 40.7505, lng: -73.9934, avg_fare: 18.8, morningMultiplier: 1.26, eveningMultiplier: 1.1, weather_condition: 'Cloudy', event_intensity: 'High' },
  { zone_id: '142', zone_name: 'Midtown East', borough: 'Manhattan', lat: 40.7484, lng: -73.9857, avg_fare: 17.4, morningMultiplier: 1.12, eveningMultiplier: 1.18, weather_condition: 'Light rain', event_intensity: 'Medium' },
  { zone_id: '161', zone_name: 'Financial District', borough: 'Manhattan', lat: 40.7128, lng: -74.006, avg_fare: 17.9, morningMultiplier: 1.22, eveningMultiplier: 0.94, weather_condition: 'Clear', event_intensity: 'Low' },
  { zone_id: '68', zone_name: 'Downtown Brooklyn', borough: 'Brooklyn', lat: 40.7061, lng: -73.9969, avg_fare: 20.2, morningMultiplier: 0.96, eveningMultiplier: 1.1, weather_condition: 'Cloudy', event_intensity: 'Medium' },
  { zone_id: '230', zone_name: 'Grand Central', borough: 'Manhattan', lat: 40.759, lng: -73.9845, avg_fare: 18.9, morningMultiplier: 1.24, eveningMultiplier: 1.14, weather_condition: 'Cloudy', event_intensity: 'High' },
  { zone_id: '239', zone_name: 'Upper East Side', borough: 'Manhattan', lat: 40.7587, lng: -73.9787, avg_fare: 17.8, morningMultiplier: 0.9, eveningMultiplier: 1.02, weather_condition: 'Partly cloudy', event_intensity: 'Low' },
  { zone_id: '249', zone_name: 'Wall Street', borough: 'Manhattan', lat: 40.706, lng: -74.0086, avg_fare: 18.5, morningMultiplier: 1.08, eveningMultiplier: 0.88, weather_condition: 'Clear', event_intensity: 'Low' },
  { zone_id: '162', zone_name: 'Union Square', borough: 'Manhattan', lat: 40.7306, lng: -73.9866, avg_fare: 16.8, morningMultiplier: 0.95, eveningMultiplier: 1.16, weather_condition: 'Light rain', event_intensity: 'Medium' },
];

const DRIVER_STORAGE_KEY = 'grid-demo-drivers';
const SESSION_STORAGE_KEY = 'grid-demo-driver-session';
const DROWSINESS_STORAGE_KEY = 'grid-demo-drowsiness';

type SessionState = {
  is_live: boolean;
  started_at: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in demo mode.
  }
}

function buildDriver(index: number, name: string, borough: string, tier: DriverTier, rating: number, trips: number, earnings: number): Driver {
  const emailSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  const experience = Math.max(1, Math.min(12, 2 + (index % 6) + (tier === 'gold' ? 1 : 0)));
  const joinedYear = Math.max(2016, new Date().getFullYear() - experience);
  const joinedMonth = ((index * 2) % 12) + 1;
  const joinedDay = ((index * 3) % 27) + 1;
  const cancellationRate = Number(
    Math.min(
      6.4,
      1.4 + (index % 5) * 0.45 + (tier === 'bronze' ? 0.4 : tier === 'silver' ? 0.15 : 0),
    ).toFixed(1),
  );
  const onlineHours = Number((38 + (trips / 110) + ((index % 4) * 2.75)).toFixed(1));
  const tone = tier === 'gold' ? 'calm, premium' : tier === 'silver' ? 'reliable, efficient' : 'steady, neighborhood-first';

  return {
    id: String(index),
    phone: `${index}`.padStart(10, '0'),
    name,
    email: `${emailSlug}@gridfleet.com`,
    joinedDate: new Date(joinedYear, joinedMonth - 1, joinedDay).toISOString().slice(0, 10),
    carModel: CAR_MODELS[(index - 1) % CAR_MODELS.length],
    licensePlate: `NYC-${String(index).padStart(2, '0')}${String(Math.floor(trips / 10) % 100).padStart(2, '0')}`,
    bio: `${borough}-based driver focused on ${STYLE_SNIPPETS[(index - 1) % STYLE_SNIPPETS.length]} with a ${tone} service style.`,
    experience,
    completedTrips: trips,
    cancellationRate,
    onlineHours,
    tier,
    status: 'offline',
    avatar: `https://picsum.photos/seed/${name.split(' ')[0].toLowerCase()}/100/100`,
    borough,
    rating,
    trips,
    earnings,
  };
}

function defaultDrivers() {
  return DRIVER_SEED.map(([name, borough, tier, rating, trips, earnings], index) =>
    buildDriver(index + 1, name, borough, tier, rating, trips, earnings),
  );
}

function getDriversState() {
  const fallback = defaultDrivers();
  const stored = readStorage<Driver[]>(DRIVER_STORAGE_KEY, fallback);

  if (!stored.length) {
    writeStorage(DRIVER_STORAGE_KEY, fallback);
    return fallback;
  }

  return stored;
}

function saveDriversState(drivers: Driver[]) {
  writeStorage(DRIVER_STORAGE_KEY, drivers);
  return drivers;
}

function defaultSessionState(): SessionState {
  return {
    is_live: false,
    started_at: null,
  };
}

function getSessionState() {
  return readStorage<SessionState>(SESSION_STORAGE_KEY, defaultSessionState());
}

function saveSessionState(state: SessionState) {
  writeStorage(SESSION_STORAGE_KEY, state);
  return state;
}

function defaultDrowsinessState(): DrowsinessResponse {
  return {
    status: 'Awaiting detector',
    severity: 'warning',
    ear: null,
    threshold: 0.23,
    consecutive_closed_frames: 0,
    eyes_closed_seconds: 0,
    alarm_active: false,
    assistant_response: 'Camera detector is ready when you go live.',
    source: 'demo-api',
    updated_at: nowIso(),
  };
}

function getDrowsinessState() {
  return readStorage<DrowsinessResponse>(DROWSINESS_STORAGE_KEY, defaultDrowsinessState());
}

function saveDrowsinessState(state: DrowsinessResponse) {
  writeStorage(DROWSINESS_STORAGE_KEY, state);
  return state;
}

function demandLevel(value: number): HotspotZone['demand_level'] {
  if (value >= 120) {
    return 'High';
  }

  if (value >= 85) {
    return 'Medium';
  }

  return 'Low';
}

function buildPeriod(label: string, targetTime: string, multipliers: Array<[ZoneProfile, number]>) {
  const zones = [...multipliers]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([zone, multiplier]) => {
      const predictedDemand = Number((75 * multiplier).toFixed(1));
      return {
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        borough: zone.borough,
        lat: zone.lat,
        lng: zone.lng,
        predicted_demand: predictedDemand,
        demand_level: demandLevel(predictedDemand),
        event_intensity: zone.event_intensity,
        weather_condition: zone.weather_condition,
      } satisfies HotspotZone;
    });

  const recommended_zones = zones.slice(0, 5).map((zone, index) => ({
    zone_id: zone.zone_id,
    zone_name: zone.zone_name,
    rank: index + 1,
    expected_trips_per_hour: zone.predicted_demand,
  }));

  const avoid_zones = zones.slice(-2).map((zone) => ({
    zone_id: zone.zone_id,
    expected_trips_per_hour: zone.predicted_demand,
  }));

  return {
    label,
    target_time: targetTime,
    zones,
    recommended_zones,
    avoid_zones,
  } satisfies HotspotPeriod;
}

function buildHotspotsResponse() {
  const currentHour = new Date().getHours();
  const morning = buildPeriod(
    'Morning Rush',
    '7:00 AM - 10:00 AM',
    ZONES.map((zone) => [zone, zone.morningMultiplier] as [ZoneProfile, number]),
  );
  const evening = buildPeriod(
    'Evening Surge',
    '5:00 PM - 9:00 PM',
    ZONES.map((zone) => [zone, zone.eveningMultiplier] as [ZoneProfile, number]),
  );

  return {
    generated_at: nowIso(),
    active_period: currentHour < 15 ? 'morning' : 'evening',
    morning,
    evening,
  } satisfies HotspotsResponse;
}

function buildForecastResponse() {
  const generatedAt = new Date();
  const forecast: ForecastPoint[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const dt = new Date(generatedAt);
    dt.setHours(hour, 0, 0, 0);

    const commuteBoost = (hour >= 7 && hour <= 10 ? 1500 : 0) + (hour >= 17 && hour <= 21 ? 1900 : 0);
    const nightlifeBoost = hour >= 22 || hour <= 1 ? 650 : 0;
    const baseline = 2100 + (Math.sin((hour / 24) * Math.PI * 2) * 220);
    const totalDemand = Number((baseline + commuteBoost + nightlifeBoost).toFixed(1));
    const activeZones = hour < 15 ? buildHotspotsResponse().morning.zones : buildHotspotsResponse().evening.zones;
    const topZone = activeZones[hour % activeZones.length] ?? activeZones[0];
    const topZoneDemand = Number((topZone.predicted_demand * 24).toFixed(1));

    forecast.push({
      hour,
      datetime: dt.toISOString(),
      total_predicted_demand: totalDemand,
      top_zone_id: topZone.zone_id,
      top_zone_name: topZone.zone_name,
      top_zone_demand: topZoneDemand,
    });
  }

  const peak = forecast.reduce((best, point) =>
    point.total_predicted_demand > best.total_predicted_demand ? point : best,
  );

  const summary: ForecastSummary = {
    total_horizon_demand: Number(forecast.reduce((sum, point) => sum + point.total_predicted_demand, 0).toFixed(1)),
    peak_hour: peak.hour,
    peak_datetime: peak.datetime,
    peak_zone_id: peak.top_zone_id,
    peak_zone_name: peak.top_zone_name,
    peak_zone_demand: peak.top_zone_demand,
  };

  return {
    generated_at: generatedAt.toISOString(),
    forecast,
    summary,
  } satisfies ForecastResponse;
}

function buildMetricsResponse() {
  const modelVariants: ModelVariantMetric[] = [
    {
      key: 'baseline',
      label: 'Baseline Model',
      model_type: 'xgboost',
      training_date: '2026-03-25',
      test_rmse: 14.82,
      test_r2: 0.9241,
      train_rmse: 12.95,
      train_r2: 0.9415,
      feature_count: 24,
    },
    {
      key: 'events',
      label: 'Event-Enriched Model',
      model_type: 'xgboost',
      training_date: '2026-03-26',
      test_rmse: 11.43,
      test_r2: 0.9528,
      train_rmse: 9.84,
      train_r2: 0.9689,
      feature_count: 31,
    },
    {
      key: 'hybrid',
      label: 'Hybrid Demand Model',
      model_type: 'xgboost',
      training_date: '2026-03-28',
      test_rmse: 9.74,
      test_r2: 0.9714,
      train_rmse: 8.91,
      train_r2: 0.9798,
      feature_count: 38,
    },
  ];

  const featureImportance: FeatureImportancePoint[] = [
    { name: 'pickup_hour', value: 0.281 },
    { name: 'rain_intensity', value: 0.194 },
    { name: 'event_density', value: 0.158 },
    { name: 'driver_supply', value: 0.132 },
    { name: 'zone_cluster', value: 0.114 },
    { name: 'weekday_index', value: 0.078 },
    { name: 'temperature_feels_like', value: 0.043 },
  ];

  return {
    generated_at: nowIso(),
    current_model_key: 'hybrid',
    current_model_label: 'Hybrid Demand Model',
    model_variants: modelVariants,
    feature_importance: featureImportance,
  } satisfies MetricsResponse;
}

function getZone(zoneId?: string) {
  return ZONES.find((zone) => zone.zone_id === zoneId) ?? ZONES[0];
}

function getActivePeriodLabel(hour: number) {
  return hour < 15 ? 'morning' : 'evening';
}

export async function mockLoginDriver(phone: string, password: string) {
  const drivers = getDriversState();
  const driver = drivers.find((entry) => entry.phone === phone);

  if (!driver) {
    throw new MockApiError(401, 'No driver found with this phone number.');
  }

  // Accept the universal demo password OR a custom password set at registration
  const passwords = readStorage<Record<string, string>>('grid-demo-passwords', {});
  const storedPassword = passwords[phone];
  if (password !== 'qwerty' && (!storedPassword || password !== storedPassword)) {
    throw new MockApiError(401, 'Incorrect password. Demo drivers use "qwerty".');
  }

  return { ...driver };
}

export async function mockRegisterDriver(payload: {
  name: string;
  phone: string;
  password: string;
  borough: string;
  carModel: string;
}) {
  const drivers = getDriversState();

  if (drivers.find((d) => d.phone === payload.phone)) {
    throw new MockApiError(409, 'This phone number is already registered.');
  }

  const emailSlug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  const newDriver: Driver = {
    id: String(Date.now()),
    phone: payload.phone,
    name: payload.name,
    email: `${emailSlug}@gridfleet.com`,
    joinedDate: new Date().toISOString().slice(0, 10),
    carModel: payload.carModel,
    licensePlate: `NYC-NEW${payload.phone.slice(-4)}`,
    bio: `${payload.borough}-based driver ready to hit the road with GRID.`,
    experience: 0,
    completedTrips: 0,
    cancellationRate: 0,
    onlineHours: 0,
    tier: 'bronze',
    status: 'offline',
    avatar: `https://picsum.photos/seed/${payload.name.split(' ')[0].toLowerCase()}/100/100`,
    borough: payload.borough,
    rating: 5.0,
    trips: 0,
    earnings: 0,
  };

  saveDriversState([...drivers, newDriver]);

  // Persist password so future logins work
  const passwords = readStorage<Record<string, string>>('grid-demo-passwords', {});
  writeStorage('grid-demo-passwords', { ...passwords, [payload.phone]: payload.password });

  return { ...newDriver };
}

export async function mockListDrivers() {
  return getDriversState().map((driver) => ({ ...driver }));
}

export async function mockUpdateDriverStatus(driverId: string, status: DriverStatus) {
  const nextDrivers = getDriversState().map((driver) =>
    driver.id === driverId ? { ...driver, status } : driver,
  );
  saveDriversState(nextDrivers);
  return nextDrivers.find((driver) => driver.id === driverId) ?? null;
}

export async function mockLogoutDriver(driverId: string) {
  await mockUpdateDriverStatus(driverId, 'offline');
  saveSessionState(defaultSessionState());
  return { status: 'ok' };
}

export async function mockGetMetrics() {
  return buildMetricsResponse();
}

export async function mockGetForecast() {
  return buildForecastResponse();
}

export async function mockGetHotspots() {
  return buildHotspotsResponse();
}

export async function mockGetPrediction(query: { zoneId?: string; predictionTime?: string }) {
  const targetDate = query.predictionTime ? new Date(query.predictionTime) : new Date();
  const hour = Number.isNaN(targetDate.getTime()) ? new Date().getHours() : targetDate.getHours();
  const zone = getZone(query.zoneId);
  const activePeriod = getActivePeriodLabel(hour);
  const zoneBase = activePeriod === 'morning' ? zone.morningMultiplier : zone.eveningMultiplier;
  const predictedDemand = Number((78 * zoneBase + ((hour % 4) * 6)).toFixed(1));

  return {
    requested_at: nowIso(),
    prediction_time: (Number.isNaN(targetDate.getTime()) ? new Date() : targetDate).toISOString(),
    zone_id: zone.zone_id,
    zone_name: zone.zone_name,
    borough: zone.borough,
    lat: zone.lat,
    lng: zone.lng,
    predicted_demand: predictedDemand,
    demand_level: demandLevel(predictedDemand),
    confidence: 0.93,
    active_period: activePeriod,
    model_key: 'hybrid',
    model_label: 'Hybrid Demand Model',
  } satisfies PredictionResponse;
}

export async function mockGetWeather(query: { zoneId?: string }) {
  const zone = getZone(query.zoneId);
  const condition = zone.weather_condition;
  const precip = condition.toLowerCase().includes('rain') ? 2.8 : 0.2;
  const cloud = condition.toLowerCase().includes('clear') ? 18 : 62;
  const tempC = zone.borough === 'Queens' ? 24 : zone.borough === 'Brooklyn' ? 23 : 22;
  const demandImpact = precip > 1 ? 'High' : cloud > 40 ? 'Moderate' : 'Low';

  return {
    requested_at: nowIso(),
    source: 'demo-weather',
    zone_id: zone.zone_id,
    zone_name: zone.zone_name,
    borough: zone.borough,
    location_name: `${zone.zone_name}, ${zone.borough}`,
    region: 'New York',
    country: 'USA',
    lat: zone.lat,
    lng: zone.lng,
    local_time: new Date().toLocaleString('en-US'),
    condition,
    temp_c: tempC,
    temp_f: Number(((tempC * 9) / 5 + 32).toFixed(1)),
    feelslike_c: tempC + 1.1,
    humidity: 68,
    wind_kph: 14.2,
    precip_mm: precip,
    cloud,
    demand_impact: demandImpact,
    impact_score: Number((demandImpact === 'High' ? 8.7 : demandImpact === 'Moderate' ? 6.2 : 4.4).toFixed(1)),
  } satisfies WeatherResponse;
}

export async function mockGetDrowsinessStatus() {
  const state = getDrowsinessState();
  return {
    ...state,
    updated_at: nowIso(),
  } satisfies DrowsinessResponse;
}

export async function mockPostDrowsinessStatus(payload: DrowsinessUpdatePayload) {
  const nextState: DrowsinessResponse = {
    status: payload.status,
    severity: payload.severity,
    ear: payload.ear ?? null,
    threshold: payload.threshold ?? 0.23,
    consecutive_closed_frames: payload.consecutive_closed_frames,
    eyes_closed_seconds: payload.eyes_closed_seconds,
    alarm_active: payload.alarm_active,
    assistant_response: payload.assistant_response ?? null,
    source: payload.source,
    updated_at: payload.updated_at ?? nowIso(),
  };

  return saveDrowsinessState(nextState);
}

export async function mockPostDriverSession(payload: DriverSessionTogglePayload) {
  const current = getSessionState();
  const nextState: SessionState = payload.is_live
    ? {
        is_live: true,
        started_at: current.is_live && current.started_at ? current.started_at : nowIso(),
      }
    : {
        is_live: false,
        started_at: null,
      };

  saveSessionState(nextState);

  return {
    status: 'ok',
    is_live: payload.is_live,
  } satisfies DriverSessionResponse;
}

export async function mockGetWellnessStatus() {
  const session = getSessionState();
  const startedAt = session.started_at ? new Date(session.started_at).getTime() : null;
  const elapsedMs = session.is_live && startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const driveMinutes = session.is_live ? Math.min(180, Math.floor(elapsedMs / 1000)) : 0;
  const progress = session.is_live ? Math.min(1, driveMinutes / 10) : 0;
  const fatigueLevel = driveMinutes < 4 ? 'low' : driveMinutes < 8 ? 'moderate' : 'high';

  return {
    drive_minutes: driveMinutes,
    fatigue_level: fatigueLevel,
    is_live: session.is_live,
    is_filling: session.is_live && progress > 0,
    progress: Number(progress.toFixed(2)),
  } satisfies WellnessStatus;
}

export async function mockAskCopilot(query: string) {
  const normalized = query.toLowerCase();

  if (normalized.includes('airport') || normalized.includes('jfk')) {
    return {
      spoken_response: 'Airport demand is building. Head toward JFK for longer-fare pickups.',
      action: { type: 'navigate_to_zone', payload: '138' },
    } satisfies CopilotResponse;
  }

  if (normalized.includes('midtown') || normalized.includes('times square')) {
    return {
      spoken_response: 'Midtown is hot right now. Move toward Times Square for dense pickup volume.',
      action: { type: 'navigate_to_zone', payload: '132' },
    } satisfies CopilotResponse;
  }

  if (normalized.includes('where') || normalized.includes('next')) {
    return {
      spoken_response: 'Top demand is centered around Times Square and Grand Central over the next hour.',
      action: { type: 'navigate_to_zone', payload: '230' },
    } satisfies CopilotResponse;
  }

  return {
    spoken_response: 'GRID demo mode is active. Demand is steady, and Midtown remains your best short-route zone.',
  } satisfies CopilotResponse;
}

export function isMockApiError(error: unknown): error is MockApiError {
  return error instanceof MockApiError;
}
