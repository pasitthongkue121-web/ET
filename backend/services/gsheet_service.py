import json
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from backend.database.connection import get_connection

_cache_lock = threading.Lock()
_cached_rows: List[Dict[str, Any]] = []
_cache_ts: Optional[datetime] = None
_cache_ttl_seconds = 30

def clear_sheet_cache() -> None:
    global _cached_rows, _cache_ts
    with _cache_lock:
        _cached_rows = []
        _cache_ts = None


def _get_config(key: str) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM gsheet_config WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else None

def _set_config(key: str, value: str) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        'INSERT OR REPLACE INTO gsheet_config (key, value, updated_at) VALUES (?, ?, ?)',
        (key, value, now)
    )
    conn.commit()
    conn.close()

def get_sheet_url() -> Optional[str]:
    return _get_config('web_app_url')

def save_sheet_url(url: str) -> None:
    _set_config('web_app_url', url)

def get_sync_status() -> Dict[str, Any]:
    url = get_sheet_url()
    last_sync = _get_config('last_sync_at')
    last_count = _get_config('last_row_count')
    last_error = _get_config('last_error')
    return {
        'connected': bool(url),
        'web_app_url': url or '',
        'last_sync_at': last_sync or '',
        'last_row_count': int(last_count) if last_count else 0,
        'last_error': last_error or '',
        'cache_ttl_seconds': _cache_ttl_seconds,
    }

def _normalize_header(h: str) -> str:
    return h.strip().lower().replace(' ', '_').replace('-', '_')

def _parse_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

def _parse_int(val: Any, default: int = 1) -> int:
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default

def _fetch_from_sheet(url: str) -> Tuple[List[Dict[str, Any]], str]:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ENERGY-TWINS-AI/1.0', 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                rows_raw = parsed
            elif isinstance(parsed, dict):
                rows_raw = parsed.get('data', parsed.get('rows', parsed.get('values', [])))
            else:
                return [], 'Unexpected JSON format from Google Sheet Web App'
            if rows_raw and isinstance(rows_raw[0], list):
                headers = [_normalize_header(str(h)) for h in rows_raw[0]]
                rows_raw = [dict(zip(headers, row)) for row in rows_raw[1:]]
            normalized: List[Dict[str, Any]] = []
            for r in rows_raw:
                nr = {_normalize_header(k): v for k, v in r.items()}
                normalized.append(nr)
            return normalized, ''
    except urllib.error.HTTPError as e:
        return [], f'HTTP {e.code}: {e.reason}'
    except urllib.error.URLError as e:
        return [], f'URL Error: {str(e.reason)}'
    except json.JSONDecodeError as e:
        return [], f'Invalid JSON from sheet: {str(e)}'
    except Exception as e:
        return [], f'Unexpected error: {str(e)}'

def _map_row_to_reading(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ts = row.get('timestamp') or row.get('time') or row.get('datetime') or row.get('date')
    if not ts:
        return None
    raw_ts = str(ts).strip()
    norm_ts = raw_ts
    try:
        # Try converting standard or ISO format to clean YYYY-MM-DD HH:MM:SS
        clean_ts = raw_ts.replace("Z", "+00:00").replace("T", " ")
        if "+" in clean_ts:
            clean_ts = clean_ts.split("+")[0].strip()
        if "." in clean_ts:
            clean_ts = clean_ts.split(".")[0].strip()
        parsed_dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M:%S")
        norm_ts = parsed_dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        norm_ts = raw_ts

    device_id = row.get('device_id') or row.get('device') or row.get('sensor_id') or row.get('sensor') or 'sheet_sensor'
    return {
        'timestamp': norm_ts,
        'device_id': str(device_id).strip(),
        'voltage': _parse_float(row.get('voltage') or row.get('v'), 230.0),
        'current': _parse_float(row.get('current') or row.get('i') or row.get('ampere'), 0.0),
        'power': _parse_float(row.get('power_w') or row.get('power') or row.get('watt') or row.get('w'), 0.0),
        'energy': _parse_float(row.get('energy_kwh') or row.get('energy') or row.get('kwh'), 0.0),
        'temperature': _parse_float(row.get('temperature') or row.get('temp') or row.get('t'), 25.0),
        'humidity': _parse_float(row.get('humidity') or row.get('hum') or row.get('rh'), 60.0),
        'occupancy': _parse_int(row.get('occupancy') or row.get('occ'), 1),
    }

def _ensure_device_exists(device_id: str) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO rooms (id, name, floor, icon) VALUES ('sheet_room', 'Sheet Data', 1, 'table')")
    cursor.execute(
        "INSERT OR IGNORE INTO devices (device_id, name, room_id, rated_power, status, category) VALUES (?, ?, 'sheet_room', 0, 1, 'sheet')",
        (device_id, device_id.replace('_', ' ').title())
    )
    conn.commit()
    conn.close()

def _write_readings_to_db(readings: List[Dict[str, Any]]) -> int:
    if not readings:
        return 0
    conn = get_connection()
    cursor = conn.cursor()
    inserted = 0
    for r in readings:
        try:
            cursor.execute(
                'INSERT OR IGNORE INTO energy_readings (timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy) VALUES (:timestamp, :device_id, :voltage, :current, :power, :energy, :temperature, :humidity, :occupancy)',
                r
            )
            if cursor.rowcount:
                inserted += 1
                is_active = r.get('power', 0.0) > 5.0
                cursor.execute('UPDATE devices SET status = ?, temperature = ? WHERE device_id = ?', (1 if is_active else 0, r.get('temperature'), r['device_id']))
        except Exception:
            pass
    conn.commit()
    conn.close()
    return inserted

def sync_from_sheet(force: bool = False) -> Dict[str, Any]:
    global _cached_rows, _cache_ts
    url = get_sheet_url()
    if not url:
        return {'success': False, 'error': 'No Google Sheet URL configured'}
    with _cache_lock:
        if not force and _cache_ts:
            age = (datetime.now(timezone.utc) - _cache_ts).total_seconds()
            if age < _cache_ttl_seconds:
                return {'success': True, 'cached': True, 'row_count': len(_cached_rows), 'cache_age_seconds': round(age, 1)}
    rows_raw, error = _fetch_from_sheet(url)
    if error:
        _set_config('last_error', error)
        return {'success': False, 'error': error}
    readings: List[Dict[str, Any]] = []
    device_ids = set()
    for row in rows_raw:
        mapped = _map_row_to_reading(row)
        if mapped:
            readings.append(mapped)
            device_ids.add(mapped['device_id'])
    for did in device_ids:
        _ensure_device_exists(did)
    new_rows = _write_readings_to_db(readings)
    with _cache_lock:
        _cached_rows = readings
        _cache_ts = datetime.now(timezone.utc)
    now_iso = datetime.now(timezone.utc).isoformat()
    _set_config('last_sync_at', now_iso)
    _set_config('last_row_count', str(len(readings)))
    _set_config('last_error', '')
    return {'success': True, 'cached': False, 'row_count': len(readings), 'new_rows_inserted': new_rows, 'synced_at': now_iso}

def get_preview_rows(limit: int = 10) -> List[Dict[str, Any]]:
    with _cache_lock:
        if _cached_rows:
            return _cached_rows[-limit:]
    url = get_sheet_url()
    if not url:
        return []
    rows_raw, _ = _fetch_from_sheet(url)
    result = []
    for row in rows_raw[-limit:]:
        mapped = _map_row_to_reading(row)
        if mapped:
            result.append(mapped)
    return result

_sync_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()

def _background_sync_loop():
    import time
    while not _stop_event.is_set():
        try:
            if get_sheet_url():
                sync_from_sheet(force=True)
        except Exception:
            pass
        _stop_event.wait(timeout=_cache_ttl_seconds)

def start_background_sync():
    global _sync_thread
    if _sync_thread and _sync_thread.is_alive():
        return
    _stop_event.clear()
    _sync_thread = threading.Thread(target=_background_sync_loop, daemon=True, name='gsheet-sync')
    _sync_thread.start()

def stop_background_sync():
    _stop_event.set()
