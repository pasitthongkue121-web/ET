from typing import List, Optional
from backend.ai.digital_twin import digital_twin_engine
from backend.database.models import (
    DigitalTwinHome,
    DigitalTwinRoom,
    DigitalTwinDevice,
    DigitalTwinState,
    DigitalTwinDeviceDetail
)

class TwinService:
    def __init__(self):
        self.engine = digital_twin_engine

    def get_home(self) -> DigitalTwinHome:
        return self.engine.get_home()

    def get_rooms(self) -> List[DigitalTwinRoom]:
        return self.engine.get_rooms()

    def get_devices(self) -> List[DigitalTwinDevice]:
        return self.engine.get_devices()

    def get_state(self) -> DigitalTwinState:
        return self.engine.get_state()

    def get_device_detail(self, device_id: str) -> Optional[DigitalTwinDeviceDetail]:
        return self.engine.get_device_detail(device_id)

twin_service = TwinService()
