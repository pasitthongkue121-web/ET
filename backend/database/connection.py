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

    conn.commit()
    conn.close()
