import { mockAlerts, mockArrivals, mockHealth, mockReliability, mockRoutes, mockVehicles } from "./mockData";
import type { Arrival, Health, Reliability, RouteSummary, ServiceAlert, Vehicle } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getHealth() {
  return getJson<Health>("/health", mockHealth);
}

export function getRoutes() {
  return getJson<RouteSummary[]>("/routes", mockRoutes);
}

export function getVehicles(routeId: string) {
  return getJson<Vehicle[]>(`/routes/${encodeURIComponent(routeId)}/vehicles`, mockVehicles[routeId] ?? []);
}

export function getArrivals(stopId: string) {
  return getJson<Arrival[]>(`/stops/${encodeURIComponent(stopId)}/arrivals`, mockArrivals);
}

export function getAlerts() {
  return getJson<ServiceAlert[]>("/alerts", mockAlerts);
}

export function getReliability(routeId: string) {
  return getJson<Reliability>(
    `/analytics/routes/${encodeURIComponent(routeId)}/reliability`,
    mockReliability[routeId] ?? mockReliability["66"],
  );
}
