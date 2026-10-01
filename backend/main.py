from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from backend.api import (
    dashboard,
    energy,
    devices,
    rooms,
    analytics,
    routine,
    prediction,
    twin,
    simulation,
    google_integration,
    gsheet_ingest,
    schedule_control,
    tou_simulation,
)

app = FastAPI(
    title="ENERGY TWINS AI Backend",
    description=(
        "Smart Home Energy Management with Digital Twin & AI Prediction Engine. "
        "Supports ESP32 telemetry, Firebase Firestore, TOU optimization, "
        "Anomaly Detection, and Forecast."
    ),
    version="2.0.0"
)

# ── CORS ────────────────────────────────────────────────────────────────────
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://energy-twins-ai.netlify.app",
    "*",  # keep broad for development; restrict in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(dashboard.router)
app.include_router(energy.router)
app.include_router(devices.router)
app.include_router(rooms.router)
app.include_router(analytics.router)
app.include_router(routine.router)
app.include_router(prediction.router)
app.include_router(twin.router)
app.include_router(simulation.router)
app.include_router(google_integration.router)
app.include_router(gsheet_ingest.router)
app.include_router(schedule_control.router)
app.include_router(tou_simulation.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    use_firebase = os.getenv("USE_FIREBASE", "false").lower() == "true"

    if use_firebase:
        logger.info("🔥 Firebase mode enabled — initialising Firestore repository…")
        from backend.database.firebase_repository import get_firebase_repository
        repo = get_firebase_repository()
        repo.seed_if_empty()
        logger.info("✅ Firestore ready.")
    else:
        logger.info("🗄️  SQLite mode — initialising local database…")
        from backend.database.connection import init_db
        init_db()
        logger.info("✅ SQLite ready.")

    # Auto-start ESP32 multi-device simulator if requested
    enable_sim = os.getenv("ENABLE_ESP32_SIM", "false").lower() == "true"
    if enable_sim:
        from backend.services.esp32_simulator_service import esp32_simulator
        result = esp32_simulator.start()
        logger.info(f"📡 ESP32 Simulator: {result}")
    else:
        logger.info("📡 ESP32 Simulator: disabled (set ENABLE_ESP32_SIM=true to enable)")

    # Optional: Google Sheets background sync (only if URL configured)
    try:
        from backend.services.gsheet_service import start_background_sync
        start_background_sync()
    except Exception as e:
        logger.warning(f"GSheet sync not started: {e}")


# ── Health / Root ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    use_firebase = os.getenv("USE_FIREBASE", "false").lower() == "true"
    sim_enabled  = os.getenv("ENABLE_ESP32_SIM", "false").lower() == "true"
    return {
        "app":     "ENERGY TWINS AI",
        "version": "2.0.0",
        "status":  "online",
        "backend_db": "firebase_firestore" if use_firebase else "sqlite",
        "esp32_sim":  "enabled" if sim_enabled else "disabled",
        "esp32_ingestion_endpoint": "/api/energy",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    try:
        from backend.database.repository import get_repository
        repo = get_repository()
        # Just try to init the client
        if hasattr(repo, "_client"):
            repo._client()
        return {"status": "healthy", "db": "connected"}
    except Exception as e:
        import traceback
        return {"status": "unhealthy", "error": str(e), "trace": traceback.format_exc()}
