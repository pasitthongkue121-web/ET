from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timedelta
from backend.database.database import get_db
from backend.database.orm_models import EnergyData, Device, User
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/energy", tags=["Energy v2"])

PEAK_RATE = 5.0     # THB/kWh 09:00-22:00
OFFPEAK_RATE = 3.0  # THB/kWh 22:00-09:00

def get_rate(ts: datetime) -> float:
    return PEAK_RATE if 9 <= ts.hour < 22 else OFFPEAK_RATE

class EnergyIn(BaseModel):
    device_id: str
    voltage: float = 230.0
    current: float = 0.0
    power: float = 0.0
    energy_kwh: float = 0.0
    temperature: float = 25.0

def _build_response(rows: list, period: str):
    total_energy = sum(r.energy_kwh or 0 for r in rows)
    total_cost = sum((r.energy_kwh or 0) * get_rate(r.timestamp) for r in rows)
    timeseries = [
        {
            "timestamp": r.timestamp.isoformat(),
            "device_id": r.device_id,
            "power": r.power,
            "energy_kwh": r.energy_kwh,
            "voltage": r.voltage,
            "temperature": r.temperature,
            "cost_thb": (r.energy_kwh or 0) * get_rate(r.timestamp),
        }
        for r in rows
    ]
    return {"period": period, "timeseries": timeseries, "total_energy_kwh": round(total_energy, 4), "total_cost_thb": round(total_cost, 2)}

@router.get("")
@router.get("/history")
def get_energy(period: str = "today", device_id: Optional[str] = None,
               db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    if period == "7d":
        start = now - timedelta(days=7)
    elif period == "30d":
        start = now - timedelta(days=30)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    q = db.query(EnergyData).filter(EnergyData.user_id == current_user.id, EnergyData.timestamp >= start)
    if device_id:
        q = q.filter(EnergyData.device_id == device_id)
    rows = q.order_by(EnergyData.timestamp).all()
    return _build_response(rows, period)

@router.get("/today")
def get_today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.query(EnergyData).filter(EnergyData.user_id == current_user.id, EnergyData.timestamp >= start).order_by(EnergyData.timestamp).all()
    return _build_response(rows, "today")

@router.get("/month")
def get_month(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = db.query(EnergyData).filter(EnergyData.user_id == current_user.id, EnergyData.timestamp >= start).order_by(EnergyData.timestamp).all()
    return _build_response(rows, "month")

@router.post("", status_code=201)
def post_energy(body: EnergyIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == body.device_id, Device.user_id == current_user.id).first()
    if not device:
        raise HTTPException(status_code=403, detail="Device not found or access denied")
    
    reading = EnergyData(
        user_id=current_user.id,
        device_id=body.device_id,
        timestamp=datetime.utcnow(),
        voltage=body.voltage,
        current=body.current,
        power=body.power,
        energy_kwh=body.energy_kwh,
        temperature=body.temperature,
    )
    db.add(reading)
    db.commit()
    return {"success": True, "id": reading.id}
