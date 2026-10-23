from fastapi import APIRouter, Query, Depends
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.database.orm_models import User, EnergyData
from backend.core.auth import get_optional_current_user
from backend.database.models import ESP32ReadingInput
from backend.services.energy_service import energy_service

router = APIRouter(prefix="/api/energy", tags=["Energy"])

@router.get("")
def get_energy_data(
    period: str = Query("today", pattern="^(today|7d|30d)$"),
    device_id: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns time-series energy readings for Recharts power & energy graphs.
    If user is authenticated, returns energy records isolated to the user.
    """
    if user:
        from backend.api.energy_v2 import get_energy
        user_res = get_energy(period=period, device_id=device_id, db=db, current_user=user)
        if user_res and user_res.get("timeseries"):
            # Format timeseries points to match frontend Recharts format
            formatted_ts = []
            for item in user_res["timeseries"]:
                ts_str = item.get("timestamp", "")
                time_label = ts_str[11:16] if len(ts_str) >= 16 else ts_str
                p_w = float(item.get("power", 0.0))
                kwh = float(item.get("energy_kwh", 0.0))
                formatted_ts.append({
                    "time": time_label,
                    "power_w": round(p_w, 1),
                    "power_kw": round(p_w / 1000.0, 2),
                    "energy_kwh": round(kwh, 3),
                    "voltage": round(float(item.get("voltage", 230.0)), 1),
                    "current_a": round(p_w / 230.0, 2),
                    "temperature": round(float(item.get("temperature", 26.0)), 1),
                    "cost_thb": round(float(item.get("cost_thb", 0.0)), 2),
                    "occupancy": True
                })
            return {
                "period": period,
                "device_id": device_id,
                "total_energy_kwh": user_res.get("total_energy_kwh", 0.0),
                "total_cost_thb": user_res.get("total_cost_thb", 0.0),
                "timeseries": formatted_ts
            }

    return energy_service.get_energy_history(period=period, device_id=device_id)

@router.post("")
def ingest_energy_reading(payload: ESP32ReadingInput):
    """
    Ingests sensor reading from physical ESP32 or IoT gateway.
    """
    return energy_service.ingest_esp32_reading(payload)
