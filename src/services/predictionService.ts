import { PredictionState, ZoneDemand, EventInfo, WeatherInfo } from '../types';

const MOCK_ZONES: ZoneDemand[] = [
  {
    id: '1',
    name: 'Midtown Manhattan',
    lat: 40.7549,
    lng: -73.9840,
    demand: 4250,
    demandLevel: 'High',
    eventIntensity: 'High',
    weatherCondition: 'Cloudy'
  },
  {
    id: '2',
    name: 'Williamsburg, Brooklyn',
    lat: 40.7081,
    lng: -73.9571,
    demand: 2100,
    demandLevel: 'Medium',
    eventIntensity: 'Medium',
    weatherCondition: 'Cloudy'
  },
  {
    id: '3',
    name: 'Upper East Side',
    lat: 40.7736,
    lng: -73.9566,
    demand: 1800,
    demandLevel: 'Medium',
    eventIntensity: 'Low',
    weatherCondition: 'Cloudy'
  },
  {
    id: '4',
    name: 'Financial District',
    lat: 40.7075,
    lng: -74.0113,
    demand: 3500,
    demandLevel: 'High',
    eventIntensity: 'Medium',
    weatherCondition: 'Cloudy'
  },
  {
    id: '5',
    name: 'Astoria, Queens',
    lat: 40.7644,
    lng: -73.9235,
    demand: 900,
    demandLevel: 'Low',
    eventIntensity: 'Low',
    weatherCondition: 'Cloudy'
  }
];

const MOCK_EVENTS: EventInfo[] = [
  {
    id: 'e1',
    name: 'Madison Square Garden Concert',
    location: 'Manhattan',
    endTime: '10:30 PM',
    surgeNotice: 'High demand expected in Midtown',
    intensity: 'High'
  },
  {
    id: 'e2',
    name: 'Barclays Center NBA Game',
    location: 'Brooklyn',
    endTime: '9:45 PM',
    surgeNotice: 'Surge likely near Atlantic Ave',
    intensity: 'High'
  }
];

const MOCK_WEATHER: WeatherInfo = {
  temp: 68,
  condition: 'Cloudy',
  windSpeed: 12,
  rainExpectedIn: 30,
  impactOnDemand: 'Moderate'
};

export interface HistoricalDemand {
  id: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  avgLevel: string;
}

const MOCK_HISTORICAL_DEMAND: HistoricalDemand[] = [
  { id: 'h1', name: 'Times Square', lat: 40.7580, lng: -73.9855, count: 12500, avgLevel: 'High' },
  { id: 'h2', name: 'Grand Central', lat: 40.7527, lng: -73.9772, count: 9800, avgLevel: 'High' },
  { id: 'h3', name: 'Central Park South', lat: 40.7644, lng: -73.9730, count: 7500, avgLevel: 'Medium' },
  { id: 'h4', name: 'Chelsea Market', lat: 40.7423, lng: -74.0062, count: 6200, avgLevel: 'Medium' },
  { id: 'h5', name: 'DUMBO', lat: 40.7033, lng: -73.9881, count: 4500, avgLevel: 'Medium' },
  { id: 'h6', name: 'Bushwick', lat: 40.6944, lng: -73.9213, count: 2100, avgLevel: 'Low' },
  { id: 'h7', name: 'Astoria Park', lat: 40.7797, lng: -73.9215, count: 1800, avgLevel: 'Low' },
  { id: 'h8', name: 'Prospect Park', lat: 40.6602, lng: -73.9690, count: 3200, avgLevel: 'Low' },
];

export const getHistoricalDemand = (): HistoricalDemand[] => {
  return MOCK_HISTORICAL_DEMAND;
};

export const getPredictionData = (): PredictionState => {
  return {
    currentDemand: 'Medium',
    nextHourDemand: 4200,
    threeHourTrend: [
      { name: 'Now', value: 3800 },
      { name: '+1h', value: 4200 },
      { name: '+2h', value: 4500 },
      { name: '+3h', value: 4100 },
    ],
    weather: MOCK_WEATHER,
    events: MOCK_EVENTS,
    zones: MOCK_ZONES
  };
};
