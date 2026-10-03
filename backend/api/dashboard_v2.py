from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.database.database import get_db
from backend.database.orm_models import EnergyData, Device, User
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard v2"])

PEAK_RATE = 5.0
OFFPEAK_RATE = 3.0

def get_rate(ts: datetime) -> float:
    return PEAK_RATE if 9 <= ts.hour < 22 else OFFPEAK_RATE

@router.get("")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    today_rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= today_start
    ).all()

    month_rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= month_start
    ).all()

    today_energy = sum(r.energy_kwh or 0 for r in today_rows)
    today_cost = sum((r.energy_kwh or 0) * get_rate(r.timestamp) for r in today_rows)
    monthly_energy = sum(r.energy_kwh or 0 for r in month_rows)
    monthly_cost = sum((r.energy_kwh or 0) * get_rate(r.timestamp) for r in month_rows)

    # Current power: latest reading per device (last 5 min)
    recent_cutoff = now - timedelta(minutes=5)
    recent_rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= recent_cutoff
    ).all()
    current_power = sum(r.power or 0 for r in recent_rows) / 1000 if recent_rows else 0  # kW

    # Active devices
    active_device_ids = {r.device_id for r in recent_rows}
    active_devices = len(active_device_ids)

    # Simple prediction: today's energy rate * remaining hours
    elapsed_hours = (now - today_start).seconds / 3600
    predicted_energy = (today_energy / elapsed_hours * 24) if elapsed_hours > 0 else 0
    estimated_saving = predicted_energy * 0.15 * OFFPEAK_RATE  # 15% saving estimate

    return {
        "user_name": current_user.name,
        "user_id": current_user.id,
        "today_energy": round(today_energy, 4),
        "today_cost": round(today_cost, 2),
        "monthly_energy": round(monthly_energy, 4),
        "monthly_cost": round(monthly_cost, 2),
        "current_power": round(current_power, 3),
        "active_devices": active_devices,
        "predicted_energy": round(predicted_energy, 4),
        "estimated_saving": round(estimated_saving, 2),
    }
