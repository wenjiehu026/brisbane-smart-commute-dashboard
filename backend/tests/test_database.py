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


if __name__ == "__main__":
    unittest.main()
