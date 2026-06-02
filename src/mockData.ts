import type { Arrival, Health, Reliability, RouteSummary, ServiceAlert, Vehicle } from "./types";

export const mockHealth: Health = {
  status: "ok",
  service: "brisbane-smart-commute-api",
  last_ingestion_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  live_ingestion_enabled: false,
};

export const mockRoutes: RouteSummary[] = [
  {
    route_id: "66",
    route_short_name: "66",
    route_long_name: "UQ Lakes - RBWH via CBD",
    mode: "bus",
    active_vehicle_count: 18,
    average_delay_seconds: 124,
    alert_count: 1,
  },
  {
    route_id: "BRCL",
    route_short_name: "Beenleigh",
    route_long_name: "Beenleigh line to Central",
    mode: "train",
    active_vehicle_count: 9,
    average_delay_seconds: 72,
    alert_count: 0,
  },
  {
    route_id: "CITYCAT",
    route_short_name: "CityCat",
    route_long_name: "UQ St Lucia - Northshore Hamilton",
    mode: "ferry",
    active_vehicle_count: 7,
    average_delay_seconds: 38,
    alert_count: 0,
  },
  {
    route_id: "199",
    route_short_name: "199",
    route_long_name: "West End - Teneriffe via City",
    mode: "bus",
    active_vehicle_count: 14,
    average_delay_seconds: 214,
    alert_count: 2,
  },
  {
    route_id: "SPRINT",
    route_short_name: "Springfield",
    route_long_name: "Springfield line to Central",
    mode: "train",
    active_vehicle_count: 6,
    average_delay_seconds: 91,
    alert_count: 1,
  },
];

export const mockVehicles: Record<string, Vehicle[]> = {
  "66": [
    marker("bus-66-1", "66", "66-in-104", -27.497, 153.013, 98, 130),
    marker("bus-66-2", "66", "66-out-221", -27.469, 153.024, 12, 80),
    marker("bus-66-3", "66", "66-in-114", -27.444, 153.028, 202, 240),
  ],
  BRCL: [
    marker("train-beenleigh-1", "BRCL", "bn-208", -27.466, 153.026, 310, 46),
    marker("train-beenleigh-2", "BRCL", "bn-215", -27.512, 153.033, 300, 91),
  ],
  CITYCAT: [
    marker("ferry-citycat-1", "CITYCAT", "cc-19", -27.475, 153.017, 82, 20),
    marker("ferry-citycat-2", "CITYCAT", "cc-24", -27.452, 153.046, 66, 44),
  ],
  "199": [
    marker("bus-199-1", "199", "199-in-88", -27.481, 153.009, 12, 390),
    marker("bus-199-2", "199", "199-out-41", -27.456, 153.043, 184, 175),
  ],
  SPRINT: [
    marker("train-springfield-1", "SPRINT", "sp-501", -27.470, 153.018, 260, 60),
    marker("train-springfield-2", "SPRINT", "sp-507", -27.535, 152.947, 82, 119),
  ],
};

export const mockArrivals: Arrival[] = [
  arrival("UQ-LAKES", "66", "UQ Lakes station", 2, 3, 60),
  arrival("UQ-LAKES", "66", "UQ Lakes station", 9, 12, 180),
  arrival("CENTRAL", "BRCL", "Central station", 5, 6, 60),
  arrival("SOUTHBANK", "CITYCAT", "South Bank ferry terminal", 7, 7, 0),
  arrival("WESTEND", "199", "Boundary Street at West End", 4, 10, 360),
];

export const mockAlerts: ServiceAlert[] = [
  {
    alert_id: "roadworks-cbd",
    severity: "warning",
    category: "Roadworks",
    summary: "CBD roadworks may add 5-10 minutes to selected bus services.",
    affected_routes: ["66", "199"],
    active_from: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    active_to: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    alert_id: "platform-change-springfield",
    severity: "info",
    category: "Platform change",
    summary: "Springfield line services are using an alternate platform at Central.",
    affected_routes: ["SPRINT"],
    active_from: null,
    active_to: null,
  },
];

export const mockReliability: Record<string, Reliability> = Object.fromEntries(
  mockRoutes.map((route, routeIndex) => {
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        date: date.toISOString().slice(0, 10),
        average_delay_seconds: Math.max(20, route.average_delay_seconds + (index - 3) * 18 + routeIndex * 7),
        late_percentage: Math.min(88, Math.max(8, 22 + routeIndex * 8 + index * 2)),
        alert_count: index % 3 === 0 ? route.alert_count : 0,
        observation_count: 420 + index * 26,
      };
    });

    return [
      route.route_id,
      {
        route_id: route.route_id,
        from_date: daily[0].date,
        to_date: daily[daily.length - 1].date,
        average_delay_seconds: Math.round(daily.reduce((sum, item) => sum + item.average_delay_seconds, 0) / daily.length),
        late_percentage: Math.round(daily.reduce((sum, item) => sum + item.late_percentage, 0) / daily.length),
        alert_count: daily.reduce((sum, item) => sum + item.alert_count, 0),
        observation_count: daily.reduce((sum, item) => sum + item.observation_count, 0),
        daily,
      },
    ];
  }),
);

function marker(
  vehicle_id: string,
  route_id: string,
  trip_id: string,
  latitude: number,
  longitude: number,
  bearing: number,
  delay_seconds: number,
): Vehicle {
  return {
    vehicle_id,
    route_id,
    trip_id,
    latitude,
    longitude,
    bearing,
    speed: null,
    timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 5).toISOString(),
    delay_seconds,
  };
}

function arrival(
  stop_id: string,
  route_id: string,
  stop_name: string,
  scheduledMinutes: number,
  predictedMinutes: number,
  delay_seconds: number,
): Arrival {
  const scheduled = new Date(Date.now() + scheduledMinutes * 60 * 1000);
  const predicted = new Date(Date.now() + predictedMinutes * 60 * 1000);
  return {
    stop_id,
    route_id,
    trip_id: `${route_id}-${scheduledMinutes}`,
    stop_name,
    scheduled_time: scheduled.toISOString(),
    predicted_time: predicted.toISOString(),
    delay_seconds,
  };
}
