from fastapi import APIRouter, Query
from typing import List
from backend.services.analytics_service import analytics_service
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

router = APIRouter(prefix="/api/analytics", tags=["Energy Analytics"])

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(days: int = Query(30, ge=1, le=90)):
    """
    Returns full statistical energy analytics: total consumption, min/max/avg power,
    peak time & duration, energy cost, and CO2 emission.
    """
    return analytics_service.get_summary(days=days)

@router.get("/daily", response_model=List[DailyEnergyItem])
def get_daily_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns daily energy consumption series with cost and peak/avg power.
    """
    return analytics_service.get_daily(days=days)

@router.get("/weekly", response_model=List[WeeklyEnergyItem])
def get_weekly_analytics(days: int = Query(30, ge=7, le=90)):
    """
    Returns weekly aggregated energy consumption.
    """
    return analytics_service.get_weekly(days=days)

@router.get("/monthly", response_model=List[MonthlyEnergyItem])
def get_monthly_analytics(days: int = Query(30, ge=15, le=180)):
    """
    Returns monthly aggregated energy consumption and projected cost.
    """
    return analytics_service.get_monthly(days=days)

@router.get("/devices", response_model=List[DeviceConsumptionItem])
def get_device_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns appliance-by-appliance breakdown: kWh, percentage, runtime, standby hours, cost.
    """
    return analytics_service.get_devices(days=days)

@router.get("/peak", response_model=PeakAnalyticsResponse)
def get_peak_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns peak power telemetry, 3-hour peak window, duration, PAR, and hourly distribution.
    """
    return analytics_service.get_peak(days=days)

@router.get("/cost", response_model=CostAnalyticsResponse)
def get_cost_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns cost calculation based on configurable electricity tariff without hardcoding.
    """
    return analytics_service.get_cost(days=days)

@router.get("/co2", response_model=CO2AnalyticsResponse)
def get_co2_analytics(days: int = Query(30, ge=1, le=90)):
    """
    Returns estimated carbon footprint (kg CO2) and tree offset equivalents.
    """
    return analytics_service.get_co2(days=days)
