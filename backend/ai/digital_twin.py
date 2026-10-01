import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import pandas as pd
from backend.database.connection import get_connection
from backend.config import settings
from backend.database.models import (
    DigitalTwinHome,
    DigitalTwinRoom,
    DigitalTwinDevice,
    DigitalTwinState,
    DigitalTwinDeviceDetail
)

class DigitalTwinEngine:
    def __init__(self):
        pass

    def get_state(self) -> DigitalTwinState:
        """
        Synchronizes the current instantaneous digital twin state with the latest telemetry.
        """
        conn = get_connection()
        # Find latest timestamp in the database
        latest_ts_row = conn.execute("SELECT MAX(timestamp) as max_ts FROM energy_readings").fetchone()
        latest_ts = latest_ts_row["max_ts"] if latest_ts_row and latest_ts_row["max_ts"] else datetime.now().isoformat()
        
        # Get latest reading for EVERY registered device
        query = """
            SELECT d.device_id, d.name, d.room_id, d.rated_power, d.status,
                   COALESCE(r.power, 0.0) as power,
                   COALESCE(r.voltage, 230.0) as voltage,
                   COALESCE(r.current, 0.0) as current,
                   COALESCE(r.temperature, 28.4) as temperature,
                   COALESCE(r.humidity, 60.0) as humidity,
                   COALESCE(r.occupancy, 1) as occupancy
            FROM devices d
            LEFT JOIN (
                SELECT r1.*
                FROM energy_readings r1
                INNER JOIN (
                    SELECT device_id, MAX(timestamp) as max_ts
                    FROM energy_readings
                    GROUP BY device_id
                ) latest ON r1.device_id = latest.device_id AND r1.timestamp = latest.max_ts
            ) r ON d.device_id = r.device_id
        """
        rows = conn.execute(query).fetchall()

        total_power_w = 0.0
        active_count = 0
        total_count = len(rows)
        temp_c = 28.4
        humidity = 60.0
        occupancy = True
        
        for row in rows:
            p = float(row["power"] or 0.0)
            total_power_w += p
            if p > 15.0 or bool(row["status"]):
                active_count += 1
            if row["temperature"]:
                temp_c = float(row["temperature"])
            if row["humidity"]:
                humidity = float(row["humidity"])
            if row["occupancy"] is not None:
                occupancy = bool(row["occupancy"])

        # Calculate estimated cost today based on today's total energy
        day_str = latest_ts[:10]
        cost_query = """
            SELECT SUM(energy) as today_kwh
            FROM energy_readings
            WHERE timestamp >= ?
        """
        cost_row = conn.execute(cost_query, (day_str + " 00:00:00",)).fetchone()
        today_kwh = float(cost_row["today_kwh"] or 0.0) if cost_row else 0.0
        cost_today_thb = round(today_kwh * settings.ELECTRICITY_RATE, 2)
        
        conn.close()

        # Occupancy headcount heuristic
        occ_count = 2 if occupancy else 0

        return DigitalTwinState(
            timestamp=latest_ts,
            total_power_kw=round(total_power_w / 1000.0, 3),
            temperature_c=round(temp_c, 1),
            humidity_pct=round(humidity, 1),
            occupancy=occupancy,
            occupancy_count=occ_count,
            active_devices_count=active_count,
            total_devices_count=total_count,
            estimated_cost_today_thb=cost_today_thb,
            tag="MEASURED"
        )

    def get_home(self) -> DigitalTwinHome:
        """
        Returns full digital twin summary for the residence.
        """
        state = self.get_state()
        conn = get_connection()
        
        # Calculate 30-day monthly energy
        monthly_query = "SELECT SUM(energy) as total_kwh FROM energy_readings"
        m_row = conn.execute(monthly_query).fetchone()
        monthly_kwh = float(m_row["total_kwh"] or 0.0) if m_row else 0.0
        
        # Today energy
        day_str = state.timestamp[:10]
        today_query = "SELECT SUM(energy) as today_kwh FROM energy_readings WHERE timestamp >= ?"
        t_row = conn.execute(today_query, (day_str + " 00:00:00",)).fetchone()
        today_kwh = float(t_row["today_kwh"] or 0.0) if t_row else 0.0

        conn.close()

        return DigitalTwinHome(
            home_id="HOME_TWIN_01",
            name="ENERGY TWINS Residence",
            total_power_w=round(state.total_power_kw * 1000.0, 1),
            total_power_kw=state.total_power_kw,
            daily_energy_kwh=round(today_kwh, 2),
            monthly_energy_kwh=round(monthly_kwh, 2),
            total_devices=state.total_devices_count,
            active_devices=state.active_devices_count,
            cost_today_thb=state.estimated_cost_today_thb
        )

    def get_rooms(self) -> List[DigitalTwinRoom]:
        """
        Returns virtual home floorplan with all rooms and their device digital twins.
        """
        conn = get_connection()
        
        # Get latest timestamp
        latest_ts_row = conn.execute("SELECT MAX(timestamp) as max_ts FROM energy_readings").fetchone()
        latest_ts = latest_ts_row["max_ts"] if latest_ts_row and latest_ts_row["max_ts"] else datetime.now().isoformat()

        # Query all devices with latest reading per device
        query = """
            SELECT d.device_id, d.name, d.room_id, r.name as room_name, r.floor, r.icon as room_icon,
                   d.rated_power, d.status, d.temperature as temp_setting, d.category,
                   COALESCE(latest_readings.power, 0.0) as current_power
            FROM devices d
            JOIN rooms r ON d.room_id = r.id
            LEFT JOIN (
                SELECT r1.device_id, r1.power
                FROM energy_readings r1
                INNER JOIN (
                    SELECT device_id, MAX(timestamp) as max_ts
                    FROM energy_readings
                    GROUP BY device_id
                ) latest ON r1.device_id = latest.device_id AND r1.timestamp = latest.max_ts
            ) latest_readings ON d.device_id = latest_readings.device_id
            ORDER BY r.floor, r.name, d.name
        """
        rows = conn.execute(query).fetchall()
        conn.close()

        # Group by room
        rooms_dict: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            r_id = row["room_id"]
            if r_id not in rooms_dict:
                rooms_dict[r_id] = {
                    "room_id": r_id,
                    "name": row["room_name"],
                    "floor": row["floor"],
                    "icon": row["room_icon"],
                    "devices": [],
                    "active_devices": 0,
                    "total_devices": 0,
                    "current_power_w": 0.0
                }

            p_w = float(row["current_power"] or 0.0)
            is_active = p_w > 15.0 or bool(row["status"])
            
            # Formulate device schedule description
            sched = "24/7 Continuous" if "FRIDGE" in row["device_id"] else (
                "18:00 - 23:00 Evening" if "LIVING" in row["device_id"] else (
                    "23:00 - 06:30 Night Sleep" if "BEDROOM" in row["device_id"] and "AC" in row["device_id"] else (
                        "09:00 - 18:00 Work Hours" if "PC" in row["device_id"] else "Intermittent / Routine"
                    )
                )
            )

            twin_dev = DigitalTwinDevice(
                device_id=row["device_id"],
                name=row["name"],
                room_id=r_id,
                room_name=row["room_name"],
                device_type=row["category"],
                rated_power=float(row["rated_power"]),
                status=is_active,
                current_power_w=round(p_w, 1),
                temperature_setting=float(row["temp_setting"]) if row["temp_setting"] else (24.0 if "AC" in row["device_id"] else None),
                schedule=sched
            )

            rooms_dict[r_id]["devices"].append(twin_dev)
            rooms_dict[r_id]["total_devices"] += 1
            rooms_dict[r_id]["current_power_w"] += p_w
            if is_active:
                rooms_dict[r_id]["active_devices"] += 1

        result = []
        for r_id, r_data in rooms_dict.items():
            result.append(DigitalTwinRoom(
                room_id=r_data["room_id"],
                name=r_data["name"],
                floor=r_data["floor"],
                icon=r_data["icon"],
                active_devices=r_data["active_devices"],
                total_devices=r_data["total_devices"],
                current_power_w=round(r_data["current_power_w"], 1),
                devices=r_data["devices"]
            ))

        return result

    def get_devices(self) -> List[DigitalTwinDevice]:
        """
        Returns flat list of all digital twin devices with live status.
        """
        rooms = self.get_rooms()
        devices = []
        for r in rooms:
            devices.extend(r.devices)
        return devices

    def get_device_detail(self, device_id: str) -> Optional[DigitalTwinDeviceDetail]:
        """
        Returns full detailed operational statistics for a specific digital twin device.
        """
        conn = get_connection()
        device_row = conn.execute("""
            SELECT d.*, r.name as room_name
            FROM devices d
            JOIN rooms r ON d.room_id = r.id
            WHERE d.device_id = ?
        """, (device_id,)).fetchone()
        
        if not device_row:
            conn.close()
            return None

        # Get latest reading
        latest_ts_row = conn.execute("SELECT MAX(timestamp) as max_ts FROM energy_readings").fetchone()
        latest_ts = latest_ts_row["max_ts"] if latest_ts_row and latest_ts_row["max_ts"] else datetime.now().isoformat()
        
        latest_reading = conn.execute("""
            SELECT power, temperature FROM energy_readings
            WHERE device_id = ? AND timestamp = ?
        """, (device_id, latest_ts)).fetchone()

        current_power = float(latest_reading["power"] or 0.0) if latest_reading else 0.0
        
        # Today energy & runtime
        day_str = latest_ts[:10]
        today_stats = conn.execute("""
            SELECT SUM(energy) as today_kwh,
                   COUNT(CASE WHEN power > 15.0 THEN 1 END) * 0.25 as runtime_h
            FROM energy_readings
            WHERE device_id = ? AND timestamp >= ?
        """, (device_id, day_str + " 00:00:00")).fetchone()
        
        today_kwh = float(today_stats["today_kwh"] or 0.0) if today_stats else 0.0
        runtime_h = float(today_stats["runtime_h"] or 0.0) if today_stats else 0.0

        # Monthly energy
        month_stats = conn.execute("""
            SELECT SUM(energy) as month_kwh,
                   COUNT(*) as sample_count
            FROM energy_readings
            WHERE device_id = ?
        """, (device_id,)).fetchone()
        monthly_kwh = float(month_stats["month_kwh"] or 0.0) if month_stats else 0.0
        sample_count = int(month_stats["sample_count"] or 0) if month_stats else 0

        conn.close()

        # Confidence based on sample count
        confidence_pct = min(98, max(50, int((sample_count / 2880) * 98)))

        sched = "24/7 Continuous" if "FRIDGE" in device_id else (
            "18:00 - 23:00 Evening" if "LIVING" in device_id else (
                "23:00 - 06:30 Night Sleep" if "BEDROOM" in device_id and "AC" in device_id else (
                    "09:00 - 18:00 Work Hours" if "PC" in device_id else "Flexible Usage"
                )
            )
        )

        return DigitalTwinDeviceDetail(
            device_id=device_id,
            name=device_row["name"],
            room_id=device_row["room_id"],
            room_name=device_row["room_name"],
            device_type=device_row["category"],
            status=current_power > 15.0 or bool(device_row["status"]),
            current_power_w=round(current_power, 1),
            rated_power_w=float(device_row["rated_power"]),
            today_energy_kwh=round(today_kwh, 2),
            monthly_energy_kwh=round(monthly_kwh, 2),
            runtime_hours=round(runtime_h, 1),
            temperature_setting=float(device_row["temperature"]) if device_row["temperature"] else (24.0 if "AC" in device_id else None),
            schedule=sched,
            confidence_pct=confidence_pct,
            tag="MEASURED"
        )

digital_twin_engine = DigitalTwinEngine()
