# Brisbane Smart Commute API

FastAPI backend for the Brisbane Smart Commute Dashboard.

## Run Locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Environment

- `BRISCOMMUTE_DB_PATH`: local SQLite path. Defaults to `backend/data/commute.db`.
- `ENABLE_LIVE_INGESTION`: defaults to `true` and starts the polling worker.
- `TRANSLINK_VEHICLE_POSITIONS_URL`: defaults to `https://gtfsrt.api.translink.com.au/api/realtime/SEQ/VehiclePositions`.
- `TRANSLINK_TRIP_UPDATES_URL`: defaults to `https://gtfsrt.api.translink.com.au/api/realtime/SEQ/TripUpdates`.
- `TRANSLINK_SERVICE_ALERTS_URL`: defaults to `https://gtfsrt.api.translink.com.au/api/realtime/SEQ/Alerts`.
- `INGESTION_INTERVAL_SECONDS`: polling interval. Defaults to `60`.
- `CORS_ORIGINS`: comma-separated frontend origins.

## Endpoints

- `GET /health`
- `GET /routes`
- `GET /routes/{route_id}/vehicles`
- `GET /stops/{stop_id}/arrivals`
- `GET /alerts`
- `GET /analytics/routes/{route_id}/reliability?from=&to=`
- `POST /admin/ingest`
