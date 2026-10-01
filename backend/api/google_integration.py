import io
import csv
import json
import urllib.request
from datetime import datetime
from fastapi import APIRouter, Response, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from backend.database.connection import get_connection
from backend.config import settings
from backend.services.analytics_service import analytics_service
from backend.services.twin_service import twin_service
from backend.services.simulation_service import simulation_service

router = APIRouter(prefix="/api/export", tags=["Google Sheets & Sites Integration"])

class GoogleSheetsSyncRequest(BaseModel):
    webhook_url: str
    export_type: str = "all" # "all", "summary", "daily", "devices", "scenarios"

@router.get("/summary.csv")
def export_summary_csv():
    """
    Returns CSV formatted live summary data.
    Designed for Google Sheets formula: =IMPORTDATA("https://<domain>/api/export/summary.csv")
    """
    state = twin_service.get_state()
    home = twin_service.get_home()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Value", "Unit", "Tag", "Updated_At"])
    writer.writerow(["Total House Power", state.total_power_kw, "kW", "MEASURED", state.timestamp])
    writer.writerow(["Daily Energy", home.daily_energy_kwh, "kWh", "MEASURED", state.timestamp])
    writer.writerow(["Estimated Cost Today", state.estimated_cost_today_thb, "THB", "MEASURED", state.timestamp])
    writer.writerow(["Monthly Energy", home.monthly_energy_kwh, "kWh", "MEASURED", state.timestamp])
    writer.writerow(["Ambient Temperature", state.temperature_c, "°C", "MEASURED", state.timestamp])
    writer.writerow(["Relative Humidity", state.humidity_pct, "%", "MEASURED", state.timestamp])
    writer.writerow(["Occupancy", "Home" if state.occupancy else "Away", "Status", "MEASURED", state.timestamp])
    writer.writerow(["Active Devices", f"{state.active_devices_count}/{state.total_devices_count}", "Devices", "MEASURED", state.timestamp])
    writer.writerow(["Electricity Tariff Rate", settings.ELECTRICITY_RATE, "THB/kWh", "CONFIG", state.timestamp])
    writer.writerow(["CO2 Factor", settings.CO2_EMISSION_FACTOR, "kg/kWh", "CONFIG", state.timestamp])

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "inline; filename=energy_summary.csv"}
    )

@router.get("/daily.csv")
def export_daily_csv(days: int = 30):
    """
    Returns 30-day historical daily energy consumption CSV.
    Google Sheets formula: =IMPORTDATA("https://<domain>/api/export/daily.csv")
    """
    daily = analytics_service.get_daily(days=days)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Energy_kWh", "Cost_THB", "Avg_Power_W", "Peak_Power_W"])
    for d in daily:
        writer.writerow([
            d.date,
            round(d.energy_kwh, 2),
            round(d.cost_thb, 2),
            round(d.avg_power_w, 1),
            round(d.peak_power_w, 1)
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "inline; filename=daily_energy.csv"}
    )

@router.get("/devices.csv")
def export_devices_csv(days: int = 30):
    """
    Returns per-device breakdown CSV for Google Sheets.
    Google Sheets formula: =IMPORTDATA("https://<domain>/api/export/devices.csv")
    """
    devices = analytics_service.get_devices(days=days)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Device_ID", "Device_Name", "Room", "Category", "Consumption_kWh", "Percentage", "Cost_THB", "Runtime_Hours"])
    for dev in devices:
        writer.writerow([
            dev.device_id,
            dev.name,
            dev.room_name,
            dev.category,
            round(dev.total_kwh, 2),
            round(dev.percentage, 1),
            round(dev.cost_thb, 2),
            round(dev.runtime_hours, 1)
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "inline; filename=device_consumption.csv"}
    )

@router.get("/scenarios.csv")
def export_scenarios_csv():
    """
    Returns What-If simulation scenarios comparison table as CSV.
    Google Sheets formula: =IMPORTDATA("https://<domain>/api/export/scenarios.csv")
    """
    table = simulation_service.get_scenarios()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Scenario_ID", "Name", "Description", "Monthly_Energy_kWh", "Monthly_Cost_THB", "Saving_kWh", "Saving_THB", "Peak_Power_kW", "Reduction_Pct", "Scenario_Score", "Tag"])
    for sc in table.scenarios:
        writer.writerow([
            sc.id,
            sc.name,
            sc.description,
            round(sc.energy_kwh, 1),
            round(sc.cost_thb, 0),
            round(sc.saving_kwh, 1),
            round(sc.saving_thb, 0),
            round(sc.peak_kw, 2),
            round(sc.reduction_pct, 1),
            round(sc.score or 0.0, 1),
            sc.tag
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "inline; filename=simulation_scenarios.csv"}
    )

@router.post("/google-sheets/webhook")
def push_to_google_sheets(req: GoogleSheetsSyncRequest):
    """
    Pushes live Energy Twins data and simulation scenarios directly to Google Sheets
    via a Google Apps Script Web App Webhook.
    """
    if not req.webhook_url.startswith("https://script.google.com/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Apps Script Webhook URL. Must start with https://script.google.com/"
        )

    # Gather data to push
    state = twin_service.get_state()
    home = twin_service.get_home()
    scenarios = simulation_service.get_scenarios()
    
    payload = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "power_kw": state.total_power_kw,
            "daily_kwh": home.daily_energy_kwh,
            "cost_today_thb": state.estimated_cost_today_thb,
            "monthly_kwh": home.monthly_energy_kwh,
            "active_devices": state.active_devices_count,
            "temperature_c": state.temperature_c,
        },
        "scenarios": [
            {
                "name": sc.name,
                "energy_kwh": sc.energy_kwh,
                "cost_thb": sc.cost_thb,
                "saving_thb": sc.saving_thb,
                "peak_kw": sc.peak_kw,
                "score": sc.score
            }
            for sc in scenarios.scenarios
        ]
    }

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            req.webhook_url,
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            resp_body = response.read().decode("utf-8", errors="ignore")
            return {
                "status": "success",
                "message": "Data successfully pushed to Google Sheet!",
                "google_response": resp_body[:200]
            }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Google Apps Script Webhook: {str(e)}"
        )

@router.get("/google-apps-script")
def get_apps_script_code():
    """
    Returns copy-paste ready Google Apps Script code for users to deploy in Google Sheets.
    """
    code = """// ========================================================
// ENERGY TWINS AI - Google Sheets Auto-Sync Webhook Receiver
// Paste this code into: Extensions > Apps Script in Google Sheets
// ========================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Check if headers exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "Power (kW)", "Daily (kWh)", "Cost Today (THB)", 
        "Monthly (kWh)", "Active Devices", "Temperature (C)"
      ]);
      sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
    }
    
    // Append telemetry summary row
    sheet.appendRow([
      data.timestamp,
      data.summary.power_kw,
      data.summary.daily_kwh,
      data.summary.cost_today_thb,
      data.summary.monthly_kwh,
      data.summary.active_devices,
      data.summary.temperature_c
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
"""
    return {"language": "javascript", "code": code}
