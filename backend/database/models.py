from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# --- Database / Entity Models ---

class Room(BaseModel):
    id: str
    name: str
    floor: int = 1
    icon: str = "home"

class Device(BaseModel):
    device_id: str
    name: str
    room_id: str
    rated_power: float  # in Watts
    status: bool = False # ON / OFF
    temperature: Optional[float] = None
    category: str = "general" # hvac, entertainment, computing, appliance, lighting

class EnergyReading(BaseModel):
    id: Optional[int] = None
    timestamp: datetime
    device_id: str
    voltage: float = 230.0
    current: float = 0.0
    power: float = 0.0    # in Watts
    energy: float = 0.0   # in kWh
    temperature: float = 25.0
    humidity: float = 60.0
    occupancy: bool = True

# --- API Request & Response Schemas ---

class ESP32ReadingInput(BaseModel):
    device_id: str = Field(..., example="AC01")
    voltage: float = Field(230.0, example=230.0)
    current: float = Field(..., example=5.2)
    power: float = Field(..., example=1196.0)
    energy: float = Field(..., example=0.02)
    temperature: Optional[float] = Field(28.4, example=28.4)
    humidity: Optional[float] = Field(60.0, example=60.0)
    occupancy: Optional[bool] = Field(True, example=True)
    timestamp: Optional[datetime] = None

class DeviceStatusResponse(BaseModel):
    device_id: str
    name: str
    room_id: str
    room_name: str
    rated_power: float
    status: bool
    current_power: float
    today_energy: float
    runtime_hours: float
    temperature: Optional[float] = None
    category: str

class RoomSummaryResponse(BaseModel):
    id: str
    name: str
    floor: int
    icon: str
    active_devices: int
    total_devices: int
    current_power: float
    today_energy: float

class AIInsightItem(BaseModel):
    id: str
    type: str  # "peak", "device", "efficiency", "pattern", "saving"
    title: str
    description: str
    severity: str # "info", "warning", "success"
    metric_value: Optional[str] = None

class EnergyScoreBreakdown(BaseModel):
    score: int # 0 - 100
    efficiency: int
    peak_usage: int
    standby: int
    usage_pattern: int
    energy_stability: int
    grade: str # "A", "B", "C", "D"
    summary: str

class RecentActivityItem(BaseModel):
    timestamp: str
    device_name: str
    room_name: str
    event: str
    power_w: float

class DashboardSummaryResponse(BaseModel):
    current_power_kw: float
    today_energy_kwh: float
    today_cost_thb: float
    monthly_energy_kwh: float
    monthly_cost_thb: float
    monthly_forecast_kwh: float
    monthly_forecast_cost_thb: float
    energy_score: EnergyScoreBreakdown
    insights: List[AIInsightItem]
    recent_activities: List[RecentActivityItem]
    devices_online: int
    devices_total: int
    last_updated: str

# --- STEP 6: Energy Analytics Models ---

class AnalyticsSummaryResponse(BaseModel):
    total_energy_kwh: float
    avg_power_w: float
    max_power_w: float
    min_power_w: float
    peak_usage_time: str
    peak_usage_duration_hours: float
    total_cost_thb: float
    total_co2_kg: float
    electricity_rate: float
    co2_factor: float
    data_points_analyzed: int
    analyzed_from: str
    analyzed_to: str

class DailyEnergyItem(BaseModel):
    date: str
    energy_kwh: float
    cost_thb: float
    peak_power_w: float
    avg_power_w: float

class WeeklyEnergyItem(BaseModel):
    week_label: str
    start_date: str
    end_date: str
    energy_kwh: float
    cost_thb: float

class MonthlyEnergyItem(BaseModel):
    month_label: str
    energy_kwh: float
    cost_thb: float
    projected_cost_thb: float

class DeviceConsumptionItem(BaseModel):
    device_id: str
    name: str
    room_name: str
    category: str
    total_kwh: float
    percentage: float
    runtime_hours: float
    standby_hours: float
    cost_thb: float

class PeakAnalyticsResponse(BaseModel):
    peak_power_w: float
    peak_timestamp: str
    peak_window: str
    peak_duration_hours: float
    peak_to_average_ratio: float
    threshold_w: float
    peak_hours_distribution: List[Dict[str, Any]]

class CostAnalyticsResponse(BaseModel):
    rate_per_kwh: float
    total_cost_thb: float
    today_cost_thb: float
    monthly_projected_cost_thb: float
    tier_info: str
    daily_costs: List[Dict[str, Any]]

class CO2AnalyticsResponse(BaseModel):
    total_co2_kg: float
    co2_factor: float
    today_co2_kg: float
    monthly_co2_kg: float
    tree_offset_equivalent: float # number of trees needed to offset
    potential_reduction_kg: float

# --- STEP 7: Personal Energy Routine Models ---

class RoutineSlot(BaseModel):
    slot_id: str
    name: str
    time_range: str
    energy_kwh: float
    avg_power_w: float
    percentage: float
    primary_activity: str
    occupancy_rate: float

class DeviceRoutineProfile(BaseModel):
    device_id: str
    name: str
    room_name: str
    typical_start: str
    typical_stop: str
    average_runtime_hours: float
    confidence_pct: int
    confidence_level: str # "High", "Medium", "Low"
    pattern_summary: str

class RoutineTimelineItem(BaseModel):
    hour: int
    time_label: str
    power_w: float
    intensity: str # "Low", "Moderate", "High", "Peak"
    slot_name: str
    is_peak: bool
    occupancy: bool

class RoutineProbabilityResponse(BaseModel):
    devices: List[str]
    hours: List[int]
    probabilities: List[Dict[str, Any]] # list of { hour: "18:00", AC_LIVING: 0.71, TV: 0.65, ... }

class RoutineResponse(BaseModel):
    slots: List[RoutineSlot]
    detected_transitions: List[Dict[str, str]]
    timeline: List[RoutineTimelineItem]
    devices_routine: List[DeviceRoutineProfile]
    routine_summary: str

# --- STEP 8: AI Energy Prediction Models ---

class ForecastPoint(BaseModel):
    timestamp: str
    time_label: str
    predicted_power_w: float
    predicted_energy_kwh: float
    predicted_cost_thb: float
    lower_bound_kwh: float
    upper_bound_kwh: float
    tag: str = "PREDICTED"

class ForecastDayItem(BaseModel):
    date: str
    day_name: str
    predicted_energy_kwh: float
    predicted_cost_thb: float
    tag: str = "PREDICTED"

class ModelEvaluationMetric(BaseModel):
    model_name: str
    mae: float
    rmse: float
    r2: float
    is_champion: bool

class PredictionForecastResponse(BaseModel):
    champion_model: str
    models_evaluated: List[ModelEvaluationMetric]
    next_hour: List[ForecastPoint]
    tomorrow: List[ForecastPoint]
    tomorrow_total_kwh: float
    tomorrow_cost_thb: float
    next_7_days: List[ForecastDayItem]
    next_7_days_total_kwh: float
    next_7_days_cost_thb: float
    end_of_month_forecast_kwh: float
    end_of_month_forecast_cost_thb: float
    actual_today_kwh: float
    forecast_today_kwh: float
    generated_at: str

class PredictionExplanation(BaseModel):
    champion_model: str
    top_influencing_features: List[Dict[str, Any]]
    narrative_explanation: str

class InsightDetectionItem(BaseModel):
    id: str
    type: str # "peak", "anomaly", "trend", "runtime", "saving"
    title: str
    description: str
    severity: str # "info", "warning", "success"
    confidence: int
    potential_saving_kwh: Optional[float] = None
    potential_saving_thb: Optional[float] = None
    action_recommendation: Optional[str] = None


# ==========================================
# PHASE 3: DIGITAL TWIN & WHAT-IF SIMULATION
# ==========================================

# --- Digital Twin Models ---

class DigitalTwinDevice(BaseModel):
    device_id: str
    name: str
    room_id: str
    room_name: str
    device_type: str
    rated_power: float
    status: bool # ON / OFF
    current_power_w: float
    temperature_setting: Optional[float] = None
    schedule: str = "Flexible"

class DigitalTwinRoom(BaseModel):
    room_id: str
    name: str
    floor: int
    icon: str
    active_devices: int
    total_devices: int
    current_power_w: float
    devices: List[DigitalTwinDevice]

class DigitalTwinHome(BaseModel):
    home_id: str = "HOME_TWIN_01"
    name: str = "ENERGY TWINS Residence"
    total_power_w: float
    total_power_kw: float
    daily_energy_kwh: float
    monthly_energy_kwh: float
    total_devices: int
    active_devices: int
    cost_today_thb: float

class DigitalTwinState(BaseModel):
    timestamp: str
    total_power_kw: float
    temperature_c: float
    humidity_pct: float
    occupancy: bool
    occupancy_count: int
    active_devices_count: int
    total_devices_count: int
    estimated_cost_today_thb: float
    tag: str = "MEASURED"

class DigitalTwinDeviceDetail(BaseModel):
    device_id: str
    name: str
    room_id: str
    room_name: str
    device_type: str
    status: bool
    current_power_w: float
    rated_power_w: float
    today_energy_kwh: float
    monthly_energy_kwh: float
    runtime_hours: float
    temperature_setting: Optional[float] = None
    schedule: str
    confidence_pct: int
    tag: str = "MEASURED"

# --- What-If Simulation Models ---

class SimulationParameters(BaseModel):
    ac_device_id: Optional[str] = "AC_LIVING"
    ac_target_temp: Optional[float] = 26.0
    ac_start_hour: Optional[int] = None
    ac_end_hour: Optional[int] = None
    device_schedule_shifts: Optional[Dict[str, Dict[str, int]]] = None # e.g. {"AC_BEDROOM": {"start_hour": 23, "end_hour": 6}}
    device_power_overrides: Optional[Dict[str, float]] = None # e.g. {"AC_LIVING": 1000.0}
    device_status_overrides: Optional[Dict[str, bool]] = None # e.g. {"PC_STUDY": False}
    standby_reduction_w: Optional[float] = 0.0
    scenario_name: Optional[str] = "What-If Scenario"

class SimulationResult(BaseModel):
    simulation_id: str
    scenario_name: str
    created_at: str
    parameters: SimulationParameters
    current_monthly_kwh: float
    simulated_monthly_kwh: float
    current_monthly_cost_thb: float
    simulated_monthly_cost_thb: float
    current_peak_kw: float
    simulated_peak_kw: float
    energy_saving_kwh: float
    energy_saving_pct: float
    cost_saving_thb: float
    cost_saving_pct: float
    peak_reduction_kw: float
    peak_reduction_pct: float
    co2_reduction_kg: float
    confidence_level: str # "High", "Medium", "Low"
    confidence_reason: str
    device_runtime_comparison: List[Dict[str, Any]]
    hourly_load_comparison: List[Dict[str, Any]] # 24h current_w vs simulated_w
    tag: str = "SIMULATED"

class ScenarioItem(BaseModel):
    id: str
    name: str
    description: str
    energy_kwh: float
    cost_thb: float
    saving_kwh: float
    saving_thb: float
    peak_kw: float
    reduction_pct: float
    score: Optional[float] = None
    tag: str = "SIMULATED"

class ScenarioComparisonTable(BaseModel):
    scenarios: List[ScenarioItem]
    baseline_kwh: float
    baseline_cost_thb: float
    baseline_peak_kw: float

class ScenarioScoreWeights(BaseModel):
    efficiency_weight: float = Field(0.40, ge=0.0, le=1.0)
    cost_weight: float = Field(0.30, ge=0.0, le=1.0)
    peak_weight: float = Field(0.20, ge=0.0, le=1.0)
    comfort_weight: float = Field(0.10, ge=0.0, le=1.0)

class ScenarioScoreResult(BaseModel):
    scenario_id: str
    scenario_name: str
    total_score: float
    efficiency_score: float
    cost_score: float
    peak_score: float
    comfort_score: float
    weights: ScenarioScoreWeights

class AIRecommendationResult(BaseModel):
    recommended_scenario_id: str
    recommended_scenario_name: str
    headline: str
    justification_points: List[str]
    energy_saving_pct: float
    cost_saving_thb: float
    comfort_impact: str
    tag: str = "RECOMMENDED"

class SimulationTemplateItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    default_parameters: SimulationParameters

