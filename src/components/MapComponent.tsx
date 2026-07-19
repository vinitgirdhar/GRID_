import { memo, useEffect } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

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

export interface MapHotspot {
  id: string;
  position: [number, number];
  label: string;
  intensity: 'high' | 'medium' | 'low';
  demand?: number;
}

export interface MapDriverPin {
  id: string;
  position: [number, number];
  name: string;
  targetLabel: string;
}

interface MapComponentProps {
  zones?: ZoneDemand[];
  theme: Theme;
  height?: string;
  simplified?: boolean;
  route?: MapRoute;
  ridePins?: MapRidePin[];
  hotspots?: MapHotspot[];
  driverPins?: MapDriverPin[];
  offlineMode?: boolean;
  noBorderRadius?: boolean;
  zoom?: number;
  showYouAreHere?: boolean;
  youAreHerePosition?: [number, number];
  autoFit?: boolean;
}

function ThemeLayer({ theme }: { theme: Theme }) {
  const map = useMap();

  useEffect(() => {
    void map;
    void theme;
  }, [map, theme]);

  return null;
}

function AutoFitView({
  enabled,
  points,
}: {
  enabled: boolean;
  points: Array<[number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], map.getZoom());
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [32, 32],
      maxZoom: 14,
    });
  }, [enabled, map, points]);

  return null;
}

const YOU_ARE_HERE_ICON = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:36px;height:44px">
      <div style="
        position:absolute;inset:0;margin:auto;
        width:20px;height:20px;border-radius:50%;
        background:#3b82f6;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(59,130,246,0.35),0 2px 8px rgba(0,0,0,0.25);
      "></div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        background:#1d4ed8;color:#fff;
        font-size:8px;font-weight:900;letter-spacing:0.05em;
        padding:1px 5px;border-radius:4px;white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.2);
      ">YOU</div>
    </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 38],
  popupAnchor: [0, -40],
});

const OTHER_DRIVER_ICON = L.divIcon({
  className: '',
  html: `
    <div style="
      width:26px;height:26px;border-radius:50%;
      background:#0ea5e9;border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;line-height:1;
      box-shadow:0 0 0 3px rgba(14,165,233,0.3),0 2px 6px rgba(0,0,0,0.3);
    ">🚕</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14],
});

function MapComponent({
  zones = [],
  theme,
  height = '400px',
  simplified = false,
  route,
  ridePins = [],
  hotspots = [],
  driverPins = [],
  offlineMode = false,
  noBorderRadius = false,
  zoom,
  showYouAreHere = false,
  youAreHerePosition,
  autoFit = false,
}: MapComponentProps) {
  // When ride pins exist, center on driver location so spokes fan out naturally
  const center: [number, number] = route
    ? ridePins.length > 0
      ? route.start
      : [(route.start[0] + route.end[0]) / 2, (route.start[1] + route.end[1]) / 2]
    : youAreHerePosition && showYouAreHere
      ? youAreHerePosition
    : [40.73061, -73.935242];

  // Zoom 14 shows clear street names; fall back to 11 for the zone heatmap view
  const zoomLevel = zoom ?? (route ? 14 : 11);

  // Priority colors: red = high priority, yellow = moderate, green = low
  const getDemandColor = (level: string) => {
    switch (level) {
      case 'High':
        return '#EF4444';
      case 'Medium':
        return '#F59E0B';
      case 'Low':
        return '#22C55E';
      default:
        return '#94A3B8';
    }
  };

  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const autoFitPoints: Array<[number, number]> = [
    ...(route ? [route.start, route.end] : []),
    ...(showYouAreHere && youAreHerePosition ? [youAreHerePosition] : []),
    ...hotspots.map((spot) => spot.position),
    ...ridePins.map((pin) => pin.position),
    ...driverPins.map((pin) => pin.position),
    ...zones.map((zone) => [zone.lat, zone.lng] as [number, number]),
  ];

  return (
    <div
      style={{ height, width: '100%', borderRadius: noBorderRadius ? '0' : '12px', overflow: 'hidden' }}
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
        <AutoFitView enabled={autoFit} points={autoFitPoints} />

        {route && (
          <>
            {/* Spoke lines from driver position to each ride pin pickup */}
            {ridePins.map((pin) => (
              <Polyline
                key={`spoke-${pin.id}`}
                positions={[route.start, pin.position]}
                dashArray="6, 6"
                color="#facc15"
                weight={3}
                opacity={0.75}
              />
            ))}

            {/* "You are here" marker at driver start */}
            <Marker position={route.start} icon={YOU_ARE_HERE_ICON}>
              <Popup>You are here</Popup>
            </Marker>

            {/* Destination marker */}
            <CircleMarker
              center={route.end}
              radius={8}
              pathOptions={{ fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }}
            >
              <Popup>Destination</Popup>
            </CircleMarker>
          </>
        )}

        {showYouAreHere && (
          <Marker position={youAreHerePosition ?? center} icon={YOU_ARE_HERE_ICON}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {hotspots.map((spot) => {
          const color = spot.intensity === 'high' ? '#ef4444' : spot.intensity === 'medium' ? '#f59e0b' : '#22c55e';
          const radius = spot.intensity === 'high' ? 44 : spot.intensity === 'medium' ? 34 : 26;
          return (
            <CircleMarker
              key={`hotspot-${spot.id}`}
              center={spot.position}
              radius={radius}
              pathOptions={{ fillColor: color, color, fillOpacity: 0.18, weight: 2, opacity: 0.5 }}
            >
              <Popup>
                <div className="p-1 min-w-[140px]">
                  <div className="flex items-center gap-2 border-b pb-1 mb-1">
                    <span style={{ background: color }} className="w-2 h-2 rounded-full inline-block shrink-0" />
                    <span className="font-bold text-sm">{spot.label}</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                    {spot.intensity} demand
                  </p>
                  {spot.demand != null && (
                    <p className="text-xs text-gray-500 mt-0.5">{spot.demand.toFixed(0)} trips/hr</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {driverPins.map((pin) => (
          <Marker key={`driver-${pin.id}`} position={pin.position} icon={OTHER_DRIVER_ICON}>
            <Popup>
              <div className="p-1 min-w-[130px]">
                <h3 className="font-bold text-sm border-b pb-1 mb-1">{pin.name}</h3>
                <p className="text-xs text-gray-600">Heading to <span className="font-semibold">{pin.targetLabel}</span></p>
              </div>
            </Popup>
          </Marker>
        ))}

        {ridePins.map((pin) => (
          <CircleMarker
            key={`pin-${pin.id}`}
            center={pin.position}
            radius={9}
            pathOptions={{
              fillColor: '#22c55e',
              color: '#fff',
              weight: 2.5,
              fillOpacity: 0.92,
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
            radius={simplified ? 20 : 30}
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
                  {zone.driversHeading != null && zone.driversHeading > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Drivers heading:</span>
                      <span className="font-bold text-sky-600">{zone.driversHeading} 🚕</span>
                    </div>
                  )}
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
          <div className="absolute top-4 left-4 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-400 shadow-lg">
            Offline Navigation
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[rgba(250,204,21,0.15)] bg-[#0a0a1e] px-4 py-3 shadow-xl">
            <p className="text-sm font-bold text-[#e8edf3]">Limited detail mode</p>
            <p className="mt-1 text-xs font-medium text-[#94a3b8]">
              Cached ride markers and route guidance remain visible. Base street tiles are unavailable offline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function areMapPropsEqual(prev: MapComponentProps, next: MapComponentProps) {
  return (
    prev.theme === next.theme &&
    prev.height === next.height &&
    prev.simplified === next.simplified &&
    prev.offlineMode === next.offlineMode &&
    prev.noBorderRadius === next.noBorderRadius &&
    prev.zoom === next.zoom &&
    prev.showYouAreHere === next.showYouAreHere &&
    prev.autoFit === next.autoFit &&
    prev.route === next.route &&
    prev.ridePins === next.ridePins &&
    prev.hotspots === next.hotspots &&
    prev.driverPins === next.driverPins &&
    prev.zones === next.zones &&
    prev.youAreHerePosition === next.youAreHerePosition
  );
}

export default memo(MapComponent, areMapPropsEqual);
