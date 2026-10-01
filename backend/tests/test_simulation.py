import unittest
from backend.services.simulation_service import simulation_service
from backend.database.models import (
    SimulationParameters,
    ScenarioScoreWeights
)
from backend.database.connection import get_connection

class TestSimulationService(unittest.TestCase):
    def test_database_immutability(self):
        """
        Verify that running simulations does not alter any row in SQLite energy_readings table.
        """
        conn = get_connection()
        count_before = conn.execute("SELECT COUNT(*) as cnt FROM energy_readings").fetchone()["cnt"]
        conn.close()

        # Run simulation
        params = SimulationParameters(
            ac_device_id="AC_LIVING",
            ac_target_temp=26.0,
            standby_reduction_w=20.0
        )
        res = simulation_service.run_simulation(params)
        self.assertIsNotNone(res.simulation_id)

        conn = get_connection()
        count_after = conn.execute("SELECT COUNT(*) as cnt FROM energy_readings").fetchone()["cnt"]
        conn.close()

        self.assertEqual(count_before, count_after, "Database records were modified by simulation!")

    def test_ac_temperature_simulation(self):
        """
        Raising AC from 24°C to 26°C should mathematically reduce energy and cost.
        """
        params_base = SimulationParameters(ac_target_temp=24.0, scenario_name="Base 24C")
        res_base = simulation_service.run_simulation(params_base)

        params_eco = SimulationParameters(ac_target_temp=26.0, scenario_name="Eco 26C")
        res_eco = simulation_service.run_simulation(params_eco)

        self.assertLess(res_eco.simulated_monthly_kwh, res_base.simulated_monthly_kwh)
        self.assertGreater(res_eco.energy_saving_kwh, 0.0)
        self.assertGreater(res_eco.cost_saving_thb, 0.0)
        self.assertIn(res_eco.confidence_level, ["High", "Medium"])
        self.assertEqual(res_eco.tag, "SIMULATED")

    def test_schedule_shift_simulation(self):
        """
        Shortening AC runtime should reduce active hours and peak load.
        """
        params = SimulationParameters(
            ac_device_id="AC_LIVING",
            ac_start_hour=19,
            ac_end_hour=21, # only 2 hours instead of typical 5 hours
            scenario_name="Short Schedule"
        )
        res = simulation_service.run_simulation(params)
        self.assertGreater(res.energy_saving_kwh, 0.0)

        # Check runtime comparison
        ac_runtime = next((d for d in res.device_runtime_comparison if d["device_id"] == "AC_LIVING"), None)
        self.assertIsNotNone(ac_runtime)
        self.assertLess(ac_runtime["simulated_hours"], ac_runtime["baseline_hours"])

    def test_equipment_replacement_simulation(self):
        """
        Replacing 1500W AC with 1000W Inverter should reduce consumption.
        """
        params = SimulationParameters(
            device_power_overrides={"AC_LIVING": 1000.0},
            scenario_name="Inverter Upgrade"
        )
        res = simulation_service.run_simulation(params)
        self.assertGreater(res.energy_saving_kwh, 0.0)
        self.assertGreater(res.peak_reduction_kw, 0.0)

    def test_templates_and_scenarios(self):
        templates = simulation_service.get_templates()
        self.assertGreaterEqual(len(templates), 5)
        template_ids = [t.id for t in templates]
        self.assertIn("template_ac_26", template_ids)
        self.assertIn("template_inverter_upgrade", template_ids)

        table = simulation_service.get_scenarios()
        self.assertGreaterEqual(len(table.scenarios), 3)

    def test_scenario_scoring_and_recommendation(self):
        scores = simulation_service.score_scenarios()
        self.assertGreater(len(scores), 0)
        for s in scores:
            self.assertGreater(s.total_score, 0.0)
            self.assertLessEqual(s.total_score, 100.0)

        rec = simulation_service.get_ai_recommendation()
        self.assertIsNotNone(rec.recommended_scenario_id)
        self.assertGreater(len(rec.justification_points), 0)
        self.assertEqual(rec.tag, "RECOMMENDED")

if __name__ == '__main__':
    unittest.main()
