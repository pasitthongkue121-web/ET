'use client';

import React from 'react';
import { EnergyScoreBreakdown } from '../lib/types';
import { Award } from './Icons';

interface EnergyScoreCardProps {
  scoreData: EnergyScoreBreakdown;
}

export default function EnergyScoreCard({ scoreData }: EnergyScoreCardProps) {
  const { score, efficiency, peak_usage, standby, usage_pattern, energy_stability, grade, summary } = scoreData;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getGradeColor = (g: string) => {
    if (g === 'A') return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (g === 'B') return 'text-blue-400 border-blue-500/40 bg-blue-500/10';
    if (g === 'C') return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const metrics = [
    { label: 'Efficiency', value: efficiency, color: 'bg-emerald-500' },
    { label: 'Peak Usage', value: peak_usage, color: 'bg-blue-500' },
    { label: 'Standby Control', value: standby, color: 'bg-indigo-500' },
    { label: 'Usage Pattern', value: usage_pattern, color: 'bg-cyan-500' },
    { label: 'Stability', value: energy_stability, color: 'bg-teal-500' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Award className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Energy Performance Score
          </h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${getGradeColor(grade)}`}>
          Grade {grade}
        </span>
      </div>

      {/* Circle & Breakdown */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} stroke="#1e293b" strokeWidth="6" fill="transparent" />
            <circle
              cx="40" cy="40" r={radius} stroke="#10b981" strokeWidth="6" fill="transparent"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-xl font-black text-white font-mono">{score}</span>
            <span className="text-[9px] text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Sliders list */}
        <div className="flex-1 space-y-1.5">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 text-[10px]">{m.label}</span>
              <div className="flex items-center gap-2 w-28">
                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${m.color}`} style={{ width: `${m.value}%` }} />
                </div>
                <span className="font-mono text-slate-300 w-5 text-right text-[10px]">{m.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary note */}
      <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/60 leading-relaxed">
        {summary}
      </p>
    </div>
  );
}
