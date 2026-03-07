import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Theme } from '../types';
import { HistoricalDemand } from '../services/predictionService';

interface HistoricalMapComponentProps {
  data: HistoricalDemand[];
  theme: Theme;
  height?: string;
}

export default function HistoricalMapComponent({ data, theme, height = "500px" }: HistoricalMapComponentProps) {
  const center: [number, number] = [40.730610, -73.935242]; // NYC Center
  
  // Blue -> Yellow -> Red gradient
  const getHistoricalColor = (count: number) => {
    if (count > 9000) return '#EF4444'; // Red
    if (count > 5000) return '#F59E0B'; // Yellow/Orange
    return '#3B82F6'; // Blue
  };

  const tileUrl = theme === 'dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }} className="border border-[var(--border)]">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        {data.map((item) => (
          <CircleMarker 
            key={item.id}
            center={[item.lat, item.lng]}
            radius={Math.sqrt(item.count) / 4} // Scale radius by demand
            pathOptions={{ 
              fillColor: getHistoricalColor(item.count), 
              color: getHistoricalColor(item.count),
              fillOpacity: 0.5,
              weight: 1
            }}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-sm mb-1">{item.name}</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Historical Demand:</span>
                    <span className="font-bold">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Avg Demand Level:</span>
                    <span className={`font-bold ${item.avgLevel === 'High' ? 'text-red-500' : ''}`}>{item.avgLevel}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
