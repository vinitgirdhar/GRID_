import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Thermometer, CloudRain, Wind, Info } from 'lucide-react';
import { WEATHER_IMPACT } from '../../constants';

const TEMP_DEMAND = [
  { name: '0°C', value: 4200 },
  { name: '5°C', value: 4800 },
  { name: '10°C', value: 5500 },
  { name: '15°C', value: 6800 },
  { name: '20°C', value: 8200 },
  { name: '25°C', value: 9100 },
  { name: '30°C', value: 8500 },
];

const RAIN_DEMAND = [
  { name: 'None', value: 7200 },
  { name: 'Light', value: 8500 },
  { name: 'Moderate', value: 9800 },
  { name: 'Heavy', value: 10500 },
];

export default function WeatherInsights() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Weather Insights</h1>
        <p className="text-[var(--text-secondary)] mt-1">Correlation between meteorological conditions and ride demand</p>
      </div>

      {/* Top: Temp vs Demand */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Thermometer className="text-warning w-5 h-5" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Temperature vs Demand</h2>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TEMP_DEMAND}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
              <Line type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={3} dot={{ r: 4, fill: '#F4B000' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Below: Rainfall and Wind */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <CloudRain className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Rainfall vs Demand</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RAIN_DEMAND}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                  {RAIN_DEMAND.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 1 ? '#F4B000' : '#F4B00040'} stroke="#F4B000" strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Wind className="text-secondary w-5 h-5" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Wind Speed vs Demand</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={WEATHER_IMPACT}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="value" stroke="#F4B000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insight Card */}
      <div className="bg-primary/10 border border-primary/20 rounded-card p-6 flex items-start gap-4">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Info className="text-primary w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-primary">Key Weather Insight</h3>
          <p className="text-[var(--text-primary)]/80 mt-1">
            Historical data shows that ride demand increases by <span className="font-bold text-primary">24.5%</span> during moderate to heavy rainfall, especially in Manhattan and Brooklyn. The model accounts for this by increasing weight for precipitation features during peak hours.
          </p>
        </div>
      </div>
    </div>
  );
}
