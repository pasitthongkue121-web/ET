import unittest
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.ai.routine import routine_engine

class TestPersonalEnergyRoutine(unittest.TestCase):
    def setUp(self):
        self.engine = routine_engine

    def test_routine_slots(self):
        slots = self.engine.compute_routine_slots(days=30)
        self.assertEqual(len(slots), 6) # 6 time slots
        total_pct = sum(s["percentage"] for s in slots)
        self.assertAlmostEqual(total_pct, 100.0, delta=2.0)
        for s in slots:
            self.assertIn("name", s)
            self.assertGreaterEqual(s["avg_power_w"], 0)

    def test_empirical_transitions(self):
        transitions = self.engine.detect_empirical_transitions(days=30)
        self.assertGreaterEqual(len(transitions), 5)
        titles = [t["title"] for t in transitions]
        self.assertIn("Morning Routine", titles)
        self.assertIn("House Empty", titles)
        self.assertIn("Evening Routine", titles)
        self.assertIn("Night Routine", titles)

    def test_device_routine_confidence(self):
        devs = self.engine.compute_device_routines(days=30)
        self.assertTrue(len(devs) > 0)
        for d in devs:
            self.assertGreaterEqual(d["confidence_pct"], 40)
            self.assertLessEqual(d["confidence_pct"], 100)
            self.assertIn(d["confidence_level"], ["High", "Medium", "Low"])
            self.assertIn("typical_start", d)
            self.assertIn("typical_stop", d)

    def test_probability_matrix(self):
        prob = self.engine.compute_probabilities(days=30)
        self.assertEqual(len(prob["hours"]), 24)
        self.assertEqual(len(prob["probabilities"]), 24)
        for row in prob["probabilities"]:
            self.assertIn("hour", row)
            for dev in prob["devices"]:
                p_val = row[dev]
                self.assertGreaterEqual(p_val, 0.0)
                self.assertLessEqual(p_val, 1.0)

if __name__ == "__main__":
    unittest.main()
