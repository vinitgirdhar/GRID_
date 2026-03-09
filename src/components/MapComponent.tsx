import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { ZoneDemand, Theme } from '../types';

export interface MapRoute {
  start: [number, number];
  end: [number, number];
}

export interface MapRidePin {
  id: string;
  position: [number, number];
  label: string;
  fare: number;
}

interface MapComponentProps {
  zones?: ZoneDemand[];
  theme: Theme;
  height?: string;
  simplified?: boolean;
  route?: MapRoute;
  ridePins?: MapRidePin[];
}

const ThemeLayer = ({ theme }: { theme: Theme }) => {
  const map = useMap();
  useEffect(() => {
    // You can add logic here to change map style based on theme if using a provider like Mapbox
    // For OpenStreetMap, we just use different tile URLs if available
  }, [theme, map]);
  return null;
};

export default function MapComponent({
  zones = [],
  theme,
  height = "400px",
  simplified = false,
  route,
  ridePins = []
}: MapComponentProps) {
  // If we have a route, roughly center on the midpoint, else default NYC
  const center: [number, number] = route
    ? [(route.start[0] + route.end[0]) / 2, (route.start[1] + route.end[1]) / 2]
    : [40.730610, -73.935242];

  const zoomLevel = route ? 12 : 11;

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
    <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }} className="border border-[var(--border)] relative z-0">
      <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={zoomLevel} style={{ height: '100%', width: '100%' }} scrollWheelZoom={!simplified}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={tileUrl}
        />
        <ThemeLayer theme={theme} />

        {/* Render Route if available */}
        {route && (
          <>
            <Polyline
              positions={[route.start, route.end]}
              dashArray="8, 8"
              color="#facc15"
              weight={4}
              opacity={0.8}
            />
            {/* Start Pin */}
            <CircleMarker center={route.start} radius={6} pathOptions={{ fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1 }}>
              <Popup>Your Location</Popup>
            </CircleMarker>
            {/* End Pin */}
            <CircleMarker center={route.end} radius={8} pathOptions={{ fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }}>
              <Popup>Destination</Popup>
            </CircleMarker>
          </>
        )}

        {/* Render Ride Pins if available */}
        {ridePins && ridePins.map((pin) => (
          <CircleMarker
            key={`pin-${pin.id}`}
            center={pin.position}
            radius={8}
            pathOptions={{
              fillColor: '#22c55e', // Success green for rides
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9
            }}
          >
            <Popup>
              <div className="p-1 min-w-[120px]">
                <h3 className="font-bold border-b pb-1 mb-1">{pin.label}</h3>
                <p className="text-sm font-bold text-success">${pin.fare.toFixed(2)}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Render Default Zones */}
        {zones && zones.map((zone) => (
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
