"""
Device Schedule & Energy Plan Controller
=========================================
Lets users schedule on/off times for devices and run
cost-optimized plans to minimize electricity bill.
"""

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.database.connection import get_connection
from backend.database.repository import get_repository

router = APIRouter(prefix="/api/schedule", tags=["Device Schedule & Energy Plan"])

ELECTRICITY_RATE_PER_KWH = 4.42  # THB per kWh


class DeviceScheduleItem(BaseModel):
    device_id: str
    on_hour: int       # 0-23
    off_hour: int      # 0-23
    enabled: bool = True


class EnergyPlanRequest(BaseModel):
    plan_name: str
    schedules: List[DeviceScheduleItem]


# -----------------------------------------------------------------------
# GET /api/schedule/devices  – list all devices with current power + status
# -----------------------------------------------------------------------
@router.get("/devices")
def get_schedulable_devices():
    """Returns all devices with their live power draw and on/off status."""
    repo = get_repository()
    devices = repo.get_devices()

    conn = get_connection()
    c = conn.cursor()
    # Latest power reading per device
    c.execute("""
        SELECT device_id, power, energy, timestamp
        FROM energy_readings
        WHERE id IN (
            SELECT MAX(id) FROM energy_readings GROUP BY device_id
        )
    """)
    live = {row[0]: {"power": row[1], "energy": row[2], "last_seen": row[3]} for row in c.fetchall()}
    conn.close()

    result = []
    for d in devices:
        did = d["device_id"]
        lv = live.get(did, {})
        daily_kwh = round((d.get("rated_power", 0) * 8) / 1000, 2)
        daily_cost = round(daily_kwh * ELECTRICITY_RATE_PER_KWH, 2)
        result.append({
            **d,
            "current_power_w": lv.get("power", 0.0),
            "last_seen": lv.get("last_seen"),
            "daily_kwh_estimate": daily_kwh,
            "daily_cost_thb": daily_cost,
        })
    return result


# -----------------------------------------------------------------------
# POST /api/schedule/device/toggle  – turn device on/off by writing a 0W or full reading
# -----------------------------------------------------------------------
class DeviceToggleRequest(BaseModel):
    device_id: str
    turn_on: bool
    override_watts: Optional[float] = None


@router.post("/device/toggle")
def toggle_device(req: DeviceToggleRequest):
    """Toggle a device on or off by inserting an energy reading."""
    repo = get_repository()
    device = repo.get_device(req.device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{req.device_id}' not found.")

    if req.turn_on:
        power = req.override_watts if req.override_watts is not None else device.get("rated_power", 1000.0)
    else:
        power = 0.0

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    reading = {
        "timestamp": now_str,
        "device_id": req.device_id,
        "voltage": 230.0,
        "current": round(power / 230.0, 2),
        "power": power,
        "energy": round(power / 1000.0 / 3600.0, 6),
        "temperature": 25.0,
        "humidity": 60.0,
        "occupancy": 1 if req.turn_on else 0,
    }
    repo.insert_reading(reading)
    repo.update_device_status(req.device_id, req.turn_on, 25.0)

    return {
        "status": "success",
        "device_id": req.device_id,
        "action": "turned_on" if req.turn_on else "turned_off",
        "power_w": power,
        "timestamp": now_str,
        "message": f"{'Turned ON' if req.turn_on else 'Turned OFF'} {device.get('name', req.device_id)} ({power}W)"
    }


# -----------------------------------------------------------------------
# POST /api/schedule/plan/simulate  – simulate a plan and return cost savings
# -----------------------------------------------------------------------
@router.post("/plan/simulate")
def simulate_plan(req: EnergyPlanRequest):
    """
    Calculates projected cost for the day if the given schedule plan is applied.
    Returns comparison vs. running all devices at full rated power 24h.
    """
    repo = get_repository()
    devices = {d["device_id"]: d for d in repo.get_devices()}

    total_kwh = 0.0
    breakdown = []

    for s in req.schedules:
        if not s.enabled:
            continue
        device = devices.get(s.device_id)
        if not device:
            continue

        hours_on = s.off_hour - s.on_hour if s.off_hour > s.on_hour else (24 - s.on_hour + s.off_hour)
        hours_on = max(0, min(24, hours_on))
        rated_kw = device.get("rated_power", 1000.0) / 1000.0
        kwh = round(rated_kw * hours_on, 2)
        cost = round(kwh * ELECTRICITY_RATE_PER_KWH, 2)
        total_kwh += kwh

        breakdown.append({
            "device_id": s.device_id,
            "device_name": device.get("name", s.device_id),
            "on_hour": s.on_hour,
            "off_hour": s.off_hour,
            "hours_on": hours_on,
            "rated_kw": rated_kw,
            "kwh": kwh,
            "cost_thb": cost,
        })

    total_kwh = round(total_kwh, 2)
    total_cost = round(total_kwh * ELECTRICITY_RATE_PER_KWH, 2)

    # Baseline: all devices on 24h
    baseline_kwh = round(sum(d.get("rated_power", 0) / 1000.0 * 24 for d in devices.values()), 2)
    baseline_cost = round(baseline_kwh * ELECTRICITY_RATE_PER_KWH, 2)
    savings_kwh = round(baseline_kwh - total_kwh, 2)
    savings_thb = round(baseline_cost - total_cost, 2)
    savings_pct = round((savings_thb / baseline_cost) * 100, 1) if baseline_cost > 0 else 0

    return {
        "plan_name": req.plan_name,
        "total_kwh": total_kwh,
        "total_cost_thb": total_cost,
        "baseline_kwh_24h": baseline_kwh,
        "baseline_cost_thb_24h": baseline_cost,
        "savings_kwh": savings_kwh,
        "savings_thb": savings_thb,
        "savings_pct": savings_pct,
        "breakdown": breakdown,
    }


# -----------------------------------------------------------------------
# POST /api/schedule/data/reset  – delete all energy readings (sheet data)
# -----------------------------------------------------------------------
class ResetDataRequest(BaseModel):
    confirm: bool = False
    keep_days: Optional[int] = None  # Keep last N days; None = wipe all


@router.post("/data/reset")
def reset_data(req: ResetDataRequest):
    """Deletes energy readings from the database. Irreversible!"""
    if not req.confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to proceed. This action cannot be undone."
        )

    conn = get_connection()
    c = conn.cursor()

    if req.keep_days is not None and req.keep_days > 0:
        c.execute("""
            DELETE FROM energy_readings
            WHERE timestamp < datetime('now', ? || ' days')
        """, (f"-{req.keep_days}",))
        msg = f"Deleted readings older than {req.keep_days} days."
    else:
        c.execute("DELETE FROM energy_readings")
        msg = "All energy readings deleted."

    deleted = c.rowcount
    conn.commit()

    # Reset device statuses to 0 (offline)
    c.execute("UPDATE devices SET status = 0, temperature = NULL")
    conn.commit()
    conn.close()

    try:
        from backend.services.gsheet_service import clear_sheet_cache
        clear_sheet_cache()
    except Exception:
        pass

    return {
        "status": "success",
        "rows_deleted": deleted,
        "message": msg,
    }

