from fastapi import APIRouter
from typing import List
from backend.database.repository import get_repository
from backend.database.models import RoomSummaryResponse

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

@router.get("", response_model=List[RoomSummaryResponse])
def get_rooms():
    """
    Returns household rooms with aggregated active devices and telemetry.
    """
    repo = get_repository()
    rooms = repo.get_rooms()
    devices = repo.get_devices()
    latest_readings = repo.get_latest_device_readings()
    reading_map = {r["device_id"]: r for r in latest_readings}

    result = []
    for rm in rooms:
        room_devices = [d for d in devices if d["room_id"] == rm["id"]]
        active_cnt = 0
        total_power = 0.0

        for d in room_devices:
            r = reading_map.get(d["device_id"])
            p = r["power"] if r else 0.0
            if p > 5.0:
                active_cnt += 1
            total_power += p

        result.append(RoomSummaryResponse(
            id=rm["id"],
            name=rm["name"],
            floor=rm["floor"],
            icon=rm["icon"],
            active_devices=active_cnt,
            total_devices=len(room_devices),
            current_power=round(total_power, 1),
            today_energy=round((total_power / 1000.0) * 4.0, 2)
        ))

    return result
