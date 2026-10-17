from fastapi import APIRouter, Query, Response
from typing import List, Optional
import csv
import io
from datetime import datetime
from backend.services.analytics_service import analytics_service
from backend.services.tou_service import is_on_peak, get_tou_rate
from backend.database.connection import get_connection
from backend.database.models import (
    AnalyticsSummaryResponse,
    DailyEnergyItem,
    WeeklyEnergyItem,
    MonthlyEnergyItem,
    DeviceConsumptionItem,
    PeakAnalyticsResponse,
    CostAnalyticsResponse,
    CO2AnalyticsResponse,
)

router = APIRouter(prefix="/api/analytics", tags=["Energy Analytics"])

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(days: int = Query(30, ge=1, le=90)):
    """
    Returns full statistical energy analytics: total consumption, min/max/avg power,
    peak time & duration, energy cost, and CO2 emission.
    """
    return analytics_service.get_summary(days=days)

@router.get("/daily", response_model=List[DailyEnergyItem])
def get_daily_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns daily energy consumption series with cost and peak/avg power.
    """
    return analytics_service.get_daily(days=days)

@router.get("/weekly", response_model=List[WeeklyEnergyItem])
def get_weekly_analytics(days: int = Query(30, ge=7, le=90)):
    """
    Returns weekly aggregated energy consumption.
    """
    return analytics_service.get_weekly(days=days)

@router.get("/monthly", response_model=List[MonthlyEnergyItem])
def get_monthly_analytics(days: int = Query(30, ge=15, le=180)):
    """
    Returns monthly aggregated energy consumption and projected cost.
    """
    return analytics_service.get_monthly(days=days)

@router.get("/devices", response_model=List[DeviceConsumptionItem])
def get_device_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns appliance-by-appliance breakdown: kWh, percentage, runtime, standby hours, cost.
    """
    return analytics_service.get_devices(days=days)

@router.get("/peak", response_model=PeakAnalyticsResponse)
def get_peak_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns peak power telemetry, 3-hour peak window, duration, PAR, and hourly distribution.
    """
    return analytics_service.get_peak(days=days)

@router.get("/cost", response_model=CostAnalyticsResponse)
def get_cost_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns cost calculation based on configurable electricity tariff without hardcoding.
    """
    return analytics_service.get_cost(days=days)

@router.get("/co2", response_model=CO2AnalyticsResponse)
def get_co2_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns estimated carbon footprint (kg CO2) and tree offset equivalents.
    """
    return analytics_service.get_co2(days=days)


@router.get("/export/csv")
def export_energy_readings_csv(
    start_date: Optional[str] = Query(None, description="Start date/time (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    end_date: Optional[str] = Query(None, description="End date/time (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)"),
    device_id: Optional[str] = Query(None, description="Device ID filter"),
    data_source: Optional[str] = Query(None, description="Source filter: real, simulated, or all"),
):
    """
    Exports energy readings to CSV with TOU tariff, cost calculations,
    and data provenance disclosure (data_source, simulation_batch_id).
    """
    conn = get_connection()
    c = conn.cursor()

    # Device lookup
    c.execute("SELECT device_id, name FROM devices")
    device_names = {row["device_id"]: row["name"] for row in c.fetchall()}

    query = """
        SELECT r.id, r.timestamp, r.device_id, r.voltage, r.current, r.power, r.energy,
               r.data_source, r.simulation_batch_id
        FROM energy_readings r
        INNER JOIN (
            SELECT MAX(id) as max_id
            FROM energy_readings
            GROUP BY timestamp, device_id
        ) latest ON r.id = latest.max_id
        WHERE 1=1
    """
    params = []

    if isinstance(start_date, str) and start_date:
        start_date_str = f"{start_date} 00:00:00" if len(start_date) == 10 else start_date
        query += " AND r.timestamp >= ?"
        params.append(start_date_str)

    if isinstance(end_date, str) and end_date:
        end_date_str = f"{end_date} 23:59:59" if len(end_date) == 10 else end_date
        query += " AND r.timestamp <= ?"
        params.append(end_date_str)

    if isinstance(device_id, str) and device_id:
        query += " AND r.device_id = ?"
        params.append(device_id)

    if isinstance(data_source, str) and data_source.lower() != "all":
        query += " AND r.data_source = ?"
        params.append(data_source.lower())

    query += " ORDER BY r.timestamp ASC"

    c.execute(query, params)
    rows = c.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "timestamp",
        "device_id",
        "device_name",
        "power_w",
        "energy_kwh",
        "voltage_v",
        "current_a",
        "tariff_period",
        "rate_thb_kwh",
        "cost_thb",
        "data_source",
        "simulation_batch_id"
    ])

    for row in rows:
        ts_str = str(row["timestamp"])
        try:
            ts_dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            ts_dt = datetime.now()

        on_peak = is_on_peak(ts_dt)
        tariff_period = "on-peak" if on_peak else "off-peak"
        rate = get_tou_rate(ts_dt)

        power_w = round(float(row["power"] or 0.0), 2)
        energy_kwh = round(float(row["energy"] or 0.0), 4)
        voltage_v = round(float(row["voltage"] or 0.0), 1)
        current_a = round(float(row["current"] or 0.0), 2)
        cost_thb = round(energy_kwh * rate, 4)

        dev_id = str(row["device_id"])
        dev_name = device_names.get(dev_id, dev_id)
        src = str(row["data_source"] or "simulated")
        batch_id = str(row["simulation_batch_id"] or "")

        writer.writerow([
            ts_str,
            dev_id,
            dev_name,
            power_w,
            energy_kwh,
            voltage_v,
            current_a,
            tariff_period,
            rate,
            cost_thb,
            src,
            batch_id
        ])

    csv_content = output.getvalue()
    filename = f"energy_readings_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
