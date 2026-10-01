'use client';

import React, { useState } from 'react';
import { Zap, Calendar, TrendingUp } from './Icons';

interface DailyEnergyPoint {
  date: string;
  energy_kwh: number;
  cost_thb?: number;
}

interface EnergyUsageChartProps {
  data?: DailyEnergyPoint[];
  todayKwh?: number;
  avgKwh?: number;
  isLoading?: boolean;
}

export default function EnergyUsageChart({
  data = [],
  todayKwh = 12.4,
  avgKwh = 10.8,
  isLoading = false,
}: EnergyUsageChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fallback 7-day data if none provided
  const points: DailyEnergyPoint[] = data && data.length > 0 ? data.slice(-7) : [
    { date: 'Mon', energy_kwh: 9.8, cost_thb: 43.3 },
    { date: 'Tue', energy_kwh: 10.4, cost_thb: 46.0 },
    { date: 'Wed', energy_kwh: 11.2, cost_thb: 49.5 },
    { date: 'Thu', energy_kwh: 9.6, cost_thb: 42.4 },
    { date: 'Fri', energy_kwh: 12.8, cost_thb: 56.6 },
    { date: 'Sat', energy_kwh: 14.1, cost_thb: 62.3 },
    { date: 'Sun', energy_kwh: todayKwh, cost_thb: todayKwh * 4.42 },
  ];

  const maxVal = Math.max(...points.map(p => p.energy_kwh), 15);

  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Energy Usage (kWh)
            </h3>
            <span className="text-[10px] text-slate-400">Daily 7-Day Cumulative</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400">
            Avg: <span className="font-bold text-slate-200 font-mono">{avgKwh.toFixed(1)} kWh</span>
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </div>
      </div>

      {/* Bar Chart Area */}
      <div className="h-36 pt-4 flex items-end justify-between gap-2 px-1">
        {points.map((pt, idx) => {
          const heightPct = Math.min(100, Math.max(12, (pt.energy_kwh / maxVal) * 100));
          const isToday = idx === points.length - 1;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={pt.date + idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-1.5 bg-slate-950 text-white text-[10px] px-2 py-1 rounded shadow-lg border border-slate-700 z-20 whitespace-nowrap">
                  <div className="font-bold">{pt.date}</div>
                  <div className="text-emerald-400">{pt.energy_kwh.toFixed(1)} kWh</div>
                  {pt.cost_thb && <div className="text-slate-400">฿{pt.cost_thb.toFixed(1)}</div>}
                </div>
              )}

              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all duration-200 ${
                  isToday
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : isHovered
                    ? 'bg-blue-500'
                    : 'bg-slate-700/80 hover:bg-slate-600'
                }`}
                style={{ height: `${heightPct}%` }}
              />

              {/* Label */}
              <span className={`text-[10px] mt-1 truncate ${
                isToday ? 'font-bold text-emerald-400' : 'text-slate-400'
              }`}>
                {pt.date.length > 5 ? pt.date.slice(-5) : pt.date}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/50 mt-1">
        <span>Today: <strong className="text-white font-mono">{todayKwh.toFixed(1)} kWh</strong></span>
        <span className="text-emerald-400 font-medium">● 7-Day Trend Steady</span>
      </div>
    </div>
  );
}
