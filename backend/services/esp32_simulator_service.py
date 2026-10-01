import os
import random
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)
logger_prefix = "[ESP32-SIM]"

_CIRCUITS = [
    {
        "circuit_id": "circuit_lighting",
        "name": "วงจรแสงสว่าง (Lighting)",
        "category": "lighting",
        "rated_power": 800.0,
        "noise": 30.0,
    },
    {
        "circuit_id": "circuit_receptacle",
        "name": "วงจรเต้ารับ (Receptacle)",
        "category": "receptacle",
        "rated_power": 2000.0,
        "noise": 100.0,
    },
    {
        "circuit_id": "circuit_heavy_load",
        "name": "โหลดหนัก (Heavy Load)",
        "category": "heavy_load",
        "rated_power": 5000.0,
        "noise": 200.0,
    },
    {
        "circuit_id": "circuit_solar",
        "name": "Solar PV (On-Grid)",
        "category": "solar",
        "rated_power": -5000.0,
        "noise": 0.0,  # custom logic for solar
    }
]

class CircuitEnergySimulator:
    def __init__(self):
        self.interval_seconds = 60
        self.solar_mode = "on_grid"
        self._running = False
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None
        self.packets_sent = 0
        self.packets_failed = 0
        self.last_batch_at = None
        self.last_error = None
        self._energy_accumulators = {c["circuit_id"]: 0.0 for c in _CIRCUITS}

    def _get_circuit_power(self, circuit_id: str, hour: int, minute: int) -> float:
        if circuit_id == "circuit_lighting":
            base = 0
            if 6 <= hour < 8:
                base = 50
            elif 8 <= hour < 17:
                base = 100
            elif 17 <= hour < 23:
                base = 600
            return max(0.0, base + random.uniform(-30, 30) if base > 0 else 0)

        elif circuit_id == "circuit_receptacle":
            base = 100
            if 6 <= hour < 9:
                base = 300
            elif 9 <= hour < 18:
                base = 800
            elif 18 <= hour < 23:
                base = 1200
            return max(0.0, base + random.uniform(-100, 100))

        elif circuit_id == "circuit_heavy_load":
            base = 0
            if 6 <= hour < 8:
                base = 3200
            elif 8 <= hour < 17:
                base = 1350
            elif 17 <= hour < 23:
                base = 1350
                
            if 13 <= hour < 23:
                base += random.uniform(-150, 150)
            
            if base > 0:
                base += random.uniform(-200, 200)
            return max(0.0, base)

        elif circuit_id == "circuit_solar":
            base = 0
            if 6 <= hour < 10:
                base = -3500 * ((hour - 6) / 4)
            elif 10 <= hour < 15:
                base = -3500
            elif 15 <= hour < 18:
                base = -3500 * (1 - (hour - 15) / 3)
            
            cloud_factor = random.uniform(0.7, 1.0)
            return base * cloud_factor

        return 0.0

    def _generate_readings_batch(self, current_dt: Optional[datetime] = None) -> List[Dict]:
        dt = current_dt or datetime.now()
        now_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        hour = dt.hour
        minute = dt.minute
        
        readings = []
        for circuit in _CIRCUITS:
            cid = circuit["circuit_id"]
            power_w = self._get_circuit_power(cid, hour, minute)
            
            voltage = round(220.0 + random.uniform(-2.0, 2.0), 1)
            current = round(abs(power_w) / voltage, 2)
            
            kwh_delta = (abs(power_w) * (self.interval_seconds / 3600.0)) / 1000.0
            if power_w < 0:
                self._energy_accumulators[cid] -= kwh_delta
            else:
                self._energy_accumulators[cid] += kwh_delta
                
            reading = {
                "device_id": cid,
                "name": circuit["name"],
                "room_id": "main_panel",
                "category": circuit["category"],
                "timestamp": now_str,
                "voltage": voltage,
                "current": current,
                "power": round(power_w, 1),
                "energy": round(self._energy_accumulators[cid], 4),
                "temperature": round(28.5 + random.uniform(-2.0, 2.0), 1),
                "humidity": round(65.0 + random.uniform(-5.0, 5.0), 1),
                "occupancy": 1,
                "is_generation": cid == "circuit_solar",
                "circuit_type": circuit["category"]
            }
            
            if cid == "circuit_solar":
                reading["solar_mode"] = self.solar_mode
                reading["battery_pct"] = random.randint(20, 100) if self.solar_mode == "off_grid" else None
                
            readings.append(reading)
            
        return readings

    def _worker_loop(self):
        while not self._stop_event.is_set():
            try:
                from backend.database.repository import get_repository
                repo = get_repository()
                readings = self._generate_readings_batch()
                repo.insert_readings_bulk(readings)

                with self._lock:
                    self.packets_sent += len(readings)
                    self.last_batch_at = datetime.now().isoformat()

                logger.info(f"{logger_prefix} Sent {len(readings)} readings to DB.")
            except Exception as e:
                with self._lock:
                    self.packets_failed += 1
                    self.last_error = str(e)
                logger.error(f"{logger_prefix} Batch write failed: {e}")

            self._stop_event.wait(self.interval_seconds)

    def seed_historical_data(self, hours: int = 24):
        from backend.database.repository import get_repository
        repo = get_repository()
        
        now = datetime.now()
        start = now - timedelta(hours=hours)
        
        current = start
        all_readings = []
        
        logger.info(f"{logger_prefix} Generating {hours}h historical data from {start} to {now}...")
        
        orig_interval = self.interval_seconds
        self.interval_seconds = 300 
        
        while current <= now:
            batch = self._generate_readings_batch(current)
            all_readings.extend(batch)
            current += timedelta(minutes=5)
            
        self.interval_seconds = orig_interval
        
        repo.insert_readings_bulk(all_readings)
        logger.info(f"{logger_prefix} Inserted {len(all_readings)} historical readings.")

    def start(self) -> Dict:
        with self._lock:
            if self._running:
                return {"status": "already_running"}
            self._stop_event.clear()
            self._running = True
            self._thread = threading.Thread(target=self._worker_loop, daemon=True, name="esp32-circuit-sim")
            self._thread.start()
        return {"status": "started", "devices": len(_CIRCUITS), "interval_seconds": self.interval_seconds}

    def stop(self) -> Dict:
        with self._lock:
            if not self._running:
                return {"status": "not_running"}
            self._stop_event.set()
            self._running = False
        return {"status": "stopped"}

    def get_status(self) -> Dict:
        with self._lock:
            return {
                "running": self._running,
                "devices_simulated": len(_CIRCUITS),
                "interval_seconds": self.interval_seconds,
                "packets_sent": self.packets_sent,
                "packets_failed": self.packets_failed,
                "last_batch_at": self.last_batch_at,
                "last_error": self.last_error,
                "solar_mode": self.solar_mode
            }

    def set_solar_mode(self, mode: str) -> Dict:
        if mode in ["on_grid", "off_grid"]:
            self.solar_mode = mode
            return {"status": "success", "mode": self.solar_mode}
        return {"status": "error", "message": "Invalid mode"}

    def get_current_readings(self) -> List[Dict]:
        return self._generate_readings_batch()


esp32_simulator = CircuitEnergySimulator()
esp32_multi_simulator = esp32_simulator
