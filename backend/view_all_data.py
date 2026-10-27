"""
ENERGY TWINS AI - SQLite Data Inspector
Usage:
  python -m backend.view_all_data
  python -m backend.view_all_data --limit 50
  python -m backend.view_all_data --device AC_LIVING
  python -m backend.view_all_data --export output.csv
"""
import sys
import argparse
import csv
from backend.database.connection import DB_PATH, get_connection

def inspect_all_data(device_filter=None, limit=20, export_path=None):
    print("=" * 80)
    print(" [ENERGY TWINS AI] - SQLITE DATABASE INSPECTOR")
    print(f" Database Path: {DB_PATH}")
    print("=" * 80)

    conn = get_connection()
    c = conn.cursor()

    # 1. Device Lookup dictionary
    c.execute("SELECT device_id, name, category, rated_power FROM devices")
    devices = {r["device_id"]: dict(r) for r in c.fetchall()}

    # 2. Overall Device & Time Summary
    print("\n[1. SUMMARY BY DEVICE & TIME RANGE]:")
    print("-" * 80)
    print(f"{'DEVICE ID':<22} | {'RECORDS':<8} | {'START TIME':<19} | {'END TIME':<19} | {'SOURCE'}")
    print("-" * 80)

    c.execute("""
        SELECT 
            device_id,
            COUNT(*) as total_records,
            MIN(timestamp) as earliest_time,
            MAX(timestamp) as latest_time,
            ROUND(SUM(energy), 2) as total_kwh,
            GROUP_CONCAT(DISTINCT data_source) as sources
        FROM energy_readings
        GROUP BY device_id
        ORDER BY total_records DESC
    """)
    summary_rows = c.fetchall()
    for row in summary_rows:
        dev_id = row["device_id"]
        rec = row["total_records"]
        start_t = row["earliest_time"] or "N/A"
        end_t = row["latest_time"] or "N/A"
        src = row["sources"] or "unknown"
        print(f"{dev_id:<22} | {rec:<8} | {start_t:<19} | {end_t:<19} | {src}")

    # 3. Detailed Data (Latest Records)
    print("\n[2. DETAILED READINGS (LATEST RECORDS)]:")
    print("-" * 80)
    print(f"{'TIMESTAMP':<19} | {'DEVICE ID':<20} | {'POWER (W)':<9} | {'ENERGY (kWh)':<12} | {'SOURCE'}")
    print("-" * 80)

    query = """
        SELECT timestamp, device_id, power, energy, voltage, current, data_source, simulation_batch_id
        FROM energy_readings
    """
    params = []
    if device_filter:
        query += " WHERE device_id = ?"
        params.append(device_filter)
    query += " ORDER BY timestamp DESC, id DESC LIMIT ?"
    params.append(limit)

    c.execute(query, params)
    readings = c.fetchall()
    for r in readings:
        ts = r["timestamp"]
        d_id = r["device_id"]
        pw = f"{r['power']:.1f} W"
        en = f"{r['energy']:.4f}"
        src = r["data_source"]
        print(f"{ts:<19} | {d_id:<20} | {pw:<9} | {en:<12} | {src}")

    # 4. Export if requested
    if export_path:
        print(f"\n[Exporting all records to {export_path}...]")
        exp_query = "SELECT id, timestamp, device_id, power, energy, voltage, current, data_source, simulation_batch_id FROM energy_readings ORDER BY timestamp ASC"
        c.execute(exp_query)
        all_rows = c.fetchall()
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "timestamp", "device_id", "power_w", "energy_kwh", "voltage_v", "current_a", "data_source", "simulation_batch_id"])
            for r in all_rows:
                writer.writerow([r["id"], r["timestamp"], r["device_id"], r["power"], r["energy"], r["voltage"], r["current"], r["data_source"], r["simulation_batch_id"]])
        print(f"[SUCCESS] Exported {len(all_rows)} rows to {export_path}")

    conn.close()
    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inspect all device and time data in SQLite")
    parser.add_argument("--device", type=str, default=None, help="Filter by specific device ID")
    parser.add_argument("--limit", type=int, default=15, help="Number of latest records to show")
    parser.add_argument("--export", type=str, default=None, help="Export entire dataset to CSV file")
    args = parser.parse_args()

    inspect_all_data(device_filter=args.device, limit=args.limit, export_path=args.export)
