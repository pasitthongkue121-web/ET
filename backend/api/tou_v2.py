from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from backend.database.database import get_db
from backend.database.orm_models import TOUData, EnergyData, User
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/tou", tags=["TOU"])

RATES = {
    "Peak": {"hours": "09:00-22:00", "rate_thb_kwh": 5.0},
    "Off-Peak": {"hours": "22:00-09:00", "rate_thb_kwh": 3.0},
}

def get_period(ts: datetime):
    return "Peak" if 9 <= ts.hour < 22 else "Off-Peak"

class TOUCalculateIn(BaseModel):
    energy_kwh: float
    timestamp: str  # ISO format

@router.get("/rates")
def get_rates():
    return {"rates": RATES}

@router.get("/data")
def get_tou_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(days=7)
    rows = db.query(TOUData).filter(
        TOUData.user_id == current_user.id,
        TOUData.timestamp >= cutoff
    ).order_by(TOUData.timestamp.desc()).all()
    return {"tou_data": [{"id": r.id, "device_id": r.device_id, "timestamp": r.timestamp.isoformat(),
                          "period": r.period, "energy_kwh": r.energy_kwh, "rate": r.rate, "cost": r.cost} for r in rows]}

@router.post("/calculate")
def calculate_tou(body: TOUCalculateIn, current_user: User = Depends(get_current_user)):
    ts = datetime.fromisoformat(body.timestamp)
    period = get_period(ts)
    rate = RATES[period]["rate_thb_kwh"]
    cost = body.energy_kwh * rate
    return {"period": period, "rate": rate, "cost": round(cost, 4), "energy_kwh": body.energy_kwh}
