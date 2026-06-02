from __future__ import annotations

import asyncio
from urllib.error import URLError
from urllib.request import urlopen

from .config import Settings
from .database import Database
from .gtfs_parser import ParsedFeed, parse_feed_bytes


class IngestionService:
    def __init__(self, database: Database, settings: Settings):
        self.database = database
        self.settings = settings

    async def ingest_once(self) -> None:
        parsed = ParsedFeed(vehicles=[], trip_updates=[], alerts=[])

        if self.settings.vehicle_positions_url:
            vehicle_payload = await asyncio.to_thread(_download, self.settings.vehicle_positions_url)
            parsed_vehicles = parse_feed_bytes("vehicles", vehicle_payload)
            parsed.vehicles.extend(parsed_vehicles.vehicles)

        if self.settings.trip_updates_url:
            trip_payload = await asyncio.to_thread(_download, self.settings.trip_updates_url)
            parsed_trips = parse_feed_bytes("trip_updates", trip_payload)
            parsed.trip_updates.extend(parsed_trips.trip_updates)

        if self.settings.service_alerts_url:
            alert_payload = await asyncio.to_thread(_download, self.settings.service_alerts_url)
            parsed_alerts = parse_feed_bytes("alerts", alert_payload)
            parsed.alerts.extend(parsed_alerts.alerts)

        if not (parsed.vehicles or parsed.trip_updates or parsed.alerts):
            self.database.record_ingestion("skipped", "No feed URLs configured.")
            return

        with self.database.connect() as connection:
            self.database.ensure_realtime_routes(connection, _route_ids(parsed))
            self.database.upsert_vehicle_snapshots(connection, parsed.vehicles)
            self.database.upsert_trip_updates(connection, parsed.trip_updates)
            self.database.upsert_service_alerts(connection, parsed.alerts)
            self.database.rebuild_reliability(connection)
        self.database.record_ingestion("success", "GTFS-RT feeds ingested.")

    async def run_forever(self) -> None:
        while True:
            try:
                await self.ingest_once()
            except (RuntimeError, URLError, TimeoutError) as exc:
                self.database.record_ingestion("failed", str(exc))
            await asyncio.sleep(self.settings.ingestion_interval_seconds)


def _download(url: str) -> bytes:
    with urlopen(url, timeout=15) as response:
        return response.read()


def _route_ids(parsed: ParsedFeed) -> set[str]:
    vehicle_routes = {row[1] for row in parsed.vehicles}
    trip_routes = {row[0] for row in parsed.trip_updates}
    alert_routes = {
        route_id
        for row in parsed.alerts
        for route_id in row[4].split(",")
        if route_id
    }
    return vehicle_routes | trip_routes | alert_routes
