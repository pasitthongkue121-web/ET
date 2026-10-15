import os
import sys
import unittest
from datetime import datetime, timedelta

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class TestPipelineHubSimulation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from backend.database.connection import init_db
        init_db()

    def test_01_circuits_support_all_5_categories(self):
        from backend.services.esp32_simulator_service import esp32_simulator
        circuits = esp32_simulator.get_supported_circuits()
        self.assertEqual(len(circuits), 5, "Expected 5 electrical circuits")
        cids = [c["circuit_id"] for c in circuits]
        cats = [c["category"] for c in circuits]
        
        self.assertIn("circuit_lighting", cids)
        self.assertIn("circuit_receptacle", cids)
        self.assertIn("circuit_heavy_load", cids)
        self.assertIn("circuit_ev", cids)
        self.assertIn("circuit_solar", cids)

        self.assertIn("lighting", cats)
        self.assertIn("receptacle", cats)
        self.assertIn("heavy_load", cats)
        self.assertIn("ev", cats)
        self.assertIn("solar", cats)
        print(" Test 1: All 5 electrical categories verified (Lighting, Outlets, Heavy Loads, EV, Solar)")

    def test_02_daily_weekly_monthly_preview(self):
        from backend.api.gsheet_ingest import preview_simulation_data, PipelineSimPreviewRequest
        
        # 1. Daily (24h)
        req_daily = PipelineSimPreviewRequest(period="daily", interval_minutes=15)
        res_daily = preview_simulation_data(req_daily)
        self.assertEqual(res_daily["status"], "success")
        self.assertEqual(res_daily["data_source"], "simulated")
        self.assertTrue(res_daily["simulation_mode"])
        self.assertIn("sim_batch_", res_daily["batch_id"])
        # In 24h at 15m intervals: 24 * 4 + 1 = 97 steps * 5 circuits = 485 records
        self.assertGreaterEqual(res_daily["summary"]["total_records"], 400)
        self.assertGreater(res_daily["summary"]["estimated_consumption_kwh"], 0.0)
        self.assertGreater(res_daily["summary"]["estimated_generation_kwh"], 0.0)
        self.assertGreater(res_daily["summary"]["peak_watts"], 0.0)
        self.assertEqual(len(res_daily["sample_preview"]), 12)
        
        # Every sample row has data_source="simulated"
        for row in res_daily["sample_preview"]:
            self.assertEqual(row["data_source"], "simulated")
            self.assertEqual(row["simulation_batch_id"], res_daily["batch_id"])

        # 2. Weekly (7d)
        req_weekly = PipelineSimPreviewRequest(period="weekly", interval_minutes=60)
        res_weekly = preview_simulation_data(req_weekly)
        self.assertEqual(res_weekly["status"], "success")
        self.assertGreater(res_weekly["summary"]["estimated_consumption_kwh"], res_daily["summary"]["estimated_consumption_kwh"])

        # 3. Monthly (30d)
        req_monthly = PipelineSimPreviewRequest(period="monthly", interval_minutes=60)
        res_monthly = preview_simulation_data(req_monthly)
        self.assertEqual(res_monthly["status"], "success")
        self.assertGreater(res_monthly["summary"]["estimated_consumption_kwh"], res_weekly["summary"]["estimated_consumption_kwh"])
        print(" Test 2: Daily, Weekly, and Monthly previews generated and verified accurately")

    def test_03_device_filtering_in_preview(self):
        from backend.api.gsheet_ingest import preview_simulation_data, PipelineSimPreviewRequest
        
        # Test preview with only EV and Solar
        req = PipelineSimPreviewRequest(
            devices=["circuit_ev", "circuit_solar"],
            period="daily",
            interval_minutes=15
        )
        res = preview_simulation_data(req)
        self.assertEqual(res["summary"]["circuits_count"], 2)
        devs_in_sample = set(r["device_id"] for r in res["sample_preview"])
        self.assertTrue(devs_in_sample.issubset({"circuit_ev", "circuit_solar"}))
        print(" Test 3: Device selection filtering affects dataset correctly")

    def test_04_transmission_to_database_persistence(self):
        from backend.api.gsheet_ingest import transmit_simulation_data, PipelineSimTransmitRequest
        from backend.database.connection import get_connection
        
        req = PipelineSimTransmitRequest(
            devices=["circuit_lighting", "circuit_receptacle", "circuit_heavy_load", "circuit_ev", "circuit_solar"],
            period="daily",
            interval_minutes=30
        )
        res = transmit_simulation_data(req)
        self.assertEqual(res["status"], "success")
        self.assertGreater(res["records_transmitted"], 0)
        self.assertEqual(res["records_failed"], 0)
        batch_id = res["batch_id"]

        # Verify records exist in database with correct provenance
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM energy_readings WHERE simulation_batch_id = ?", (batch_id,))
        count = cursor.fetchone()[0]
        self.assertEqual(count, res["records_transmitted"])

        cursor.execute("SELECT DISTINCT data_source FROM energy_readings WHERE simulation_batch_id = ?", (batch_id,))
        sources = [r[0] for r in cursor.fetchall()]
        self.assertEqual(sources, ["simulated"])

        # Verify all 5 circuits are present in the batch
        cursor.execute("SELECT DISTINCT device_id FROM energy_readings WHERE simulation_batch_id = ?", (batch_id,))
        devices_in_db = set(r[0] for r in cursor.fetchall())
        self.assertEqual(devices_in_db, {"circuit_lighting", "circuit_receptacle", "circuit_heavy_load", "circuit_ev", "circuit_solar"})
        conn.close()
        print(f" Test 4: Transmission persisted {count} records into SQLite with data_source='simulated' (Batch: {batch_id})")

    def test_05_real_data_protection(self):
        from backend.database.connection import get_connection
        from backend.database.repository import SQLiteEnergyRepository
        repo = SQLiteEnergyRepository()
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Ingest a real reading (simulating real ESP32 hardware with valid auth)
        repo.insert_reading({
            "device_id": "esp32_hardware_meter_01",
            "timestamp": now_str,
            "voltage": 229.5,
            "current": 4.5,
            "power": 1032.0,
            "energy": 1.25,
            "data_source": "real",
            "validation_status": "verified_real"
        })

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT data_source, validation_status FROM energy_readings WHERE device_id = 'esp32_hardware_meter_01'")
        row = cursor.fetchone()
        self.assertEqual(row[0], "real")
        self.assertEqual(row[1], "verified_real")
        conn.close()
        print(" Test 5: Real-data protection verified (real hardware data remains strictly identifiable)")

if __name__ == "__main__":
    unittest.main()
