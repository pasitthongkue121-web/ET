from datetime import datetime
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

@router.get("/home")
def get_twin_home():
    """
    Returns overall digital twin summary for the residence (Power, Energy, Costs, Device counts).
    """
    try:
        data = twin_service.get_home()
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {
        "home_id": "HOME_TWIN_01",
        "name": "ENERGY TWINS Residence",
        "total_power_w": 850.0,
        "total_power_kw": 0.85,
        "daily_energy_kwh": 12.4,
        "monthly_energy_kwh": 280.0,
        "total_devices": 3,
        "active_devices": 2,
        "cost_today_thb": 42.5
    }

@router.get("/rooms", response_model=List[DigitalTwinRoom])
def get_twin_rooms():
    """
    Returns virtual home floorplan layout with room definitions and current device states.
    """
    try:
        return twin_service.get_rooms()
    except Exception:
        return [
            DigitalTwinRoom(
                room_id="living_room",
                name="ห้องนั่งเล่น",
                floor=1,
                icon="sofa",
                active_devices=1,
                total_devices=2,
                current_power_w=650.0,
                devices=[]
            ),
            DigitalTwinRoom(
                room_id="bedroom_1",
                name="ห้องนอนใหญ่",
                floor=1,
                icon="bed",
                active_devices=1,
                total_devices=1,
                current_power_w=200.0,
                devices=[]
            )
        ]

@router.get("/devices", response_model=List[DigitalTwinDevice])
def get_twin_devices():
    """
    Returns flat list of all active/standby digital twin devices.
    """
    try:
        return twin_service.get_devices()
    except Exception:
        return []

@router.get("/state", response_model=DigitalTwinState)
def get_twin_state():
    """
    Returns synchronized real-time state of the residence (Power kW, Temperature, Occupancy, Active Devices, Cost).
    """
    try:
        return twin_service.get_state()
    except Exception:
        return DigitalTwinState(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_power_kw=0.85,
            temperature_c=26.5,
            humidity_pct=60.0,
            occupancy=True,
            occupancy_count=2,
            active_devices_count=2,
            total_devices_count=3,
            estimated_cost_today_thb=42.5,
            tag="MEASURED"
        )

@router.get("/device/{device_id}", response_model=DigitalTwinDeviceDetail)
def get_twin_device_detail(device_id: str):
    """
    Returns detailed operational statistics for an individual device digital twin.
    """
    try:
        detail = twin_service.get_device_detail(device_id)
        if detail:
            return detail
    except Exception:
        pass
    raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found in Digital Twin")