from fastapi import APIRouter
from typing import List
from backend.database.models import DeviceStatusResponse
from backend.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/devices", tags=["Devices"])

@router.get("", response_model=List[DeviceStatusResponse])
def get_devices():
    """
    Returns list of all household devices with real-time status and power readings.
    """
    return dashboard_service.get_devices_detail()
