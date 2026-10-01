from fastapi import APIRouter, Query
from typing import List
from backend.services.routine_service import routine_service
from backend.database.models import (
    RoutineResponse,
    DeviceRoutineProfile,
    RoutineTimelineItem,
    RoutineProbabilityResponse
)

router = APIRouter(prefix="/api/routine", tags=["Personal Energy Routine"])

@router.get("", response_model=RoutineResponse)
def get_personal_routine(days: int = Query(30, ge=1, le=90)):
    """
    Returns full personal energy routine profile: time slots, empirical transitions,
    timeline intensity, device profiles, and confidence scores.
    """
    return routine_service.get_routine(days=days)

@router.get("/devices", response_model=List[DeviceRoutineProfile])
def get_device_routines(days: int = Query(30, ge=1, le=90)):
    """
    Returns appliance-specific learned routine patterns (typical start/stop, runtime, confidence).
    """
    return routine_service.get_devices(days=days)

@router.get("/timeline", response_model=List[RoutineTimelineItem])
def get_routine_timeline(days: int = Query(30, ge=1, le=90)):
    """
    Returns 24-hour energy routine timeline with power level and intensity tier.
    """
    return routine_service.get_timeline(days=days)

@router.get("/probability", response_model=RoutineProbabilityResponse)
def get_activation_probabilities(days: int = Query(30, ge=1, le=90)):
    """
    Returns 24-hour appliance activation probability matrix P(device ON | hour).
    """
    return routine_service.get_probabilities(days=days)
