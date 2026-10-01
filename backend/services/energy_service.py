from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
from backend.database.repository import get_repository
from backend.database.models import ESP32ReadingInput

# Thailand standard residential electricity tariff (~฿4.42 per kWh average)
ELECTRICITY_RATE_PER_KWH = 4.42

class EnergyService:
    def __init__(self):
        self.repo = get_repository()

    def get_energy_history(
        self,
        period: str = "today",
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves time-series energy data for Recharts.
        Period options: 'today', '7d', '30d'
        """
        latest_readings = self.repo.get_latest_device_readings()
        if not latest_readings:
            return {"period": period, "timeseries": [], "total_energy_kwh": 0.0, "total_cost_thb": 0.0}

        # Reference latest timestamp in DB as the current baseline
        ref_time_str = latest_readings[0]["timestamp"]
        try:
            ref_time = datetime.strptime(ref_time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            # Handle ISO8601 format like '2026-09-14T15:49:58.249Z'
            ref_time = datetime.fromisoformat(ref_time_str.replace("Z", "+00:00").replace("T", " ").split("+")[0].split(".")[0].strip())

        if period == "today":
            start_time = ref_time.replace(hour=0, minute=0, second=0)
        elif period == "7d":
            start_time = ref_time - timedelta(days=7)
        elif period == "30d":
            start_time = ref_time - timedelta(days=30)
        else:
            start_time = ref_time.replace(hour=0, minute=0, second=0)

        start_str = start_time.strftime("%Y-%m-%d %H:%M:%S")
        end_str = ref_time.strftime("%Y-%m-%d %H:%M:%S")

        raw_data = self.repo.get_readings_timeseries(start_str, end_str, device_id=device_id)
        if not raw_data:
            return {"period": period, "timeseries": [], "total_energy_kwh": 0.0, "total_cost_thb": 0.0}

        df = pd.DataFrame(raw_data)
        df["timestamp"] = pd.to_datetime(df["timestamp"], format='mixed')

        # Downsample for smooth chart rendering based on period
        if period == "today":
            # Keep 15-min or hourly
            df["time_label"] = df["timestamp"].dt.strftime("%H:%M")
            grouped = df.groupby("time_label", as_index=False).agg({
                "power": "mean",
                "energy": "sum",
                "voltage": "mean",
                "current": "sum",
                "temperature": "mean",
                "occupancy": "max"
            })
        elif period == "7d":
            # Group by 2 hours for clarity
            df["time_label"] = df["timestamp"].dt.strftime("%d %b %H:00")
            grouped = df.groupby("time_label", as_index=False).agg({
                "power": "mean",
                "energy": "sum",
                "voltage": "mean",
                "current": "sum",
                "temperature": "mean",
                "occupancy": "max"
            })
        else: # 30d
            # Group by day
            df["time_label"] = df["timestamp"].dt.strftime("%d %b")
            grouped = df.groupby("time_label", as_index=False).agg({
                "power": "mean",
                "energy": "sum",
                "voltage": "mean",
                "current": "sum",
                "temperature": "mean",
                "occupancy": "max"
            })

        timeseries = []
        for _, row in grouped.iterrows():
            timeseries.append({
                "time": str(row["time_label"]),
                "power_w": round(float(row["power"]), 1),
                "power_kw": round(float(row["power"]) / 1000.0, 2),
                "energy_kwh": round(float(row["energy"]), 3),
                "voltage": round(float(row["voltage"]), 1),
                "current_a": round(float(row["current"]), 2),
                "temperature": round(float(row["temperature"]), 1),
                "cost_thb": round(float(row["energy"]) * ELECTRICITY_RATE_PER_KWH, 2),
                "occupancy": bool(row["occupancy"])
            })

        total_energy = round(df["energy"].sum(), 2)
        total_cost = round(total_energy * ELECTRICITY_RATE_PER_KWH, 2)

        return {
            "period": period,
            "device_id": device_id,
            "total_energy_kwh": total_energy,
            "total_cost_thb": total_cost,
            "timeseries": timeseries
        }

    def ingest_esp32_reading(self, reading_in: ESP32ReadingInput) -> Dict[str, Any]:
        """
        Receives real-time telemetry from physical ESP32 or simulated sensor.
        """
        now = reading_in.timestamp or datetime.now()
        timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")

        reading_dict = {
            "timestamp": timestamp_str,
            "device_id": reading_in.device_id,
            "voltage": reading_in.voltage,
            "current": reading_in.current,
            "power": reading_in.power,
            "energy": reading_in.energy,
            "temperature": reading_in.temperature or 25.0,
            "humidity": reading_in.humidity or 60.0,
            "occupancy": 1 if reading_in.occupancy else 0
        }

        row_id = self.repo.insert_reading(reading_dict)
        return {
            "status": "success",
            "message": "ESP32 reading ingested successfully",
            "reading_id": row_id,
            "timestamp": timestamp_str,
            "device_id": reading_in.device_id,
            "power_w": reading_in.power
        }

energy_service = EnergyService()
