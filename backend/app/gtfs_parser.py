from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any


@dataclass(frozen=True)
class ParsedFeed:
    vehicles: list[tuple]
    trip_updates: list[tuple]
    alerts: list[tuple]


def parse_feed_bytes(feed_kind: str, payload: bytes) -> ParsedFeed:
    """Parse JSON fixtures in tests or GTFS-Realtime protobuf payloads in production."""
    if payload.lstrip().startswith(b"{") or payload.lstrip().startswith(b"["):
        return _parse_json_fixture(feed_kind, json.loads(payload.decode("utf-8")))

    try:
        from google.transit import gtfs_realtime_pb2
    except ImportError as exc:
        raise RuntimeError("Install gtfs-realtime-bindings to parse live TransLink protobuf feeds.") from exc

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(payload)
    vehicles: list[tuple] = []
    trip_updates: list[tuple] = []
    alerts: list[tuple] = []

    for entity in feed.entity:
        if entity.HasField("vehicle"):
            vehicle = entity.vehicle
            position = vehicle.position
            vehicles.append(
                (
                    vehicle.vehicle.id or entity.id,
                    vehicle.trip.route_id,
                    vehicle.trip.trip_id,
                    position.latitude,
                    position.longitude,
                    position.bearing if position.HasField("bearing") else None,
                    position.speed if position.HasField("speed") else None,
                    _timestamp(vehicle.timestamp),
                    0,
                )
            )
        elif entity.HasField("trip_update"):
            update = entity.trip_update
            for stop_update in update.stop_time_update:
                arrival = stop_update.arrival if stop_update.HasField("arrival") else stop_update.departure
                scheduled = _timestamp(arrival.time - arrival.delay if arrival.HasField("delay") else arrival.time)
                predicted = _timestamp(arrival.time)
                trip_updates.append(
                    (
                        update.trip.route_id,
                        update.trip.trip_id,
                        stop_update.stop_id,
                        stop_update.stop_id,
                        scheduled,
                        predicted,
                        arrival.delay if arrival.HasField("delay") else 0,
                    )
                )
        elif entity.HasField("alert"):
            alert = entity.alert
            routes = sorted({informed.route_id for informed in alert.informed_entity if informed.route_id})
            alerts.append(
                (
                    entity.id,
                    "warning",
                    str(alert.cause) or "Transit alert",
                    _translation(alert.header_text) or _translation(alert.description_text) or "Service alert",
                    ",".join(routes),
                    None,
                    None,
                )
            )

    return ParsedFeed(vehicles=vehicles, trip_updates=trip_updates, alerts=alerts)


def _parse_json_fixture(feed_kind: str, data: dict[str, Any]) -> ParsedFeed:
    vehicles: list[tuple] = []
    trip_updates: list[tuple] = []
    alerts: list[tuple] = []
    now = datetime.now(timezone.utc).isoformat()

    if feed_kind in {"vehicles", "mixed"}:
        for item in data.get("vehicles", []):
            vehicles.append(
                (
                    item["vehicle_id"],
                    item["route_id"],
                    item.get("trip_id", ""),
                    item["latitude"],
                    item["longitude"],
                    item.get("bearing"),
                    item.get("speed"),
                    item.get("timestamp", now),
                    item.get("delay_seconds", 0),
                )
            )

    if feed_kind in {"trip_updates", "mixed"}:
        for item in data.get("trip_updates", []):
            trip_updates.append(
                (
                    item["route_id"],
                    item["trip_id"],
                    item["stop_id"],
                    item.get("stop_name", item["stop_id"]),
                    item["scheduled_time"],
                    item["predicted_time"],
                    item.get("delay_seconds", 0),
                )
            )

    if feed_kind in {"alerts", "mixed"}:
        for item in data.get("alerts", []):
            alerts.append(
                (
                    item["alert_id"],
                    item.get("severity", "info"),
                    item.get("category", "Transit alert"),
                    item["summary"],
                    ",".join(item.get("affected_routes", [])),
                    item.get("active_from"),
                    item.get("active_to"),
                )
            )

    return ParsedFeed(vehicles=vehicles, trip_updates=trip_updates, alerts=alerts)


def _timestamp(value: int) -> str:
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def _translation(text_field: Any) -> str:
    translations = getattr(text_field, "translation", [])
    if not translations:
        return ""
    return translations[0].text
