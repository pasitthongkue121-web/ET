from fastapi import APIRouter, HTTPException
from typing import List
from backend.services.twin_service import twin_service
from backend.database.models import (
    DigitalTwinHome,
    DigitalTwinRoom,
    DigitalTwinDevice,
    DigitalTwinState,
    DigitalTwinDeviceDetail
)

router = APIRouter(prefix="/api/twin", tags=["Digital Twin"])

@router.get("/home", response_model=DigitalTwinHome)
def get_twin_home():
    """
    Returns overall digital twin summary for the residence (Power, Energy, Costs, Device counts).
    """
    return twin_service.get_home()

@router.get("/rooms", response_model=List[DigitalTwinRoom])
def get_twin_rooms():
    """
    Returns virtual home floorplan layout with room definitions and current device states.
    """
    return twin_service.get_rooms()

@router.get("/devices", response_model=List[DigitalTwinDevice])
def get_twin_devices():
    """
    Returns flat list of all active/standby digital twin devices.
    """
    return twin_service.get_devices()

@router.get("/state", response_model=DigitalTwinState)
def get_twin_state():
    """
    Returns synchronized real-time state of the residence (Power kW, Temperature, Occupancy, Active Devices, Cost).
    """
    return twin_service.get_state()

@router.get("/device/{device_id}", response_model=DigitalTwinDeviceDetail)
def get_twin_device_detail(device_id: str):
    """
    Returns detailed operational statistics for an individual device digital twin.
    """
    detail = twin_service.get_device_detail(device_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found in Digital Twin")
    return detail
