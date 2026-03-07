import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ZoneDemand, Theme } from '../types';

interface MapComponentProps {
  zones: ZoneDemand[];
  theme: Theme;
  height?: string;
  simplified?: boolean;
}

const ThemeLayer = ({ theme }: { theme: Theme }) => {
  const map = useMap();
  useEffect(() => {
    // You can add logic here to change map style based on theme if using a provider like Mapbox
    // For OpenStreetMap, we just use different tile URLs if available
  }, [theme, map]);
  return null;
};

export default function MapComponent({ zones, theme, height = "400px", simplified = false }: MapComponentProps) {
  const center: [number, number] = [40.730610, -73.935242]; // NYC Center

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'High': return '#EF4444'; // danger
      case 'Medium': return '#F59E0B'; // warning
      case 'Low': return '#3B82F6'; // primary
      default: return '#94A3B8';
    }
  };

  const tileUrl = theme === 'dark'
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }} className="border border-[var(--border)]">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={!simplified}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        <ThemeLayer theme={theme} />
        {zones.map((zone) => (
          <CircleMarker
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={simplified ? 10 : 15}
            pathOptions={{
              fillColor: getDemandColor(zone.demandLevel),
              color: getDemandColor(zone.demandLevel),
              fillOpacity: 0.6,
              weight: 1
            }}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-sm mb-1">{zone.name}</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Predicted Demand:</span>
                    <span className="font-bold">{zone.demand.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Event Intensity:</span>
                    <span className={`font-bold ${zone.eventIntensity === 'High' ? 'text-red-500' : ''}`}>{zone.eventIntensity}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Weather:</span>
                    <span className="font-bold">{zone.weatherCondition}</span>
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
