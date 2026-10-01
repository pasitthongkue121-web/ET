"""
API: Anomaly Detection + Enhanced Forecast endpoints
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timedelta

from backend.database.repository import get_repository
from backend.ai.anomaly_detection import run_full_anomaly_scan
from backend.ai.prediction import prediction_engine

router = APIRouter(prefix="/api/prediction", tags=["Prediction"])


@router.get("/forecast")
def get_forecast(hours_ahead: int = Query(24, ge=1, le=72)):
    """
    24-hour (or custom) energy consumption forecast using ML model.
    Returns hourly predictions with confidence intervals.
    """
    repo = get_repository()
    now = datetime.now()
    start = (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    end = now.strftime("%Y-%m-%d %H:%M:%S")
    # We no longer pass readings as argument to predict_forecasts because
    # AIEnergyPredictionEngine pulls them internally
    result = prediction_engine.predict_forecasts()
    return result


@router.get("/anomalies")
def get_anomalies(days: int = Query(7, ge=1, le=30)):
    """
    Run anomaly detection on the last N days of data.
    Returns spike anomalies, standby waste, and energy anomalies.
    """
    repo = get_repository()
    now = datetime.now()
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    end = now.strftime("%Y-%m-%d %H:%M:%S")
    readings = repo.get_readings_timeseries(start, end)
    latest   = repo.get_latest_device_readings()
    result = run_full_anomaly_scan(readings, latest)
    return result
