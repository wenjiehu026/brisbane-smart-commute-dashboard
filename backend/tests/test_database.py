import unittest

from backend.app.database import Database


class DatabaseTest(unittest.TestCase):
    def test_seeded_database_exposes_dashboard_data(self) -> None:
        database = Database(":memory:")
        database.seed_if_empty()

        routes = database.routes()
        vehicles = database.vehicles_for_route("66")
        arrivals = database.arrivals_for_stop("UQ-LAKES")
        alerts = database.alerts()
        reliability = database.reliability("66", None, None)

        self.assertGreaterEqual(len(routes), 5)
        self.assertGreaterEqual(len(vehicles), 1)
        self.assertGreaterEqual(len(arrivals), 1)
        self.assertGreaterEqual(len(alerts), 1)
        self.assertEqual(reliability["route_id"], "66")
        self.assertGreater(reliability["observation_count"], 0)

    def test_realtime_routes_are_inserted_when_unknown(self) -> None:
        database = Database(":memory:")
        with database.connect() as connection:
            database.ensure_realtime_routes(connection, {"REALTIME-1"})
            database.upsert_vehicle_snapshots(
                connection,
                [
                    (
                        "vehicle-1",
                        "REALTIME-1",
                        "trip-1",
                        -27.47,
                        153.02,
                        None,
                        None,
                        "2026-06-02T09:00:00+00:00",
                        45,
                    )
                ],
            )

        routes = database.routes()

        self.assertTrue(any(route["route_id"] == "REALTIME-1" for route in routes))


if __name__ == "__main__":
    unittest.main()
