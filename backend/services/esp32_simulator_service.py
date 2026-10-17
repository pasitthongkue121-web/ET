import os
import random
import threading
import time
import uuid
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
        "name": "วงจรเต้ารับ (General Outlets)",
        "category": "receptacle",
        "rated_power": 2000.0,
        "noise": 100.0,
    },
    {
        "circuit_id": "circuit_heavy_load",
        "name": "โหลดหนัก (Heavy Load: AC/Water Heater)",
        "category": "heavy_load",
        "rated_power": 5000.0,
        "noise": 200.0,
    },
    {
        "circuit_id": "circuit_ev",
        "name": "เครื่องชาร์จ EV (EV Charging)",
        "category": "ev",
        "rated_power": 7400.0,
        "noise": 150.0,
    },
    {
        "circuit_id": "circuit_solar",
        "name": "Solar PV (Solar Generation)",
        "category": "solar",
        "rated_power": 5000.0,
        "noise": 0.0,
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
        self.last_batch_id = None
        self.last_error = None
        self._energy_accumulators = {c["circuit_id"]: 0.0 for c in _CIRCUITS}

    def get_supported_circuits(self) -> List[Dict[str, Any]]:
        return _CIRCUITS

    def _get_circuit_power(self, circuit_id: str, hour: int, minute: int) -> float:
        if circuit_id == "circuit_lighting":
            base = 0.0
            if 6 <= hour < 8:
                base = 50.0
            elif 8 <= hour < 17:
                base = 100.0
            elif 17 <= hour < 23:
                base = 600.0
            return max(0.0, base + random.uniform(-30, 30) if base > 0 else 0.0)

        elif circuit_id == "circuit_receptacle":
            base = 100.0
            if 6 <= hour < 9:
                base = 300.0
            elif 9 <= hour < 18:
                base = 800.0
            elif 18 <= hour < 23:
                base = 1200.0
            return max(0.0, base + random.uniform(-100, 100))

        elif circuit_id == "circuit_heavy_load":
            base = 0.0
            if 6 <= hour < 8:
                base = 3200.0  # Morning water heater
            elif 8 <= hour < 17:
                base = 1350.0  # AC + Fridge
            elif 17 <= hour < 23:
                base = 1500.0  # Evening cooling
            if 13 <= hour < 23:
                base += random.uniform(-150, 150)
            if base > 0:
                base += random.uniform(-150, 150)
            return max(0.0, base)

        elif circuit_id == "circuit_ev":
            # EV Charging: typically overnight (22:00-06:00) during TOU Off-Peak
            base = 0.0
            if (22 <= hour <= 23) or (0 <= hour < 6):
                base = 3600.0 + random.uniform(-120, 120)
            elif 13 <= hour < 15:
                # Occasional top-up
                base = 2200.0 if random.random() < 0.25 else 0.0
            return max(0.0, base)

        elif circuit_id == "circuit_solar":
            base = 0.0
            if 6 <= hour < 10:
                base = 3500.0 * ((hour - 6) / 4.0)
            elif 10 <= hour < 15:
                base = 3500.0
            elif 15 <= hour < 18:
                base = 3500.0 * (1.0 - (hour - 15) / 3.0)
            cloud_factor = random.uniform(0.75, 1.0)
            return max(0.0, base * cloud_factor)

        return 0.0

    def _generate_readings_batch(
        self,
        current_dt: Optional[datetime] = None,
        circuit_ids: Optional[List[str]] = None,
        batch_id: Optional[str] = None
    ) -> List[Dict]:
        dt = current_dt or datetime.now()
        now_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        hour = dt.hour
        minute = dt.minute
        
        target_circuits = _CIRCUITS
        if circuit_ids:
            target_circuits = [c for c in _CIRCUITS if c["circuit_id"] in circuit_ids]
            if not target_circuits:
                target_circuits = _CIRCUITS

        batch_tag = batch_id or f"sim_batch_{int(time.time())}"

        readings = []
        for circuit in target_circuits:
            cid = circuit["circuit_id"]
            power_w = abs(self._get_circuit_power(cid, hour, minute))
            
            voltage = round(220.0 + random.uniform(-2.0, 2.0), 1)
            current = round(power_w / max(1.0, voltage), 2)
            
            kwh_delta = (power_w * (self.interval_seconds / 3600.0)) / 1000.0
            self._energy_accumulators[cid] = self._energy_accumulators.get(cid, 0.0) + kwh_delta
                
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
                "circuit_type": circuit["category"],
                "data_source": "simulated",
                "simulation_batch_id": batch_tag,
                "validation_status": "simulated_ok"
            }
            
            if cid == "circuit_solar":
                reading["solar_mode"] = self.solar_mode
                reading["battery_pct"] = random.randint(20, 100) if self.solar_mode == "off_grid" else None
                
            readings.append(reading)
            
        return readings

    def generate_dataset(
        self,
        circuit_ids: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        interval_minutes: int = 15,
        batch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates simulated time-series for specified circuits and date range.
        Strictly marks every record with data_source='simulated'.
        """
        now = datetime.now()
        end = end_time or now
        start = start_time or (end - timedelta(days=1))
        
        if start > end:
            start, end = end - timedelta(days=1), end

        target_circuits = _CIRCUITS
        if circuit_ids:
            target_circuits = [c for c in _CIRCUITS if c["circuit_id"] in circuit_ids]
            if not target_circuits:
                target_circuits = _CIRCUITS

        batch_tag = batch_id or f"sim_batch_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        interval_sec = max(60, interval_minutes * 60)

        accumulators = {c["circuit_id"]: 0.0 for c in target_circuits}
        readings = []
        curr = start

        while curr <= end:
            dt_str = curr.strftime("%Y-%m-%d %H:%M:%S")
            hour = curr.hour
            minute = curr.minute

            for circuit in target_circuits:
                cid = circuit["circuit_id"]
                power_w = abs(self._get_circuit_power(cid, hour, minute))
                voltage = round(220.0 + random.uniform(-2.5, 2.5), 1)
                current = round(power_w / max(1.0, voltage), 2)
                kwh_inc = (power_w * (interval_sec / 3600.0)) / 1000.0
                accumulators[cid] += kwh_inc

                r = {
                    "device_id": cid,
                    "name": circuit["name"],
                    "room_id": "main_panel",
                    "category": circuit["category"],
                    "timestamp": dt_str,
                    "voltage": voltage,
                    "current": current,
                    "power": round(power_w, 1),
                    "energy": round(accumulators[cid], 4),
                    "temperature": round(28.0 + random.uniform(-2.0, 2.0), 1),
                    "humidity": round(65.0 + random.uniform(-5.0, 5.0), 1),
                    "occupancy": 1,
                    "is_generation": cid == "circuit_solar",
                    "circuit_type": circuit["category"],
                    "data_source": "simulated",
                    "simulation_batch_id": batch_tag,
                    "validation_status": "simulated_ok"
                }
                if cid == "circuit_solar":
                    r["solar_mode"] = self.solar_mode
                    r["battery_pct"] = random.randint(20, 100) if self.solar_mode == "off_grid" else None

                readings.append(r)

            curr += timedelta(minutes=interval_minutes)

        return readings

    def transmit_batch(self, readings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Transmits simulated records directly to repository and database.
        """
        if not readings:
            return {"status": "error", "message": "No readings to transmit", "records_transmitted": 0}

        from backend.database.repository import get_repository
        repo = get_repository()
        
        start_t = time.time()
        count = repo.insert_readings_bulk(readings)
        elapsed = round(time.time() - start_t, 3)

        batch_tag = readings[0].get("simulation_batch_id", "sim_batch_unknown")
        with self._lock:
            self.packets_sent += count
            self.last_batch_at = datetime.now().isoformat()
            self.last_batch_id = batch_tag

        logger.info(f"{logger_prefix} Transmitted batch {batch_tag}: {count} records in {elapsed}s")
        return {
            "status": "success",
            "message": f"Successfully transmitted {count} simulated records to database.",
            "records_transmitted": count,
            "records_failed": 0,
            "batch_id": batch_tag,
            "elapsed_seconds": elapsed,
            "data_source": "simulated"
        }

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

                # Also forward live stream to Google Sheet Web App if connected
                try:
                    from backend.services.gsheet_service import get_sheet_url
                    s_url = get_sheet_url()
                    if s_url and readings:
                        import urllib.request
                        import json
                        s_rows = []
                        for r in readings:
                            s_rows.append({
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
                        req_s = urllib.request.Request(
                            s_url,
                            data=json.dumps(s_rows).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        )
                        urllib.request.urlopen(req_s, timeout=8)
                except Exception:
                    pass
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
        all_readings = self.generate_dataset(
            start_time=start,
            end_time=now,
            interval_minutes=5,
            batch_id="seed_initial_24h"
        )
        repo.insert_readings_bulk(all_readings)
        logger.info(f"{logger_prefix} Inserted {len(all_readings)} historical readings.")

    def start(self, device_id: Optional[str] = None, target: Optional[str] = None, interval: Optional[int] = None) -> Dict:
        with self._lock:
            if interval:
                self.interval_seconds = interval
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

    def set_override(self, power_watts: float):
        pass

    def generate_reading(self, device_id: str = "circuit_lighting", power_watts: float = 1200.0) -> Dict[str, Any]:
        dt = datetime.now()
        voltage = 230.0
        current = round(abs(power_watts) / voltage, 2)
        return {
            "device_id": device_id,
            "name": device_id.replace("_", " ").title(),
            "room_id": "main_panel",
            "category": "appliance",
            "timestamp": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "voltage": voltage,
            "current": current,
            "power": round(power_watts, 1),
            "power_w": round(power_watts, 1),
            "energy": round(power_watts * (15.0 / 3600.0) / 1000.0, 4),
            "temperature": 28.5,
            "humidity": 65.0,
            "occupancy": 1,
            "data_source": "simulated",
            "simulation_batch_id": f"single_test_{int(time.time())}",
            "validation_status": "simulated_ok"
        }

    def send_packet(self, reading: Dict[str, Any]) -> Dict[str, Any]:
        from backend.database.repository import get_repository
        repo = get_repository()
        reading.setdefault("data_source", "simulated")
        reading.setdefault("simulation_batch_id", f"single_{int(time.time())}")
        reading.setdefault("validation_status", "simulated_ok")
        repo.insert_reading(reading)
        with self._lock:
            self.packets_sent += 1
            self.last_batch_at = datetime.now().isoformat()
        return {
            "success": True,
            "payload": reading,
            "results": {"status": "injected"}
        }

    def get_status(self) -> Dict:
        with self._lock:
            return {
                "running": self._running,
                "simulation_mode": True,
                "status_label": "SIMULATION MODE — ขณะนี้กำลังจำลองข้อมูลผ่าน Pipeline Hub (Simulated Data Only)",
                "devices_simulated": len(_CIRCUITS),
                "interval_seconds": self.interval_seconds,
                "packets_sent": self.packets_sent,
                "packets_failed": self.packets_failed,
                "last_batch_at": self.last_batch_at,
                "last_sent_at": self.last_batch_at,
                "last_batch_id": self.last_batch_id,
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
