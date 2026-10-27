from backend.database.connection import DB_PATH, get_connection

def inspect():
    print(f"Database File: {DB_PATH}")
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print(f"Tables ({len(tables)}):")
    for t in tables:
        c.execute(f"SELECT COUNT(*) FROM {t}")
        cnt = c.fetchone()[0]
        print(f"  - {t}: {cnt} rows")
    
    print("\nSample records in 'energy_readings' (latest 3):")
    c.execute("SELECT id, timestamp, device_id, power, energy, data_source, simulation_batch_id FROM energy_readings ORDER BY id DESC LIMIT 3")
    for r in c.fetchall():
        print("   ", dict(r))
    conn.close()

if __name__ == "__main__":
    inspect()
