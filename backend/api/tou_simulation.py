"""
API route: TOU Optimization
============================
Exposes TOU cost analysis and device-shift recommendations via REST.
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timedelta

from backend.database.repository import get_repository
from backend.services.tou_service import (
    calculate_cost_from_readings,
    generate_shift_recommendations,
    classify_load_groups,
    RATE_ON_PEAK,
    RATE_OFF_PEAK,
)

router = APIRouter(prefix="/api/tou", tags=["TOU Optimization"])


@router.get("/cost")
def get_tou_cost(days: int = Query(7, ge=1, le=90)):
    """
    Calculate electricity cost breakdown using TOU rates for the last N days.
    Returns on-peak vs off-peak cost, savings potential, and per-device breakdown.
    """
    repo = get_repository()
    now   = datetime.now()
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    end   = now.strftime("%Y-%m-%d %H:%M:%S")
    readings = repo.get_readings_timeseries(start, end)
    return calculate_cost_from_readings(readings)


@router.get("/recommendations")
def get_shift_recommendations(days: int = Query(7, ge=1, le=30)):
    """
    Recommend shifting shiftable devices (washing machine, water heater, EV)
    from on-peak to off-peak windows to reduce electricity bill.
    """
    repo = get_repository()
    now   = datetime.now()
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    end   = now.strftime("%Y-%m-%d %H:%M:%S")
    readings = repo.get_readings_timeseries(start, end)
    recs = generate_shift_recommendations(readings)
    return {
        "analysis_period_days": days,
        "on_peak_rate":   RATE_ON_PEAK,
        "off_peak_rate":  RATE_OFF_PEAK,
        "recommendations": recs,
        "total_potential_saving_thb": round(sum(r["savings_thb"] for r in recs), 2),
    }


@router.get("/load-groups")
def get_load_groups(days: int = Query(7, ge=1, le=30)):
    """
    Classify energy consumption into MEA load groups:
    lighting / receptacle / heavy-load circuits.
    """
    repo = get_repository()
    now   = datetime.now()
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    end   = now.strftime("%Y-%m-%d %H:%M:%S")
    devices  = repo.get_devices()
    readings = repo.get_readings_timeseries(start, end)
    return classify_load_groups(devices, readings)


@router.get("/rates")
def get_rates():
    """Return current TOU rate structure (MEA Thailand residential)."""
    return {
        "tariff": "MEA Residential TOU",
        "on_peak_rate_thb_kwh": RATE_ON_PEAK,
        "off_peak_rate_thb_kwh": RATE_OFF_PEAK,
        "on_peak_hours": "Mon–Fri 09:00–22:00",
        "off_peak_hours": "Mon–Fri 22:00–09:00, Sat–Sun all day",
        "note": "Rates include FT charge (2024)",
    }
