import uuid
import re
from datetime import datetime
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
    Returns list of devices with real-time status, power readings, and ESP32 API Keys.
    If authenticated, returns devices isolated to the current user.
    """
    if user:
        user_devs = db.query(ORMDevice).filter(ORMDevice.user_id == user.id).all()
        if user_devs:
            result = []
            has_updates = False
            for d in user_devs:
                # Ensure device has an API Key
                if not d.api_key:
                    d.api_key = f"key_{uuid.uuid4().hex[:16]}"
                    has_updates = True

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
                    "category": d.device_type or "appliance",
                    "api_key": d.api_key,
                })
            if has_updates:
                db.commit()
            return result

    return dashboard_service.get_devices_detail()

@router.post("")
def create_device(
    payload: CreateDeviceRequest,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a new device assigned to a specific room / area.
    If authenticated, links device and generated API key to current user.
    """
    if user:
        # Generate clean device_id
        safe_name = re.sub(r"[^a-zA-Z0-9_]", "", payload.name.lower().replace(" ", "_"))
        if not safe_name:
            safe_name = "device"
        clean_id = f"{user.id}_{safe_name[:12]}_{uuid.uuid4().hex[:4]}"
        api_key = f"key_{uuid.uuid4().hex[:16]}"

        dev = ORMDevice(
            id=clean_id,
            user_id=user.id,
            device_name=payload.name,
            device_type=payload.category,
            rated_power=float(payload.rated_power),
            location=payload.room_id or "บ้านของคุณ",
            api_key=api_key
        )
        db.add(dev)

        # Baseline reading
        init_power = round(float(payload.rated_power) * 0.35, 1)
        reading = EnergyData(
            user_id=user.id,
            device_id=clean_id,
            timestamp=datetime.utcnow(),
            voltage=228.0,
            current=round(init_power / 228.0, 2),
            power=init_power,
            energy_kwh=0.01,
            temperature=26.0
        )
        db.add(reading)
        db.commit()
        db.refresh(dev)

        return {
            "status": "success",
            "device": {
                "device_id": dev.id,
                "name": dev.device_name,
                "room_id": "home_main",
                "room_name": dev.location,
                "rated_power": float(dev.rated_power),
                "status": True,
                "current_power": init_power,
                "today_energy": 0.01,
                "runtime_hours": 0.0,
                "temperature": 26.0,
                "category": dev.device_type,
                "api_key": dev.api_key,
            }
        }

    # Fallback for unauthenticated system baseline
    repo = get_repository()
    clean_id = payload.device_id
    if not clean_id:
        clean_id = "device_" + payload.name.lower().replace(" ", "_")
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

@router.delete("/{device_id}")
def delete_device(
    device_id: str,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a device and its related energy readings.
    Restricted to the owner of the device.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to delete device")

    dev = db.query(ORMDevice).filter(ORMDevice.id == device_id, ORMDevice.user_id == user.id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found or unauthorized")

    # Clean up associated energy data
    db.query(EnergyData).filter(EnergyData.device_id == device_id, EnergyData.user_id == user.id).delete()
    db.delete(dev)
    db.commit()

    return {"status": "success", "message": f"Device {device_id} deleted successfully"}
