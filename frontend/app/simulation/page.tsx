'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import {
  runSimulation,
  getSimulationTemplates,
  getScenariosComparison,
  saveScenario,
  calculateScenarioScores,
  getAIRecommendation,
  checkBackendHealth
} from '../../lib/api';
import {
  SimulationParameters,
  SimulationResult,
  SimulationTemplateItem,
  ScenarioComparisonTable,
  ScenarioScoreWeights,
  ScenarioScoreResult,
  AIRecommendationResult
} from '../../lib/types';
import {
  Sliders,
  Sparkles,
  Zap,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Clock,
  Thermometer,
  Award,
  AlertCircle,
  CheckCircle2,
  Table,
  Wind,
  Layers
} from '../../components/Icons';

function SimulationStudioContent() {
  const searchParams = useSearchParams();
  const initialDeviceId = searchParams.get('device') || 'AC_LIVING';
  const initialTemp = parseFloat(searchParams.get('temp') || '26.0');

  // Form parameters
  const [params, setParams] = useState<SimulationParameters>({
    ac_device_id: initialDeviceId,
    ac_target_temp: initialTemp,
    ac_start_hour: 18,
    ac_end_hour: 22,
    device_power_overrides: { AC_LIVING: 1500.0 },
    standby_reduction_w: 0.0,
    scenario_name: 'What-If AC 26°C + Early Close'
  });

  // State
  const [templates, setTemplates] = useState<SimulationTemplateItem[]>([]);
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(null);
  const [scenariosTable, setScenariosTable] = useState<ScenarioComparisonTable | null>(null);
  const [scores, setScores] = useState<ScenarioScoreResult[]>([]);
  const [recommendation, setRecommendation] = useState<AIRecommendationResult | null>(null);
  const [weights, setWeights] = useState<ScenarioScoreWeights>({
    efficiency_weight: 0.40,
    cost_weight: 0.30,
    peak_weight: 0.20,
    comfort_weight: 0.10
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load initial templates & scenarios
  const loadInitialData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);
      if (isHealthy) {
        const [templatesRes, scenariosRes, recRes] = await Promise.all([
          getSimulationTemplates().catch(() => [] as SimulationTemplateItem[]),
          getScenariosComparison().catch(() => null),
          getAIRecommendation().catch(() => null)
        ]);
        if (templatesRes) setTemplates(templatesRes as SimulationTemplateItem[]);
        if (scenariosRes) setScenariosTable(scenariosRes);
        if (recRes) setRecommendation(recRes);

        // Run default simulation to show results immediately
        const defaultRun = await runSimulation(params).catch(() => null);
        if (defaultRun) setActiveResult(defaultRun);
        const scoreRes = await calculateScenarioScores(weights).catch(() => []);
        setScores(scoreRes);
      }
    } catch (err) {
      console.error('Failed to load simulation studio:', err);
      setIsBackendOnline(false);
    } finally {
      setIsPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Execute simulation
  const handleRunSimulation = async () => {
    setIsLoading(true);
    setSaveSuccess(false);
    try {
      const result = await runSimulation(params);
      setActiveResult(result);
      const [updatedScenarios, scoreRes, recRes] = await Promise.all([
        getScenariosComparison(),
        calculateScenarioScores(weights),
        getAIRecommendation()
      ]);
      setScenariosTable(updatedScenarios);
      setScores(scoreRes);
      setRecommendation(recRes);
    } catch (err) {
      console.error('Failed to run simulation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply template
  const handleApplyTemplate = (tmpl: SimulationTemplateItem) => {
    setParams({
      ...tmpl.default_parameters,
      scenario_name: tmpl.title
    });
  };

  // Save current result as scenario
  const handleSaveScenario = async () => {
    if (!activeResult) return;
    try {
      await saveScenario(activeResult);
      setSaveSuccess(true);
      const updated = await getScenariosComparison();
      setScenariosTable(updated);
      const rec = await getAIRecommendation();
      setRecommendation(rec);
    } catch (err) {
      console.error('Failed to save scenario:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar isBackendOnline={isBackendOnline} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Sliders className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                  WHAT-IF SIMULATION STUDIO
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                    [SIMULATED] Isolated State
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  ทดลองเปลี่ยนแปลงเงื่อนไขและพฤติกรรมในบ้านเสมือนจริง โดยไม่มีผลกระทบต่อข้อมูลจริงในระบบ
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Real DB: Untouched (Zero Writes)
            </span>
          </div>
        </div>

        {/* Section 1: Template Quick-Picks */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            WHAT-IF SCENARIO TEMPLATES
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleApplyTemplate(tmpl)}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 text-left transition-all group shadow-sm"
              >
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 uppercase">
                  {tmpl.category}
                </span>
                <p className="text-xs font-bold text-white mt-2 group-hover:text-amber-300 transition-colors line-clamp-1">
                  {tmpl.title}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {tmpl.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Interactive Parameter Controls & Result Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                SIMULATION PARAMETERS
              </h3>
              <span className="text-[11px] text-slate-500">Physics-based</span>
            </div>

            {/* Scenario Name */}
            <div>
              <label className="text-xs font-medium text-slate-300">Scenario Name</label>
              <input
                type="text"
                value={params.scenario_name || ''}
                onChange={(e) => setParams({ ...params, scenario_name: e.target.value })}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="e.g. Eco Mode 26°C"
              />
            </div>

            {/* AC Temperature Control */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/70">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Thermometer className="h-4 w-4 text-sky-400" />
                  AC Setpoint Temperature
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px]">Base: 24°C</span>
                  <span className="text-sm font-bold text-amber-400">{params.ac_target_temp}°C</span>
                </div>
              </div>
              <input
                type="range"
                min="22"
                max="28"
                step="1"
                value={params.ac_target_temp || 26}
                onChange={(e) => setParams({ ...params, ac_target_temp: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 px-1 font-mono">
                <span>22°C (Cool)</span>
                <span>24°C (Std)</span>
                <span>26°C (Eco)</span>
                <span>28°C (Max)</span>
              </div>
            </div>

            {/* Schedule Operating Hours */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/70">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  Living Room AC Operating Window
                </span>
                <span className="text-xs font-bold text-indigo-300">
                  {params.ac_start_hour}:00 – {params.ac_end_hour}:00
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="text-[11px] text-slate-400">Start Time</label>
                  <select
                    value={params.ac_start_hour ?? 18}
                    onChange={(e) => setParams({ ...params, ac_start_hour: parseInt(e.target.value) })}
                    className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={17}>17:00 (Early)</option>
                    <option value={18}>18:00 (Standard)</option>
                    <option value={19}>19:00 (Delayed)</option>
                    <option value={20}>20:00 (Post-Peak)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">End Time</label>
                  <select
                    value={params.ac_end_hour ?? 22}
                    onChange={(e) => setParams({ ...params, ac_end_hour: parseInt(e.target.value) })}
                    className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={21}>21:00 (Cut 2h)</option>
                    <option value={22}>22:00 (Cut 1h)</option>
                    <option value={23}>23:00 (Standard)</option>
                    <option value={24}>00:00 (Extended)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Standby Power Reduction */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/70">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  Cut Standby / Vampire Load
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  -{params.standby_reduction_w || 0} W
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={params.standby_reduction_w || 0}
                onChange={(e) => setParams({ ...params, standby_reduction_w: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                จำลองการตัดไฟอุปกรณ์ Standby ของ PC, TV, และเครื่องเสียง
              </p>
            </div>

            {/* Equipment Upgrade */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/70">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Wind className="h-4 w-4 text-amber-400" />
                  AC Power Rating Upgrade
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {params.device_power_overrides?.AC_LIVING || 1500} W
                </span>
              </div>
              <select
                value={params.device_power_overrides?.AC_LIVING || 1500}
                onChange={(e) =>
                  setParams({
                    ...params,
                    device_power_overrides: { AC_LIVING: parseFloat(e.target.value) }
                  })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={1500}>1,500 W (Current Fixed-Speed AC)</option>
                <option value={1200}>1,200 W (High-efficiency 3-Star)</option>
                <option value={1050}>1,050 W (Inverter 5-Star Premium)</option>
              </select>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunSimulation}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white font-bold text-xs tracking-wide shadow-lg shadow-orange-500/20 hover:from-amber-600 hover:to-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Computing Thermodynamic Simulation...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  RUN WHAT-IF SIMULATION
                </>
              )}
            </button>
          </div>

          {/* Results Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {activeResult && (
              <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
                {/* Result Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      Simulation Result • {activeResult.scenario_name}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      เปรียบเทียบผลลัพธ์: Real Baseline vs Simulated
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                        activeResult.confidence_level === 'High'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Confidence: {activeResult.confidence_level}
                    </span>
                  </div>
                </div>

                {/* 4 KPI Comparison Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Energy */}
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Monthly Energy</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-bold text-white">
                        {(activeResult.simulated_monthly_kwh ?? 0).toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-500 line-through">
                        {(activeResult.current_monthly_kwh ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-400">
                      ↓ {(activeResult.energy_saving_kwh ?? 0).toFixed(1)} kWh (-{(activeResult.energy_saving_pct ?? 0).toFixed(1)}%)
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Monthly Cost</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-bold text-white">
                        ฿{(activeResult.simulated_monthly_cost_thb ?? 0).toFixed(0)}
                      </span>
                      <span className="text-[10px] text-slate-500 line-through">
                        ฿{(activeResult.current_monthly_cost_thb ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-400">
                      ↓ ฿{(activeResult.cost_saving_thb ?? 0).toFixed(0)} (-{(activeResult.cost_saving_pct ?? 0).toFixed(1)}%)
                    </div>
                  </div>

                  {/* Peak Power */}
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Peak Power</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-bold text-white">
                        {(activeResult.simulated_peak_kw ?? 0).toFixed(2)} kW
                      </span>
                      <span className="text-[10px] text-slate-500 line-through">
                        {(activeResult.current_peak_kw ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-sky-400">
                      ↓ {(activeResult.peak_reduction_kw ?? 0).toFixed(2)} kW (-{(activeResult.peak_reduction_pct ?? 0).toFixed(1)}%)
                    </div>
                  </div>

                  {/* CO2 */}
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">CO₂ Reduction</span>
                    <p className="text-base font-bold text-emerald-400 mt-1">
                      -{(activeResult.co2_reduction_kg ?? 0).toFixed(1)} <span className="text-xs text-slate-400 font-normal">kg</span>
                    </p>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Factor 0.4999 kg/kWh
                    </div>
                  </div>
                </div>

                {/* Confidence Reason */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white">การประเมินความเชื่อมั่น (Confidence Explanation):</span>{' '}
                    {activeResult.confidence_reason}
                  </div>
                </div>

                {/* Visual Chart: 24-hour Peak Load Shaving */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      24-HOUR POWER LOAD CURVE (Current vs Simulated)
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-slate-500" /> Current Baseline
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" /> What-If Simulated
                      </span>
                    </div>
                  </div>

                  {/* SVG Load Chart */}
                  <div className="h-40 w-full bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-end gap-1.5">
                    {activeResult.hourly_load_comparison.map((item) => {
                      const maxW = 2000;
                      const baseH = Math.min(100, Math.max(10, (item.current_power_w / maxW) * 100));
                      const simH = Math.min(100, Math.max(10, (item.simulated_power_w / maxW) * 100));
                      return (
                        <div key={item.hour} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                          {/* Hover Tooltip */}
                          <div className="absolute -top-12 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] text-white z-20 whitespace-nowrap shadow-lg">
                            <span>{item.hour_label}</span>
                            <span className="text-slate-400">Base: {item.current_power_w}W</span>
                            <span className="text-emerald-400">Sim: {item.simulated_power_w}W</span>
                          </div>

                          <div className="w-full flex items-end gap-0.5 h-full">
                            <div
                              style={{ height: `${baseH}%` }}
                              className="w-1/2 bg-slate-700/60 rounded-t-sm"
                            />
                            <div
                              style={{ height: `${simH}%` }}
                              className="w-1/2 bg-emerald-500 rounded-t-sm"
                            />
                          </div>
                          {item.hour % 4 === 0 && (
                            <span className="text-[9px] text-slate-500">{item.hour}h</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save Scenario Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-400">
                    ชอบผลลัพธ์นี้หรือไม่? บันทึกเพื่อนำไปเปรียบเทียบในตาราง Scenario Comparison
                  </p>
                  <button
                    onClick={handleSaveScenario}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      saveSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Saved to Scenarios!
                      </>
                    ) : (
                      <>
                        <Table className="h-4 w-4" />
                        บันทึกเป็น Scenario
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Scenario Comparison Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Table className="h-5 w-5 text-indigo-400" />
                SCENARIO COMPARISON MATRIX
              </h2>
              <p className="text-xs text-slate-400">
                เปรียบเทียบผลการจำลองในแต่ละ Scenario ทั้งด้านพลังงาน ค่าใช้จ่าย Peak Load และคะแนนรวม
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              {scenariosTable?.scenarios.length || 0} Scenarios Configured
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Scenario</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Energy (kWh/mo)</th>
                  <th className="py-3.5 px-4 text-right">Cost (฿/mo)</th>
                  <th className="py-3.5 px-4 text-right">Saving (฿)</th>
                  <th className="py-3.5 px-4 text-right">Peak (kW)</th>
                  <th className="py-3.5 px-4 text-right">Reduction %</th>
                  <th className="py-3.5 px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {scenariosTable?.scenarios.map((sc) => {
                  const isBaseline = sc.id === 'current';
                  const isRecommended = recommendation?.recommended_scenario_id === sc.id;
                  return (
                    <tr
                      key={sc.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isRecommended ? 'bg-indigo-950/20 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        {sc.name}
                        {isRecommended && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                            RECOMMENDED
                          </span>
                        )}
                        {isBaseline && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-normal">
                            Baseline
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{sc.description || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                        {(sc.energy_kwh ?? 0).toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                        ฿{(sc.cost_thb ?? 0).toFixed(0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        {(sc.saving_thb ?? 0) > 0 ? `+฿${(sc.saving_thb ?? 0).toFixed(0)}` : '0'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-sky-300">
                        {(sc.peak_kw ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        {(sc.reduction_pct ?? 0) > 0 ? `-${(sc.reduction_pct ?? 0).toFixed(1)}%` : '0%'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 font-bold text-amber-400">
                          {sc.score != null ? sc.score.toFixed(1) : '--'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: AI Recommendation & Configurable Weights */}
        {recommendation && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recommendation Banner (8 cols) */}
            <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    AI Energy Twin Recommendation • [RECOMMENDED]
                  </span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    {recommendation.headline}
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                {recommendation.justification_points.map((pt, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    ประหยัดพลังงาน: <strong className="text-emerald-400">{recommendation.energy_saving_pct.toFixed(1)}%</strong>
                  </span>
                  <span className="text-slate-400">
                    ประหยัดค่าไฟ: <strong className="text-emerald-400">฿{recommendation.cost_saving_thb.toFixed(0)}/เดือน</strong>
                  </span>
                </div>
                <span className="text-indigo-300 font-medium">
                  {recommendation.comfort_impact}
                </span>
              </div>
            </div>

            {/* Configurable Scenario Weights (4 cols) */}
            <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  SCENARIO SCORING WEIGHTS
                </h4>
                <span className="text-[10px] text-slate-500">Configurable</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Energy Efficiency</span>
                    <span className="font-bold text-emerald-400">{(weights.efficiency_weight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.efficiency_weight}
                    onChange={(e) => setWeights({ ...weights, efficiency_weight: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Cost Saving</span>
                    <span className="font-bold text-amber-400">{(weights.cost_weight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.cost_weight}
                    onChange={(e) => setWeights({ ...weights, cost_weight: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Peak Reduction</span>
                    <span className="font-bold text-sky-400">{(weights.peak_weight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.peak_weight}
                    onChange={(e) => setWeights({ ...weights, peak_weight: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>User Comfort Impact</span>
                    <span className="font-bold text-indigo-400">{(weights.comfort_weight * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.comfort_weight}
                    onChange={(e) => setWeights({ ...weights, comfort_weight: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SimulationStudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading What-If Studio...</div>}>
      <SimulationStudioContent />
    </Suspense>
  );
}
