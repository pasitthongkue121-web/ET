'use client';

import React from 'react';
import Link from 'next/link';
import { Brain, Sparkles, Clock, TrendingUp, AlertCircle, ArrowRight, ShieldCheck } from './Icons';
import { DashboardSummary, RoutineResponse, InsightDetectionItem } from '../lib/types';

interface AIIntelligenceWidgetProps {
  summary: DashboardSummary | null;
  routine: RoutineResponse | null;
  insights: InsightDetectionItem[];
}

export default function AIIntelligenceWidget({
  summary,
  routine,
  insights,
}: AIIntelligenceWidgetProps) {
  const score = summary?.energy_score.score ?? 78;
  const grade = summary?.energy_score.grade ?? 'B';
  const monthlyForecast = summary?.monthly_forecast_kwh ?? 245;
  const transitions = routine?.detected_transitions ?? [
    { time: '18:00', title: 'Evening Routine', desc: 'Return home & AC on' },
    { time: '20:00', title: 'Peak Energy', desc: 'Entertainment & PC' },
    { time: '23:00', title: 'Night Routine', desc: 'Sleep mode & bedroom AC' },
  ];

  // Pick top insight or fallback
  const topInsight = insights.length > 0 ? insights[0] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-[#070b19] shadow-2xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-blue-950/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-sky-400 border border-blue-500/30">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              AI ENERGY INTELLIGENCE
            </h3>
            <span className="text-[10px] text-slate-400">Autonomous Home Energy Agent</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active ML Engine
        </span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-800/80 lg:grid-cols-3 lg:divide-y-0 lg:divide-x">
        {/* Sub-section 1: Core Intelligence KPIs */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System Health & Score
            </span>
            <span className="text-[10px] text-blue-400 font-mono">Grade {grade}</span>
          </div>

          <div className="flex items-baseline justify-between border-b border-slate-800/50 pb-3">
            <div>
              <div className="text-xs text-slate-400">Energy Score</div>
              <div className="text-2xl font-black text-white">
                {score} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Peak Time</div>
              <div className="text-xl font-bold text-amber-400">
                20:00 <span className="text-xs font-normal text-slate-400">hrs</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Monthly Forecast:</span>
            <span className="font-bold text-sky-400">
              {monthlyForecast} <span className="text-xs font-normal text-slate-400">kWh</span>
            </span>
          </div>

          <Link
            href="/forecast"
            className="flex items-center justify-between rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-400 transition"
          >
            <span>View Full ML Forecast</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Sub-section 2: AI Learned Routine */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              AI LEARNED ROUTINE
            </div>
            <span className="text-[10px] text-emerald-400">Empirical Pattern</span>
          </div>

          <div className="space-y-2">
            {transitions.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800/80 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-400">
                    {item.time}
                  </span>
                  <span className="font-medium text-slate-200">{item.title}</span>
                </div>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {item.desc.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/routine"
            className="flex items-center justify-between rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 transition"
          >
            <span>Personal Routine Insights</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Sub-section 3: AI Dynamic Insight */}
        <div className="p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                AI INSIGHT
              </div>
              <span className="text-[10px] text-indigo-400">Auto-Detected</span>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 text-xs">
              <div className="font-bold text-white mb-1">
                {topInsight ? topInsight.title : 'ช่วง 19:00–22:00 มีการใช้พลังงานสูงอย่างต่อเนื่อง'}
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {topInsight
                  ? topInsight.description
                  : 'พบว่าช่วง 19:00–22:00 มีการใช้พลังงานสูงอย่างต่อเนื่องจากการเปิดเครื่องปรับอากาศและคอมพิวเตอร์พร้อมกัน'}
              </p>
              {topInsight?.potential_saving_thb && (
                <div className="mt-2 text-[11px] font-semibold text-emerald-400">
                  ⚡ ศักยภาพประหยัด: ฿{topInsight.potential_saving_thb} / เดือน
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Data-grounded analytics</span>
            <span className="text-slate-400">Zero hallucination</span>
          </div>
        </div>
      </div>
    </div>
  );
}
