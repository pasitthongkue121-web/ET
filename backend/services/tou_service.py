"""
TOU (Time-of-Use) Optimization Engine
=======================================
Calculates electricity cost under MEA/PEA Thailand TOU tariff structure
and recommends device schedule shifts to minimise cost.

TOU Rate Structure (MEA residential TOU):
  On-Peak:   Mon–Fri 09:00–22:00           → 5.6836 THB/kWh
  Off-Peak:  Mon–Fri 22:00–09:00 + Sat/Sun → 2.6369 THB/kWh
  (Rates include FT charge as of 2024)
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from backend.services.thai_tariff import (
    TOU_ON_PEAK_WITH_FT as RATE_ON_PEAK,
    TOU_OFF_PEAK_WITH_FT as RATE_OFF_PEAK,
    TOU_ON_PEAK_BASE,
    TOU_OFF_PEAK_BASE,
    FT_RATE_THB,
    SERVICE_CHARGE_THB,
    VAT_RATE_PCT,
    calculate_normal_progressive_bill,
    calculate_tou_bill
)

# Load groups per FREC/MEA classification
LIGHTING_CATEGORY   = "lighting"
RECEPTACLE_CATEGORY = "receptacle"
HEAVY_LOAD_CATEGORY = "heavy_load"

# Shiftable heavy devices (can be moved to off-peak)
SHIFTABLE_DEVICES = {
    "washing_machine": {"shift_window": list(range(22, 24)) + list(range(0, 6)), "name": "Washing Machine"},
    "water_heater":    {"shift_window": list(range(22, 24)) + list(range(5, 7)), "name": "Water Heater"},
    "ev_charger":      {"shift_window": list(range(22, 24)) + list(range(0, 6)), "name": "EV Charger"},
    "dishwasher":      {"shift_window": list(range(22, 24)) + list(range(0, 5)), "name": "Dishwasher"},
}


def is_on_peak(dt: datetime) -> bool:
    """Return True if datetime falls in TOU on-peak window."""
    # Saturday (5) and Sunday (6) are always off-peak
    if dt.weekday() >= 5:
        return False
    return 9 <= dt.hour < 22


def get_tou_rate(dt: datetime) -> float:
    return RATE_ON_PEAK if is_on_peak(dt) else RATE_OFF_PEAK


def calculate_cost_from_readings(
    readings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate actual electricity cost from time-series readings using TOU rates.

    Args:
        readings: List of reading dicts with timestamp, power (W), device_id

    Returns:
        Dict with total_cost, on_peak_cost, off_peak_cost, on_peak_kwh, off_peak_kwh,
        cost_by_device, savings_potential
    """
    total_on_peak_kwh   = 0.0
    total_off_peak_kwh  = 0.0
    total_on_peak_cost  = 0.0
    total_off_peak_cost = 0.0
    cost_by_device: Dict[str, Dict[str, float]] = {}

    for r in readings:
        try:
            ts = datetime.strptime(r["timestamp"][:19], "%Y-%m-%d %H:%M:%S")
        except (ValueError, KeyError):
            continue

        power_w = float(r.get("power", 0.0))
        dev_id  = r.get("device_id", "unknown")

        # Assume reading represents 1-minute interval (adjust if needed)
        interval_h = 1 / 60.0
        kwh = (power_w / 1000.0) * interval_h
        rate = get_tou_rate(ts)
        cost = kwh * rate

        if is_on_peak(ts):
            total_on_peak_kwh  += kwh
            total_on_peak_cost += cost
        else:
            total_off_peak_kwh  += kwh
            total_off_peak_cost += cost

        if dev_id not in cost_by_device:
            cost_by_device[dev_id] = {"kwh": 0.0, "cost": 0.0, "on_peak_kwh": 0.0}
        cost_by_device[dev_id]["kwh"]  += kwh
        cost_by_device[dev_id]["cost"] += cost
        if is_on_peak(ts):
            cost_by_device[dev_id]["on_peak_kwh"] += kwh

    total_kwh  = total_on_peak_kwh + total_off_peak_kwh
    total_cost = total_on_peak_cost + total_off_peak_cost

    # Savings potential: if on-peak energy was shifted to off-peak
    max_saving = total_on_peak_kwh * (RATE_ON_PEAK - RATE_OFF_PEAK)

    return {
        "total_kwh":        round(total_kwh, 3),
        "total_cost_thb":   round(total_cost, 2),
        "on_peak_kwh":      round(total_on_peak_kwh, 3),
        "off_peak_kwh":     round(total_off_peak_kwh, 3),
        "on_peak_cost_thb": round(total_on_peak_cost, 2),
        "off_peak_cost_thb":round(total_off_peak_cost, 2),
        "avg_rate_thb_kwh": round(total_cost / total_kwh, 4) if total_kwh > 0 else 0.0,
        "on_peak_rate":     RATE_ON_PEAK,
        "off_peak_rate":    RATE_OFF_PEAK,
        "savings_potential_thb": round(max_saving, 2),
        "cost_by_device": {
            dev: {
                "kwh": round(v["kwh"], 3),
                "cost_thb": round(v["cost"], 2),
                "on_peak_kwh": round(v["on_peak_kwh"], 3),
            }
            for dev, v in sorted(cost_by_device.items(), key=lambda x: -x[1]["cost"])
        },
    }


def generate_shift_recommendations(
    readings: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Analyse shiftable device usage and recommend moving to off-peak windows.

    Returns list of recommendation dicts sorted by savings (highest first).
    """
    device_on_peak: Dict[str, Dict[str, float]] = {}

    for r in readings:
        dev_id = r.get("device_id", "")
        if dev_id not in SHIFTABLE_DEVICES:
            continue

        try:
            ts = datetime.strptime(r["timestamp"][:19], "%Y-%m-%d %H:%M:%S")
        except (ValueError, KeyError):
            continue

        if not is_on_peak(ts):
            continue

        power_w = float(r.get("power", 0.0))
        interval_h = 1 / 60.0
        kwh  = (power_w / 1000.0) * interval_h
        cost = kwh * RATE_ON_PEAK

        if dev_id not in device_on_peak:
            device_on_peak[dev_id] = {"kwh": 0.0, "cost": 0.0, "count": 0}
        device_on_peak[dev_id]["kwh"]  += kwh
        device_on_peak[dev_id]["cost"] += cost
        device_on_peak[dev_id]["count"] += 1

    recommendations = []
    for dev_id, stats in device_on_peak.items():
        kwh  = stats["kwh"]
        if kwh < 0.001:
            continue

        saved_cost = kwh * (RATE_ON_PEAK - RATE_OFF_PEAK)
        off_peak_cost = kwh * RATE_OFF_PEAK
        info = SHIFTABLE_DEVICES[dev_id]
        shift_window = info["shift_window"]
        window_str = f"{shift_window[0]:02d}:00 – {(shift_window[-1]+1) % 24:02d}:00"

        recommendations.append({
            "device_id":         dev_id,
            "device_name":       info["name"],
            "on_peak_kwh":       round(kwh, 3),
            "on_peak_cost_thb":  round(stats["cost"], 2),
            "off_peak_cost_thb": round(off_peak_cost, 2),
            "savings_thb":       round(saved_cost, 2),
            "shift_to_window":   window_str,
            "recommendation": (
                f"Shift {info['name']} to {window_str} (off-peak) "
                f"to save ฿{round(saved_cost, 2)}/period"
            ),
            "priority": "high" if saved_cost > 10 else ("medium" if saved_cost > 3 else "low"),
        })

    return sorted(recommendations, key=lambda x: -x["savings_thb"])


def classify_load_groups(
    devices: List[Dict[str, Any]],
    readings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Classify total energy consumption into MEA load groups:
      1. Lighting circuits
      2. Receptacle/power circuits
      3. Heavy load circuits

    Returns breakdown by group with percentage share.
    """
    from collections import defaultdict
    device_cat = {d["device_id"]: d.get("category", "receptacle") for d in devices}
    group_kwh: Dict[str, float] = {
        "lighting":    0.0,
        "receptacle":  0.0,
        "heavy_load":  0.0,
    }

    for r in readings:
        dev_id = r.get("device_id", "")
        cat = device_cat.get(dev_id, "receptacle")
        kwh = float(r.get("energy", 0.0))
        if cat in group_kwh:
            group_kwh[cat] += kwh

    total_kwh = sum(group_kwh.values()) or 1.0
    return {
        "groups": {
            cat: {
                "kwh":        round(kwh, 3),
                "percentage": round(kwh / total_kwh * 100, 1),
                "label": {
                    "lighting":   "วงจรแสงสว่าง (Lighting)",
                    "receptacle": "เต้ารับ/กำลัง (Receptacle/Power)",
                    "heavy_load": "โหลดหนัก (Heavy Load)",
                }.get(cat, cat),
            }
            for cat, kwh in group_kwh.items()
        },
        "total_kwh": round(total_kwh, 3),
    }
