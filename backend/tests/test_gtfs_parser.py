import json
import unittest

from backend.app.gtfs_parser import parse_feed_bytes


class GtfsParserTest(unittest.TestCase):
    def test_parse_json_fixture_to_normalized_rows(self) -> None:
        payload = {
            "vehicles": [
                {
                    "vehicle_id": "bus-1",
                    "route_id": "66",
                    "trip_id": "trip-1",
                    "latitude": -27.47,
                    "longitude": 153.02,
                    "delay_seconds": 120,
                }
            ],
            "trip_updates": [
                {
                    "route_id": "66",
                    "trip_id": "trip-1",
                    "stop_id": "UQ-LAKES",
                    "stop_name": "UQ Lakes station",
                    "scheduled_time": "2026-06-02T08:00:00+00:00",
                    "predicted_time": "2026-06-02T08:02:00+00:00",
                    "delay_seconds": 120,
                }
            ],
            "alerts": [
                {
                    "alert_id": "alert-1",
                    "severity": "warning",
                    "category": "Roadworks",
                    "summary": "CBD roadworks are affecting route 66.",
                    "affected_routes": ["66"],
                }
            ],
        }

        parsed = parse_feed_bytes("mixed", json.dumps(payload).encode("utf-8"))

        self.assertEqual(parsed.vehicles[0][0], "bus-1")
        self.assertEqual(parsed.trip_updates[0][3], "UQ Lakes station")
        self.assertEqual(parsed.alerts[0][4], "66")


if __name__ == "__main__":
    unittest.main()
