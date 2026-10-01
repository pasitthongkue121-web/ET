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

    def get_home(self):
        rooms = self.engine.get_rooms()
        state = self.engine.get_system_state()
        return {"state": state, "rooms": rooms}

    def get_rooms(self):
        return self.engine.get_rooms()

    def get_devices(self):
        return self.engine.get_devices()

    def get_state(self):
        return self.engine.get_system_state()

    def get_device_detail(self, device_id: str) -> Optional[DigitalTwinDeviceDetail]:
        return self.engine.get_device_detail(device_id)

twin_service = TwinService()
