"""
Firebase Firestore Repository
==============================
Implements BaseEnergyRepository using Google Firebase Firestore as the backend.
Activated when USE_FIREBASE=true environment variable is set.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default seed data (rooms & devices) — used when Firestore is empty
# ---------------------------------------------------------------------------
_DEFAULT_ROOMS = [
    {"id": "living_room",  "name": "Living Room",  "floor": 1, "icon": "sofa"},
    {"id": "bedroom_1",    "name": "Bedroom 1",    "floor": 1, "icon": "bed"},
    {"id": "bedroom_2",    "name": "Bedroom 2",    "floor": 2, "icon": "bed"},
    {"id": "kitchen",      "name": "Kitchen",      "floor": 1, "icon": "chef-hat"},
    {"id": "bathroom",     "name": "Bathroom",     "floor": 1, "icon": "shower-head"},
    {"id": "garage",       "name": "Garage",       "floor": 0, "icon": "car"},
]

_DEFAULT_DEVICES = [
    {"device_id": "ac_living_room",    "name": "AC Living Room",    "room_id": "living_room", "rated_power": 1200.0, "status": 0, "category": "heavy_load"},
    {"device_id": "fridge",            "name": "Refrigerator",      "room_id": "kitchen",     "rated_power": 150.0,  "status": 1, "category": "heavy_load"},
    {"device_id": "tv_living_room",    "name": "TV",                "room_id": "living_room", "rated_power": 100.0,  "status": 0, "category": "receptacle"},
    {"device_id": "washing_machine",   "name": "Washing Machine",   "room_id": "garage",      "rated_power": 600.0,  "status": 0, "category": "heavy_load"},
    {"device_id": "water_heater",      "name": "Water Heater",      "room_id": "bathroom",    "rated_power": 3000.0, "status": 0, "category": "heavy_load"},
    {"device_id": "lighting_living",   "name": "Living Room Lights","room_id": "living_room", "rated_power": 80.0,   "status": 0, "category": "lighting"},
    {"device_id": "lighting_bedroom1", "name": "Bedroom 1 Lights",  "room_id": "bedroom_1",   "rated_power": 60.0,   "status": 0, "category": "lighting"},
    {"device_id": "computer_desk",     "name": "Desktop Computer",  "room_id": "bedroom_1",   "rated_power": 250.0,  "status": 0, "category": "receptacle"},
    {"device_id": "microwave",         "name": "Microwave",         "room_id": "kitchen",     "rated_power": 1000.0, "status": 0, "category": "receptacle"},
    {"device_id": "ev_charger",        "name": "EV Charger",        "room_id": "garage",      "rated_power": 7000.0, "status": 0, "category": "heavy_load"},
]


def _get_firebase_app():
    """Initialize and return Firebase Admin app (singleton pattern)."""
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

        if cred_json:
            try:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
            except json.JSONDecodeError as e:
                raise RuntimeError(f"FIREBASE_CREDENTIALS_JSON is not valid JSON: {e}")
        elif cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        else:
            raise RuntimeError(
                "Firebase credentials not found. "
                "Set FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH env var."
            )

        project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_admin.initialize_app(cred, {"projectId": project_id} if project_id else {})

    return firebase_admin.get_app()


def _get_db():
    """Get Firestore client."""
    from firebase_admin import firestore
    _get_firebase_app()
    return firestore.client()


def _ts_now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class FirebaseRepository:
    """
    Firestore-backed implementation of the energy repository.

    Collections:
      - rooms            : static room metadata
      - devices          : device registry + live status
      - energy_readings  : time-series telemetry from ESP32
      - config           : key/value config store (gsheet URL etc.)
    """

    def __init__(self):
        self._db = None  # lazy init
        self._seeded = False

    def _client(self):
        if self._db is None:
            self._db = _get_db()
        return self._db

    # ------------------------------------------------------------------
    # Seeding
    # ------------------------------------------------------------------
    def seed_if_empty(self):
        """Seed default rooms and devices into Firestore if collections are empty."""
        if self._seeded:
            return
        try:
            db = self._client()
            rooms_col = db.collection("rooms")
            if not list(rooms_col.limit(1).stream()):
                logger.info("[Firebase] Seeding default rooms and devices…")
                batch = db.batch()
                for room in _DEFAULT_ROOMS:
                    batch.set(rooms_col.document(room["id"]), room)
                devices_col = db.collection("devices")
                for dev in _DEFAULT_DEVICES:
                    batch.set(devices_col.document(dev["device_id"]), dev)
                batch.commit()
                logger.info("[Firebase] Seed complete.")
            self._seeded = True
        except Exception as e:
            logger.warning(f"[Firebase] Seed failed (non-fatal): {e}")

    # ------------------------------------------------------------------
    # Rooms
    # ------------------------------------------------------------------
    def get_rooms(self) -> List[Dict[str, Any]]:
        db = self._client()
        docs = db.collection("rooms").stream()
        rooms = [doc.to_dict() for doc in docs]
        return sorted(rooms, key=lambda r: (r.get("floor", 0), r.get("name", "")))

    # ------------------------------------------------------------------
    # Devices
    # ------------------------------------------------------------------
    def get_devices(self) -> List[Dict[str, Any]]:
        db = self._client()
        devices = [doc.to_dict() for doc in db.collection("devices").stream()]
        rooms = {r["id"]: r["name"] for r in self.get_rooms()}
        for d in devices:
            d["room_name"] = rooms.get(d.get("room_id", ""), "Unknown")
            d.setdefault("temperature", None)
        return sorted(devices, key=lambda x: (x.get("room_name", ""), x.get("name", "")))

    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        db = self._client()
        doc = db.collection("devices").document(device_id).get()
        return doc.to_dict() if doc.exists else None

    def update_device_status(self, device_id: str, status: bool, temperature: Optional[float] = None) -> None:
        db = self._client()
        update = {"status": 1 if status else 0}
        if temperature is not None:
            update["temperature"] = temperature
        db.collection("devices").document(device_id).update(update)

    # ------------------------------------------------------------------
    # Readings — write
    # ------------------------------------------------------------------
    def insert_reading(self, reading: Dict[str, Any]) -> str:
        db = self._client()
        doc = {
            "timestamp":   reading.get("timestamp", _ts_now()),
            "device_id":   reading["device_id"],
            "voltage":     float(reading.get("voltage", 230.0)),
            "current":     float(reading.get("current", 0.0)),
            "power":       float(reading.get("power", reading.get("power_w", 0.0))),
            "energy":      float(reading.get("energy", reading.get("energy_kwh", 0.0))),
            "temperature": float(reading.get("temperature", 25.0)),
            "humidity":    float(reading.get("humidity", 60.0)),
            "occupancy":   1 if reading.get("occupancy", True) else 0,
        }
        ref = db.collection("energy_readings").add(doc)
        # Update device live status
        try:
            is_active = doc["power"] > 5.0
            db.collection("devices").document(doc["device_id"]).set(
                {"status": 1 if is_active else 0, "temperature": doc["temperature"]},
                merge=True
            )
        except Exception:
            pass
        return ref[1].id  # document ID

    def insert_readings_bulk(self, readings: List[Dict[str, Any]]) -> int:
        if not readings:
            return 0
        db = self._client()
        count = 0
        # Firestore batch max 500 writes
        for i in range(0, len(readings), 400):
            chunk = readings[i:i + 400]
            batch = db.batch()
            col = db.collection("energy_readings")
            for reading in chunk:
                doc = {
                    "timestamp":   reading.get("timestamp", _ts_now()),
                    "device_id":   reading["device_id"],
                    "voltage":     float(reading.get("voltage", 230.0)),
                    "current":     float(reading.get("current", 0.0)),
                    "power":       float(reading.get("power", reading.get("power_w", 0.0))),
                    "energy":      float(reading.get("energy", reading.get("energy_kwh", 0.0))),
                    "temperature": float(reading.get("temperature", 25.0)),
                    "humidity":    float(reading.get("humidity", 60.0)),
                    "occupancy":   1 if reading.get("occupancy", True) else 0,
                }
                batch.add(col, doc)
            batch.commit()
            count += len(chunk)
        # Update device statuses from last readings per device
        try:
            device_latest: Dict[str, Dict] = {}
            for r in readings:
                device_latest[r["device_id"]] = r
            for dev_id, r in device_latest.items():
                pwr = float(r.get("power", r.get("power_w", 0.0)))
                db.collection("devices").document(dev_id).set(
                    {"status": 1 if pwr > 5.0 else 0, "temperature": float(r.get("temperature", 25.0))},
                    merge=True
                )
        except Exception as e:
            logger.warning(f"[Firebase] Failed to update device statuses: {e}")
        return count

    # ------------------------------------------------------------------
    # Readings — read
    # ------------------------------------------------------------------
    def get_readings_timeseries(
        self,
        start_time: str,
        end_time: str,
        device_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        db = self._client()
        col = db.collection("energy_readings")
        query = col.where("timestamp", ">=", start_time).where("timestamp", "<=", end_time)
        docs = list(query.stream())
        rows = [doc.to_dict() for doc in docs]
        
        if device_id:
            rows = [r for r in rows if r.get("device_id") == device_id]
            
        rows.sort(key=lambda x: x.get("timestamp", ""))

        if not device_id and rows:
            # Aggregate by timestamp (group all devices by timestamp minute)
            from collections import defaultdict
            groups: Dict[str, List[Dict]] = defaultdict(list)
            for r in rows:
                ts_minute = r["timestamp"][:16]  # YYYY-MM-DD HH:MM
                groups[ts_minute].append(r)

            aggregated = []
            for ts, group in sorted(groups.items()):
                aggregated.append({
                    "timestamp":   ts + ":00",
                    "voltage":     round(sum(g["voltage"] for g in group) / len(group), 1),
                    "current":     round(sum(g["current"] for g in group), 2),
                    "power":       round(sum(g["power"] for g in group), 1),
                    "energy":      round(sum(g["energy"] for g in group), 4),
                    "temperature": round(sum(g["temperature"] for g in group) / len(group), 1),
                    "humidity":    round(sum(g["humidity"] for g in group) / len(group), 1),
                    "occupancy":   max(g["occupancy"] for g in group),
                })
            return aggregated

        return rows

    def get_latest_device_readings(self) -> List[Dict[str, Any]]:
        db = self._client()
        devices = self.get_devices()
        rooms = {r["id"]: r["name"] for r in self.get_rooms()}
        results = []

        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        start_time = (now - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
        
        query = db.collection("energy_readings").where("timestamp", ">=", start_time)
        readings = [doc.to_dict() for doc in query.stream()]
        readings.sort(key=lambda x: x.get("timestamp", ""))
        
        latest_map = {}
        for r in readings:
            dev_id = r.get("device_id")
            if dev_id:
                latest_map[dev_id] = r

        for dev in devices:
            dev_id = dev["device_id"]
            if dev_id in latest_map:
                r = latest_map[dev_id]
                r["device_name"] = dev.get("name", dev_id)
                r["room_id"] = dev.get("room_id", "")
                r["room_name"] = rooms.get(dev.get("room_id", ""), "Unknown")
                r["rated_power"] = dev.get("rated_power", 0.0)
                r["category"] = dev.get("category", "general")
                results.append(r)
            else:
                results.append({
                    "timestamp":   "",
                    "device_id":   dev_id,
                    "device_name": dev.get("name", dev_id),
                    "room_id":     dev.get("room_id", ""),
                    "room_name":   rooms.get(dev.get("room_id", ""), "Unknown"),
                    "rated_power": dev.get("rated_power", 0.0),
                    "category":    dev.get("category", "general"),
                    "voltage":     0.0, "current": 0.0, "power": 0.0,
                    "energy":      0.0, "temperature": 25.0,
                    "humidity":    60.0, "occupancy": 0,
                })

        return sorted(results, key=lambda x: x.get("power", 0.0), reverse=True)

    # ------------------------------------------------------------------
    # Config (gsheet URL etc.)
    # ------------------------------------------------------------------
    def get_config(self, key: str) -> Optional[str]:
        db = self._client()
        doc = db.collection("config").document(key).get()
        if doc.exists:
            return doc.to_dict().get("value")
        return None

    def set_config(self, key: str, value: str) -> None:
        db = self._client()
        db.collection("config").document(key).set({
            "key": key,
            "value": value,
            "updated_at": _ts_now()
        })

    # ------------------------------------------------------------------
    # Reset helpers (for Reset Data feature)
    # ------------------------------------------------------------------
    def clear_all_readings(self) -> int:
        """Delete ALL energy_readings documents. Returns count deleted."""
        return self._delete_collection("energy_readings")

    def clear_readings_before(self, cutoff_str: str) -> int:
        """Delete readings older than cutoff_str (ISO string)."""
        db = self._client()
        col = db.collection("energy_readings")
        docs = list(col.where("timestamp", "<", cutoff_str).stream())
        for doc in docs:
            doc.reference.delete()
        return len(docs)

    def _delete_collection(self, col_name: str, batch_size: int = 400) -> int:
        db = self._client()
        col = db.collection(col_name)
        total = 0
        while True:
            docs = list(col.limit(batch_size).stream())
            if not docs:
                break
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()
            total += len(docs)
        return total


# ------------------------------------------------------------------
# Singleton factory helper (used by get_repository)
# ------------------------------------------------------------------
_firebase_repo: Optional[FirebaseRepository] = None

def get_firebase_repository() -> FirebaseRepository:
    global _firebase_repo
    if _firebase_repo is None:
        _firebase_repo = FirebaseRepository()
    return _firebase_repo
