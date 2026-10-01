"""
ESP32 Multi-Device Simulator Service (v2 — Cloud Ready)
=========================================================
Simulates 10 realistic smart home IoT energy meters transmitting
telemetry directly to the database (SQLite or Firebase Firestore).

Device patterns follow Thai household usage:
  - Morning peak: 06:00–09:00
  - Daytime: 09:00–17:00 (low activity)
  - Evening peak: 17:00–23:00
  - Night off-peak: 23:00–06:00 (EV charging)

TOU Rate Zones (MEA/PEA Thailand):
  - On-Peak:    09:00–22:00 weekdays      → 5.68 THB/kWh
  - Off-Peak:   22:00–09:00 + weekends    → 2.64 THB/kWh
"""

import os
import random
import threading
import time
from datetime import datetime
from typing import Dict, Any, Optional, List

logger_prefix = "[ESP32-SIM]"


# ---------------------------------------------------------------------------
# Device profiles with realistic power patterns
# ---------------------------------------------------------------------------
_DEVICE_PROFILES: List[Dict[str, Any]] = [
    {
        "device_id":   "ac_living_room",
        "name":        "AC Living Room",
        "room_id":     "living_room",
        "rated_power": 1200.0,
        "category":    "heavy_load",
        "base_power":  950.0,
        "noise":       (-80.0, 150.0),
        "active_hours": list(range(13, 24)) + list(range(0, 1)),  # 13:00–00:00
        "cycle": None,  # always on when in active hours
    },
    {
        "device_id":   "fridge",
        "name":        "Refrigerator",
        "room_id":     "kitchen",
        "rated_power": 150.0,
        "category":    "heavy_load",
        "base_power":  110.0,
        "noise":       (-20.0, 30.0),
        "active_hours": list(range(24)),  # always on
        "cycle": {"on_min": 15, "off_min": 20},  # cycles on/off
    },
    {
        "device_id":   "tv_living_room",
        "name":        "Smart TV",
        "room_id":     "living_room",
        "rated_power": 100.0,
        "category":    "receptacle",
        "base_power":  85.0,
        "noise":       (-10.0, 20.0),
        "active_hours": list(range(18, 24)),
        "cycle": None,
    },
    {
        "device_id":   "washing_machine",
        "name":        "Washing Machine",
        "room_id":     "garage",
        "rated_power": 600.0,
        "category":    "heavy_load",
        "base_power":  500.0,
        "noise":       (-50.0, 100.0),
        "active_hours": [8, 9, 10, 14, 15],  # only at these hours occasionally
        "cycle": {"on_min": 45, "off_min": 23 * 60},  # runs ~1 cycle/day
    },
    {
        "device_id":   "water_heater",
        "name":        "Water Heater",
        "room_id":     "bathroom",
        "rated_power": 3000.0,
        "category":    "heavy_load",
        "base_power":  2800.0,
        "noise":       (-100.0, 200.0),
        "active_hours": list(range(6, 9)),  # morning only
        "cycle": {"on_min": 20, "off_min": 1400},
    },
    {
        "device_id":   "lighting_living",
        "name":        "Living Room Lights",
        "room_id":     "living_room",
        "rated_power": 80.0,
        "category":    "lighting",
        "base_power":  65.0,
        "noise":       (-5.0, 10.0),
        "active_hours": list(range(18, 24)) + [6, 7],
        "cycle": None,
    },
    {
        "device_id":   "lighting_bedroom1",
        "name":        "Bedroom Lights",
        "room_id":     "bedroom_1",
        "rated_power": 60.0,
        "category":    "lighting",
        "base_power":  50.0,
        "noise":       (-5.0, 8.0),
        "active_hours": list(range(20, 24)) + [6, 7],
        "cycle": None,
    },
    {
        "device_id":   "computer_desk",
        "name":        "Desktop Computer",
        "room_id":     "bedroom_1",
        "rated_power": 250.0,
        "category":    "receptacle",
        "base_power":  200.0,
        "noise":       (-30.0, 50.0),
        "active_hours": list(range(9, 12)) + list(range(19, 23)),
        "cycle": None,
    },
    {
        "device_id":   "microwave",
        "name":        "Microwave",
        "room_id":     "kitchen",
        "rated_power": 1000.0,
        "category":    "receptacle",
        "base_power":  950.0,
        "noise":       (-50.0, 80.0),
        "active_hours": list(range(7, 9)) + list(range(12, 14)),
        "cycle": {"on_min": 5, "off_min": 55},
    },
    {
        "device_id":   "ev_charger",
        "name":        "EV Charger",
        "room_id":     "garage",
        "rated_power": 7000.0,
        "category":    "heavy_load",
        "base_power":  3300.0,
        "noise":       (-200.0, 500.0),
        "active_hours": list(range(22, 24)) + list(range(0, 6)),  # off-peak only
        "cycle": {"on_min": 120, "off_min": 6 * 60},
    },
]


class DeviceState:
    """Tracks per-device state: cumulative energy and on/off cycle."""
    def __init__(self, profile: Dict[str, Any]):
        self.profile = profile
        self.cumulative_kwh: float = round(random.uniform(0.1, 5.0), 3)
        self.is_on: bool = False
        self.cycle_remaining: int = 0  # minutes left in current phase


class ESP32MultiDeviceSimulator:
    """
    Simulates 10 ESP32 devices transmitting energy readings every 60 seconds.
    Writes directly to the repository (SQLite or Firebase).
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.interval_seconds: int = 60

        # Stats
        self.packets_sent: int = 0
        self.packets_failed: int = 0
        self.last_batch_at: Optional[str] = None
        self.last_error: Optional[str] = None

        # Per-device state
        self._device_states: Dict[str, DeviceState] = {
            p["device_id"]: DeviceState(p) for p in _DEVICE_PROFILES
        }

    # ------------------------------------------------------------------
    # Power generation logic
    # ------------------------------------------------------------------
    def _is_active_hour(self, profile: Dict, hour: int) -> bool:
        return hour in profile.get("active_hours", [])

    def _compute_power(self, state: DeviceState) -> float:
        hour = datetime.now().hour
        profile = state.profile
        cycle = profile.get("cycle")

        # Determine if device is on based on hour
        if not self._is_active_hour(profile, hour):
            state.is_on = False
            return 0.0

        if cycle:
            # Advance cycle counter
            if state.cycle_remaining <= 0:
                # Flip state
                state.is_on = not state.is_on
                state.cycle_remaining = cycle["on_min"] if state.is_on else cycle["off_min"]
            else:
                # Decrement by 1 interval-minute (interval_seconds / 60)
                state.cycle_remaining = max(0, state.cycle_remaining - 1)
        else:
            state.is_on = True

        if not state.is_on:
            return 0.0

        base = profile["base_power"]
        lo, hi = profile["noise"]
        power = max(0.0, base + random.uniform(lo, hi))

        # Add time-of-day variation (hot afternoon → AC works harder)
        if "ac" in profile["device_id"] and 13 <= hour <= 16:
            power *= random.uniform(1.05, 1.20)

        return round(power, 1)

    def _generate_readings_batch(self) -> List[Dict[str, Any]]:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        readings = []

        for dev_id, state in self._device_states.items():
            power_w = self._compute_power(state)
            voltage = round(220.0 + random.uniform(-5.0, 5.0), 1)
            current = round(power_w / max(voltage, 1.0), 2) if power_w > 0 else 0.0

            # Accumulate energy
            kwh_delta = (power_w * (self.interval_seconds / 3600.0)) / 1000.0
            state.cumulative_kwh = round(state.cumulative_kwh + kwh_delta, 4)

            readings.append({
                "timestamp":   now_str,
                "device_id":   dev_id,
                "voltage":     voltage,
                "current":     current,
                "power":       power_w,
                "energy":      state.cumulative_kwh,
                "temperature": round(28.0 + random.uniform(-3.0, 5.0), 1),
                "humidity":    round(62.0 + random.uniform(-8.0, 8.0), 1),
                "occupancy":   1 if (8 <= datetime.now().hour <= 22) else 0,
            })

        return readings

    # ------------------------------------------------------------------
    # Worker loop
    # ------------------------------------------------------------------
    def _worker_loop(self):
        import logging
        log = logging.getLogger(__name__)

        while not self._stop_event.is_set():
            try:
                from backend.database.repository import get_repository
                repo = get_repository()
                readings = self._generate_readings_batch()
                repo.insert_readings_bulk(readings)

                with self._lock:
                    self.packets_sent += len(readings)
                    self.last_batch_at = datetime.now().isoformat()

                log.info(f"{logger_prefix} Sent {len(readings)} readings to DB.")
            except Exception as e:
                with self._lock:
                    self.packets_failed += 1
                    self.last_error = str(e)
                log.error(f"{logger_prefix} Batch write failed: {e}")

            self._stop_event.wait(self.interval_seconds)

    # ------------------------------------------------------------------
    # Control API
    # ------------------------------------------------------------------
    def start(self) -> Dict[str, Any]:
        with self._lock:
            if self._running:
                return {"status": "already_running"}
            self._stop_event.clear()
            self._running = True
            self._thread = threading.Thread(
                target=self._worker_loop, daemon=True, name="esp32-multi-sim"
            )
            self._thread.start()
        return {
            "status": "started",
            "devices": len(self._device_states),
            "interval_seconds": self.interval_seconds,
        }

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            if not self._running:
                return {"status": "not_running"}
            self._stop_event.set()
            self._running = False
        return {"status": "stopped"}

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "running": self._running,
                "devices_simulated": len(self._device_states),
                "interval_seconds": self.interval_seconds,
                "packets_sent": self.packets_sent,
                "packets_failed": self.packets_failed,
                "last_batch_at": self.last_batch_at,
                "last_error": self.last_error,
            }

    def get_current_readings(self) -> List[Dict[str, Any]]:
        """Return a snapshot of the latest simulated readings (non-persisted)."""
        return self._generate_readings_batch()


# Global singleton
esp32_simulator = ESP32MultiDeviceSimulator()
# Backward-compat alias used by existing API routes
esp32_multi_simulator = esp32_simulator
