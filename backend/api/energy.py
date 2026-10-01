from fastapi import APIRouter, Query
from typing import Optional, Dict, Any
from backend.database.models import ESP32ReadingInput
from backend.services.energy_service import energy_service

router = APIRouter(prefix="/api/energy", tags=["Energy"])

@router.get("")
def get_energy_data(
    period: str = Query("today", pattern="^(today|7d|30d)$"),
    device_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Returns time-series energy readings for Recharts power & energy graphs.
    """
    return energy_service.get_energy_history(period=period, device_id=device_id)

@router.post("")
def ingest_energy_reading(payload: ESP32ReadingInput):
    """
    Ingests sensor reading from physical ESP32 or IoT gateway.
    """
    return energy_service.ingest_esp32_reading(payload)
