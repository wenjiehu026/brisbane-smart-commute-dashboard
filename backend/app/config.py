from dataclasses import dataclass
import os
from pathlib import Path


DEFAULT_DB_PATH = str(Path(__file__).resolve().parents[1] / "data" / "commute.db")


@dataclass(frozen=True)
class Settings:
    service_name: str = "brisbane-smart-commute-api"
    database_path: str = os.getenv("BRISCOMMUTE_DB_PATH", DEFAULT_DB_PATH)
    vehicle_positions_url: str = os.getenv("TRANSLINK_VEHICLE_POSITIONS_URL", "")
    trip_updates_url: str = os.getenv("TRANSLINK_TRIP_UPDATES_URL", "")
    service_alerts_url: str = os.getenv("TRANSLINK_SERVICE_ALERTS_URL", "")
    ingestion_interval_seconds: int = int(os.getenv("INGESTION_INTERVAL_SECONDS", "60"))
    enable_live_ingestion: bool = os.getenv("ENABLE_LIVE_INGESTION", "false").lower() == "true"
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()
