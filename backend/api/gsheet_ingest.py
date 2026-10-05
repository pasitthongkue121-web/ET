from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

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
    device_id: Optional[str] = "living_room_ac"
    target: Optional[str] = "both"  # "apps_script", "direct_db", "both"
    interval: Optional[int] = 15
    power_watts: Optional[float] = None


class SimTestPacketRequest(BaseModel):
    device_id: Optional[str] = "living_room_ac"
    power_watts: Optional[float] = 1250.0
    voltage: Optional[float] = 230.0


@router.get("/status")
def gsheet_status():
    """Returns Google Sheet connection status and last sync info."""
    return get_sync_status()


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
@router.get("/pipeline/health")
def get_pipeline_health():
    """
    Checks health of all 5 stages in the pipeline.
    """
    sim_status = esp32_simulator.get_status()
    sheet_status = get_sync_status()
    
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
            "simulator_running": sim_status["running"],
            "packets_sent": sim_status["packets_sent"],
            "last_sent_at": sim_status["last_sent_at"],
            "status": "online" if sim_status["running"] or sim_status["packets_sent"] > 0 else "idle"
        },
        "stage2_bridge": {
            "name": "Google Apps Script",
            "url_configured": bool(sheet_status.get("web_app_url")),
            "last_http_status": sim_status.get("last_status_code", 200) if sheet_status.get("connected") else None,
            "status": "online" if sheet_status.get("connected") else "not_configured"
        },
        "stage3_ledger": {
            "name": "Google Sheets",
            "rows_synced": sheet_status["last_row_count"],
            "last_sync_at": sheet_status["last_sync_at"],
            "status": "online" if sheet_status["connected"] and not sheet_status["last_error"] else ("error" if sheet_status["last_error"] else "not_configured")
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
def sim_start(req: SimStartRequest):
    if req.power_watts is not None:
        esp32_simulator.set_override(req.power_watts)
    return esp32_simulator.start(
        device_id=req.device_id,
        target=req.target,
        interval=req.interval
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
    return esp32_simulator.send_packet(reading)


# -------------------------------------------------------------------
# Upgraded Bidirectional Google Apps Script Template
# -------------------------------------------------------------------
APPS_SCRIPT_CODE = r"""// ====================================================================
// ENERGY TWINS AI - Google Sheets 2-Way IoT Telemetry Hub
// ====================================================================
// FEATURES:
//   1. doPost(e) : Ingests JSON from ESP32 or Simulator, auto-creates
//                  headers, appends rows, and caps to last 5,000 rows.
//   2. doGet(e)  : Serves latest data to FastAPI with ?action=latest
//   3. Optional  : Webhook push back to FastAPI for 0-latency updates.
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
// 2. SERVE DATA TO FASTAPI BACKEND (doGet)
// --------------------------------------------------------------------
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

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
