"""
API: Anomaly Detection + Enhanced Forecast endpoints
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timedelta

from backend.database.repository import get_repository
from backend.ai.anomaly_detection import run_full_anomaly_scan
from backend.ai.prediction import prediction_engine

from backend.services.prediction_service import prediction_service

router = APIRouter(prefix="/api/prediction", tags=["Prediction"])


@router.get("/forecast")
def get_forecast(hours_ahead: int = Query(24, ge=1, le=72)):
    """
    24-hour (or custom) energy consumption forecast using ML model.
    Returns hourly predictions with confidence intervals.
    """
    try:
        return prediction_service.get_forecast()
    except Exception:
        return prediction_engine.predict_forecasts()


@router.get("/insights")
def get_insights():
    """
    Automated pattern detection & explainable AI insights.
    """
    return prediction_service.get_insights()


@router.get("/models")
def get_models():
    """
    Machine learning model evaluation benchmarks (MAE, RMSE, R2).
    """
    return prediction_service.get_models()


@router.get("/explanation")
def get_explanation():
    """
    Explainable AI feature importance weights and contributing factors.
    """
    return prediction_service.get_explanation()


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

