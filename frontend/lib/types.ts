export interface Room {
  id: string;
  name: string;
  floor: number;
  icon: string;
  active_devices: number;
  total_devices: number;
  current_power: number;
  today_energy: number;
}

export interface Device {
  device_id: string;
  name: string;
  room_id: string;
  room_name: string;
  rated_power: number;
  status: boolean;
  current_power: number;
  today_energy: number;
  runtime_hours: number;
  temperature?: number | null;
  category: string;
}

export interface EnergyReadingTimeseries {
  time: string;
  power_w: number;
  power_kw: number;
  energy_kwh: number;
  voltage: number;
  current_a: number;
  temperature: number;
  cost_thb: number;
  occupancy: boolean;
}

export interface EnergyHistoryResponse {
  period: string;
  device_id?: string | null;
  total_energy_kwh: number;
  total_cost_thb: number;
  timeseries: EnergyReadingTimeseries[];
}

export interface AIInsightItem {
  id: string;
  type: 'peak' | 'device' | 'efficiency' | 'pattern' | 'saving' | string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success';
  metric_value?: string | null;
}

export interface EnergyScoreBreakdown {
  score: number;
  efficiency: number;
  peak_usage: number;
  standby: number;
  usage_pattern: number;
  energy_stability: number;
  grade: string;
  summary: string;
}

export interface RecentActivityItem {
  timestamp: string;
  device_name: string;
  room_name: string;
  event: string;
  power_w: number;
}

export interface DashboardSummary {
  current_power_kw: number;
  today_energy_kwh: number;
  today_cost_thb: number;
  monthly_energy_kwh: number;
  monthly_cost_thb: number;
  monthly_forecast_kwh: number;
  monthly_forecast_cost_thb: number;
  energy_score: EnergyScoreBreakdown;
  insights: AIInsightItem[];
  recent_activities: RecentActivityItem[];
  devices_online: number;
  devices_total: number;
  last_updated: string;
}

// --- Phase 2: STEP 6 Analytics Types ---

export interface AnalyticsSummary {
  total_energy_kwh: number;
  avg_power_w: number;
  max_power_w: number;
  min_power_w: number;
  peak_usage_time: string;
  peak_usage_duration_hours: number;
  total_cost_thb: number;
  total_co2_kg: number;
  electricity_rate: number;
  co2_factor: number;
  data_points_analyzed: number;
  analyzed_from: string;
  analyzed_to: string;
}

export interface DailyEnergyItem {
  date: string;
  energy_kwh: number;
  cost_thb: number;
  peak_power_w: number;
  avg_power_w: number;
}

export interface WeeklyEnergyItem {
  week_label: string;
  start_date: string;
  end_date: string;
  energy_kwh: number;
  cost_thb: number;
}

export interface MonthlyEnergyItem {
  month_label: string;
  energy_kwh: number;
  cost_thb: number;
  projected_cost_thb: number;
}

export interface DeviceConsumptionItem {
  device_id: string;
  name: string;
  room_name: string;
  category: string;
  total_kwh: number;
  percentage: number;
  runtime_hours: number;
  standby_hours: number;
  cost_thb: number;
}

export interface PeakAnalytics {
  peak_power_w: number;
  peak_timestamp: string;
  peak_window: string;
  peak_duration_hours: number;
  peak_to_average_ratio: number;
  threshold_w: number;
  peak_hours_distribution: Array<{
    hour: number;
    label: string;
    avg_power_w: number;
    max_power_w: number;
    is_peak: boolean;
  }>;
}

export interface CostAnalytics {
  rate_per_kwh: number;
  total_cost_thb: number;
  today_cost_thb: number;
  monthly_projected_cost_thb: number;
  tier_info: string;
  daily_costs: Array<{ date: string; cost_thb: number }>;
}

export interface CO2Analytics {
  total_co2_kg: number;
  co2_factor: number;
  today_co2_kg: number;
  monthly_co2_kg: number;
  tree_offset_equivalent: number;
  potential_reduction_kg: number;
}

// --- Phase 2: STEP 7 Routine Types ---

export interface RoutineSlot {
  slot_id: string;
  name: string;
  time_range: string;
  energy_kwh: number;
  avg_power_w: number;
  percentage: number;
  primary_activity: string;
  occupancy_rate: number;
}

export interface DeviceRoutineProfile {
  device_id: string;
  name: string;
  room_name: string;
  typical_start: string;
  typical_stop: string;
  average_runtime_hours: number;
  confidence_pct: number;
  confidence_level: 'High' | 'Medium' | 'Low';
  pattern_summary: string;
}

export interface RoutineTimelineItem {
  hour: number;
  time_label: string;
  power_w: number;
  intensity: 'Low' | 'Moderate' | 'High' | 'Peak';
  slot_name: string;
  is_peak: boolean;
  occupancy: boolean;
}

export interface RoutineProbability {
  devices: string[];
  hours: number[];
  probabilities: Array<Record<string, any>>;
}

export interface RoutineResponse {
  slots: RoutineSlot[];
  detected_transitions: Array<{ time: string; title: string; desc: string }>;
  timeline: RoutineTimelineItem[];
  devices_routine: DeviceRoutineProfile[];
  routine_summary: string;
}

// --- Phase 2: STEP 8 Prediction Types ---

export interface ForecastPoint {
  timestamp: string;
  time_label: string;
  predicted_power_w: number;
  predicted_energy_kwh: number;
  predicted_cost_thb: number;
  lower_bound_kwh: number;
  upper_bound_kwh: number;
  tag: 'PREDICTED' | 'ACTUAL' | 'SIMULATED';
}

export interface ForecastDayItem {
  date: string;
  day_name: string;
  predicted_energy_kwh: number;
  predicted_cost_thb: number;
  tag: 'PREDICTED' | 'ACTUAL' | 'SIMULATED';
}

export interface ModelEvaluationMetric {
  model_name: string;
  mae: number;
  rmse: number;
  r2: number;
  is_champion: boolean;
}

export interface PredictionForecastResponse {
  champion_model: string;
  models_evaluated: ModelEvaluationMetric[];
  next_hour: ForecastPoint[];
  tomorrow: ForecastPoint[];
  tomorrow_total_kwh: number;
  tomorrow_cost_thb: number;
  next_7_days: ForecastDayItem[];
  next_7_days_total_kwh: number;
  next_7_days_cost_thb: number;
  end_of_month_forecast_kwh: number;
  end_of_month_forecast_cost_thb: number;
  actual_today_kwh: number;
  forecast_today_kwh: number;
  generated_at: string;
}

export interface PredictionExplanation {
  champion_model: string;
  top_influencing_features: Array<{
    feature: string;
    importance_pct: number;
    description: string;
  }>;
  narrative_explanation: string;
}

export interface InsightDetectionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success';
  confidence: number;
  potential_saving_kwh?: number | null;
  potential_saving_thb?: number | null;
  action_recommendation?: string | null;
}

// --- Phase 3: Digital Twin Types ---

export interface DigitalTwinDevice {
  device_id: string;
  name: string;
  room_id: string;
  room_name: string;
  device_type: string;
  rated_power: number;
  status: boolean;
  current_power_w: number;
  temperature_setting?: number | null;
  schedule: string;
}

export interface DigitalTwinRoom {
  room_id: string;
  name: string;
  floor: number;
  icon: string;
  active_devices: number;
  total_devices: number;
  current_power_w: number;
  devices: DigitalTwinDevice[];
}

export interface DigitalTwinHome {
  home_id: string;
  name: string;
  total_power_w: number;
  total_power_kw: number;
  daily_energy_kwh: number;
  monthly_energy_kwh: number;
  total_devices: number;
  active_devices: number;
  cost_today_thb: number;
}

export interface DigitalTwinState {
  timestamp: string;
  total_power_kw: number;
  temperature_c: number;
  humidity_pct: number;
  occupancy: boolean;
  occupancy_count: number;
  active_devices_count: number;
  total_devices_count: number;
  estimated_cost_today_thb: number;
  tag: string;
}

export interface DigitalTwinDeviceDetail {
  device_id: string;
  name: string;
  room_id: string;
  room_name: string;
  device_type: string;
  status: boolean;
  current_power_w: number;
  rated_power_w: number;
  today_energy_kwh: number;
  monthly_energy_kwh: number;
  runtime_hours: number;
  temperature_setting?: number | null;
  schedule: string;
  confidence_pct: number;
  tag: string;
}

// --- Phase 3: What-If Simulation Types ---

export interface SimulationParameters {
  ac_device_id?: string;
  ac_target_temp?: number;
  ac_start_hour?: number | null;
  ac_end_hour?: number | null;
  device_schedule_shifts?: Record<string, { start_hour: number; end_hour: number }>;
  device_power_overrides?: Record<string, number>;
  device_status_overrides?: Record<string, boolean>;
  standby_reduction_w?: number;
  scenario_name?: string;
}

export interface DeviceRuntimeComparisonItem {
  device_id: string;
  device_name: string;
  baseline_hours: number;
  simulated_hours: number;
  difference_hours: number;
}

export interface HourlyLoadComparisonItem {
  hour: number;
  hour_label: string;
  current_power_w: number;
  simulated_power_w: number;
  saving_w: number;
}

export interface SimulationResult {
  simulation_id: string;
  scenario_name: string;
  created_at: string;
  parameters: SimulationParameters;
  current_monthly_kwh: number;
  simulated_monthly_kwh: number;
  current_monthly_cost_thb: number;
  simulated_monthly_cost_thb: number;
  current_peak_kw: number;
  simulated_peak_kw: number;
  energy_saving_kwh: number;
  energy_saving_pct: number;
  cost_saving_thb: number;
  cost_saving_pct: number;
  peak_reduction_kw: number;
  peak_reduction_pct: number;
  co2_reduction_kg: number;
  confidence_level: 'High' | 'Medium' | 'Low';
  confidence_reason: string;
  device_runtime_comparison: DeviceRuntimeComparisonItem[];
  hourly_load_comparison: HourlyLoadComparisonItem[];
  tag: 'SIMULATED';
}

export interface ScenarioItem {
  id: string;
  name: string;
  description: string;
  energy_kwh: number;
  cost_thb: number;
  saving_kwh: number;
  saving_thb: number;
  peak_kw: number;
  reduction_pct: number;
  score?: number | null;
  tag: string;
}

export interface ScenarioComparisonTable {
  scenarios: ScenarioItem[];
  baseline_kwh: number;
  baseline_cost_thb: number;
  baseline_peak_kw: number;
}

export interface ScenarioScoreWeights {
  efficiency_weight: number;
  cost_weight: number;
  peak_weight: number;
  comfort_weight: number;
}

export interface ScenarioScoreResult {
  scenario_id: string;
  scenario_name: string;
  total_score: number;
  efficiency_score: number;
  cost_score: number;
  peak_score: number;
  comfort_score: number;
  weights: ScenarioScoreWeights;
}

export interface AIRecommendationResult {
  recommended_scenario_id: string;
  recommended_scenario_name: string;
  headline: string;
  justification_points: string[];
  energy_saving_pct: number;
  cost_saving_thb: number;
  comfort_impact: string;
  tag: 'RECOMMENDED';
}

export interface SimulationTemplateItem {
  id: string;
  title: string;
  description: string;
  category: string;
  default_parameters: SimulationParameters;
}
