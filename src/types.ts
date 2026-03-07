export type Page = 'overview' | 'data-insights' | 'weather-insights' | 'prediction' | 'hotspot-map' | 'performance' | 'drivers' | 'go-for-ride' | 'driver-performance';
export type UserRole = 'driver' | 'admin';
export type Theme = 'dark' | 'light';

export interface KPI {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

export interface ChartData {
  name: string;
  value: number;
  secondary?: number;
}

export interface RideRequest {
  id: string;
  pickup: string;
  drop: string;
  distance: string;
  fare: number;
  traffic: 'Low' | 'Moderate' | 'High';
  weather: string;
  eventScore: number;
  recommendation: 'ACCEPT' | 'CONSIDER' | 'REJECT';
  reasoning: string;
  borough: string;
  direction: 'North' | 'South' | 'East' | 'West';
}

export type DemandLevel = 'Low' | 'Medium' | 'High';

export interface WeatherInfo {
  temp: number;
  condition: string;
  windSpeed: number;
  rainExpectedIn: number | null; // minutes
  impactOnDemand: 'High' | 'Moderate' | 'Low';
}

export interface EventInfo {
  id: string;
  name: string;
  location: string;
  endTime: string;
  surgeNotice: string;
  intensity: 'High' | 'Medium' | 'Low';
}

export interface ZoneDemand {
  id: string;
  name: string;
  lat: number;
  lng: number;
  demand: number;
  demandLevel: DemandLevel;
  eventIntensity: 'High' | 'Medium' | 'Low';
  weatherCondition: string;
}

export interface PredictionState {
  currentDemand: DemandLevel;
  nextHourDemand: number;
  threeHourTrend: ChartData[];
  weather: WeatherInfo;
  events: EventInfo[];
  zones: ZoneDemand[];
}
