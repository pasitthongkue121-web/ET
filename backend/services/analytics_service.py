from typing import Dict, Any, List
from backend.ai.analytics import analytics_engine
from backend.database.models import (
    AnalyticsSummaryResponse,
    DailyEnergyItem,
    WeeklyEnergyItem,
    MonthlyEnergyItem,
    DeviceConsumptionItem,
    PeakAnalyticsResponse,
    CostAnalyticsResponse,
    CO2AnalyticsResponse,
)

class AnalyticsService:
    def __init__(self):
        self.engine = analytics_engine

    def get_summary(self, days: int = 30) -> AnalyticsSummaryResponse:
        data = self.engine.compute_summary(days)
        return AnalyticsSummaryResponse(**data)

    def get_daily(self, days: int = 30) -> List[DailyEnergyItem]:
        items = self.engine.compute_daily(days)
        return [DailyEnergyItem(**item) for item in items]

    def get_weekly(self, days: int = 30) -> List[WeeklyEnergyItem]:
        items = self.engine.compute_weekly(days)
        return [WeeklyEnergyItem(**item) for item in items]

    def get_monthly(self, days: int = 30) -> List[MonthlyEnergyItem]:
        items = self.engine.compute_monthly(days)
        return [MonthlyEnergyItem(**item) for item in items]

    def get_devices(self, days: int = 30) -> List[DeviceConsumptionItem]:
        items = self.engine.compute_devices(days)
        return [DeviceConsumptionItem(**item) for item in items]

    def get_peak(self, days: int = 30) -> PeakAnalyticsResponse:
        data = self.engine.compute_peak(days)
        return PeakAnalyticsResponse(**data)

    def get_cost(self, days: int = 30) -> CostAnalyticsResponse:
        data = self.engine.compute_cost(days)
        return CostAnalyticsResponse(**data)

    def get_co2(self, days: int = 30) -> CO2AnalyticsResponse:
        data = self.engine.compute_co2(days)
        return CO2AnalyticsResponse(**data)

analytics_service = AnalyticsService()
