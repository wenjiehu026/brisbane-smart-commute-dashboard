import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bus,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Gauge,
  Info,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Ship,
  Train,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAlerts, getArrivals, getHealth, getReliability, getRoutes, getVehicles } from "./api";
import type { DataSource } from "./api";
import type { Arrival, Health, Reliability, RouteSummary, ServiceAlert, Vehicle } from "./types";

const TILE_SIZE = 256;
const BRISBANE_CENTER = { latitude: -27.4698, longitude: 153.0251 };
const MAP_LANDMARKS = [
  { label: "CBD", latitude: -27.4705, longitude: 153.026 },
  { label: "UQ", latitude: -27.497, longitude: 153.013 },
  { label: "South Bank", latitude: -27.481, longitude: 153.023 },
  { label: "Hamilton", latitude: -27.438, longitude: 153.07 },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDelay(seconds: number) {
  if (seconds <= 30) return "On time";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min late`;
}

function formatTime(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAffectedRoutes(routes: string[]) {
  if (!routes.length) return "Routes: network-wide";
  const visibleRoutes = routes.slice(0, 5).join(", ");
  const remaining = routes.length - 5;
  return `Routes: ${visibleRoutes}${remaining > 0 ? ` + ${remaining} more` : ""}`;
}

function modeIcon(mode: RouteSummary["mode"]) {
  if (mode === "train") return <Train size={18} />;
  if (mode === "ferry") return <Ship size={18} />;
  return <Bus size={18} />;
}

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [query, setQuery] = useState("");
  const [noticeQuery, setNoticeQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Record<string, DataSource>>({});

  useEffect(() => {
    let active = true;

    async function loadStaticData() {
      const [healthResult, routeResult, alertResult, arrivalResult] = await Promise.all([
        getHealth(),
        getRoutes(),
        getAlerts(),
        getArrivals("UQ-LAKES"),
      ]);
      if (!active) return;
      setHealth(healthResult.data);
      setRoutes(routeResult.data);
      setAlerts(alertResult.data);
      setArrivals(arrivalResult.data);
      setSources((current) => ({
        ...current,
        health: healthResult.source,
        routes: routeResult.source,
        alerts: alertResult.source,
        arrivals: arrivalResult.source,
      }));
      setSelectedRouteId((current) => {
        const currentRoute = routeResult.data.find((route) => route.route_id === current);
        if (currentRoute && currentRoute.active_vehicle_count > 0) return current;
        const bestLiveRoute = routeResult.data.find((route) => route.active_vehicle_count > 0);
        return bestLiveRoute?.route_id ?? routeResult.data[0]?.route_id ?? "";
      });
    }

    loadStaticData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRouteData() {
      if (!selectedRouteId) return;
      setLoading(true);
      const [vehicleResult, reliabilityResult] = await Promise.all([
        getVehicles(selectedRouteId),
        getReliability(selectedRouteId),
      ]);
      if (!active) return;
      setVehicles(vehicleResult.data);
      setReliability(reliabilityResult.data);
      setSources((current) => ({
        ...current,
        vehicles: vehicleResult.source,
        reliability: reliabilityResult.source,
      }));
      setLoading(false);
    }

    loadRouteData();
    const timer = window.setInterval(loadRouteData, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedRouteId]);

  const selectedRoute = routes.find((route) => route.route_id === selectedRouteId) ?? routes[0];
  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return routes;
    return routes.filter((route) =>
      [route.route_short_name, route.route_long_name, route.mode].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, routes]);
  const networkScore = useMemo(() => {
    if (!routes.length) return 0;
    const averageDelay = routes.reduce((sum, route) => sum + route.average_delay_seconds, 0) / routes.length;
    return Math.max(42, Math.round(100 - averageDelay / 5));
  }, [routes]);
  const hasLiveBackend = health?.live_ingestion_enabled === true && sources.health === "live";
  const allVisibleLive = hasLiveBackend && Object.values(sources).length > 0 && Object.values(sources).every((source) => source === "live");
  const routesAreLive = hasLiveBackend && sources.routes === "live";
  const alertsAreLive = hasLiveBackend && sources.alerts === "live";
  const demoSources = Object.entries(sources)
    .filter(([, source]) => source === "demo")
    .map(([name]) => name);
  const filteredAlerts = useMemo(() => {
    const normalized = noticeQuery.trim().toLowerCase();
    if (!normalized) return alerts;
    return alerts.filter((alert) =>
      [alert.category, alert.summary, alert.affected_routes.join(" ")].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [alerts, noticeQuery]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Brisbane Smart Commute</p>
          <h1>Real-time transit reliability for SEQ commuters</h1>
          <p>
            A portfolio-grade full-stack dashboard that ingests TransLink GTFS-Realtime feeds, stores historical snapshots,
            and turns live vehicle data into route reliability insights.
          </p>
          <div className="hero-actions">
            <a href="#dashboard">View dashboard</a>
            <a href="#architecture" className="secondary">Architecture</a>
          </div>
        </div>
        <div className="system-card" aria-label="System health">
          <div className="status-row">
            <CheckCircle2 />
            <span>{hasLiveBackend ? "Live TransLink API" : "Demo fallback data"}</span>
          </div>
          <strong>{health?.service ?? "brisbane-smart-commute-api"}</strong>
          <small>Last ingestion: {formatTime(health?.last_ingestion_at ?? null)}</small>
          <small>{hasLiveBackend ? "GTFS-RT ingestion enabled" : "Backend offline or live ingestion disabled"}</small>
        </div>
      </header>

      <section className={cx("source-banner", allVisibleLive ? "live" : "demo")}>
        <strong>{allVisibleLive ? "Live TransLink data" : "Mixed or demo fallback data"}</strong>
        <span>
          {allVisibleLive
            ? "All visible API sections are currently loaded from the local FastAPI backend connected to TransLink GTFS-RT."
            : `Fallback sections: ${demoSources.length ? demoSources.join(", ") : "unknown"}. Start the backend to show live GTFS-RT data.`}
        </span>
      </section>

      <section className="metric-grid" id="dashboard">
        <MetricCard icon={<Route />} label="Tracked routes" value={routes.length} detail="Bus, train and ferry services" />
        <MetricCard icon={<Activity />} label="Active vehicles" value={routes.reduce((sum, route) => sum + route.active_vehicle_count, 0)} detail={routesAreLive ? "Latest GTFS-RT snapshot" : "Demo sample vehicles"} />
        <MetricCard
          icon={<Gauge />}
          label="Network score"
          value={`${networkScore}%`}
          detail="Derived from route delay data"
          help="This is a portfolio metric, not a TransLink official score. It starts from 100 and decreases as average route delay increases. If live history is sparse, treat it as indicative only."
        />
        <MetricCard icon={<AlertTriangle />} label="Open alerts" value={alerts.length} detail={alertsAreLive ? "Live service notices" : "Demo fallback notices"} />
      </section>

      <section className="dashboard-grid">
        <aside className="route-panel">
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routes, e.g. 66 or ferry" />
          </label>
          <div className="route-list">
            {filteredRoutes.map((route) => (
              <button
                className={cx("route-card", route.route_id === selectedRouteId && "selected")}
                key={route.route_id}
                onClick={() => setSelectedRouteId(route.route_id)}
              >
                <span className={cx("mode-badge", route.mode)}>{modeIcon(route.mode)} {route.route_short_name}</span>
                <strong>{route.route_long_name}</strong>
                <small>{route.active_vehicle_count} vehicles · {formatDelay(route.average_delay_seconds)} · {route.alert_count} alerts</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="map-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live operations</p>
              <h2>{selectedRoute?.route_long_name ?? "Route details"}</h2>
            </div>
            <span className="refresh-pill"><RefreshCw size={15} /> {loading ? "Refreshing" : "30s refresh"}</span>
          </div>
          <TransitMap vehicles={vehicles} />
          <div className="vehicle-strip">
            {vehicles.map((vehicle) => (
              <div className="vehicle-chip" key={vehicle.vehicle_id}>
                <Bus size={16} />
                <span>{vehicle.vehicle_id}</span>
                <strong>{formatDelay(vehicle.delay_seconds)}</strong>
              </div>
            ))}
            {!vehicles.length && <p className="muted">No current vehicles for this route yet.</p>}
          </div>
        </section>

        <section className="analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Reliability analytics</p>
              <h2>7-day route performance</h2>
            </div>
            <BarChart3 />
          </div>
          {reliability && <ReliabilityChart reliability={reliability} />}
        </section>

        <section className="arrival-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Stop arrivals</p>
              <h2>Upcoming services</h2>
            </div>
            <Clock />
          </div>
          <div className="arrival-list">
            {arrivals.slice(0, 5).map((arrival) => (
              <div className="arrival-row" key={`${arrival.trip_id}-${arrival.predicted_time}`}>
                <span>{arrival.route_id}</span>
                <div>
                  <strong>{arrival.stop_name}</strong>
                  <small>Scheduled {formatTime(arrival.scheduled_time)} · Predicted {formatTime(arrival.predicted_time)}</small>
                </div>
                <em className={arrival.delay_seconds > 180 ? "late" : ""}>{formatDelay(arrival.delay_seconds)}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="alert-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{alertsAreLive ? "Live service alerts" : "Demo service alerts"}</p>
              <h2>Current notices</h2>
            </div>
            <AlertTriangle />
          </div>
          <label className="search-box compact">
            <Search size={17} />
            <input
              value={noticeQuery}
              onChange={(event) => setNoticeQuery(event.target.value)}
              placeholder="Search notices by route, line or keyword"
            />
          </label>
          <p className="notice-count">
            Showing {Math.min(filteredAlerts.length, 6)} of {filteredAlerts.length} matching notices
          </p>
          <div className="alert-list">
            {filteredAlerts.slice(0, 6).map((alert) => (
              <article className={cx("alert-card", alert.severity)} key={alert.alert_id}>
                <span>{alert.category}</span>
                <strong>{alert.summary}</strong>
                <small>{formatAffectedRoutes(alert.affected_routes)}</small>
                {!alertsAreLive && <small>Source: demo fallback data, not an official TransLink alert.</small>}
              </article>
            ))}
            {!filteredAlerts.length && <p className="muted">No notices match this search.</p>}
          </div>
        </section>
      </section>

      <section className="architecture" id="architecture">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">System architecture</p>
            <h2>Cloud-ready realtime data pipeline</h2>
          </div>
          <Cloud />
        </div>
        <div className="architecture-grid">
          <ArchitectureStep icon={<RefreshCw />} title="GTFS-RT ingestion" text="Scheduled FastAPI worker polls TransLink vehicle, trip update and alert feeds." />
          <ArchitectureStep icon={<Database />} title="Historical storage" text="Normalized snapshots are stored for reliability analytics and route comparisons." />
          <ArchitectureStep icon={<ShieldCheck />} title="Resilient API" text="Health checks, mock fallback data and failure-safe parsing make the demo dependable." />
          <ArchitectureStep icon={<BarChart3 />} title="Frontend insights" text="React dashboard converts real-time transit data into maps, alerts and reliability metrics." />
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  help,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail: string;
  help?: string;
}) {
  return (
    <article className="metric-card">
      <span>{icon}</span>
      <p>
        {label}
        {help && (
          <button className="help-button" title={help} aria-label={`${label} explanation`}>
            <Info size={14} />
          </button>
        )}
      </p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TransitMap({ vehicles }: { vehicles: Vehicle[] }) {
  const [mapRef, mapSize] = useElementSize<HTMLDivElement>();
  const [zoomOffset, setZoomOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const validVehicles = vehicles.filter((vehicle) => Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude));
  const selectedVehicle = validVehicles.find((vehicle) => vehicle.vehicle_id === selectedVehicleId) ?? null;
  const viewport = {
    width: mapSize.width || 860,
    height: mapSize.height || (expanded ? 680 : 430),
  };
  const center = getMapCenter(validVehicles);
  const zoom = Math.max(10, Math.min(16, getMapZoom(validVehicles) + zoomOffset));
  const centerPixel = lonLatToWorldPixel(center.longitude, center.latitude, zoom);
  const tiles = getVisibleTiles(centerPixel, viewport.width, viewport.height, zoom);
  const markers = validVehicles
    .map((vehicle) => ({
      vehicle,
      position: getViewportPosition(vehicle.longitude, vehicle.latitude, centerPixel, viewport.width, viewport.height, zoom),
    }))
    .filter(({ position }) => position.left >= -48 && position.left <= viewport.width + 48 && position.top >= -48 && position.top <= viewport.height + 48);
  const landmarks = MAP_LANDMARKS.map((landmark) => ({
    ...landmark,
    position: getViewportPosition(landmark.longitude, landmark.latitude, centerPixel, viewport.width, viewport.height, zoom),
  })).filter(({ position }) => position.left >= -80 && position.left <= viewport.width + 80 && position.top >= -32 && position.top <= viewport.height + 32);

  return (
    <div className={cx("transit-map", expanded && "expanded")} ref={mapRef} aria-label="OpenStreetMap of Brisbane with live vehicle positions">
      {tiles.map((tile) => (
        <img
          alt=""
          className="map-tile"
          draggable={false}
          key={`${tile.z}-${tile.x}-${tile.y}`}
          loading="lazy"
          src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`}
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      {landmarks.map((landmark) => (
        <span className="map-landmark" key={landmark.label} style={{ left: landmark.position.left, top: landmark.position.top }}>
          {landmark.label}
        </span>
      ))}
      {markers.map(({ vehicle, position }) => (
        <button
          className={cx("vehicle-marker", vehicle.delay_seconds > 180 && "late", vehicle.vehicle_id === selectedVehicleId && "selected")}
          key={vehicle.vehicle_id}
          onClick={() => setSelectedVehicleId(vehicle.vehicle_id)}
          style={{ left: position.left, top: position.top }}
          title={`${vehicle.vehicle_id}: ${formatDelay(vehicle.delay_seconds)}`}
        >
          <MapPin size={18} />
        </button>
      ))}
      <div className="map-controls" aria-label="Map controls">
        <button onClick={() => setZoomOffset((value) => Math.min(3, value + 1))} title="Zoom in">
          <Plus size={17} />
        </button>
        <button onClick={() => setZoomOffset((value) => Math.max(-3, value - 1))} title="Zoom out">
          <Minus size={17} />
        </button>
        <button onClick={() => setExpanded((value) => !value)} title={expanded ? "Collapse map" : "Expand map"}>
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      {selectedVehicle && (
        <aside className="vehicle-detail">
          <button className="close-detail" onClick={() => setSelectedVehicleId(null)} aria-label="Close vehicle details">
            <X size={15} />
          </button>
          <p className="eyebrow">Vehicle details</p>
          <strong>{selectedVehicle.vehicle_id}</strong>
          <span>{formatDelay(selectedVehicle.delay_seconds)}</span>
          <small>Route: {selectedVehicle.route_id}</small>
          <small>Trip: {selectedVehicle.trip_id || "Unknown"}</small>
          <small>Position: {selectedVehicle.latitude.toFixed(5)}, {selectedVehicle.longitude.toFixed(5)}</small>
          <small>Speed: {selectedVehicle.speed ?? "Unavailable"}</small>
          <small>Bearing: {selectedVehicle.bearing ?? "Unavailable"}</small>
          <small>Updated: {formatDate(selectedVehicle.timestamp)}</small>
        </aside>
      )}
      {!validVehicles.length && <span className="map-empty">Waiting for live vehicle coordinates</span>}
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap contributors
      </a>
    </div>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function getMapCenter(vehicles: Vehicle[]) {
  if (!vehicles.length) return BRISBANE_CENTER;
  return {
    latitude: vehicles.reduce((sum, vehicle) => sum + vehicle.latitude, 0) / vehicles.length,
    longitude: vehicles.reduce((sum, vehicle) => sum + vehicle.longitude, 0) / vehicles.length,
  };
}

function getMapZoom(vehicles: Vehicle[]) {
  if (vehicles.length < 2) return 13;
  const latitudes = vehicles.map((vehicle) => vehicle.latitude);
  const longitudes = vehicles.map((vehicle) => vehicle.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const widestSpan = Math.max(latitudeSpan, longitudeSpan);
  if (widestSpan > 0.28) return 10;
  if (widestSpan > 0.14) return 11;
  if (widestSpan > 0.07) return 12;
  return 13;
}

function lonLatToWorldPixel(longitude: number, latitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const clippedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sinLatitude = Math.sin((clippedLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

function getViewportPosition(
  longitude: number,
  latitude: number,
  centerPixel: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
) {
  const pixel = lonLatToWorldPixel(longitude, latitude, zoom);
  return {
    left: width / 2 + pixel.x - centerPixel.x,
    top: height / 2 + pixel.y - centerPixel.y,
  };
}

function getVisibleTiles(centerPixel: { x: number; y: number }, width: number, height: number, zoom: number) {
  const minX = Math.floor((centerPixel.x - width / 2) / TILE_SIZE) - 1;
  const maxX = Math.floor((centerPixel.x + width / 2) / TILE_SIZE) + 1;
  const minY = Math.floor((centerPixel.y - height / 2) / TILE_SIZE) - 1;
  const maxY = Math.floor((centerPixel.y + height / 2) / TILE_SIZE) + 1;
  const maxTile = 2 ** zoom;
  const tiles: Array<{ x: number; y: number; z: number; left: number; top: number }> = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      tiles.push({
        x: ((x % maxTile) + maxTile) % maxTile,
        y,
        z: zoom,
        left: x * TILE_SIZE - centerPixel.x + width / 2,
        top: y * TILE_SIZE - centerPixel.y + height / 2,
      });
    }
  }

  return tiles;
}

function ReliabilityChart({ reliability }: { reliability: Reliability }) {
  const daily = reliability.daily.slice(-7);
  const observedDays = daily.filter((day) => day.observation_count > 0);
  const maxDelay = Math.max(...observedDays.map((day) => day.average_delay_seconds), 0);
  const hasLiveHistory = observedDays.length > 0 && maxDelay > 0;

  return (
    <div>
      <div className="reliability-summary">
        <span><strong>{formatDelay(reliability.average_delay_seconds)}</strong><small>average delay</small></span>
        <span><strong>{reliability.late_percentage}%</strong><small>late services</small></span>
        <span><strong>{reliability.observation_count}</strong><small>observations</small></span>
      </div>
      {hasLiveHistory ? (
        <div className="chart">
          {daily.map((day) => (
            <div className="bar-column" key={day.date}>
              <div className="bar-track">
                <span style={{ height: `${day.observation_count ? Math.max(10, (day.average_delay_seconds / maxDelay) * 100) : 0}%` }} />
              </div>
              <small>{new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="history-note">
          Live delay history is still accumulating. The chart appears once this route has trip update observations with measurable delay.
        </p>
      )}
    </div>
  );
}

function ArchitectureStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

export default App;
