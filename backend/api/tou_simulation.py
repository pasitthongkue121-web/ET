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


# ---------------------------------------------------------------------------
# TOU Smart Meter & Multi-Circuit Simulation Endpoints
# ---------------------------------------------------------------------------
from pydantic import BaseModel
import random

class TOUSimulateRequest(BaseModel):
    solar_mode: str = "hybrid"  # none | ongrid | hybrid
    solar_capacity_kw: float = 5.0
    battery_capacity_kwh: float = 10.0
    battery_dod_pct: float = 90.0
    ev_enabled: bool = True
    ev_charger_kw: float = 7.4
    ev_target_kwh: float = 30.0
    ev_mode: str = "smart_offpeak"  # immediate | smart_offpeak | solar_surplus


@router.get("/status")
def get_tou_status():
    """Returns real-time TOU meter status and period based on current Thai time."""
    now = datetime.now()
    is_weekend = now.weekday() >= 5
    hour = now.hour
    is_on_peak = not is_weekend and (9 <= hour < 22)
    
    from backend.services.thai_tariff import (
        TOU_ON_PEAK_BASE,
        TOU_OFF_PEAK_BASE,
        TOU_ON_PEAK_WITH_FT,
        TOU_OFF_PEAK_WITH_FT,
        FT_RATE_THB,
        SERVICE_CHARGE_THB,
        VAT_RATE_PCT
    )

    current_rate = TOU_ON_PEAK_WITH_FT if is_on_peak else TOU_OFF_PEAK_WITH_FT
    flat_rate = 4.4217 + FT_RATE_THB  # effective ~4.82 THB/kWh with Ft
    
    if is_on_peak:
        hours_to_next = 22 - hour
        period_name = "On-Peak (ช่วงความต้องการไฟฟ้าสูง)"
        period_color = "rose"
        next_period = f"Off-Peak เริ่มเวลา 22:00 ({hours_to_next} ชม.)"
    else:
        hours_to_next = (9 - hour) if (hour < 9 and not is_weekend) else (24 - hour + 9 if not is_weekend else 24)
        period_name = "Off-Peak (ช่วงค่าไฟประหยัด)"
        period_color = "emerald"
        next_period = "On-Peak เริ่มเวลา 09:00 วันจันทร์-ศุกร์" if is_weekend else f"On-Peak เริ่มเวลา 09:00 ({hours_to_next} ชม.)"

    return {
        "is_on_peak": is_on_peak,
        "current_rate_thb": current_rate,
        "base_rate_thb": TOU_ON_PEAK_BASE if is_on_peak else TOU_OFF_PEAK_BASE,
        "ft_rate_thb": FT_RATE_THB,
        "flat_rate_thb": round(flat_rate, 2),
        "service_charge_thb": SERVICE_CHARGE_THB,
        "vat_pct": VAT_RATE_PCT,
        "period_name": period_name,
        "period_color": period_color,
        "hours_to_next": max(1, hours_to_next),
        "next_period": next_period,
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
    }


@router.get("/circuits")
def get_circuits_status():
    """Returns load breakdown across 3 main circuits (Lighting, Receptacle, Heavy Load)."""
    repo = get_repository()
    devices = repo.get_devices()
    
    lighting_devs = []
    receptacle_devs = []
    heavy_devs = []

    for d in devices:
        cat = d.get("category", "").lower()
        item = {
            "device_id": d.get("device_id"),
            "name": d.get("name"),
            "room_id": d.get("room_id", "main_panel"),
            "room_name": d.get("room_name", "Main Panel"),
            "rated_power": float(d.get("rated_power", 1000.0)),
            "status": int(d.get("status", 0)),
            "temperature": d.get("temperature", 25.0),
            "category": cat,
            "circuit": "lighting" if cat == "lighting" else ("receptacle" if cat in ["receptacle", "computing", "entertainment"] else "heavy_load"),
            "current_power_w": float(d.get("rated_power", 1000.0) if d.get("status", 0) else (d.get("rated_power", 1000.0) * 0.4)),
            "is_active": bool(d.get("status", 0))
        }
        if cat == "lighting":
            lighting_devs.append(item)
        elif cat in ["receptacle", "computing", "entertainment"]:
            receptacle_devs.append(item)
        else:
            heavy_devs.append(item)

    # Provide defaults if any group is empty
    if not lighting_devs:
        lighting_devs = [{
            "device_id": "circuit_lighting",
            "name": "วงจรแสงสว่าง (Lighting Circuit)",
            "room_id": "main_panel",
            "room_name": "Main Panel",
            "rated_power": 800.0,
            "status": 1,
            "category": "lighting",
            "circuit": "lighting",
            "current_power_w": 250.0,
            "is_active": True
        }]
    if not receptacle_devs:
        receptacle_devs = [{
            "device_id": "circuit_receptacle",
            "name": "วงจรเต้ารับ (Power Receptacles)",
            "room_id": "main_panel",
            "room_name": "Main Panel",
            "rated_power": 2000.0,
            "status": 1,
            "category": "receptacle",
            "circuit": "receptacle",
            "current_power_w": 650.0,
            "is_active": True
        }]
    if not heavy_devs:
        heavy_devs = [{
            "device_id": "circuit_heavy_load",
            "name": "โหลดหนัก (AC, Water Heater, Motors)",
            "room_id": "main_panel",
            "room_name": "Main Panel",
            "rated_power": 5000.0,
            "status": 1,
            "category": "heavy_load",
            "circuit": "heavy_load",
            "current_power_w": 1850.0,
            "is_active": True
        }]

    return {
        "lighting": {
            "name": "วงจรแสงสว่าง (Lighting Circuit)",
            "devices": lighting_devs,
            "total_power_w": sum(d["current_power_w"] for d in lighting_devs),
            "rated_power_w": sum(d["rated_power"] for d in lighting_devs),
        },
        "receptacle": {
            "name": "วงจรเต้ารับ (Receptacle Circuit)",
            "devices": receptacle_devs,
            "total_power_w": sum(d["current_power_w"] for d in receptacle_devs),
            "rated_power_w": sum(d["rated_power"] for d in receptacle_devs),
        },
        "heavy_load": {
            "name": "โหลดหนัก (Heavy Load Circuit)",
            "devices": heavy_devs,
            "total_power_w": sum(d["current_power_w"] for d in heavy_devs),
            "rated_power_w": sum(d["rated_power"] for d in heavy_devs),
        }
    }


@router.post("/simulate")
def run_tou_simulation(req: TOUSimulateRequest):
    """
    Executes a 24-hour smart TOU simulation calculating solar generation curve,
    battery dispatch (BESS), EV smart-charging, grid import/export, and savings.
    """
    solar_cap = req.solar_capacity_kw if req.solar_mode != "none" else 0.0
    bat_cap = req.battery_capacity_kwh if req.solar_mode == "hybrid" else 0.0
    bat_max_soc = bat_cap * (req.battery_dod_pct / 100.0)
    current_bat_kwh = bat_max_soc * 0.3  # start at 30% available

    records = []
    total_consumption = 0.0
    total_solar_gen = 0.0
    total_grid_import = 0.0
    total_grid_export = 0.0
    on_peak_import = 0.0
    off_peak_import = 0.0
    
    light_total = 0.0
    recep_total = 0.0
    heavy_total = 0.0
    ev_total = 0.0

    ev_target_needed = req.ev_target_kwh if req.ev_enabled else 0.0

    for h in range(24):
        hour_label = f"{h:02d}:00"
        is_on_peak = 9 <= h < 22
        rate = RATE_ON_PEAK if is_on_peak else RATE_OFF_PEAK

        # Base load profiles (kW)
        l_kw = 0.45 if (18 <= h <= 23) else (0.15 if (6 <= h <= 8) else 0.05)
        r_kw = 0.85 if (8 <= h <= 22) else 0.25
        h_kw = 1.95 if (12 <= h <= 23) else 0.40

        # EV Charging profile based on mode
        ev_kw = 0.0
        if req.ev_enabled and ev_target_needed > 0:
            if req.ev_mode == "smart_offpeak":
                # Charge strictly off-peak (22:00 to 06:00)
                if (h >= 22 or h < 6) and ev_target_needed > 0:
                    ev_kw = min(req.ev_charger_kw, ev_target_needed)
                    ev_target_needed -= ev_kw
            elif req.ev_mode == "solar_surplus":
                # Charge during solar peak (11:00 to 15:00)
                if (11 <= h <= 15) and ev_target_needed > 0:
                    ev_kw = min(req.ev_charger_kw, ev_target_needed)
                    ev_target_needed -= ev_kw
            else: # Immediate mode
                if (18 <= h <= 23) and ev_target_needed > 0:
                    ev_kw = min(req.ev_charger_kw, ev_target_needed)
                    ev_target_needed -= ev_kw

        tot_load = l_kw + r_kw + h_kw + ev_kw
        total_consumption += tot_load

        light_total += l_kw
        recep_total += r_kw
        heavy_total += h_kw
        ev_total += ev_kw

        # Solar PV generation curve (Bell curve peaking at noon)
        solar_gen = 0.0
        if 6 <= h <= 18 and solar_cap > 0:
            noon_dist = abs(h - 12.0)
            solar_factor = max(0.0, 1.0 - (noon_dist / 6.0) ** 2)
            solar_gen = round(solar_cap * solar_factor * 0.85, 2)
        total_solar_gen += solar_gen

        # Battery Storage & Grid flow simulation
        bat_charge = 0.0
        bat_discharge = 0.0
        net = solar_gen - tot_load

        if net > 0: # Surplus solar
            if bat_cap > 0 and current_bat_kwh < bat_max_soc:
                bat_charge = min(net, (bat_max_soc - current_bat_kwh), 3.3)
                current_bat_kwh += bat_charge
                net -= bat_charge
            grid_export = max(0.0, net)
            grid_import = 0.0
        else: # Deficit
            deficit = abs(net)
            if bat_cap > 0 and current_bat_kwh > 0 and is_on_peak:
                # Discharge battery during expensive on-peak hours
                bat_discharge = min(deficit, current_bat_kwh, 3.3)
                current_bat_kwh -= bat_discharge
                deficit -= bat_discharge
            grid_import = max(0.0, deficit)
            grid_export = 0.0

        total_grid_import += grid_import
        total_grid_export += grid_export

        if is_on_peak:
            on_peak_import += grid_import
        else:
            off_peak_import += grid_import

        bat_soc_pct = (current_bat_kwh / bat_cap * 100.0) if bat_cap > 0 else 0.0

        records.append({
            "hour": h,
            "hour_label": hour_label,
            "is_on_peak": is_on_peak,
            "rate_thb": rate,
            "lighting_kw": round(l_kw, 2),
            "receptacle_kw": round(r_kw, 2),
            "heavy_load_kw": round(h_kw, 2),
            "ev_load_kw": round(ev_kw, 2),
            "total_load_kw": round(tot_load, 2),
            "solar_gen_kw": round(solar_gen, 2),
            "bat_charge_kw": round(bat_charge, 2),
            "bat_discharge_kw": round(bat_discharge, 2),
            "bat_soc_pct": round(bat_soc_pct, 1),
            "grid_import_kw": round(grid_import, 2),
            "grid_export_kw": round(grid_export, 2),
        })

    # Authentic MEA / PEA Electricity Tariff Calculations
    from backend.services.thai_tariff import (
        calculate_normal_progressive_bill,
        calculate_tou_bill,
        TOU_ON_PEAK_BASE,
        TOU_OFF_PEAK_BASE,
        FT_RATE_THB,
        SERVICE_CHARGE_THB,
        VAT_RATE_PCT,
        FIT_EXPORT_RATE_THB
    )

    # 30-Day Household Projection
    monthly_consumption_kwh = total_consumption * 30.0
    normal_bill = calculate_normal_progressive_bill(monthly_consumption_kwh)

    monthly_on_peak_kwh = on_peak_import * 30.0
    monthly_off_peak_kwh = off_peak_import * 30.0
    monthly_export_kwh = total_grid_export * 30.0
    tou_bill = calculate_tou_bill(monthly_on_peak_kwh, monthly_off_peak_kwh, monthly_export_kwh)

    monthly_flat = normal_bill["total_bill_thb"]
    monthly_tou = tou_bill["total_bill_thb"]
    monthly_savings = max(0.0, monthly_flat - monthly_tou)
    savings_pct = (monthly_savings / monthly_flat * 100.0) if monthly_flat > 0 else 0.0
    yearly_savings = monthly_savings * 12.0

    daily_flat_baseline = round(monthly_flat / 30.0, 2)
    daily_tou_cost = round(monthly_tou / 30.0, 2)
    daily_savings = round(monthly_savings / 30.0, 2)

    on_peak_cost = round(on_peak_import * (TOU_ON_PEAK_BASE + FT_RATE_THB), 2)
    off_peak_cost = round(off_peak_import * (TOU_OFF_PEAK_BASE + FT_RATE_THB), 2)
    export_income = round(total_grid_export * FIT_EXPORT_RATE_THB, 2)

    # System investment estimation (solar ~25k/kW, battery ~14k/kWh, EV Wallbox ~25k)
    invest = (solar_cap * 25000.0) + (bat_cap * 14000.0) + (25000.0 if req.ev_enabled else 0.0)
    payback_years = round((invest / max(1.0, yearly_savings)), 1) if yearly_savings > 0 else 0.0

    return {
        "scenario": {
            "solar_mode": req.solar_mode,
            "solar_capacity_kw": solar_cap,
            "battery_capacity_kwh": bat_cap,
            "ev_enabled": req.ev_enabled,
            "ev_charger_kw": req.ev_charger_kw if req.ev_enabled else 0.0,
            "ev_mode": req.ev_mode,
            "ev_target_kwh": req.ev_target_kwh if req.ev_enabled else 0.0
        },
        "totals": {
            "total_consumption_kwh": round(total_consumption, 2),
            "total_solar_gen_kwh": round(total_solar_gen, 2),
            "total_grid_import_kwh": round(total_grid_import, 2),
            "total_grid_export_kwh": round(total_grid_export, 2),
            "on_peak_import_kwh": round(on_peak_import, 2),
            "off_peak_import_kwh": round(off_peak_import, 2),
            "solar_self_consumption_pct": round(min(100.0, ((total_solar_gen - total_grid_export) / max(0.1, total_solar_gen)) * 100.0), 1),
        },
        "circuits_breakdown": {
            "lighting_kwh": round(light_total, 2),
            "receptacle_kwh": round(recep_total, 2),
            "heavy_load_kwh": round(heavy_total, 2),
            "ev_kwh": round(ev_total, 2),
            "lighting_pct": round((light_total / max(0.1, total_consumption)) * 100.0, 1),
            "receptacle_pct": round((recep_total / max(0.1, total_consumption)) * 100.0, 1),
            "heavy_load_pct": round((heavy_total / max(0.1, total_consumption)) * 100.0, 1),
            "ev_pct": round((ev_total / max(0.1, total_consumption)) * 100.0, 1),
        },
        "costs": {
            "on_peak_cost_thb": on_peak_cost,
            "off_peak_cost_thb": off_peak_cost,
            "export_income_thb": export_income,
            "daily_tou_cost_thb": daily_tou_cost,
            "daily_flat_baseline_thb": daily_flat_baseline,
            "raw_tou_without_solar_thb": round(daily_flat_baseline * 0.95, 2),
            "daily_savings_thb": daily_savings,
            "daily_savings_pct": round(savings_pct, 1),
            "monthly_flat_cost_thb": round(monthly_flat, 2),
            "monthly_tou_cost_thb": round(monthly_tou, 2),
            "monthly_savings_thb": round(monthly_savings, 2),
            "yearly_savings_thb": round(yearly_savings, 2),
            "estimated_investment_thb": round(invest, 2),
            "payback_period_years": payback_years,
        },
        "official_tariffs": {
            "ft_rate_thb": FT_RATE_THB,
            "service_charge_thb": SERVICE_CHARGE_THB,
            "vat_pct": VAT_RATE_PCT,
            "fit_export_rate_thb": FIT_EXPORT_RATE_THB,
            "normal_steps": [
                {"label": "1 - 150 หน่วยแรก", "rate": 3.2484},
                {"label": "151 - 400 หน่วยถัดไป", "rate": 4.2233},
                {"label": "401 หน่วยขึ้นไป", "rate": 4.4217},
            ],
            "tou_rates": {
                "on_peak_base": TOU_ON_PEAK_BASE,
                "off_peak_base": TOU_OFF_PEAK_BASE,
                "on_peak_with_ft": round(TOU_ON_PEAK_BASE + FT_RATE_THB, 4),
                "off_peak_with_ft": round(TOU_OFF_PEAK_BASE + FT_RATE_THB, 4),
            }
        },
        "normal_bill_breakdown": normal_bill,
        "tou_bill_breakdown": tou_bill,
        "hourly_chart": records
    }
