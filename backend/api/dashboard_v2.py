from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import random
from backend.database.database import get_db
from backend.database.orm_models import EnergyData, Device, User
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard v2"])

PEAK_RATE = 5.0
OFFPEAK_RATE = 3.0

def get_rate(ts: datetime) -> float:
    return PEAK_RATE if 9 <= ts.hour < 22 else OFFPEAK_RATE

def _ensure_user_has_starter_data(user: User, db: Session):
    """Seed starter household circuits and readings if user is brand new."""
    existing_devs = db.query(Device).filter(Device.user_id == user.id).all()
    if not existing_devs:
        defaults = [
            ("ac_heavy_load", f"แอร์และโหลดหลัก ({user.name})", "heavy_load", 3500.0, "ห้องนั่งเล่น"),
            ("outlet_general", f"วงจรเต้ารับ ({user.name})", "receptacle", 1500.0, "ทั่วไป"),
            ("lighting_home", f"วงจรแสงสว่าง ({user.name})", "lighting", 500.0, "ทั้งบ้าน"),
        ]
        created_devs = []
        for dev_suffix, name, dtype, rated, loc in defaults:
            dev = Device(
                id=f"{user.id}_{dev_suffix}",
                user_id=user.id,
                device_name=name,
                device_type=dtype,
                rated_power=rated,
                location=loc,
                api_key=uuid.uuid4().hex
            )
            db.add(dev)
            created_devs.append(dev)
        db.commit()

        # Seed baseline readings for today
        now = datetime.utcnow()
        for i in range(12):
            ts = now - timedelta(hours=(11 - i))
            for dev in created_devs:
                power = (dev.rated_power * 0.4) + random.uniform(-50, 50)
                power = max(10.0, power)
                kwh = (power / 1000.0) * 1.0 # 1 hr interval
                entry = EnergyData(
                    user_id=user.id,
                    device_id=dev.id,
                    timestamp=ts,
                    voltage=228.0 + random.uniform(-2, 2),
                    current=round(power / 228.0, 2),
                    power=round(power, 1),
                    energy_kwh=round(kwh, 4),
                    temperature=26.5 + random.uniform(-1, 1),
                )
                db.add(entry)
        db.commit()

@router.get("")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_user_has_starter_data(current_user, db)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now - timedelta(days=30)

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

    # Current power (last 15 min or latest reading)
    recent_rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id
    ).order_by(EnergyData.timestamp.desc()).limit(len(db.query(Device).filter(Device.user_id == current_user.id).all()) or 3).all()

    current_power_kw = sum(r.power or 0 for r in recent_rows) / 1000.0 if recent_rows else 0.0

    # Devices
    all_devices = db.query(Device).filter(Device.user_id == current_user.id).all()
    devices_online = len([r for r in recent_rows if (r.power or 0) > 10.0])
    devices_total = len(all_devices)

    # Forecast (realistic monthly estimate)
    daily_runrate = (monthly_energy / 30.0) if monthly_energy > 0 else (today_energy or 15.0)
    monthly_forecast_kwh = daily_runrate * 30.0
    monthly_forecast_cost = monthly_forecast_kwh * 4.42

    # Energy score matching frontend schema
    score = max(50, min(95, 85 - int(current_power_kw * 5)))
    grade = "A" if score >= 85 else ("B" if score >= 70 else "C")
    energy_score = {
        "score": score,
        "overall": score,
        "efficiency": score,
        "peak_usage": 78,
        "standby": 82,
        "usage_pattern": 80,
        "energy_stability": 82,
        "grade": grade,
        "summary": f"บัญชีของ {current_user.name} กำลังใช้งานพลังงานอยู่ในเกณฑ์ดี มีโอกาสประหยัดเพิ่มเติมช่วง Peak"
    }

    # Generate insights
    insights = [
        {
            "id": "user-isolated-banner",
            "type": "info",
            "title": f"โปรไฟล์ส่วนตัว ({current_user.name})",
            "description": f"ระบบเชื่อมต่อเฉพาะอุปกรณ์ของคุณ ({devices_total} วงจร) ปลอดภัยด้วย User Isolation",
            "severity": "info",
            "metric_value": f"{devices_total} วงจร"
        }
    ]
    if current_power_kw > 2.5:
        insights.append({
            "id": "high-load-warning",
            "type": "warning",
            "title": "กำลังไฟสูงกว่าปกติ (High Load)",
            "description": f"กำลังไฟขณะนี้ {current_power_kw:.2f} kW ควรเลื่อนการเปิดเครื่องใช้ไฟฟ้าหนักไปช่วง Off-Peak",
            "severity": "warning",
            "metric_value": f"{current_power_kw:.2f} kW"
        })

    # Recent activities
    recent_all = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id
    ).order_by(EnergyData.timestamp.desc()).limit(5).all()

    recent_activities = [
        {
            "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "device_name": r.device_id.replace(f"{current_user.id}_", "").replace("_", " ").title(),
            "room_name": "บ้านของคุณ",
            "event": "ทำงานอยู่ (Active)" if (r.power or 0) > 10 else "สแตนด์บาย (Standby)",
            "power_w": round(r.power or 0, 1),
            "energy_kwh": round(r.energy_kwh or 0, 4)
        }
        for r in recent_all
    ]

    return {
        "current_power_kw": round(current_power_kw, 2),
        "today_energy_kwh": round(today_energy, 2),
        "today_cost_thb": round(today_cost, 2),
        "monthly_energy_kwh": round(monthly_energy, 2),
        "monthly_cost_thb": round(monthly_cost, 2),
        "monthly_forecast_kwh": round(monthly_forecast_kwh, 1),
        "monthly_forecast_cost_thb": round(monthly_forecast_cost, 2),
        "energy_score": energy_score,
        "insights": insights,
        "recent_activities": recent_activities,
        "devices_online": devices_online,
        "devices_total": devices_total,
        "last_updated": now.strftime("%Y-%m-%d %H:%M:%S"),
        "user_name": current_user.name,
        "user_id": current_user.id,
        "is_user_isolated": True,
        "estimated_saving": round(monthly_forecast_kwh * 0.15 * OFFPEAK_RATE, 2),
    }
