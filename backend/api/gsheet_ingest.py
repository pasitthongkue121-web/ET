from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from datetime import datetime, timedelta
import uuid

from backend.services.gsheet_service import (
    get_sync_status,
    save_sheet_url,
    sync_from_sheet,
    get_preview_rows,
    get_sheet_url,
    start_background_sync,
)
from backend.services.esp32_simulator_service import esp32_simulator
from backend.database.connection import get_connection

router = APIRouter(prefix="/api/gsheet", tags=["Google Sheets & Pipeline"])


class ConnectRequest(BaseModel):
    web_app_url: str
    test_on_connect: bool = True


class SimStartRequest(BaseModel):
    device_id: Optional[str] = "circuit_lighting"
    target: Optional[str] = "both"  # "apps_script", "direct_db", "both"
    interval: Optional[int] = 15
    power_watts: Optional[float] = None


class SimTestPacketRequest(BaseModel):
    device_id: Optional[str] = "circuit_lighting"
    power_watts: Optional[float] = 1250.0
    voltage: Optional[float] = 230.0


class PipelineSimPreviewRequest(BaseModel):
    devices: Optional[List[str]] = None
    period: Optional[str] = "daily"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    interval_minutes: Optional[int] = 15
    mode: Optional[str] = "batch"


class PipelineSimTransmitRequest(BaseModel):
    devices: Optional[List[str]] = None
    period: Optional[str] = "daily"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    interval_minutes: Optional[int] = 15
    batch_id: Optional[str] = None


@router.get("/status")
def gsheet_status():
    """Returns Google Sheet connection status and last sync info."""
    try:
        return get_sync_status()
    except Exception:
        return {
            'connected': False,
            'web_app_url': '',
            'last_sync_at': '',
            'last_row_count': 0,
            'last_error': '',
            'cache_ttl_seconds': 60,
        }


@router.post("/connect")
def connect_gsheet(req: ConnectRequest):
    """Saves the Google Apps Script Web App URL and optionally tests it."""
    url = req.web_app_url.strip()
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL must start with https://")
    if ("script.google.com" not in url
            and "googleapis.com" not in url
            and "docs.google.com" not in url):
        raise HTTPException(
            status_code=400,
            detail="URL must be a Google Apps Script Web App URL (script.google.com)"
        )
    save_sheet_url(url)
    start_background_sync()
    if req.test_on_connect:
        result = sync_from_sheet(force=True)
        if not result.get("success"):
            return {
                "status": "saved_but_fetch_failed",
                "message": "URL saved. First sync failed. Check URL is deployed as Web App with Anyone access.",
                "error": result.get("error"),
                "web_app_url": url,
            }
        row_count = result.get("row_count", 0)
        return {
            "status": "connected",
            "message": f"Connected! Fetched {row_count} rows from your Google Sheet.",
            "sync_result": result,
            "web_app_url": url,
        }
    return {"status": "saved", "message": "URL saved. Background sync will begin shortly.", "web_app_url": url}


@router.post("/sync")
def force_sync():
    """Forces an immediate re-fetch from Google Sheet."""
    url = get_sheet_url()
    if not url:
        raise HTTPException(status_code=400, detail="No Google Sheet URL configured.")
    result = sync_from_sheet(force=True)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Sync failed"))
    return result


@router.get("/preview")
def preview_rows(limit: int = 15):
    """Returns last N rows fetched from Google Sheet."""
    url = get_sheet_url()
    if not url:
        return {"connected": False, "rows": [], "message": "No Google Sheet connected yet."}
    rows = get_preview_rows(limit=limit)
    return {"connected": True, "row_count": len(rows), "rows": rows}


@router.delete("/disconnect")
def disconnect_gsheet():
    """Removes the Google Sheet URL (disconnects)."""
    conn = get_connection()
    cursor = conn.cursor()
    keys = ("web_app_url", "last_sync_at", "last_row_count", "last_error")
    placeholders = ",".join(["?"] * len(keys))
    cursor.execute(f"DELETE FROM gsheet_config WHERE key IN ({placeholders})", keys)
    conn.commit()
    conn.close()
    return {"status": "disconnected", "message": "Google Sheet disconnected. Data in SQLite preserved."}


# -------------------------------------------------------------------
# Instant Webhook Push Endpoint (FastAPI Stage 4)
# -------------------------------------------------------------------
@router.post("/webhook")
async def gsheet_webhook(payload: Dict[str, Any] = Body(...)):
    """
    Receives instant telemetry pushes from Google Apps Script or ESP32.
    Inserts reading into SQLite immediately for zero-latency live updates.
    """
    from backend.services.gsheet_service import _map_row_to_reading, _ensure_device_exists, _write_readings_to_db

    rows_to_process = []
    if "data" in payload and isinstance(payload["data"], list):
        rows_to_process = payload["data"]
    elif isinstance(payload, list):
        rows_to_process = payload
    else:
        rows_to_process = [payload]

    mapped_readings = []
    for r in rows_to_process:
        m = _map_row_to_reading(r)
        if m:
            _ensure_device_exists(m["device_id"])
            mapped_readings.append(m)

    new_count = _write_readings_to_db(mapped_readings)

    return {
        "status": "success",
        "received": len(rows_to_process),
        "inserted": new_count,
        "message": f"Processed {len(mapped_readings)} readings from webhook."
    }


# -------------------------------------------------------------------
# Pipeline Health & 5-Stage Diagnostics
# -------------------------------------------------------------------
# -------------------------------------------------------------------
@router.get("/pipeline/health")
def get_pipeline_health():
    """
    Checks health of all stages in the pipeline safely.
    """
    try:
        sim_status = esp32_simulator.get_status()
    except Exception:
        sim_status = {}
        
    try:
        sheet_status = get_sync_status()
    except Exception:
        sheet_status = {}
    
    # Check DB health
    db_ok = False
    total_readings = 0
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM energy_readings")
        total_readings = cursor.fetchone()[0]
        conn.close()
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "stage1_origin": {
            "name": "ESP32 / Simulation",
            "simulator_running": sim_status.get("running", False),
            "packets_sent": sim_status.get("packets_sent", 0),
            "last_sent_at": sim_status.get("last_batch_at") or sim_status.get("last_sent_at"),
            "status": "online" if sim_status.get("running") or sim_status.get("packets_sent", 0) > 0 else "idle"
        },
        "stage2_bridge": {
            "name": "Data Bridge",
            "url_configured": bool(sheet_status.get("web_app_url")),
            "last_http_status": sim_status.get("last_status_code", 200) if sheet_status.get("connected") else 200,
            "status": "online" if sheet_status.get("connected") else "not_configured"
        },
        "stage3_ledger": {
            "name": "Data Pipeline",
            "rows_synced": sheet_status.get("last_row_count", 0),
            "last_sync_at": sheet_status.get("last_sync_at"),
            "status": "online" if sheet_status.get("connected") and not sheet_status.get("last_error") else ("error" if sheet_status.get("last_error") else "idle")
        },
        "stage4_brain": {
            "name": "FastAPI Backend",
            "db_connected": db_ok,
            "total_readings": total_readings,
            "status": "online" if db_ok else "error"
        },
        "stage5_website": {
            "name": "Next.js Webapp",
            "status": "online"
        }
    }


# -------------------------------------------------------------------
# Virtual ESP32 Simulator Controls
# -------------------------------------------------------------------
@router.get("/simulation/esp32/status")
def sim_status():
    return esp32_simulator.get_status()


@router.post("/simulation/esp32/start")
def sim_start(
    req: Optional[SimStartRequest] = None,
    device_id: Optional[str] = None,
    target: Optional[str] = None,
    interval: Optional[int] = None,
    power_watts: Optional[float] = None
):
    dev_id = (req.device_id if req else None) or device_id or "living_room_ac"
    tgt = (req.target if req else None) or target or "both"
    inv = (req.interval if req else None) or interval or 15
    pw = (req.power_watts if req else None) or power_watts

    if pw is not None:
        esp32_simulator.set_override(pw)
    return esp32_simulator.start(
        device_id=dev_id,
        target=tgt,
        interval=inv
    )


@router.post("/simulation/esp32/stop")
def sim_stop():
    return esp32_simulator.stop()


@router.post("/simulation/esp32/send")
def sim_send_test(req: SimTestPacketRequest):
    reading = esp32_simulator.generate_reading(
        device_id=req.device_id,
        power_watts=req.power_watts
    )
    if req.voltage:
        reading["voltage"] = req.voltage
        reading["current"] = round(reading["power_w"] / req.voltage, 2)
    res = esp32_simulator.send_packet(reading)

    sheet_url = get_sheet_url()
    if sheet_url:
        try:
            import urllib.request
            import json
            sheet_row = [{
                "timestamp": reading.get("timestamp"),
                "device_id": reading.get("device_id"),
                "power_w": reading.get("power_w", 0),
                "energy_kwh": reading.get("energy", 0),
                "voltage": reading.get("voltage", 230.0),
                "current": reading.get("current", 0.0),
                "temperature": reading.get("temperature", 28.0),
                "humidity": reading.get("humidity", 60.0),
                "occupancy": reading.get("occupancy", 1),
            }]
            payload = json.dumps(sheet_row).encode("utf-8")
            req_sheet = urllib.request.Request(
                sheet_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req_sheet, timeout=10)
            res["gsheet_pushed"] = True
        except Exception as e:
            res["gsheet_pushed"] = False
            res["gsheet_error"] = str(e)

    return res


@router.get("/simulation/circuits")
def get_simulation_circuits():
    """Returns the 5 primary electrical circuits for simulation."""
    return {
        "status": "success",
        "circuits": esp32_simulator.get_supported_circuits()
    }


@router.post("/simulation/preview")
def preview_simulation_data(req: PipelineSimPreviewRequest):
    """
    Generates preview metrics and sample records for Pipeline Hub
    without saving to the database.
    """
    now = datetime.now()
    if req.period == "daily":
        start = now - timedelta(days=1)
        end = now
    elif req.period == "weekly":
        start = now - timedelta(days=7)
        end = now
    elif req.period == "monthly":
        start = now - timedelta(days=30)
        end = now
    elif req.period == "custom":
        try:
            start = datetime.strptime(req.start_time, "%Y-%m-%d %H:%M:%S") if req.start_time else (now - timedelta(days=1))
            end = datetime.strptime(req.end_time, "%Y-%m-%d %H:%M:%S") if req.end_time else now
        except Exception:
            start = now - timedelta(days=1)
            end = now
    else:
        start = now - timedelta(days=1)
        end = now

    batch_tag = f"sim_batch_{now.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    inv = req.interval_minutes or 15

    readings = esp32_simulator.generate_dataset(
        circuit_ids=req.devices,
        start_time=start,
        end_time=end,
        interval_minutes=inv,
        batch_id=batch_tag
    )

    total_records = len(readings)
    total_energy_kwh = round(sum(r.get("energy", 0.0) for r in readings if not r.get("is_generation")), 2)
    solar_kwh = round(sum(r.get("energy", 0.0) for r in readings if r.get("is_generation")), 2)
    peak_watts = max((r.get("power", 0.0) for r in readings if not r.get("is_generation")), default=0.0)

    sample_preview = readings[:12]

    return {
        "status": "success",
        "simulation_mode": True,
        "status_label": "SIMULATION MODE — ข้อมูลจำลองพร้อมส่งเข้าสู่ระบบ (Simulated Data Only)",
        "batch_id": batch_tag,
        "data_source": "simulated",
        "summary": {
            "period": req.period,
            "start_time": start.strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": end.strftime("%Y-%m-%d %H:%M:%S"),
            "interval_minutes": inv,
            "total_records": total_records,
            "circuits_count": len(req.devices) if req.devices else len(esp32_simulator.get_supported_circuits()),
            "estimated_consumption_kwh": total_energy_kwh,
            "estimated_generation_kwh": solar_kwh,
            "peak_watts": round(peak_watts, 1),
        },
        "sample_preview": sample_preview
    }


@router.post("/simulation/transmit")
def transmit_simulation_data(req: PipelineSimTransmitRequest):
    """
    Transmits generated records directly to repository and database.
    Stamps every record with data_source='simulated' and simulation_batch_id.
    """
    now = datetime.now()
    if req.period == "daily":
        start = now - timedelta(days=1)
        end = now
    elif req.period == "weekly":
        start = now - timedelta(days=7)
        end = now
    elif req.period == "monthly":
        start = now - timedelta(days=30)
        end = now
    elif req.period == "custom":
        try:
            start = datetime.strptime(req.start_time, "%Y-%m-%d %H:%M:%S") if req.start_time else (now - timedelta(days=1))
            end = datetime.strptime(req.end_time, "%Y-%m-%d %H:%M:%S") if req.end_time else now
        except Exception:
            start = now - timedelta(days=1)
            end = now
    else:
        start = now - timedelta(days=1)
        end = now

    batch_tag = req.batch_id or f"sim_batch_{now.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    inv = req.interval_minutes or 15

    readings = esp32_simulator.generate_dataset(
        circuit_ids=req.devices,
        start_time=start,
        end_time=end,
        interval_minutes=inv,
        batch_id=batch_tag
    )

    result = esp32_simulator.transmit_batch(readings)

    # Automatically push to Google Sheet Web App if connected!
    sheet_url = get_sheet_url()
    if sheet_url and readings:
        try:
            import urllib.request
            import json
            sheet_rows = []
            for r in readings[:300]:
                sheet_rows.append({
                    "timestamp": r.get("timestamp"),
                    "device_id": r.get("device_id"),
                    "power_w": r.get("power", r.get("power_w", 0)),
                    "energy_kwh": r.get("energy", r.get("energy_kwh", 0)),
                    "voltage": r.get("voltage", 230.0),
                    "current": r.get("current", 0.0),
                    "temperature": r.get("temperature", 28.0),
                    "humidity": r.get("humidity", 60.0),
                    "occupancy": r.get("occupancy", 1),
                })
            payload = json.dumps(sheet_rows).encode("utf-8")
            req_sheet = urllib.request.Request(
                sheet_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req_sheet, timeout=15)
            result["gsheet_pushed"] = True
            result["gsheet_rows_pushed"] = len(sheet_rows)
        except Exception as e:
            result["gsheet_pushed"] = False
            result["gsheet_error"] = str(e)

    return result


class ClearSimulationRequest(BaseModel):
    batch_id: Optional[str] = None
    clear_all_simulated: bool = True
    clear_google_sheet: bool = False


@router.post("/simulation/clear")
def clear_simulation_readings(req: Optional[ClearSimulationRequest] = None):
    """
    Cleans up residual simulated data from database while strictly preserving real physical device data.
    Optionally also clears the connected Google Sheet.
    """
    conn = get_connection()
    c = conn.cursor()
    
    if req and req.batch_id:
        c.execute("DELETE FROM energy_readings WHERE simulation_batch_id = ? AND data_source = 'simulated'", (req.batch_id,))
    else:
        c.execute("DELETE FROM energy_readings WHERE data_source = 'simulated'")
    
    deleted_count = c.rowcount
    conn.commit()
    conn.close()

    from backend.services.gsheet_service import clear_sheet_cache
    clear_sheet_cache()

    sheet_cleared = False
    if req and req.clear_google_sheet:
        sheet_url = get_sheet_url()
        if sheet_url:
            try:
                import urllib.request, json
                payload = json.dumps({"action": "clear"}).encode("utf-8")
                req_s = urllib.request.Request(sheet_url, data=payload, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req_s, timeout=10)
                sheet_cleared = True
            except Exception:
                pass

    return {
        "status": "success",
        "message": f"ล้างข้อมูลจำลองตกค้างเรียบร้อยแล้ว ({deleted_count} รายการ)",
        "deleted_records": deleted_count,
        "google_sheet_cleared": sheet_cleared,
        "real_data_preserved": True
    }


@router.post("/clear-sheet")
def clear_google_sheet():
    """
    Clears all data rows from the connected Google Sheet (row 2 downwards), leaving headers.
    """
    sheet_url = get_sheet_url()
    if not sheet_url:
        raise HTTPException(status_code=400, detail="ยังไม่ได้เชื่อมต่อ Google Sheet Web App URL")
    try:
        import urllib.request, json
        payload = json.dumps({"action": "clear"}).encode("utf-8")
        req = urllib.request.Request(sheet_url, data=payload, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=12)
        from backend.services.gsheet_service import clear_sheet_cache
        clear_sheet_cache()
        return {"status": "success", "message": "ส่งคำสั่งล้างข้อมูลตกค้างใน Google Sheet สำเร็จ"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ไม่สามารถล้างข้อมูลใน Google Sheet ได้: {e}")


# -------------------------------------------------------------------
# Upgraded Bidirectional Google Apps Script Template
# -------------------------------------------------------------------
APPS_SCRIPT_CODE = r"""// ====================================================================
// ENERGY TWINS AI - Google Sheets 2-Way IoT Telemetry Hub
// ====================================================================
// FEATURES:
//   1. doPost(e) : Ingests JSON from ESP32 or Simulator, handles clear/reset,
//                  auto-creates headers, appends rows, caps to 5,000 rows.
//   2. doGet(e)  : Serves latest data to FastAPI, or ?action=clear to reset.
// ====================================================================

var SHEET_HEADERS = [
  "timestamp", "device_id", "power_w", "energy_kwh",
  "voltage", "current", "temperature", "humidity", "occupancy"
];

// --------------------------------------------------------------------
// 1. RECEIVE TELEMETRY FROM ESP32 / SIMULATOR (doPost)
// --------------------------------------------------------------------
function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var content = e.postData.contents;
    var data = JSON.parse(content);

    // Support Clean Reset / Clear residual data
    if (!Array.isArray(data) && (data.action === "clear" || data.action === "reset")) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({
        status: "success",
        message: "ล้างข้อมูลตกค้างใน Google Sheet เรียบร้อยแล้ว",
        cleared_rows: Math.max(0, lastRow - 1)
      });
    }

    // Support single object or array of objects
    var rows = Array.isArray(data) ? data : [data];
    var nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

    for (var i = 0; i < rows.length; i++) {
      var item = rows[i];
      var row = [
        item.timestamp || nowStr,
        item.device_id || "esp32_sensor",
        Number(item.power_w || item.power || 0),
        Number(item.energy_kwh || item.energy || 0),
        Number(item.voltage || 230),
        Number(item.current || 0),
        Number(item.temperature || 25),
        Number(item.humidity || 60),
        Number(item.occupancy || 1)
      ];
      sheet.appendRow(row);
    }

    // Auto-Cap to keep sheet fast (max 5,000 rows)
    var maxRows = 5000;
    var currentRows = sheet.getLastRow();
    if (currentRows > maxRows + 100) {
      sheet.deleteRows(2, currentRows - maxRows);
    }

    return jsonResponse({
      status: "success",
      appended: rows.length,
      total_rows: sheet.getLastRow(),
      server_time: nowStr
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// --------------------------------------------------------------------
// 2. SERVE DATA TO FASTAPI BACKEND OR RESET VIA GET (doGet)
// --------------------------------------------------------------------
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    // Support Clean Reset via GET URL: ?action=clear
    if (e && e.parameter && (e.parameter.action === "clear" || e.parameter.action === "reset")) {
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({
        status: "success",
        message: "ล้างข้อมูลตกค้างใน Google Sheet เรียบร้อยแล้ว",
        cleared_rows: Math.max(0, lastRow - 1)
      });
    }

    if (lastRow < 2) {
      return jsonResponse({ data: [], total_rows: 0, message: "Sheet has only headers" });
    }

    var limit = 50;
    if (e && e.parameter && e.parameter.limit) {
      limit = parseInt(e.parameter.limit, 10);
    }

    // Determine row range to read (efficiently only read last N rows)
    var startRow = Math.max(2, lastRow - limit + 1);
    var numRows = lastRow - startRow + 1;

    var headerRange = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var headers = headerRange.map(function(h) {
      return h.toString().toLowerCase().trim().replace(/ /g, "_");
    });

    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var rows = [];

    for (var i = 0; i < dataRange.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = dataRange[i][j];
      }
      rows.push(row);
    }

    return jsonResponse({
      data: rows,
      total_rows: lastRow - 1,
      fetched_rows: rows.length,
      sheet_name: sheet.getName(),
      synced_at: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// --------------------------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------------------------
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    // Format Header Row
    var headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    headerRange.setBackground("#1e293b");
    headerRange.setFontColor("#38bdf8");
    headerRange.setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --------------------------------------------------------------------
// OPTIONAL: Run this once from Apps Script editor to format your sheet
// --------------------------------------------------------------------
function setupSheet() {
  var sheet = getOrCreateSheet();
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
}
"""


@router.get("/apps-script-template")
def get_apps_script_template():
    """Returns the upgraded 2-way Google Apps Script code for ESP32 and FastAPI."""
    return {
        "language": "javascript",
        "code": APPS_SCRIPT_CODE,
        "instructions": [
            "1. Open your Google Sheet -> Extensions -> Apps Script",
            "2. Delete existing code and paste this entire script",
            "3. Click Save (Ctrl+S)",
            "4. Click Deploy -> New Deployment -> Web App",
            "5. Set 'Execute as' = Me, 'Who has access' = Anyone",
            "6. Click Deploy, copy the Web App URL",
            "7. Paste that URL into the ENERGY TWINS webapp at /pipeline or /gsheet",
        ]
    }
