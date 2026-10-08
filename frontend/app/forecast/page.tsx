'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import {
  getPredictionForecast,
  getModelBenchmarks,
  getPredictionExplanation,
  getAutomatedInsights,
  checkBackendHealth
} from '../../lib/api';
import {
  PredictionForecastResponse,
  ModelEvaluationMetric,
  PredictionExplanation,
  InsightDetectionItem
} from '../../lib/types';
import {
  Brain,
  Sparkles,
  TrendingUp,
  DollarSign,
  Calendar,
  Zap,
  Target,
  RefreshCw,
  Award,
  ShieldCheck,
  AlertCircle,
  Clock
} from '../../components/Icons';

export default function AIForecastPage() {
  const [forecast, setForecast] = useState<PredictionForecastResponse | null>(null);
  const [models, setModels] = useState<ModelEvaluationMetric[]>([]);
  const [explanation, setExplanation] = useState<PredictionExplanation | null>(null);
  const [insights, setInsights] = useState<InsightDetectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);

      const [foreRes, modRes, expRes, insRes] = await Promise.all([
        getPredictionForecast().catch(() => null),
        getModelBenchmarks().catch(() => []),
        getPredictionExplanation().catch(() => null),
        getAutomatedInsights().catch(() => []),
      ]);

      if (foreRes) setForecast(foreRes);
      setModels(modRes as ModelEvaluationMetric[]);
      if (expRes) setExplanation(expRes);
      setInsights(insRes as InsightDetectionItem[]);
    } catch (err) {
      console.error('Error loading forecast data:', err);
      setIsBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppShell isBackendOnline={isBackendOnline} onRefresh={loadData} isLoading={isLoading}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                AI Energy Forecast & Intelligence
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-blue-500/20">
                <Brain className="h-3 w-3" />
                Scikit-Learn ML Core
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              การคาดการณ์พลังงานไฟฟ้าล่วงหน้าด้วย Machine Learning พร้อมคำอธิบาย AI ที่อิงจากข้อมูลจริง
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tag Badges Legend */}
            <div className="hidden md:flex items-center gap-2 text-[11px] bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-slate-400 font-semibold">Data Legend:</span>
              <span className="rounded bg-blue-500/20 text-sky-400 px-1.5 py-0.5 font-mono font-bold border border-blue-500/30">
                [Measured]
              </span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 font-mono font-bold border border-emerald-500/30">
                [Predicted]
              </span>
              <span className="rounded bg-purple-500/20 text-purple-400 px-1.5 py-0.5 font-mono font-bold border border-purple-500/30">
                [Simulated]
              </span>
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Retrain & Forecast
            </button>
          </div>
        </div>

        {/* Section 1: Multi-Horizon Forecast Overview Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* TODAY COMPARISON */}
          <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                TODAY (24H OUTLOOK)
              </span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 border border-blue-500/20">
                Hourly ML
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Actual
                  <span className="text-[10px] font-mono text-slate-500">[Measured]</span>
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  {forecast ? forecast.actual_today_kwh : '--'} <span className="text-xs font-normal text-slate-400">kWh</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Forecast
                  <span className="text-[10px] font-mono text-emerald-400">[Predicted]</span>
                </div>
                <div className="mt-1 text-2xl font-black text-emerald-400">
                  {forecast ? forecast.forecast_today_kwh : '--'} <span className="text-xs font-normal text-slate-400">kWh</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>Tomorrow Estimated:</span>
              <strong className="text-white">
                {forecast ? `${forecast.tomorrow_total_kwh} kWh (฿${forecast.tomorrow_cost_thb})` : '--'}
              </strong>
            </div>
          </div>

          {/* NEXT 7 DAYS TOTAL */}
          <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                NEXT 7 DAYS OUTLOOK
              </span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                [Predicted]
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-400">Total 7-Day Cumulative:</div>
              <div className="mt-1 text-3xl font-black text-white">
                {forecast ? forecast.next_7_days_total_kwh : '--'}{' '}
                <span className="text-sm font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
              <span className="text-slate-400">Estimated Weekly Cost:</span>
              <strong className="text-emerald-400 text-sm">
                ฿{forecast ? forecast.next_7_days_cost_thb : '--'}
              </strong>
            </div>
          </div>

          {/* END OF MONTH PROJECTION */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 via-slate-900/90 to-slate-950/90 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                END OF MONTH PROJECTION
              </span>
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/20">
                [Predicted]
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-400">Projected Monthly Total:</div>
              <div className="mt-1 text-3xl font-black text-sky-400">
                {forecast ? forecast.end_of_month_forecast_kwh : '--'}{' '}
                <span className="text-sm font-normal text-slate-400">kWh</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
              <span className="text-slate-400">Projected Electricity Bill:</span>
              <strong className="text-amber-400 text-sm font-bold">
                ฿{forecast ? forecast.end_of_month_forecast_cost_thb : '--'}
              </strong>
            </div>
          </div>
        </div>

        {/* Section 2: NEXT 7 DAYS Daily Breakdown Cards */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                NEXT 7 DAYS FORECAST BREAKDOWN
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              Algorithm: {forecast?.champion_model || 'Random Forest'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {(forecast?.next_7_days || []).map((day, idx) => (
              <div
                key={day.date}
                className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-1.5 transition duration-200 hover:border-emerald-500/40"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold">{day.day_name.split(' ')[0]}</span>
                  <span className="font-mono text-[9px] text-slate-500">Day {idx + 1}</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {day.predicted_energy_kwh} <span className="text-xs font-normal text-slate-400">kWh</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-400 pt-1 border-t border-slate-800/50">
                  <span>฿{day.predicted_cost_thb}</span>
                  <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-mono">
                    {day.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Explainable AI & Machine Learning Model Benchmark */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Explainable AI Narrative & Feature Importances */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  AI EXPLANATION (XAI)
                </h3>
              </div>
              <span className="text-xs text-slate-400">Data-driven Reasoning</span>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3.5 text-xs text-slate-200 leading-relaxed">
              <p className="font-medium text-white mb-1.5">
                💡 คำอธิบายการคาดการณ์จากโมเดล {explanation?.champion_model}:
              </p>
              <p className="text-slate-300">
                {explanation?.narrative_explanation ||
                  'AI คาดว่าการใช้พลังงานในช่วงเย็นจะเพิ่มขึ้น เนื่องจากรูปแบบการใช้งานเครื่องปรับอากาศในช่วงเวลา 18:00–22:00 ประกอบกับอุณหภูมิแวดล้อมที่ยังคงสะสมความร้อน'}
              </p>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-400">
                Top Influencing Features (น้ำหนักของตัวแปรที่มีผลต่อการทำนาย):
              </span>
              {(explanation?.top_influencing_features || []).map((feat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      {feat.description} <span className="font-mono text-[10px] text-slate-500">({feat.feature})</span>
                    </span>
                    <span className="font-bold text-sky-400">{feat.importance_pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                      style={{ width: `${feat.importance_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Machine Learning Benchmark Table */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Model Selection & Validation Benchmark
                </h3>
              </div>
              <span className="text-xs text-slate-400">80/20 Train/Test Split</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Algorithm</th>
                    <th className="py-2.5 px-3 font-semibold">MAE (Watts)</th>
                    <th className="py-2.5 px-3 font-semibold">RMSE (Watts)</th>
                    <th className="py-2.5 px-3 font-semibold">R² Score</th>
                    <th className="py-2.5 px-3 font-semibold">Selection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {models.map((m) => (
                    <tr
                      key={m.model_name}
                      className={`hover:bg-slate-800/30 transition ${
                        m.is_champion ? 'bg-emerald-950/20 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-white flex items-center gap-1.5">
                        {m.model_name}
                        {m.is_champion && (
                          <span className="rounded bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.2 font-bold border border-emerald-500/30">
                            Champion
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{m.mae}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{m.rmse}</td>
                      <td className="py-3 px-3 font-mono text-sky-400">{m.r2}</td>
                      <td className="py-3 px-3">
                        {m.is_champion ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                            <ShieldCheck className="h-3.5 w-3.5" /> Best Model
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400 space-y-1">
              <p>
                <strong>Evaluation Criterion:</strong> ระบบทดสอบและเปรียบเทียบโมเดลอัตโนมัติ โดยเลือกโมเดลที่มี Validation Error (RMSE) ต่ำสุดและ $R^2$ สูงสุด เพื่อให้การพยากรณ์มีความแม่นยำสูงสุด
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: AI Insight Engine Feed (7 Automated Pattern Detectors) */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                AI INSIGHT ENGINE (AUTOMATED PATTERN DETECTION)
              </h3>
            </div>
            <span className="text-xs text-slate-400">7 Detectors Active</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2 flex flex-col justify-between hover:border-blue-500/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white truncate" title={item.title}>
                      {item.title}
                    </h4>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        item.severity === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : item.severity === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-500/15 text-sky-400 border border-blue-500/30'
                      }`}
                    >
                      {item.severity} ({item.confidence}%)
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 space-y-1 text-[11px]">
                  {item.potential_saving_thb && (
                    <div className="text-emerald-400 font-semibold flex items-center justify-between">
                      <span>Potential Saving:</span>
                      <span>฿{item.potential_saving_thb} / เดือน ({item.potential_saving_kwh} kWh)</span>
                    </div>
                  )}
                  {item.action_recommendation && (
                    <div className="text-slate-400 italic">
                      👉 {item.action_recommendation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
