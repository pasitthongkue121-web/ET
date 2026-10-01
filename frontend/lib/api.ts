import {
  DashboardSummary,
  Device,
  Room,
  EnergyHistoryResponse,
  AnalyticsSummary,
  DailyEnergyItem,
  WeeklyEnergyItem,
  MonthlyEnergyItem,
  DeviceConsumptionItem,
  PeakAnalytics,
  CostAnalytics,
  CO2Analytics,
  RoutineResponse,
  DeviceRoutineProfile,
  RoutineTimelineItem,
  RoutineProbability,
  PredictionForecastResponse,
  ModelEvaluationMetric,
  PredictionExplanation,
  InsightDetectionItem,
  DigitalTwinHome,
  DigitalTwinRoom,
  DigitalTwinDevice,
  DigitalTwinState,
  DigitalTwinDeviceDetail,
  SimulationParameters,
  SimulationResult,
  ScenarioItem,
  ScenarioComparisonTable,
  ScenarioScoreWeights,
  ScenarioScoreResult,
  AIRecommendationResult,
  SimulationTemplateItem
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000');

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store', // Always fresh data
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 3000);
    return res.ok;
  } catch {
    return false;
  }
}

// --- Dashboard & Devices ---

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/dashboard`);
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  return await res.json();
}

export async function getEnergyHistory(period: 'today' | '7d' | '30d' = 'today', deviceId?: string): Promise<EnergyHistoryResponse> {
  const params = new URLSearchParams({ period });
  if (deviceId) params.append('device_id', deviceId);
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/energy?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch energy history: ${res.status}`);
  return await res.json();
}

export async function getDevices(): Promise<Device[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/devices`);
  if (!res.ok) throw new Error(`Failed to fetch devices: ${res.status}`);
  return await res.json();
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/rooms`);
  if (!res.ok) throw new Error(`Failed to fetch rooms: ${res.status}`);
  return await res.json();
}

// --- Phase 2: STEP 6 Energy Analytics APIs ---

export async function getAnalyticsSummary(days = 30): Promise<AnalyticsSummary> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/summary?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch analytics summary: ${res.status}`);
  return await res.json();
}

export async function getDailyAnalytics(days = 30): Promise<DailyEnergyItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/daily?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch daily analytics: ${res.status}`);
  return await res.json();
}

export async function getWeeklyAnalytics(days = 30): Promise<WeeklyEnergyItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/weekly?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch weekly analytics: ${res.status}`);
  return await res.json();
}

export async function getMonthlyAnalytics(days = 30): Promise<MonthlyEnergyItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/monthly?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch monthly analytics: ${res.status}`);
  return await res.json();
}

export async function getDeviceAnalytics(days = 30): Promise<DeviceConsumptionItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/devices?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch device analytics: ${res.status}`);
  return await res.json();
}

export async function getPeakAnalytics(days = 30): Promise<PeakAnalytics> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/peak?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch peak analytics: ${res.status}`);
  return await res.json();
}

export async function getCostAnalytics(days = 30): Promise<CostAnalytics> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/cost?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch cost analytics: ${res.status}`);
  return await res.json();
}

export async function getCO2Analytics(days = 30): Promise<CO2Analytics> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/analytics/co2?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch CO2 analytics: ${res.status}`);
  return await res.json();
}

// --- Phase 2: STEP 7 Personal Energy Routine APIs ---

export async function getRoutine(days = 30): Promise<RoutineResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/routine?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch routine: ${res.status}`);
  return await res.json();
}

export async function getDeviceRoutines(days = 30): Promise<DeviceRoutineProfile[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/routine/devices?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch device routines: ${res.status}`);
  return await res.json();
}

export async function getRoutineTimeline(days = 30): Promise<RoutineTimelineItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/routine/timeline?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch routine timeline: ${res.status}`);
  return await res.json();
}

export async function getRoutineProbabilities(days = 30): Promise<RoutineProbability> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/routine/probability?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch probabilities: ${res.status}`);
  return await res.json();
}

// --- Phase 2: STEP 8 AI Energy Prediction APIs ---

export async function getPredictionForecast(): Promise<PredictionForecastResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/prediction/forecast`);
  if (!res.ok) throw new Error(`Failed to fetch forecast: ${res.status}`);
  return await res.json();
}

export async function getModelBenchmarks(): Promise<ModelEvaluationMetric[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/prediction/models`);
  if (!res.ok) throw new Error(`Failed to fetch model benchmarks: ${res.status}`);
  return await res.json();
}

export async function getPredictionExplanation(): Promise<PredictionExplanation> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/prediction/explanation`);
  if (!res.ok) throw new Error(`Failed to fetch explanation: ${res.status}`);
  return await res.json();
}

export async function getAutomatedInsights(): Promise<InsightDetectionItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/prediction/insights`);
  if (!res.ok) throw new Error(`Failed to fetch insights: ${res.status}`);
  return await res.json();
}

// --- Phase 3: Digital Twin APIs ---

export async function getTwinHome(): Promise<DigitalTwinHome> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/twin/home`);
  if (!res.ok) throw new Error(`Failed to fetch twin home: ${res.status}`);
  return await res.json();
}

export async function getTwinRooms(): Promise<DigitalTwinRoom[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/twin/rooms`);
  if (!res.ok) throw new Error(`Failed to fetch twin rooms: ${res.status}`);
  return await res.json();
}

export async function getTwinDevices(): Promise<DigitalTwinDevice[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/twin/devices`);
  if (!res.ok) throw new Error(`Failed to fetch twin devices: ${res.status}`);
  return await res.json();
}

export async function getTwinState(): Promise<DigitalTwinState> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/twin/state`);
  if (!res.ok) throw new Error(`Failed to fetch twin state: ${res.status}`);
  return await res.json();
}

export async function getTwinDeviceDetail(deviceId: string): Promise<DigitalTwinDeviceDetail> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/twin/device/${encodeURIComponent(deviceId)}`);
  if (!res.ok) throw new Error(`Failed to fetch device detail: ${res.status}`);
  return await res.json();
}

// --- Phase 3: What-If Simulation APIs ---

export async function runSimulation(params: SimulationParameters): Promise<SimulationResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to run simulation: ${res.status}`);
  return await res.json();
}

export async function getSimulationById(simId: string): Promise<SimulationResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/${encodeURIComponent(simId)}`);
  if (!res.ok) throw new Error(`Failed to fetch simulation ${simId}: ${res.status}`);
  return await res.json();
}

export async function getSimulationHistory(): Promise<SimulationResult[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/history`);
  if (!res.ok) throw new Error(`Failed to fetch simulation history: ${res.status}`);
  return await res.json();
}

export async function getSimulationTemplates(): Promise<SimulationTemplateItem[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/templates`);
  if (!res.ok) throw new Error(`Failed to fetch simulation templates: ${res.status}`);
  return await res.json();
}

export async function getScenariosComparison(): Promise<ScenarioComparisonTable> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios comparison: ${res.status}`);
  return await res.json();
}

export async function saveScenario(result: SimulationResult): Promise<ScenarioItem> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(`Failed to save scenario: ${res.status}`);
  return await res.json();
}

export async function deleteScenario(scenarioId: string): Promise<any> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/scenario/${encodeURIComponent(scenarioId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete scenario: ${res.status}`);
  return await res.json();
}

export async function calculateScenarioScores(weights?: ScenarioScoreWeights): Promise<ScenarioScoreResult[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: weights ? JSON.stringify(weights) : undefined,
  });
  if (!res.ok) throw new Error(`Failed to score scenarios: ${res.status}`);
  return await res.json();
}

export async function getAIRecommendation(): Promise<AIRecommendationResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/simulation/recommendation`);
  if (!res.ok) throw new Error(`Failed to fetch AI recommendation: ${res.status}`);
  return await res.json();
}

// --- Google Sheets Live Data Feed ---

export interface GSheetStatus {
  connected: boolean;
  web_app_url: string;
  last_sync_at: string;
  last_row_count: number;
  last_error: string;
  cache_ttl_seconds: number;
}

export interface GSheetConnectResult {
  status: string;
  message: string;
  error?: string;
  web_app_url?: string;
  sync_result?: {
    row_count: number;
    new_rows_inserted: number;
    synced_at: string;
  };
}

export interface GSheetPreview {
  connected: boolean;
  row_count: number;
  rows: Record<string, any>[];
  message?: string;
}

export interface GSheetSyncResult {
  success: boolean;
  cached?: boolean;
  row_count?: number;
  new_rows_inserted?: number;
  synced_at?: string;
  cache_age_seconds?: number;
}

export async function getGSheetStatus(): Promise<GSheetStatus> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/status`, {}, 5000);
  if (!res.ok) throw new Error(`Failed to fetch gsheet status: ${res.status}`);
  return await res.json();
}

export async function connectGoogleSheet(webAppUrl: string): Promise<GSheetConnectResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ web_app_url: webAppUrl, test_on_connect: true }),
  }, 20000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to connect: ${res.status}`);
  }
  return await res.json();
}

export async function syncGSheet(): Promise<GSheetSyncResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/sync`, {
    method: 'POST',
  }, 20000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to sync: ${res.status}`);
  }
  return await res.json();
}

export async function previewGSheet(limit = 15): Promise<GSheetPreview> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/preview?limit=${limit}`, {}, 10000);
  if (!res.ok) throw new Error(`Failed to preview gsheet: ${res.status}`);
  return await res.json();
}

export async function disconnectGSheet(): Promise<{ status: string; message: string }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/disconnect`, {
    method: 'DELETE',
  }, 5000);
  if (!res.ok) throw new Error(`Failed to disconnect: ${res.status}`);
  return await res.json();
}

export async function getGSheetAppsScriptTemplate(): Promise<{ language: string; code: string; instructions: string[] }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/apps-script-template`, {}, 5000);
  if (!res.ok) throw new Error(`Failed to get template: ${res.status}`);
  return await res.json();
}

// --- 5-Stage Pipeline & ESP32 Simulator API ---

export interface PipelineStageHealth {
  name: string;
  status: 'online' | 'idle' | 'not_configured' | 'error';
  [key: string]: any;
}

export interface PipelineHealthResponse {
  stage1_origin: PipelineStageHealth;
  stage2_bridge: PipelineStageHealth;
  stage3_ledger: PipelineStageHealth;
  stage4_brain: PipelineStageHealth;
  stage5_website: PipelineStageHealth;
}

export interface ESP32SimStatus {
  running: boolean;
  device_id: string;
  target: string;
  interval_seconds: number;
  packets_sent: number;
  packets_failed: number;
  last_sent_at?: string;
  last_status_code?: number;
  last_error?: string;
  last_payload?: Record<string, any>;
  manual_override_watts?: number;
}

export async function getPipelineHealth(): Promise<PipelineHealthResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/pipeline/health`, {}, 5000);
  if (!res.ok) throw new Error(`Failed to fetch pipeline health: ${res.status}`);
  return await res.json();
}

export async function getESP32SimStatus(): Promise<ESP32SimStatus> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/simulation/esp32/status`, {}, 5000);
  if (!res.ok) throw new Error(`Failed to fetch sim status: ${res.status}`);
  return await res.json();
}

export async function startESP32Sim(
  deviceId: string = 'living_room_ac',
  target: string = 'both',
  interval: number = 15,
  powerWatts?: number
): Promise<{ status: string; message: string }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/simulation/esp32/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      target,
      interval,
      power_watts: powerWatts,
    }),
  }, 5000);
  if (!res.ok) throw new Error(`Failed to start simulator: ${res.status}`);
  return await res.json();
}

export async function stopESP32Sim(): Promise<{ status: string; message: string }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/simulation/esp32/stop`, {
    method: 'POST',
  }, 5000);
  if (!res.ok) throw new Error(`Failed to stop simulator: ${res.status}`);
  return await res.json();
}

export async function sendESP32TestPacket(
  deviceId: string = 'living_room_ac',
  powerWatts: number = 1200.0,
  voltage: number = 230.0
): Promise<{ success: boolean; payload: any; results: any }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/gsheet/simulation/esp32/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      power_watts: powerWatts,
      voltage,
    }),
  }, 10000);
  if (!res.ok) throw new Error(`Failed to send test packet: ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// TOU Tariff & Multi-Circuit Energy API Interfaces & Functions
// ---------------------------------------------------------------------------

export interface TOUStatusResponse {
  is_on_peak: boolean;
  current_rate_thb: number;
  flat_rate_thb: number;
  period_name: string;
  period_color: 'rose' | 'emerald';
  hours_to_next: number;
  next_period: string;
  timestamp: string;
}

export interface CircuitDeviceItem {
  device_id: string;
  name: string;
  room_id: string;
  room_name?: string;
  rated_power: number;
  status: number;
  temperature?: number;
  category: string;
  circuit: string;
  current_power_w: number;
  is_active: boolean;
}

export interface CircuitCategory {
  name: string;
  devices: CircuitDeviceItem[];
  total_power_w: number;
  rated_power_w: number;
}

export interface CircuitsResponse {
  lighting: CircuitCategory;
  receptacle: CircuitCategory;
  heavy_load: CircuitCategory;
}

export interface TOUSimulateRequest {
  solar_mode: 'none' | 'ongrid' | 'hybrid';
  solar_capacity_kw: number;
  battery_capacity_kwh: number;
  battery_dod_pct: number;
  ev_enabled: boolean;
  ev_charger_kw: number;
  ev_target_kwh: number;
  ev_mode: 'immediate' | 'smart_offpeak' | 'solar_surplus';
}

export interface HourlyTOUEnergyRecord {
  hour: number;
  hour_label: string;
  is_on_peak: boolean;
  rate_thb: number;
  lighting_kw: number;
  receptacle_kw: number;
  heavy_load_kw: number;
  ev_load_kw: number;
  total_load_kw: number;
  solar_gen_kw: number;
  bat_charge_kw: number;
  bat_discharge_kw: number;
  bat_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
}

export interface TOUSimulateResponse {
  scenario: {
    solar_mode: string;
    solar_capacity_kw: number;
    battery_capacity_kwh: number;
    ev_enabled: boolean;
    ev_charger_kw: number;
    ev_mode: string;
    ev_target_kwh: number;
  };
  totals: {
    total_consumption_kwh: number;
    total_solar_gen_kwh: number;
    total_grid_import_kwh: number;
    total_grid_export_kwh: number;
    on_peak_import_kwh: number;
    off_peak_import_kwh: number;
    solar_self_consumption_pct: number;
  };
  circuits_breakdown: {
    lighting_kwh: number;
    receptacle_kwh: number;
    heavy_load_kwh: number;
    ev_kwh: number;
    lighting_pct: number;
    receptacle_pct: number;
    heavy_load_pct: number;
    ev_pct: number;
  };
  costs: {
    on_peak_cost_thb: number;
    off_peak_cost_thb: number;
    export_income_thb: number;
    daily_tou_cost_thb: number;
    daily_flat_baseline_thb: number;
    raw_tou_without_solar_thb: number;
    daily_savings_thb: number;
    daily_savings_pct: number;
    monthly_flat_cost_thb: number;
    monthly_tou_cost_thb: number;
    monthly_savings_thb: number;
    yearly_savings_thb: number;
    estimated_investment_thb: number;
    payback_period_years: number;
  };
  hourly_chart: HourlyTOUEnergyRecord[];
}

export async function getTOUStatus(): Promise<TOUStatusResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/tou/status`, { cache: 'no-store' }, 5000);
  if (!res.ok) throw new Error(`Failed to fetch TOU status: ${res.status}`);
  return await res.json();
}

export async function getTOUCircuits(): Promise<CircuitsResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/tou/circuits`, { cache: 'no-store' }, 5000);
  if (!res.ok) throw new Error(`Failed to fetch circuits: ${res.status}`);
  return await res.json();
}

export async function runTOUSimulation(req: TOUSimulateRequest): Promise<TOUSimulateResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/tou/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }, 10000);
  if (!res.ok) throw new Error(`Failed to run TOU simulation: ${res.status}`);
  return await res.json();
}

export interface ResetDataResponse {
  status: string;
  rows_deleted: number;
  message: string;
}

export async function resetTelemetryData(keepDays: number | null = null): Promise<ResetDataResponse> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/schedule/data/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, keep_days: keepDays }),
  }, 10000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Failed to reset data: ${res.status}`);
  }
  return await res.json();
}

