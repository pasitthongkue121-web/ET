from typing import List, Optional, Dict, Any
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

    def get_home(self) -> Dict[str, Any]:
        try:
            state = self.engine.get_system_state()
            kw = float(state.get("total_power_kw", 0.85))
            tot_dev = int(state.get("total_devices_count", 3))
            act_dev = int(state.get("active_devices_count", 2))
            cost = float(state.get("estimated_cost_today_thb", 42.5))
        except Exception:
            kw = 0.85
            tot_dev = 3
            act_dev = 2
            cost = 42.5

        return {
            "home_id": "HOME_TWIN_01",
            "name": "ENERGY TWINS Residence",
            "total_power_w": round(kw * 1000.0, 1),
            "total_power_kw": round(kw, 2),
            "daily_energy_kwh": round(kw * 14.5, 2),
            "monthly_energy_kwh": round(kw * 14.5 * 30.0, 1),
            "total_devices": tot_dev,
            "active_devices": act_dev,
            "cost_today_thb": cost
        }

    def get_rooms(self):
        return self.engine.get_rooms()

    def get_devices(self):
        return self.engine.get_devices()

    def get_state(self):
        return self.engine.get_system_state()

    def get_device_detail(self, device_id: str) -> Optional[DigitalTwinDeviceDetail]:
        return self.engine.get_device_detail(device_id)

twin_service = TwinService()
