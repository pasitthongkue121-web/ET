from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
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

@router.get("", response_model=List[DeviceStatusResponse])
def get_devices():
    """
    Returns list of all household devices with real-time status and power readings.
    """
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
