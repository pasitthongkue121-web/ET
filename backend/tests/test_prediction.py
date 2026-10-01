import unittest
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.ai.prediction import prediction_engine
from backend.ai.insight_engine import insight_engine

class TestAIPrediction(unittest.TestCase):
    def setUp(self):
        self.pred_engine = prediction_engine
        self.insight_engine = insight_engine

    def test_model_training_and_selection(self):
        best_model, champ_name, metrics, df = self.pred_engine.train_and_evaluate()
        self.assertIsNotNone(best_model)
        self.assertIn(champ_name, ["Random Forest", "Gradient Boosting", "Linear Regression"])
        self.assertEqual(len(metrics), 3)

        # Check metrics MAE, RMSE, R2
        champ_metric = next(m for m in metrics if m["is_champion"])
        self.assertGreaterEqual(champ_metric["r2"], 0.0)
        self.assertGreater(champ_metric["mae"], 0.0)
        self.assertGreater(champ_metric["rmse"], 0.0)

    def test_forecast_output_horizons(self):
        forecast = self.pred_engine.predict_forecasts()
        self.assertIn("next_hour", forecast)
        self.assertEqual(len(forecast["next_hour"]), 4) # 4 * 15m = 1h

        self.assertIn("tomorrow", forecast)
        self.assertEqual(len(forecast["tomorrow"]), 24) # 24 hours

        self.assertIn("next_7_days", forecast)
        self.assertEqual(len(forecast["next_7_days"]), 7) # 7 days

        self.assertGreater(forecast["tomorrow_total_kwh"], 0)
        self.assertGreater(forecast["next_7_days_total_kwh"], 0)
        self.assertGreater(forecast["end_of_month_forecast_kwh"], 0)

        # Check explicit PREDICTED tag
        for pt in forecast["next_hour"]:
            self.assertEqual(pt["tag"], "PREDICTED")
        for pt in forecast["tomorrow"]:
            self.assertEqual(pt["tag"], "PREDICTED")

    def test_explainable_ai(self):
        explanation = self.pred_engine.get_explanation()
        self.assertIn("champion_model", explanation)
        self.assertIn("top_influencing_features", explanation)
        self.assertTrue(len(explanation["top_influencing_features"]) > 0)
        self.assertIn("narrative_explanation", explanation)

    def test_automated_insights_detection(self):
        insights = self.insight_engine.detect_insights()
        self.assertGreaterEqual(len(insights), 4)
        for item in insights:
            self.assertIn("title", item)
            self.assertIn("description", item)
            self.assertIn("confidence", item)
            self.assertIn(item["severity"], ["info", "warning", "success"])

if __name__ == "__main__":
    unittest.main()
