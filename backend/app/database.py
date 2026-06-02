from __future__ import annotations

from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path
import sqlite3
from typing import Iterable

from . import sample_data


SCHEMA = """
CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT PRIMARY KEY,
  route_short_name TEXT NOT NULL,
  route_long_name TEXT NOT NULL,
  mode TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  bearing REAL,
  speed REAL,
  timestamp TEXT NOT NULL,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  UNIQUE(vehicle_id, timestamp)
);

CREATE TABLE IF NOT EXISTS trip_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_name TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  predicted_time TEXT NOT NULL,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trip_id, stop_id, predicted_time)
);

CREATE TABLE IF NOT EXISTS service_alerts (
  alert_id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  affected_routes TEXT NOT NULL,
  active_from TEXT,
  active_to TEXT
);

CREATE TABLE IF NOT EXISTS route_reliability_daily (
  route_id TEXT NOT NULL,
  date TEXT NOT NULL,
  average_delay_seconds INTEGER NOT NULL,
  late_percentage INTEGER NOT NULL,
  alert_count INTEGER NOT NULL,
  observation_count INTEGER NOT NULL,
  PRIMARY KEY(route_id, date)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL,
  message TEXT
);
"""


class Database:
    def __init__(self, path: str):
        self.path = path
        self._memory_connection: sqlite3.Connection | None = None
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        else:
            self._memory_connection = sqlite3.connect(path)
            self._memory_connection.row_factory = sqlite3.Row
        self.initialize()

    @contextmanager
    def connect(self):
        if self._memory_connection is not None:
            yield self._memory_connection
            self._memory_connection.commit()
            return
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)

    def seed_if_empty(self) -> None:
        with self.connect() as connection:
            route_count = connection.execute("SELECT COUNT(*) FROM routes").fetchone()[0]
            if route_count:
                return
            connection.executemany(
                "INSERT INTO routes(route_id, route_short_name, route_long_name, mode) VALUES (?, ?, ?, ?)",
                sample_data.ROUTES,
            )
            self.upsert_vehicle_snapshots(connection, sample_data.VEHICLES)
            self.upsert_trip_updates(connection, sample_data.TRIP_UPDATES)
            self.upsert_service_alerts(connection, sample_data.ALERTS)
            self.rebuild_reliability(connection)

    def ensure_realtime_routes(self, connection: sqlite3.Connection, route_ids: Iterable[str]) -> None:
        rows = sorted({route_id for route_id in route_ids if route_id})
        connection.executemany(
            """
            INSERT OR IGNORE INTO routes(route_id, route_short_name, route_long_name, mode)
            VALUES (?, ?, ?, ?)
            """,
            (_route_label(route_id) for route_id in rows),
        )
        connection.execute(
            """
            UPDATE routes
            SET
              route_short_name = substr(route_id, 1, instr(route_id, '-') - 1),
              route_long_name = 'TransLink route ' || substr(route_id, 1, instr(route_id, '-') - 1)
            WHERE route_long_name LIKE 'TransLink route %'
              AND instr(route_id, '-') > 0
            """
        )

    def upsert_vehicle_snapshots(self, connection: sqlite3.Connection, rows: Iterable[tuple]) -> None:
        connection.executemany(
            """
            INSERT OR IGNORE INTO vehicle_snapshots(
              vehicle_id, route_id, trip_id, latitude, longitude, bearing, speed, timestamp, delay_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

    def upsert_trip_updates(self, connection: sqlite3.Connection, rows: Iterable[tuple]) -> None:
        connection.executemany(
            """
            INSERT OR IGNORE INTO trip_updates(
              route_id, trip_id, stop_id, stop_name, scheduled_time, predicted_time, delay_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

    def upsert_service_alerts(self, connection: sqlite3.Connection, rows: Iterable[tuple]) -> None:
        connection.executemany(
            """
            INSERT OR REPLACE INTO service_alerts(
              alert_id, severity, category, summary, affected_routes, active_from, active_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

    def rebuild_reliability(self, connection: sqlite3.Connection) -> None:
        routes = connection.execute("SELECT route_id FROM routes").fetchall()
        today = date.today()
        for route_index, route in enumerate(routes):
            for days_back in range(6, -1, -1):
                day = today - timedelta(days=days_back)
                base_delay = 55 + route_index * 34 + (6 - days_back) * 11
                late_percentage = min(86, 18 + route_index * 9 + (6 - days_back) * 2)
                alert_count = connection.execute(
                    "SELECT COUNT(*) FROM service_alerts WHERE affected_routes LIKE ?",
                    (f"%{route['route_id']}%",),
                ).fetchone()[0]
                connection.execute(
                    """
                    INSERT OR REPLACE INTO route_reliability_daily(
                      route_id, date, average_delay_seconds, late_percentage, alert_count, observation_count
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (route["route_id"], day.isoformat(), base_delay, late_percentage, alert_count, 380 + days_back * 31),
                )

    def record_ingestion(self, status: str, message: str | None = None) -> None:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO ingestion_runs(status, message, completed_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (status, message),
            )

    def last_ingestion_at(self) -> str | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT completed_at FROM ingestion_runs WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1"
            ).fetchone()
            return row["completed_at"] if row else None

    def routes(self) -> list[dict]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                  r.route_id,
                  r.route_short_name,
                  r.route_long_name,
                  r.mode,
                  COUNT(DISTINCT latest.vehicle_id) AS active_vehicle_count,
                  COALESCE(AVG(latest.delay_seconds), 0) AS average_delay_seconds,
                  (
                    SELECT COUNT(*)
                    FROM service_alerts a
                    WHERE a.affected_routes LIKE '%' || r.route_id || '%'
                  ) AS alert_count
                FROM routes r
                LEFT JOIN (
                  SELECT v.*
                  FROM vehicle_snapshots v
                  JOIN (
                    SELECT vehicle_id, MAX(timestamp) AS timestamp
                    FROM vehicle_snapshots
                    GROUP BY vehicle_id
                  ) recent ON recent.vehicle_id = v.vehicle_id AND recent.timestamp = v.timestamp
                ) latest ON latest.route_id = r.route_id
                GROUP BY r.route_id
                ORDER BY active_vehicle_count DESC, r.route_short_name
                """
            ).fetchall()
            return [dict(row) for row in rows]

    def vehicles_for_route(self, route_id: str) -> list[dict]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT v.vehicle_id, v.route_id, v.trip_id, v.latitude, v.longitude, v.bearing, v.speed, v.timestamp, v.delay_seconds
                FROM vehicle_snapshots v
                JOIN (
                  SELECT vehicle_id, MAX(timestamp) AS timestamp
                  FROM vehicle_snapshots
                  WHERE route_id = ?
                  GROUP BY vehicle_id
                ) recent ON recent.vehicle_id = v.vehicle_id AND recent.timestamp = v.timestamp
                ORDER BY v.timestamp DESC
                """,
                (route_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def arrivals_for_stop(self, stop_id: str) -> list[dict]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT stop_id, route_id, trip_id, stop_name, scheduled_time, predicted_time, delay_seconds
                FROM trip_updates
                WHERE stop_id = ? OR ? = ''
                ORDER BY predicted_time
                LIMIT 12
                """,
                (stop_id, stop_id),
            ).fetchall()
            if not rows and stop_id:
                rows = connection.execute(
                    """
                    SELECT stop_id, route_id, trip_id, stop_name, scheduled_time, predicted_time, delay_seconds
                    FROM trip_updates
                    ORDER BY predicted_time
                    LIMIT 12
                    """
                ).fetchall()
            return [dict(row) for row in rows]

    def alerts(self) -> list[dict]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT alert_id, severity, category, summary, affected_routes, active_from, active_to FROM service_alerts"
            ).fetchall()
            result = []
            for row in rows:
                item = dict(row)
                item["affected_routes"] = [route for route in item["affected_routes"].split(",") if route]
                result.append(item)
            return result

    def reliability(self, route_id: str, from_date: str | None, to_date: str | None) -> dict:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT date, average_delay_seconds, late_percentage, alert_count, observation_count
                FROM route_reliability_daily
                WHERE route_id = ?
                  AND (? IS NULL OR date >= ?)
                  AND (? IS NULL OR date <= ?)
                ORDER BY date
                """,
                (route_id, from_date, from_date, to_date, to_date),
            ).fetchall()
            daily = [dict(row) for row in rows]
            if not daily:
                return {
                    "route_id": route_id,
                    "from_date": from_date or "",
                    "to_date": to_date or "",
                    "average_delay_seconds": 0,
                    "late_percentage": 0,
                    "alert_count": 0,
                    "observation_count": 0,
                    "daily": [],
                }
            return {
                "route_id": route_id,
                "from_date": daily[0]["date"],
                "to_date": daily[-1]["date"],
                "average_delay_seconds": round(sum(day["average_delay_seconds"] for day in daily) / len(daily)),
                "late_percentage": round(sum(day["late_percentage"] for day in daily) / len(daily)),
                "alert_count": sum(day["alert_count"] for day in daily),
                "observation_count": sum(day["observation_count"] for day in daily),
                "daily": daily,
            }


def _route_label(route_id: str) -> tuple[str, str, str, str]:
    short_name = route_id.split("-", 1)[0]
    return route_id, short_name, f"TransLink route {short_name}", "bus"
