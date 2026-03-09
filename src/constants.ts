import { KPI, ChartData, RideRequest } from './types';

export const KPIS: KPI[] = [
  { label: 'Total Rides (6 Months)', value: '1.2M', change: '+12.5%', trend: 'up' },
  { label: 'Avg Daily Demand', value: '8.4K', change: '+3.2%', trend: 'up' },
  { label: 'Total Events', value: '156', change: '-2.1%', trend: 'down' },
  { label: 'Rainy Days', value: '42', change: '+5.4%', trend: 'up' },
];

export const DRIVER_KPIS: KPI[] = [
  { label: 'Today’s Earnings', value: '$284.50', change: '+15.2%', trend: 'up' },
  { label: 'Completed Rides', value: '14', change: '+2', trend: 'up' },
  { label: 'Acceptance Rate', value: '92%', change: '-1.5%', trend: 'down' },
  { label: 'Productivity Score', value: '8.8', change: '+0.4', trend: 'up' },
];

export const RIDE_REQUESTS: RideRequest[] = [
  {
    id: '1',
    pickup: 'Times Square, Manhattan',
    drop: 'Barclays Center, Brooklyn',
    distance: '6.2 miles',
    fare: 32.50,
    traffic: 'Moderate',
    weather: 'Light Rain',
    eventScore: 85,
    recommendation: 'ACCEPT',
    reasoning: 'High fare-to-distance ratio and aligns with preferred route.',
    borough: 'Brooklyn',
    direction: 'South'
  },
  {
    id: '2',
    pickup: 'Upper East Side, Manhattan',
    drop: 'JFK Airport, Queens',
    distance: '18.4 miles',
    fare: 65.00,
    traffic: 'High',
    weather: 'Light Rain',
    eventScore: 20,
    recommendation: 'CONSIDER',
    reasoning: 'Good fare but high traffic on Van Wyck Expwy.',
    borough: 'Queens',
    direction: 'East'
  },
  {
    id: '3',
    pickup: 'SoHo, Manhattan',
    drop: 'Astoria, Queens',
    distance: '5.1 miles',
    fare: 18.20,
    traffic: 'Low',
    weather: 'Light Rain',
    eventScore: 10,
    recommendation: 'REJECT',
    reasoning: 'Low fare density in destination area at this hour.',
    borough: 'Queens',
    direction: 'East'
  },
  {
    id: '4',
    pickup: 'Williamsburg, Brooklyn',
    drop: 'Financial District, Manhattan',
    distance: '4.5 miles',
    fare: 28.00,
    traffic: 'Moderate',
    weather: 'Light Rain',
    eventScore: 90,
    recommendation: 'ACCEPT',
    reasoning: 'High demand in FiDi due to corporate event ending.',
    borough: 'Manhattan',
    direction: 'West'
  }
];

export const DRIVER_EARNINGS: ChartData[] = [
  { name: 'Mon', value: 180 },
  { name: 'Tue', value: 210 },
  { name: 'Wed', value: 195 },
  { name: 'Thu', value: 240 },
  { name: 'Fri', value: 310 },
  { name: 'Sat', value: 350 },
  { name: 'Sun', value: 280 },
];

export const DEMAND_OVER_TIME: ChartData[] = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 2000 },
  { name: 'Apr', value: 2780 },
  { name: 'May', value: 1890 },
  { name: 'Jun', value: 2390 },
  { name: 'Jul', value: 3490 },
];

export const BOROUGH_DEMAND: ChartData[] = [
  { name: 'Manhattan', value: 5800 },
  { name: 'Brooklyn', value: 3200 },
  { name: 'Queens', value: 2600 },
  { name: 'Bronx', value: 1460 },
  { name: 'Staten Island', value: 420 },
  { name: 'JFK/LGA', value: 1100 },
];

export const HOURLY_DEMAND: ChartData[] = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.floor(Math.random() * 1000) + 200,
}));

export const EVENT_DISTRIBUTION = [
  { name: 'Concerts', value: 45 },
  { name: 'Sports', value: 30 },
  { name: 'Festivals', value: 15 },
  { name: 'Conferences', value: 10 },
];

export const WEATHER_IMPACT: ChartData[] = [
  { name: 'Clear', value: 8200 },
  { name: 'Cloudy', value: 7800 },
  { name: 'Rain', value: 9500 },
  { name: 'Snow', value: 6200 },
];

export const FEATURE_IMPORTANCE = [
  { name: 'Hour of Day', value: 0.35 },
  { name: 'Borough', value: 0.25 },
  { name: 'Is Event', value: 0.15 },
  { name: 'Precipitation', value: 0.12 },
  { name: 'Temperature', value: 0.08 },
  { name: 'Day of Week', value: 0.05 },
];
