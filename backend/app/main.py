from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Database
from .ingest import IngestionService


database = Database(settings.database_path)
ingestion_service = IngestionService(database, settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.seed_if_empty()
    task: asyncio.Task | None = None
    if settings.enable_live_ingestion:
        task = asyncio.create_task(ingestion_service.run_forever())
    yield
    if task:
        task.cancel()


app = FastAPI(
    title="Brisbane Smart Commute API",
    description="Real-time GTFS-Realtime ingestion and route reliability analytics for Brisbane/SEQ transit.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
        "last_ingestion_at": database.last_ingestion_at(),
        "live_ingestion_enabled": settings.enable_live_ingestion,
    }


@app.get("/routes")
def routes() -> list[dict]:
    return database.routes()


@app.get("/routes/{route_id}/vehicles")
def route_vehicles(route_id: str) -> list[dict]:
    return database.vehicles_for_route(route_id)


@app.get("/stops/{stop_id}/arrivals")
def stop_arrivals(stop_id: str) -> list[dict]:
    return database.arrivals_for_stop(stop_id)


@app.get("/alerts")
def alerts() -> list[dict]:
    return database.alerts()


@app.get("/analytics/routes/{route_id}/reliability")
def route_reliability(
    route_id: str,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
) -> dict:
    return database.reliability(route_id, from_date, to_date)


@app.post("/admin/ingest")
async def ingest_now() -> dict:
    await ingestion_service.ingest_once()
    return {"status": "ok", "message": "Ingestion completed or skipped."}
