from typing import Optional, Union, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.database.orm_models import User
from backend.core.auth import get_optional_current_user
from backend.database.models import DashboardSummaryResponse
from backend.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_summary(
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated KPIs, AI insights, energy score, and recent activities.
    If Authorization Bearer token is provided, returns user-isolated dashboard.
    Otherwise, returns default system dashboard.
    """
    if user:
        from backend.api.dashboard_v2 import get_dashboard
        return get_dashboard(db=db, current_user=user)

    return dashboard_service.get_dashboard_summary()
