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
  MapPin,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Ship,
  Train,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAlerts, getArrivals, getHealth, getReliability, getRoutes, getVehicles } from "./api";
import type { Arrival, Health, Reliability, RouteSummary, ServiceAlert, Vehicle } from "./types";

const BRISBANE_BOUNDS = {
  north: -27.42,
  south: -27.56,
  west: 152.92,
  east: 153.08,
};

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
  const [loading, setLoading] = useState(true);

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
      setHealth(healthResult);
      setRoutes(routeResult);
      setAlerts(alertResult);
      setArrivals(arrivalResult);
      setSelectedRouteId((current) => {
        const currentRoute = routeResult.find((route) => route.route_id === current);
        if (currentRoute && currentRoute.active_vehicle_count > 0) return current;
        const bestLiveRoute = routeResult.find((route) => route.active_vehicle_count > 0);
        return bestLiveRoute?.route_id ?? routeResult[0]?.route_id ?? "";
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
      setVehicles(vehicleResult);
      setReliability(reliabilityResult);
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
            <span>{health?.status === "ok" ? "API healthy" : "Demo mode"}</span>
          </div>
          <strong>{health?.service ?? "brisbane-smart-commute-api"}</strong>
          <small>Last ingestion: {formatTime(health?.last_ingestion_at ?? null)}</small>
          <small>{health?.live_ingestion_enabled ? "Live ingestion enabled" : "Mock fallback ready"}</small>
        </div>
      </header>

      <section className="metric-grid" id="dashboard">
        <MetricCard icon={<Route />} label="Tracked routes" value={routes.length} detail="Bus, train and ferry services" />
        <MetricCard icon={<Activity />} label="Active vehicles" value={routes.reduce((sum, route) => sum + route.active_vehicle_count, 0)} detail="Latest GTFS-RT snapshot" />
        <MetricCard icon={<Gauge />} label="Network score" value={`${networkScore}%`} detail="Derived from delay history" />
        <MetricCard icon={<AlertTriangle />} label="Open alerts" value={alerts.length} detail="Service notices affecting routes" />
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
              <p className="eyebrow">Service alerts</p>
              <h2>Current notices</h2>
            </div>
            <AlertTriangle />
          </div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className={cx("alert-card", alert.severity)} key={alert.alert_id}>
                <span>{alert.category}</span>
                <strong>{alert.summary}</strong>
                <small>Routes: {alert.affected_routes.join(", ") || "Network-wide"}</small>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="architecture" id="architecture">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Resume talking points</p>
            <h2>Cloud-ready system design</h2>
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

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return (
    <article className="metric-card">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TransitMap({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="transit-map" aria-label="Simplified Brisbane map with live vehicle positions">
      <div className="river-line" />
      <span className="map-label cbd">CBD</span>
      <span className="map-label uq">UQ</span>
      <span className="map-label hamilton">Hamilton</span>
      <span className="map-label southbank">South Bank</span>
      {vehicles.map((vehicle) => {
        const x = ((vehicle.longitude - BRISBANE_BOUNDS.west) / (BRISBANE_BOUNDS.east - BRISBANE_BOUNDS.west)) * 100;
        const y = ((BRISBANE_BOUNDS.north - vehicle.latitude) / (BRISBANE_BOUNDS.north - BRISBANE_BOUNDS.south)) * 100;
        return (
          <button
            className={cx("vehicle-marker", vehicle.delay_seconds > 180 && "late")}
            key={vehicle.vehicle_id}
            style={{ left: `${Math.min(96, Math.max(4, x))}%`, top: `${Math.min(92, Math.max(8, y))}%` }}
            title={`${vehicle.vehicle_id}: ${formatDelay(vehicle.delay_seconds)}`}
          >
            <MapPin size={18} />
          </button>
        );
      })}
    </div>
  );
}

function ReliabilityChart({ reliability }: { reliability: Reliability }) {
  const maxDelay = Math.max(...reliability.daily.map((day) => day.average_delay_seconds), 1);

  return (
    <div>
      <div className="reliability-summary">
        <span><strong>{formatDelay(reliability.average_delay_seconds)}</strong><small>average delay</small></span>
        <span><strong>{reliability.late_percentage}%</strong><small>late services</small></span>
        <span><strong>{reliability.observation_count}</strong><small>observations</small></span>
      </div>
      <div className="chart">
        {reliability.daily.map((day) => (
          <div className="bar-column" key={day.date}>
            <div className="bar-track">
              <span style={{ height: `${Math.max(10, (day.average_delay_seconds / maxDelay) * 100)}%` }} />
            </div>
            <small>{new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}</small>
          </div>
        ))}
      </div>
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
