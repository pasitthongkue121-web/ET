import sqlite3
import os
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_PATH = DB_DIR / "energy_twins.db"

def get_db_path() -> Path:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return DB_PATH

def get_connection() -> sqlite3.Connection:
    path = get_db_path()
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        floor INTEGER DEFAULT 1,
        icon TEXT DEFAULT 'home'
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        rated_power REAL NOT NULL,
        status INTEGER DEFAULT 0,
        temperature REAL,
        category TEXT DEFAULT 'general',
        FOREIGN KEY (room_id) REFERENCES rooms(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS energy_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        device_id TEXT NOT NULL,
        voltage REAL DEFAULT 230.0,
        current REAL DEFAULT 0.0,
        power REAL DEFAULT 0.0,
        energy REAL DEFAULT 0.0,
        temperature REAL DEFAULT 25.0,
        humidity REAL DEFAULT 60.0,
        occupancy INTEGER DEFAULT 1,
        FOREIGN KEY (device_id) REFERENCES devices(device_id)
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_time ON energy_readings(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_device ON energy_readings(device_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_dev_time ON energy_readings(device_id, timestamp);")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gsheet_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # Seed default rooms if empty
    cursor.execute("SELECT COUNT(*) FROM rooms")
    if cursor.fetchone()[0] == 0:
        default_rooms = [
            ("main_panel", "Main Panel", 1, "zap"),
            ("living_room", "Living Room", 1, "sofa"),
            ("bedroom_1", "Bedroom 1", 1, "bed"),
            ("bedroom_2", "Bedroom 2", 2, "bed"),
            ("kitchen", "Kitchen", 1, "chef-hat"),
            ("bathroom", "Bathroom", 1, "shower-head"),
            ("garage", "Garage", 0, "car"),
        ]
        cursor.executemany("INSERT INTO rooms (id, name, floor, icon) VALUES (?, ?, ?, ?)", default_rooms)

    # Seed default devices if empty
    cursor.execute("SELECT COUNT(*) FROM devices")
    if cursor.fetchone()[0] == 0:
        default_devices = [
            ("circuit_lighting", "วงจรแสงสว่าง (Lighting)", "main_panel", 800.0, 0, "lighting"),
            ("circuit_receptacle", "วงจรเต้ารับ (Receptacle)", "main_panel", 2000.0, 0, "receptacle"),
            ("circuit_heavy_load", "โหลดหนัก (Heavy Load)", "main_panel", 5000.0, 0, "heavy_load"),
            ("circuit_solar", "Solar PV (On-Grid)", "main_panel", 5000.0, 0, "solar"),
        ]
        cursor.executemany("""
            INSERT INTO devices (device_id, name, room_id, rated_power, status, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, default_devices)

    # Sanitize any legacy negative ratings or readings
    cursor.execute("UPDATE devices SET rated_power = 5000.0 WHERE device_id = 'circuit_solar' AND rated_power < 0;")
    cursor.execute("UPDATE energy_readings SET power = ABS(power), energy = ABS(energy) WHERE power < 0 OR energy < 0;")

    conn.commit()
    conn.close()
