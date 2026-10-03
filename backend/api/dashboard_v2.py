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

    # Current power (last 5 min)
    recent_cutoff = now - timedelta(minutes=5)
    recent_rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= recent_cutoff
    ).all()
    current_power_kw = sum(r.power or 0 for r in recent_rows) / 1000 if recent_rows else 0.0

    # Devices
    all_devices = db.query(Device).filter(Device.user_id == current_user.id).all()
    active_ids = {r.device_id for r in recent_rows}
    devices_online = len(active_ids)
    devices_total = len(all_devices)

    # Forecast
    elapsed_hours = max((now - today_start).seconds / 3600, 0.1)
    monthly_forecast_kwh = (today_energy / elapsed_hours * 24 * 30) if today_energy > 0 else 0.0
    monthly_forecast_cost = monthly_forecast_kwh * PEAK_RATE

    # Energy score (simple 0-100 based on usage efficiency)
    score = max(0, 100 - int(current_power_kw * 10))
    energy_score = {
        "overall": score,
        "efficiency": score,
        "tou_optimization": 80,
        "peak_reduction": 75,
        "label": "ดี" if score >= 70 else "ปานกลาง" if score >= 40 else "ควรปรับปรุง"
    }

    # Generate insights from data
    insights = []
    if current_power_kw > 2.0:
        insights.append({
            "type": "warning",
            "title": "กำลังไฟสูง",
            "description": f"กำลังไฟปัจจุบัน {current_power_kw:.1f} kW สูงกว่าปกติ",
            "severity": "medium"
        })
    if not insights:
        insights.append({
            "type": "info",
            "title": "ระบบพร้อมใช้งาน",
            "description": "เพิ่มอุปกรณ์และเริ่มส่งข้อมูลพลังงานเพื่อดู Insights",
            "severity": "low"
        })

    # Recent activities from latest energy data
    recent_all = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id
    ).order_by(EnergyData.timestamp.desc()).limit(5).all()

    recent_activities = [
        {
            "device_id": r.device_id,
            "timestamp": r.timestamp.isoformat(),
            "power_kw": round((r.power or 0) / 1000, 3),
            "energy_kwh": round(r.energy_kwh or 0, 4),
            "description": f"บันทึกพลังงาน {round((r.energy_kwh or 0), 4)} kWh"
        }
        for r in recent_all
    ]

    return {
        # ── Fields matching existing frontend DashboardSummary type ──
        "current_power_kw": round(current_power_kw, 3),
        "today_energy_kwh": round(today_energy, 4),
        "today_cost_thb": round(today_cost, 2),
        "monthly_energy_kwh": round(monthly_energy, 4),
        "monthly_cost_thb": round(monthly_cost, 2),
        "monthly_forecast_kwh": round(monthly_forecast_kwh, 4),
        "monthly_forecast_cost_thb": round(monthly_forecast_cost, 2),
        "energy_score": energy_score,
        "insights": insights,
        "recent_activities": recent_activities,
        "devices_online": devices_online,
        "devices_total": devices_total,
        "last_updated": now.isoformat(),
        # ── Extra fields for new UI ──
        "user_name": current_user.name,
        "user_id": current_user.id,
        "estimated_saving": round(monthly_forecast_kwh * 0.15 * OFFPEAK_RATE, 2),
    }
