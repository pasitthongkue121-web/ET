from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import sqlite3
from .connection import get_connection

class BaseEnergyRepository(ABC):
    @abstractmethod
    def get_rooms(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_devices(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_device_status(self, device_id: str, status: bool, temperature: Optional[float] = None) -> None:
        pass

    @abstractmethod
    def insert_reading(self, reading: Dict[str, Any]) -> int:
        pass

    @abstractmethod
    def insert_readings_bulk(self, readings: List[Dict[str, Any]]) -> int:
        pass

    @abstractmethod
    def get_readings_timeseries(
        self,
        start_time: str,
        end_time: str,
        device_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_latest_device_readings(self) -> List[Dict[str, Any]]:
        pass


class SQLiteEnergyRepository(BaseEnergyRepository):
    def __init__(self):
        pass

    def get_rooms(self) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, floor, icon FROM rooms ORDER BY floor, name")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_devices(self) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.device_id, d.name, d.room_id, r.name as room_name,
                   d.rated_power, d.status, d.temperature, d.category
            FROM devices d
            LEFT JOIN rooms r ON d.room_id = r.id
            ORDER BY r.name, d.name
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO devices (device_id, name, room_id, rated_power, status, temperature, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            device_data["device_id"],
            device_data["name"],
            device_data.get("room_id", "main_panel"),
            float(device_data.get("rated_power", 1000.0)),
            int(device_data.get("status", 0)),
            device_data.get("temperature", 25.0),
            device_data.get("category", "general")
        ))
        conn.commit()
        conn.close()
        return device_data

    def update_device_status(self, device_id: str, status: bool, temperature: Optional[float] = None) -> None:
        conn = get_connection()
        cursor = conn.cursor()
        if temperature is not None:
            cursor.execute(
                "UPDATE devices SET status = ?, temperature = ? WHERE device_id = ?",
                (1 if status else 0, temperature, device_id)
            )
        else:
            cursor.execute(
                "UPDATE devices SET status = ? WHERE device_id = ?",
                (1 if status else 0, device_id)
            )
        conn.commit()
        conn.close()

    def insert_reading(self, reading: Dict[str, Any]) -> int:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR IGNORE INTO devices (device_id, name, room_id, rated_power, status, category)
            VALUES (?, ?, 'living_room', 1200.0, 1, 'appliance')
        """, (reading["device_id"], reading["device_id"].replace("_", " ").title()))
        cursor.execute("""
            INSERT INTO energy_readings 
            (timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            reading["timestamp"],
            reading["device_id"],
            reading.get("voltage", 230.0),
            reading.get("current", 0.0),
            reading.get("power", 0.0),
            reading.get("energy", 0.0),
            reading.get("temperature", 25.0),
            reading.get("humidity", 60.0),
            1 if reading.get("occupancy", True) else 0
        ))
        row_id = cursor.lastrowid
        # Update device status based on power reading (> 5W considered active)
        is_active = reading.get("power", 0.0) > 5.0
        cursor.execute(
            "UPDATE devices SET status = ?, temperature = ? WHERE device_id = ?",
            (1 if is_active else 0, reading.get("temperature"), reading["device_id"])
        )
        conn.commit()
        conn.close()
        return row_id

    def insert_readings_bulk(self, readings: List[Dict[str, Any]]) -> int:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO energy_readings 
            (timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy)
            VALUES (:timestamp, :device_id, :voltage, :current, :power, :energy, :temperature, :humidity, :occupancy)
        """, readings)
        conn.commit()
        count = cursor.rowcount
        conn.close()
        return count

    def get_readings_timeseries(
        self,
        start_time: str,
        end_time: str,
        device_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        if device_id:
            cursor.execute("""
                SELECT timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy
                FROM energy_readings
                WHERE timestamp BETWEEN ? AND ? AND device_id = ?
                ORDER BY timestamp ASC
            """, (start_time, end_time, device_id))
        else:
            cursor.execute("""
                SELECT timestamp, 
                       ROUND(AVG(voltage), 1) as voltage,
                       ROUND(SUM(current), 2) as current,
                       ROUND(SUM(power), 1) as power,
                       ROUND(SUM(energy), 4) as energy,
                       ROUND(AVG(temperature), 1) as temperature,
                       ROUND(AVG(humidity), 1) as humidity,
                       MAX(occupancy) as occupancy
                FROM energy_readings
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY timestamp
                ORDER BY timestamp ASC
            """, (start_time, end_time))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_latest_device_readings(self) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT r.*, 
                   COALESCE(d.name, replace(r.device_id, '_', ' ')) as device_name, 
                   COALESCE(d.room_id, 'living_room') as room_id, 
                   COALESCE(rm.name, 'Living Room') as room_name, 
                   COALESCE(d.rated_power, 1500.0) as rated_power, 
                   COALESCE(d.category, 'appliance') as category
            FROM energy_readings r
            LEFT JOIN devices d ON r.device_id = d.device_id
            LEFT JOIN rooms rm ON d.room_id = rm.id
            WHERE r.id IN (
                SELECT MAX(id) FROM energy_readings GROUP BY device_id
            )
            ORDER BY r.power DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]


import os as _os

# Singleton instance
_repo_instance: Optional[BaseEnergyRepository] = None

def get_repository() -> BaseEnergyRepository:
    """
    Repository factory.  Selects backend based on USE_FIREBASE env var:
      USE_FIREBASE=true  → FirebaseRepository (Firestore)
      USE_FIREBASE=false → SQLiteEnergyRepository (local file)
    """
    global _repo_instance
    if _repo_instance is None:
        if _os.getenv("USE_FIREBASE", "false").lower() == "true":
            from .firebase_repository import get_firebase_repository
            _repo_instance = get_firebase_repository()
        else:
            _repo_instance = SQLiteEnergyRepository()
    return _repo_instance
