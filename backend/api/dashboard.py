from fastapi import APIRouter
from backend.database.models import DashboardSummaryResponse
from backend.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummaryResponse)
def get_dashboard_summary():
    """
    Returns aggregated KPIs, AI insights, energy score, and recent activities.
    """
    return dashboard_service.get_dashboard_summary()
