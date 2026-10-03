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

# Multi-user v2 APIs
from backend.api import auth as auth_api
from backend.api import devices_v2, energy_v2, dashboard_v2, esp32_api, ai_api, tou_v2


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

# ── Multi-User v2 Routers (registered FIRST for priority) ────────────────────
app.include_router(auth_api.router)
app.include_router(devices_v2.router)
app.include_router(energy_v2.router)
app.include_router(dashboard_v2.router)
app.include_router(esp32_api.router)
app.include_router(ai_api.router)
app.include_router(tou_v2.router)

# ── Legacy Routers (prefixed with /legacy to avoid conflicts) ─────────────────
app.include_router(dashboard.router, prefix="/legacy")
app.include_router(energy.router, prefix="/legacy")
app.include_router(devices.router, prefix="/legacy")
app.include_router(rooms.router)
app.include_router(analytics.router, prefix="/legacy")
app.include_router(routine.router)
app.include_router(prediction.router, prefix="/legacy")
app.include_router(twin.router)
app.include_router(simulation.router)
app.include_router(google_integration.router)
app.include_router(gsheet_ingest.router)
app.include_router(schedule_control.router)
app.include_router(tou_simulation.router, prefix="/legacy")



# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    # ── Create SQLAlchemy (multi-user) tables ─────────────────────────────────
    from backend.database.database import engine as sqla_engine, SessionLocal as sqla_session
    from backend.database import orm_models as sqla_models
    sqla_models.Base.metadata.create_all(bind=sqla_engine)
    logger.info("[STARTUP] SQLAlchemy multi-user tables created/verified ✅")

    # ── Seed Admin User ────────────────────────────────────────────────────────
    from backend.core.security import get_password_hash
    _db = sqla_session()
    try:
        admin = _db.query(sqla_models.User).filter(sqla_models.User.email == "admin@energytwin.com").first()
        if not admin:
            admin_user = sqla_models.User(
                id="admin_001",
                email="admin@energytwin.com",
                password_hash=get_password_hash("1234"),
                name="Admin"
            )
            _db.add(admin_user)
            _db.commit()
            logger.info("[STARTUP] Admin user created: admin@energytwin.com / 1234 ✅")
        else:
            logger.info("[STARTUP] Admin user already exists ✅")
    finally:
        _db.close()

    use_firebase = os.getenv("USE_FIREBASE", "false").lower() == "true"


    if use_firebase:
        logger.info("🔥 Firebase mode enabled — initialising Firestore repository…")
        from backend.database.firebase_repository import get_firebase_repository
        repo = get_firebase_repository()
        repo.clear_and_reseed()
        
            
        logger.info("✅ Firestore ready.")
    else:
        logger.info("🗄️  SQLite mode — initialising local database…")
        from backend.database.connection import init_db
        init_db()
        logger.info("✅ SQLite ready.")

        # Seed 24h of historical data if Firebase is empty
        from backend.services.esp32_simulator_service import esp32_simulator
        from backend.database.repository import get_repository
        app_repo = get_repository()
        from datetime import datetime, timedelta
        now = datetime.now()
        start = (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        end = now.strftime("%Y-%m-%d %H:%M:%S")
        recent = app_repo.get_readings_timeseries(start, end)
        if not recent:
            logger.info("[STARTUP] No recent readings found, seeding 24h historical data...")
            esp32_simulator.seed_historical_data(hours=24)


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
        from backend.services.esp32_simulator_service import esp32_simulator
        from backend.services.energy_service import energy_service
        res = energy_service.get_energy_history(period="today")
        return {
            "status": "healthy", 
            "energy_len": len(res.get('timeseries', [])),
            "sim_status": esp32_simulator.get_status()
        }
    except Exception as e:
        import traceback
        return {"status": "unhealthy", "error": str(e), "trace": traceback.format_exc()}

