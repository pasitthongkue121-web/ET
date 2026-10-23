from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.database.orm_models import User, Device as ORMDevice, EnergyData
from backend.core.auth import get_optional_current_user
from backend.database.models import DeviceStatusResponse
from backend.database.repository import get_repository
from backend.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/devices", tags=["Devices"])

class CreateDeviceRequest(BaseModel):
    name: str
    room_id: str = "main_panel"
    device_id: Optional[str] = None
    rated_power: float = 1000.0
    category: str = "appliance"

@router.get("")
def get_devices(
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of devices with real-time status and power readings.
    If authenticated, returns devices isolated to the current user.
    """
    if user:
        user_devs = db.query(ORMDevice).filter(ORMDevice.user_id == user.id).all()
        if user_devs:
            result = []
            for d in user_devs:
                # Find latest energy reading for power status
                latest_reading = db.query(EnergyData).filter(
                    EnergyData.user_id == user.id,
                    EnergyData.device_id == d.id
                ).order_by(EnergyData.timestamp.desc()).first()

                curr_p = float(latest_reading.power) if latest_reading and latest_reading.power else 0.0
                curr_kwh = float(latest_reading.energy_kwh) if latest_reading and latest_reading.energy_kwh else 0.0
                is_on = curr_p > 5.0
                result.append({
                    "device_id": d.id,
                    "name": d.device_name,
                    "room_id": "home_main",
                    "room_name": d.location or "บ้านของคุณ",
                    "rated_power": float(d.rated_power),
                    "status": is_on,
                    "current_power": curr_p,
                    "today_energy": curr_kwh,
                    "runtime_hours": 8.0 if is_on else 0.0,
                    "temperature": float(latest_reading.temperature) if latest_reading and latest_reading.temperature else 26.0,
                    "category": d.device_type or "appliance"
                })
            return result

    return dashboard_service.get_devices_detail()

@router.post("")
def create_device(payload: CreateDeviceRequest):
    """
    Adds a new device assigned to a specific room / area.
    """
    repo = get_repository()
    # Auto-generate device_id if not provided
    clean_id = payload.device_id
    if not clean_id:
        clean_id = "device_" + payload.name.lower().replace(" ", "_")
        import re
        clean_id = re.sub(r"[^a-zA-Z0-9_]", "", clean_id)
        if not clean_id or clean_id == "device_":
            clean_id = f"device_{int(__import__('time').time())}"

    device_dict = {
        "device_id": clean_id,
        "name": payload.name,
        "room_id": payload.room_id,
        "rated_power": payload.rated_power,
        "status": 0,
        "temperature": 25.0,
        "category": payload.category
    }
    created = repo.create_device(device_dict)
    return {"status": "success", "device": created}
