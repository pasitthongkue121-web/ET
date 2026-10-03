from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from backend.database.database import get_db
from backend.database.orm_models import EnergyData, Device, User

router = APIRouter(prefix="/api/esp32", tags=["ESP32"])

PEAK_RATE = 5.0
OFFPEAK_RATE = 3.0

class ESP32Reading(BaseModel):
    device_id: str
    voltage: float
    current: float
    power: float
    energy_kwh: float
    temperature: float

@router.post("/energy", status_code=201)
def esp32_post_energy(
    body: ESP32Reading,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    
    device = db.query(Device).filter(Device.id == body.device_id, Device.api_key == x_api_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid device ID or API key")
    
    reading = EnergyData(
        user_id=device.user_id,
        device_id=device.id,
        timestamp=datetime.utcnow(),
        voltage=body.voltage,
        current=body.current,
        power=body.power,
        energy_kwh=body.energy_kwh,
        temperature=body.temperature,
    )
    db.add(reading)
    db.commit()
    return {"success": True, "user_id": device.user_id, "device_id": device.id}
