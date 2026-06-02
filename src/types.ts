export type Health = {
  status: string;
  service: string;
  last_ingestion_at: string | null;
  live_ingestion_enabled: boolean;
};

export type RouteSummary = {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  mode: "bus" | "train" | "ferry" | "tram";
  active_vehicle_count: number;
  average_delay_seconds: number;
  alert_count: number;
};

export type Vehicle = {
  vehicle_id: string;
  route_id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speed: number | null;
  timestamp: string;
  delay_seconds: number;
};

export type Arrival = {
  stop_id: string;
  route_id: string;
  trip_id: string;
  stop_name: string;
  scheduled_time: string;
  predicted_time: string;
  delay_seconds: number;
};

export type ServiceAlert = {
  alert_id: string;
  severity: "info" | "warning" | "severe";
  category: string;
  summary: string;
  affected_routes: string[];
  active_from: string | null;
  active_to: string | null;
};

export type Reliability = {
  route_id: string;
  from_date: string;
  to_date: string;
  average_delay_seconds: number;
  late_percentage: number;
  alert_count: number;
  observation_count: number;
  daily: Array<{
    date: string;
    average_delay_seconds: number;
    late_percentage: number;
    alert_count: number;
    observation_count: number;
  }>;
};
