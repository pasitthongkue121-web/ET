import math
import random
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.database.connection import init_db, get_connection
from backend.database.repository import SQLiteEnergyRepository

ROOMS = [
    {"id": "living_room", "name": "Living Room", "floor": 1, "icon": "sofa"},
    {"id": "bedroom", "name": "Master Bedroom", "floor": 2, "icon": "bed"},
    {"id": "kitchen", "name": "Kitchen", "floor": 1, "icon": "utensils"},
    {"id": "study", "name": "Study / Home Office", "floor": 2, "icon": "laptop"},
]

DEVICES = [
    {
        "device_id": "AC_LIVING",
        "name": "Living Room Air Conditioner",
        "room_id": "living_room",
        "rated_power": 1500.0,
        "category": "hvac",
        "standby_power": 4.5,
    },
    {
        "device_id": "AC_BEDROOM",
        "name": "Bedroom Air Conditioner",
        "room_id": "bedroom",
        "rated_power": 1200.0,
        "category": "hvac",
        "standby_power": 3.8,
    },
    {
        "device_id": "TV_LIVING",
        "name": "Smart TV 65\"",
        "room_id": "living_room",
        "rated_power": 130.0,
        "category": "entertainment",
        "standby_power": 2.2,
    },
    {
        "device_id": "PC_STUDY",
        "name": "Workstation Computer",
        "room_id": "study",
        "rated_power": 350.0,
        "category": "computing",
        "standby_power": 5.0,
    },
    {
        "device_id": "FRIDGE_KITCHEN",
        "name": "Inverter Refrigerator",
        "room_id": "kitchen",
        "rated_power": 160.0,
        "category": "appliance",
        "standby_power": 35.0,
    },
    {
        "device_id": "MICROWAVE_KITCHEN",
        "name": "Microwave Oven",
        "room_id": "kitchen",
        "rated_power": 1050.0,
        "category": "appliance",
        "standby_power": 1.5,
    },
    {
        "device_id": "LIGHTS_LIVING",
        "name": "Living Room Lighting",
        "room_id": "living_room",
        "rated_power": 65.0,
        "category": "lighting",
        "standby_power": 0.0,
    },
    {
        "device_id": "LIGHTS_BEDROOM",
        "name": "Bedroom Lighting",
        "room_id": "bedroom",
        "rated_power": 45.0,
        "category": "lighting",
        "standby_power": 0.0,
    },
]

def get_ambient_temperature(dt: datetime) -> float:
    # Bangkok / Tropical daylight temperature model (min 26°C at 05:00, max 34.5°C at 14:00)
    hour = dt.hour + dt.minute / 60.0
    # Peak at 14:00 (2 PM)
    temp = 26.0 + 8.5 * math.sin(math.pi * ((hour - 5.0) % 24) / 18.0)
    noise = random.gauss(0, 0.4)
    return round(max(24.0, min(37.0, temp + noise)), 1)

def get_ambient_humidity(dt: datetime, temp: float) -> float:
    # Inverse relationship with temperature: highest humidity before dawn
    base_hum = 85.0 - (temp - 25.0) * 3.5
    noise = random.gauss(0, 1.5)
    return round(max(45.0, min(95.0, base_hum + noise)), 1)

def is_occupied(dt: datetime) -> bool:
    is_weekend = dt.weekday() >= 5
    hour = dt.hour + dt.minute / 60.0
    if is_weekend:
        # On weekends, occupant is mostly home except maybe quick trips (13:00 - 16:00 random)
        return not (13.0 <= hour <= 16.0 and random.random() < 0.4)
    else:
        # Weekdays: leave at 08:00, back at 18:00
        if 8.0 <= hour < 17.75:
            return False
        return True

def simulate_device_power(dev: dict, dt: datetime, occupied: bool, ambient_temp: float) -> float:
    dev_id = dev["device_id"]
    rated = dev["rated_power"]
    standby = dev["standby_power"]
    hour = dt.hour + dt.minute / 60.0
    is_weekend = dt.weekday() >= 5

    # 1. Inverter Refrigerator runs 24/7 with compressor duty cycles
    if dev_id == "FRIDGE_KITCHEN":
        # Compressor cycles: on for 20 mins, off for 20 mins
        cycle_minute = (dt.hour * 60 + dt.minute) % 45
        if cycle_minute < 22:
            # Compressor running (higher in hot afternoon)
            temp_factor = 1.0 + max(0, ambient_temp - 30.0) * 0.03
            return (rated * 0.75 * temp_factor) + random.gauss(0, 4)
        else:
            return standby + random.gauss(0, 1.5)

    # If house is not occupied, everything else goes to standby
    if not occupied:
        return standby + max(0, random.gauss(0, 0.3))

    # 2. Living Room AC (Active 18:00 - 23:00 on weekdays, 12:00 - 23:00 on weekends)
    if dev_id == "AC_LIVING":
        ac_active = False
        if is_weekend and 12.0 <= hour <= 23.0:
            ac_active = True
        elif 18.0 <= hour <= 23.0:
            ac_active = True

        if ac_active:
            # Thermostat modulation: high initially, then modulates around 55-80% of rated
            cooling_demand = 0.65 + max(0, ambient_temp - 28.0) * 0.04
            return min(rated, (rated * cooling_demand) + random.gauss(0, 30))
        return standby

    # 3. Bedroom AC (Active 22:30 - 06:45 for sleeping)
    if dev_id == "AC_BEDROOM":
        if hour >= 22.5 or hour < 6.75:
            # Night sleep mode: efficient compressor modulation
            load = 0.55 + random.gauss(0, 0.05)
            return min(rated, rated * max(0.4, load))
        return standby

    # 4. Smart TV (19:00 - 22:15)
    if dev_id == "TV_LIVING":
        if 18.75 <= hour <= 22.25:
            return rated * 0.9 + random.gauss(0, 5)
        elif is_weekend and 14.0 <= hour <= 17.0 and random.random() < 0.6:
            return rated * 0.9 + random.gauss(0, 5)
        return standby

    # 5. Workstation PC (20:00 - 23:30 or weekend afternoon)
    if dev_id == "PC_STUDY":
        if 19.75 <= hour <= 23.5:
            # High compute load / gaming / work
            load = 0.65 + random.random() * 0.3
            return rated * load + random.gauss(0, 10)
        elif is_weekend and 10.0 <= hour <= 18.0 and random.random() < 0.5:
            return rated * 0.5 + random.gauss(0, 10)
        return standby

    # 6. Microwave Oven (Brief morning 06:45-07:30 or dinner 18:30-19:30)
    if dev_id == "MICROWAVE_KITCHEN":
        is_breakfast = 6.75 <= hour <= 7.5
        is_dinner = 18.5 <= hour <= 19.5
        # Intermittent 5-10% probability of heating something in this 15-min bucket
        if (is_breakfast and random.random() < 0.25) or (is_dinner and random.random() < 0.35):
            # Running for e.g. 3-5 mins out of 15 mins = average power ~250-400W
            return rated * 0.35 + random.gauss(0, 15)
        return standby

    # 7. Living Room Lighting (18:00 - 22:30)
    if dev_id == "LIGHTS_LIVING":
        if 18.0 <= hour <= 22.5:
            return rated + random.gauss(0, 1.5)
        return 0.0

    # 8. Bedroom Lighting (06:30 - 07:15 and 22:00 - 23:00)
    if dev_id == "LIGHTS_BEDROOM":
        if (6.5 <= hour <= 7.25) or (22.0 <= hour <= 23.0):
            return rated + random.gauss(0, 1.0)
        return 0.0

    return standby


def generate_synthetic_data(days: int = 30):
    print(f"[*] Initializing Database schema...")
    init_db()

    conn = get_connection()
    cursor = conn.cursor()

    # Seed Rooms
    for r in ROOMS:
        cursor.execute(
            "INSERT OR REPLACE INTO rooms (id, name, floor, icon) VALUES (?, ?, ?, ?)",
            (r["id"], r["name"], r["floor"], r["icon"])
        )

    # Seed Devices
    for d in DEVICES:
        cursor.execute("""
            INSERT OR REPLACE INTO devices 
            (device_id, name, room_id, rated_power, status, temperature, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            d["device_id"],
            d["name"],
            d["room_id"],
            d["rated_power"],
            0,
            25.0,
            d["category"]
        ))

    conn.commit()

    # Clear old readings to allow clean rebuild
    cursor.execute("DELETE FROM energy_readings")
    conn.commit()

    print(f"[*] Generating {days} days of synthetic energy readings (15-min intervals)...")
    end_time = datetime.now().replace(minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(days=days)

    interval_minutes = 15
    current_time = start_time
    total_steps = int((days * 24 * 60) / interval_minutes)
    
    step = 0
    batch = []
    total_records = 0

    while current_time <= end_time:
        occupied = is_occupied(current_time)
        ambient_temp = get_ambient_temperature(current_time)
        ambient_hum = get_ambient_humidity(current_time, ambient_temp)
        time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")

        # Slight grid voltage variance
        grid_voltage = round(228.0 + random.gauss(0, 2.5), 1)

        for dev in DEVICES:
            power_w = simulate_device_power(dev, current_time, occupied, ambient_temp)
            power_w = max(0.0, round(power_w, 1))

            # Energy in kWh for this 15-min interval = (Power in W / 1000) * (15 / 60)
            energy_kwh = round((power_w / 1000.0) * (interval_minutes / 60.0), 4)
            current_amp = round(power_w / grid_voltage, 2) if grid_voltage > 0 else 0.0

            # Internal device temperature
            dev_temp = ambient_temp
            if "AC" in dev["device_id"]:
                dev_temp = 25.0 if power_w > 100 else ambient_temp
            elif "FRIDGE" in dev["device_id"]:
                dev_temp = 4.0

            batch.append({
                "timestamp": time_str,
                "device_id": dev["device_id"],
                "voltage": grid_voltage,
                "current": current_amp,
                "power": power_w,
                "energy": energy_kwh,
                "temperature": dev_temp,
                "humidity": ambient_hum,
                "occupancy": 1 if occupied else 0
            })

        if len(batch) >= 2000:
            cursor.executemany("""
                INSERT INTO energy_readings 
                (timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy)
                VALUES (:timestamp, :device_id, :voltage, :current, :power, :energy, :temperature, :humidity, :occupancy)
            """, batch)
            conn.commit()
            total_records += len(batch)
            batch = []

        current_time += timedelta(minutes=interval_minutes)
        step += 1

    if batch:
        cursor.executemany("""
            INSERT INTO energy_readings 
            (timestamp, device_id, voltage, current, power, energy, temperature, humidity, occupancy)
            VALUES (:timestamp, :device_id, :voltage, :current, :power, :energy, :temperature, :humidity, :occupancy)
        """, batch)
        conn.commit()
        total_records += len(batch)

    # Update latest device status in devices table
    cursor.execute("SELECT MAX(timestamp) FROM energy_readings")
    latest_ts = cursor.fetchone()[0]
    cursor.execute("""
        SELECT device_id, power, temperature 
        FROM energy_readings 
        WHERE timestamp = ?
    """, (latest_ts,))
    for dev_id, p, t in cursor.fetchall():
        status = 1 if p > 5.0 else 0
        cursor.execute("UPDATE devices SET status = ?, temperature = ? WHERE device_id = ?", (status, t, dev_id))

    conn.commit()
    conn.close()

    print(f"[+] Successfully seeded {total_records} records over {days} days!")
    print(f"[+] Latest timestamp in DB: {latest_ts}")

if __name__ == "__main__":
    generate_synthetic_data(30)
