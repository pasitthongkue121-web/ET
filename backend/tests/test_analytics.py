import unittest
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.ai.analytics import analytics_engine
from backend.config import settings

class TestEnergyAnalytics(unittest.TestCase):
    def setUp(self):
        self.engine = analytics_engine

    def test_summary_calculation(self):
        summary = self.engine.compute_summary(days=30)
        self.assertIn("total_energy_kwh", summary)
        self.assertIn("avg_power_w", summary)
        self.assertIn("max_power_w", summary)
        self.assertIn("total_cost_thb", summary)
        self.assertIn("total_co2_kg", summary)

        # Check reasonable positive values
        self.assertGreater(summary["total_energy_kwh"], 0.0)
        self.assertGreater(summary["avg_power_w"], 0.0)
        self.assertGreater(summary["max_power_w"], summary["avg_power_w"])
        self.assertEqual(summary["electricity_rate"], settings.ELECTRICITY_RATE)
        self.assertAlmostEqual(
            summary["total_cost_thb"],
            round(summary["total_energy_kwh"] * settings.ELECTRICITY_RATE, 2),
            places=1
        )

    def test_daily_energy(self):
        daily = self.engine.compute_daily(days=7)
        self.assertTrue(len(daily) > 0)
        for item in daily:
            self.assertIn("date", item)
            self.assertGreater(item["energy_kwh"], 0)
            self.assertGreater(item["cost_thb"], 0)
            self.assertGreater(item["peak_power_w"], item["avg_power_w"])

    def test_device_breakdown(self):
        devices = self.engine.compute_devices(days=30)
        self.assertTrue(len(devices) > 0)
        total_pct = sum(d["percentage"] for d in devices)
        self.assertAlmostEqual(total_pct, 100.0, delta=2.0)
        for d in devices:
            self.assertIn("device_id", d)
            self.assertIn("name", d)
            self.assertGreaterEqual(d["runtime_hours"], 0)

    def test_co2_emission(self):
        co2_data = self.engine.compute_co2(days=30)
        self.assertGreater(co2_data["total_co2_kg"], 0)
        self.assertGreater(co2_data["tree_offset_equivalent"], 0)
        self.assertEqual(co2_data["co2_factor"], settings.CO2_EMISSION_FACTOR)

if __name__ == "__main__":
    unittest.main()
