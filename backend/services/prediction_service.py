from typing import Dict, Any, List
from backend.ai.prediction import prediction_engine
from backend.ai.insight_engine import insight_engine
from backend.database.models import (
    PredictionForecastResponse,
    ModelEvaluationMetric,
    PredictionExplanation,
    InsightDetectionItem,
    ForecastPoint,
    ForecastDayItem
)

class PredictionService:
    def __init__(self):
        self.pred_engine = prediction_engine
        self.insight_engine = insight_engine

    def get_forecast(self) -> PredictionForecastResponse:
        data = self.pred_engine.predict_forecasts()
        return PredictionForecastResponse(
            champion_model=data["champion_model"],
            models_evaluated=[ModelEvaluationMetric(**m) for m in data["models_evaluated"]],
            next_hour=[ForecastPoint(**p) for p in data["next_hour"]],
            tomorrow=[ForecastPoint(**p) for p in data["tomorrow"]],
            tomorrow_total_kwh=data["tomorrow_total_kwh"],
            tomorrow_cost_thb=data["tomorrow_cost_thb"],
            next_7_days=[ForecastDayItem(**d) for d in data["next_7_days"]],
            next_7_days_total_kwh=data["next_7_days_total_kwh"],
            next_7_days_cost_thb=data["next_7_days_cost_thb"],
            end_of_month_forecast_kwh=data["end_of_month_forecast_kwh"],
            end_of_month_forecast_cost_thb=data["end_of_month_forecast_cost_thb"],
            actual_today_kwh=data["actual_today_kwh"],
            forecast_today_kwh=data["forecast_today_kwh"],
            generated_at=data["generated_at"]
        )

    def get_models(self) -> List[ModelEvaluationMetric]:
        _, _, metrics, _ = self.pred_engine.train_and_evaluate()
        return [ModelEvaluationMetric(**m) for m in metrics]

    def get_explanation(self) -> PredictionExplanation:
        data = self.pred_engine.get_explanation()
        return PredictionExplanation(**data)

    def get_insights(self) -> List[InsightDetectionItem]:
        items = self.insight_engine.detect_insights()
        return [InsightDetectionItem(**i) for i in items]

prediction_service = PredictionService()
