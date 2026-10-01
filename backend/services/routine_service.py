from typing import Dict, Any, List
from backend.ai.routine import routine_engine
from backend.database.models import (
    RoutineResponse,
    DeviceRoutineProfile,
    RoutineTimelineItem,
    RoutineProbabilityResponse,
    RoutineSlot
)

class RoutineService:
    def __init__(self):
        self.engine = routine_engine

    def get_routine(self, days: int = 30) -> RoutineResponse:
        data = self.engine.get_full_routine(days)
        return RoutineResponse(
            slots=[RoutineSlot(**s) for s in data["slots"]],
            detected_transitions=data["detected_transitions"],
            timeline=[RoutineTimelineItem(**t) for t in data["timeline"]],
            devices_routine=[DeviceRoutineProfile(**d) for d in data["devices_routine"]],
            routine_summary=data["routine_summary"]
        )

    def get_devices(self, days: int = 30) -> List[DeviceRoutineProfile]:
        data = self.engine.compute_device_routines(days)
        return [DeviceRoutineProfile(**d) for d in data]

    def get_timeline(self, days: int = 30) -> List[RoutineTimelineItem]:
        data = self.engine.compute_timeline(days)
        return [RoutineTimelineItem(**t) for t in data]

    def get_probabilities(self, days: int = 30) -> RoutineProbabilityResponse:
        data = self.engine.compute_probabilities(days)
        return RoutineProbabilityResponse(**data)

routine_service = RoutineService()
