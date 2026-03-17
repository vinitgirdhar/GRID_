import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { Theme, ZoneDemand } from '../types';

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
  offlineMode?: boolean;
}

function ThemeLayer({ theme }: { theme: Theme }) {
  const map = useMap();

  useEffect(() => {
    void map;
    void theme;
  }, [map, theme]);

  return null;
}

export default function MapComponent({
  zones = [],
  theme,
  height = '400px',
  simplified = false,
  route,
  ridePins = [],
  offlineMode = false,
}: MapComponentProps) {
  const center: [number, number] = route
    ? [(route.start[0] + route.end[0]) / 2, (route.start[1] + route.end[1]) / 2]
    : [40.73061, -73.935242];

  const zoomLevel = route ? 12 : 11;

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'High':
        return '#EF4444';
      case 'Medium':
        return '#F59E0B';
      case 'Low':
        return '#3B82F6';
      default:
        return '#94A3B8';
    }
  };

  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div
      style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}
      className="border border-[var(--border)] relative z-0 bg-[linear-gradient(180deg,rgba(241,245,249,0.92),rgba(226,232,240,0.92))]"
    >
      <MapContainer
        key={`${center[0]}-${center[1]}-${offlineMode ? 'offline' : 'online'}`}
        center={center}
        zoom={zoomLevel}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={!simplified}
      >
        {!offlineMode && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url={tileUrl}
          />
        )}
        <ThemeLayer theme={theme} />

        {route && (
          <>
            <Polyline
              positions={[route.start, route.end]}
              dashArray="8, 8"
              color="#facc15"
              weight={4}
              opacity={0.8}
            />
            <CircleMarker
              center={route.start}
              radius={6}
              pathOptions={{ fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1 }}
            >
              <Popup>Your Location</Popup>
            </CircleMarker>
            <CircleMarker
              center={route.end}
              radius={8}
              pathOptions={{ fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }}
            >
              <Popup>Destination</Popup>
            </CircleMarker>
          </>
        )}

        {ridePins.map((pin) => (
          <CircleMarker
            key={`pin-${pin.id}`}
            center={pin.position}
            radius={8}
            pathOptions={{
              fillColor: '#22c55e',
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9,
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

        {zones.map((zone) => (
          <CircleMarker
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={simplified ? 10 : 15}
            pathOptions={{
              fillColor: getDemandColor(zone.demandLevel),
              color: getDemandColor(zone.demandLevel),
              fillOpacity: 0.6,
              weight: 1,
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
                    <span className={`font-bold ${zone.eventIntensity === 'High' ? 'text-red-500' : ''}`}>
                      {zone.eventIntensity}
                    </span>
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

      {offlineMode && (
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.18))]" />
          <div className="absolute top-4 left-4 rounded-full border border-amber-300/60 bg-amber-50/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-900 shadow-lg">
            Offline Navigation
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-300/70 bg-white/92 px-4 py-3 shadow-xl backdrop-blur">
            <p className="text-sm font-bold text-slate-900">Limited detail mode</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Cached ride markers and route guidance remain visible. Base street tiles are unavailable offline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
