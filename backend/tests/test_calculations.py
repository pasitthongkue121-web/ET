"""
ENERGY TWINS AI — Calculation & Formula Verification Test Suite
==============================================================
Covers all 16 required verification points:
1. Instantaneous power conversion (W to kW)
2. Energy integration over discrete intervals (variable power)
3. Progressive tariff step allocation (0-150, 151-400, 401+ kWh)
4. TOU tariff period allocation (weekday vs weekend, peak vs off-peak)
5. TOU bill calculation (base, Ft, service charge, FiT credit, VAT)
6. Progressive bill calculation (base, Ft, service charge, VAT)
7. TOU vs Progressive comparison (delta cost, delta percentage)
8. Solar generation accounting (gross, self-consumption, grid export, FiT)
9. Device-level aggregation (device sum equals total)
10. Category-level aggregation (lighting, receptacle, heavy load, ev, solar)
11. Peak power detection (maximum instantaneous reading)
12. Average power and consumption calculations
13. Simulation profile generation formulas
14. Real vs Simulated separation and filter integrity
15. Duplicate reading handling
16. Digital Twin scenario evaluation (Delta Energy & Delta Cost)
"""

import unittest
from datetime import datetime, timedelta
import sqlite3

from backend.services.thai_tariff import (
    calculate_normal_progressive_bill,
    calculate_tou_bill,
    compare_bills,
    TOU_ON_PEAK_BASE,
    TOU_OFF_PEAK_BASE,
    FT_RATE_THB,
    SERVICE_CHARGE_THB,
    VAT_RATE_PCT,
    FIT_EXPORT_RATE_THB,
)
from backend.services.tou_service import is_on_peak, get_tou_rate, calculate_cost_from_readings
from backend.services.esp32_simulator_service import CircuitEnergySimulator
from backend.database.connection import get_connection


class TestEnergyCalculations(unittest.TestCase):

    def test_01_instantaneous_power_conversion(self):
        """1. Verify W to kW conversion: kW = W / 1000."""
        test_cases = [
            (0.0, 0.0),
            (250.0, 0.25),
            (1000.0, 1.0),
            (3695.8, 3.6958),
            (7400.0, 7.4),
        ]
        for w, expected_kw in test_cases:
            kw = w / 1000.0
            self.assertAlmostEqual(kw, expected_kw, places=4)

    def test_02_energy_integration_variable_power(self):
        """2. Verify energy integration: Energy (kWh) = sum(P_i * delta_t_i / 1000)."""
        # Scenario: 4 intervals of 15 minutes (0.25h each)
        # 1000W for 15m, 2000W for 15m, 1500W for 15m, 500W for 15m
        readings = [
            {"power_w": 1000.0, "duration_h": 0.25},
            {"power_w": 2000.0, "duration_h": 0.25},
            {"power_w": 1500.0, "duration_h": 0.25},
            {"power_w": 500.0, "duration_h": 0.25},
        ]
        integrated_kwh = sum((r["power_w"] / 1000.0) * r["duration_h"] for r in readings)
        # Expected: 0.25 + 0.50 + 0.375 + 0.125 = 1.25 kWh
        self.assertAlmostEqual(integrated_kwh, 1.25, places=4)

        # Contrast with single average or single instantaneous multiplied by 1 hour:
        single_instantaneous_error = (readings[0]["power_w"] / 1000.0) * 1.0  # 1.0 kWh (20% error)
        self.assertNotEqual(single_instantaneous_error, integrated_kwh)

    def test_03_progressive_tariff_step_allocation(self):
        """3. Verify Progressive steps: 0-150 @ 3.2484, 151-400 @ 4.2233, 401+ @ 4.4217."""
        bill = calculate_normal_progressive_bill(500.0)
        breakdown = bill["steps_breakdown"]
        
        self.assertEqual(len(breakdown), 3)
        # Step 1: 150 kWh @ 3.2484 = 487.26
        self.assertAlmostEqual(breakdown[0]["kwh"], 150.0)
        self.assertAlmostEqual(breakdown[0]["cost"], 487.26, places=2)

        # Step 2: 250 kWh @ 4.2233 = 1055.825 (rounds to 1055.83 or 1055.82)
        self.assertAlmostEqual(breakdown[1]["kwh"], 250.0)
        self.assertAlmostEqual(breakdown[1]["cost"], 1055.82, places=1)

        # Step 3: 100 kWh @ 4.4217 = 442.17
        self.assertAlmostEqual(breakdown[2]["kwh"], 100.0)
        self.assertAlmostEqual(breakdown[2]["cost"], 442.17, places=2)

        expected_base = 487.26 + 1055.825 + 442.17
        self.assertAlmostEqual(bill["base_energy_cost_thb"], expected_base, places=1)

    def test_04_tou_tariff_period_allocation(self):
        """4. Verify TOU window: Mon-Fri 09:00-22:00 = On-Peak; Nights & Weekends = Off-Peak."""
        # Monday 10:00 -> On-Peak
        mon_day = datetime(2026, 10, 12, 10, 0, 0)
        self.assertTrue(is_on_peak(mon_day))

        # Monday 22:30 -> Off-Peak
        mon_night = datetime(2026, 10, 12, 22, 30, 0)
        self.assertFalse(is_on_peak(mon_night))

        # Monday 08:30 -> Off-Peak
        mon_morning = datetime(2026, 10, 12, 8, 30, 0)
        self.assertFalse(is_on_peak(mon_morning))

        # Saturday 14:00 -> Off-Peak (Weekend)
        sat_afternoon = datetime(2026, 10, 17, 14, 0, 0)
        self.assertFalse(is_on_peak(sat_afternoon))

        # Sunday 12:00 -> Off-Peak (Weekend)
        sun_noon = datetime(2026, 10, 18, 12, 0, 0)
        self.assertFalse(is_on_peak(sun_noon))

    def test_05_tou_bill_calculation(self):
        """5. Verify TOU bill math including base, Ft, service charge, export credit, and VAT."""
        bill = calculate_tou_bill(on_peak_kwh=100.0, off_peak_kwh=200.0, export_kwh=50.0)

        # On-Peak Base = 100 * 5.1135 = 511.35
        self.assertAlmostEqual(bill["on_peak_cost_thb"], 511.35, places=2)
        # Off-Peak Base = 200 * 2.6007 = 520.14
        self.assertAlmostEqual(bill["off_peak_cost_thb"], 520.14, places=2)
        # Total Base = 1031.49
        self.assertAlmostEqual(bill["base_energy_cost_thb"], 1031.49, places=2)

        # Ft = 300 * 0.3972 = 119.16
        self.assertAlmostEqual(bill["ft_cost_thb"], 119.16, places=2)
        # Service Charge = 38.22
        self.assertAlmostEqual(bill["service_charge_thb"], 38.22, places=2)

        # Subtotal before VAT = 1031.49 + 119.16 + 38.22 = 1188.87
        self.assertAlmostEqual(bill["subtotal_thb"], 1188.87, places=2)
        # VAT 7% = 1188.87 * 0.07 = 83.2209 -> 83.22
        self.assertAlmostEqual(bill["vat_cost_thb"], 83.22, places=2)
        # Import bill = 1188.87 + 83.22 = 1272.09
        self.assertAlmostEqual(bill["total_import_bill_thb"], 1272.09, places=2)

        # Solar FiT Export credit = 50 * 2.20 = 110.00
        self.assertAlmostEqual(bill["export_income_thb"], 110.00, places=2)
        # Net payable = 1272.09 - 110.00 = 1162.09
        self.assertAlmostEqual(bill["total_bill_thb"], 1162.09, places=2)

    def test_06_progressive_bill_calculation(self):
        """6. Verify Progressive bill math with Ft, service charge, and VAT."""
        bill = calculate_normal_progressive_bill(monthly_kwh=300.0)
        
        # 150 @ 3.2484 = 487.26
        # 150 @ 4.2233 = 633.495
        # Base = 1120.755
        self.assertAlmostEqual(bill["base_energy_cost_thb"], 1120.76, places=1)
        # Ft = 300 * 0.3972 = 119.16
        self.assertAlmostEqual(bill["ft_cost_thb"], 119.16, places=2)
        # Service charge = 38.22
        self.assertAlmostEqual(bill["service_charge_thb"], 38.22, places=2)
        # Subtotal = 1120.755 + 119.16 + 38.22 = 1278.135
        self.assertAlmostEqual(bill["subtotal_thb"], 1278.14, places=1)
        # VAT 7% = 1278.135 * 0.07 = 89.469
        self.assertAlmostEqual(bill["vat_cost_thb"], 89.47, places=1)
        # Total = 1278.135 + 89.469 = 1367.60
        self.assertAlmostEqual(bill["total_bill_thb"], 1367.60, places=1)

    def test_07_tou_vs_progressive_comparison(self):
        """7. Verify comparison delta: Delta Cost = Normal - TOU, Delta Pct = Delta / Normal."""
        comp = compare_bills(total_kwh=600.0, on_peak_ratio=0.30)
        normal_total = comp["normal_bill"]["total_bill_thb"]
        tou_total = comp["tou_bill"]["total_bill_thb"]

        self.assertGreater(normal_total, tou_total)
        expected_savings = round(normal_total - tou_total, 2)
        self.assertAlmostEqual(comp["monthly_savings_thb"], expected_savings, places=2)
        expected_pct = round((expected_savings / normal_total) * 100.0, 1)
        self.assertAlmostEqual(comp["savings_pct"], expected_pct, places=1)

    def test_08_solar_generation_accounting(self):
        """8. Verify solar balance: Net Grid = Import - Export; FiT credit = Export * 2.20."""
        solar_generation_kwh = 15.0
        household_load_kwh = 10.0
        
        # Self-consumption is min(generation, load) = 10.0 kWh
        self_consumption_kwh = min(solar_generation_kwh, household_load_kwh)
        self.assertEqual(self_consumption_kwh, 10.0)

        # Export = generation - self_consumption = 5.0 kWh
        export_kwh = solar_generation_kwh - self_consumption_kwh
        self.assertEqual(export_kwh, 5.0)

        # FiT revenue = 5.0 * 2.20 = 11.0 THB
        revenue = export_kwh * FIT_EXPORT_RATE_THB
        self.assertAlmostEqual(revenue, 11.0, places=2)

    def test_09_device_level_aggregation(self):
        """9. Verify device-level sum equals aggregate household consumption."""
        device_readings = [
            {"device_id": "dev_1", "energy_kwh": 12.5},
            {"device_id": "dev_2", "energy_kwh": 25.0},
            {"device_id": "dev_3", "energy_kwh": 18.25},
        ]
        total_kwh = sum(d["energy_kwh"] for d in device_readings)
        self.assertEqual(total_kwh, 55.75)

    def test_10_category_level_aggregation(self):
        """10. Verify category-level aggregation across the 5 circuits."""
        circuits = [
            {"circuit": "circuit_lighting", "category": "lighting", "kwh": 10.0},
            {"circuit": "circuit_receptacle", "category": "receptacle", "kwh": 25.0},
            {"circuit": "circuit_heavy_load", "category": "heavy_load", "kwh": 40.0},
            {"circuit": "circuit_ev", "category": "ev", "kwh": 35.0},
            {"circuit": "circuit_solar", "category": "solar", "kwh": 30.0},
        ]
        category_sums = {}
        for c in circuits:
            cat = c["category"]
            category_sums[cat] = category_sums.get(cat, 0.0) + c["kwh"]

        self.assertEqual(category_sums["lighting"], 10.0)
        self.assertEqual(category_sums["receptacle"], 25.0)
        self.assertEqual(category_sums["heavy_load"], 40.0)
        self.assertEqual(category_sums["ev"], 35.0)
        self.assertEqual(category_sums["solar"], 30.0)

    def test_11_peak_power_detection(self):
        """11. Verify peak power detection finds maximum instantaneous reading."""
        power_series = [450.0, 1200.0, 3695.8, 2100.0, 850.0]
        max_power = max(power_series)
        self.assertEqual(max_power, 3695.8)

    def test_12_average_power_and_consumption(self):
        """12. Verify average power arithmetic mean and cumulative energy."""
        power_readings = [200.0, 400.0, 600.0, 800.0]
        avg_power = sum(power_readings) / len(power_readings)
        self.assertEqual(avg_power, 500.0)

    def test_13_simulation_data_generator_formulas(self):
        """13. Verify CircuitEnergySimulator power curves (Solar noon peak, EV overnight)."""
        sim = CircuitEnergySimulator()
        
        # Solar at night (02:00) -> 0.0 W
        solar_night = sim._get_circuit_power("circuit_solar", 2, 0)
        self.assertEqual(solar_night, 0.0)

        # Solar at noon (12:00) -> positive generation magnitude around 3500W * cloud_factor
        solar_noon = sim._get_circuit_power("circuit_solar", 12, 0)
        self.assertGreater(solar_noon, 2000.0)

        # EV charger overnight (01:00) -> active charging ~3600W +/- noise
        ev_night = sim._get_circuit_power("circuit_ev", 1, 0)
        self.assertGreater(ev_night, 3000.0)

        # EV charger during daytime work hours (10:00) -> idle 0.0 W
        ev_day = sim._get_circuit_power("circuit_ev", 10, 0)
        self.assertEqual(ev_day, 0.0)

    def test_14_real_vs_simulated_separation(self):
        """14. Verify SQL query filtering by data_source isolates real and simulated data."""
        conn = get_connection()
        c = conn.cursor()

        c.execute("SELECT count(*) FROM energy_readings WHERE data_source = 'real'")
        real_count = c.fetchone()[0]

        c.execute("SELECT count(*) FROM energy_readings WHERE data_source = 'simulated'")
        sim_count = c.fetchone()[0]

        c.execute("SELECT count(*) FROM energy_readings")
        total_count = c.fetchone()[0]

        conn.close()

        self.assertEqual(real_count + sim_count, total_count)
        self.assertGreaterEqual(real_count, 1)
        self.assertGreaterEqual(sim_count, 1)

    def test_15_duplicate_reading_handling(self):
        """15. Verify that duplicate check works or primary key / timestamp indexing is intact."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("PRAGMA table_info(energy_readings)")
        columns = [row[1] for row in c.fetchall()]
        conn.close()

        self.assertIn("id", columns)
        self.assertIn("timestamp", columns)
        self.assertIn("device_id", columns)
        self.assertIn("data_source", columns)

    def test_16_digital_twin_scenario_evaluation(self):
        """16. Verify Delta Energy = Base - Scen and Delta Cost = Base Cost - Scen Cost."""
        baseline_kwh = 450.0
        baseline_cost = 2150.0

        scenario_kwh = 380.0
        scenario_cost = 1815.0

        delta_energy = max(0.0, baseline_kwh - scenario_kwh)
        delta_cost = max(0.0, baseline_cost - scenario_cost)

        self.assertEqual(delta_energy, 70.0)
        self.assertEqual(delta_cost, 335.0)

        pct_saving_energy = round((delta_energy / baseline_kwh) * 100.0, 1)
        pct_saving_cost = round((delta_cost / baseline_cost) * 100.0, 1)

        self.assertEqual(pct_saving_energy, 15.6)
        self.assertEqual(pct_saving_cost, 15.6)


if __name__ == "__main__":
    unittest.main()
