'use client';

import React, { useState } from 'react';
import {
  AnalyticsSummary,
  DailyEnergyItem,
  DeviceConsumptionItem,
  PeakAnalytics
} from '../lib/types';
import {
  BarChart3,
  Zap,
  DollarSign,
  TrendingUp,
  Clock,
  PieChart,
  Leaf,
  Activity
} from './Icons';

interface AnalyticsSectionProps {
  summary: AnalyticsSummary | null;
  daily: DailyEnergyItem[];
  devices: DeviceConsumptionItem[];
  peak: PeakAnalytics | null;
}

export default function AnalyticsSection({
  summary,
  daily,
  devices,
  peak,
}: AnalyticsSectionProps) {
  const [activeChart, setActiveChart] = useState<'daily' | 'devices' | 'hourly'>('daily');

  const maxDailyKwh = daily.length > 0 ? Math.max(...daily.map((d) => d.energy_kwh), 10) : 10;
  const hourlyDist = peak?.peak_hours_distribution || [];
  const maxHourlyPower = hourlyDist.length > 0 ? Math.max(...hourlyDist.map((h) => h.avg_power_w), 100) : 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              Energy Analytics Engine
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            การคำนวณสถิติและวิเคราะห์พฤติกรรมการใช้พลังงานเชิงลึกจากฐานข้อมูลจริง
          </p>
        </div>

        {/* Chart View Switcher */}
        <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
          <button
            onClick={() => setActiveChart('daily')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
              activeChart === 'daily'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Daily Energy
          </button>
          <button
            onClick={() => setActiveChart('devices')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
              activeChart === 'devices'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            Device Consumption
          </button>
          <button
            onClick={() => setActiveChart('hourly')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
              activeChart === 'hourly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Hourly Pattern
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Highlights */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Average Power</span>
          <p className="mt-1 text-base font-bold text-white">
            {summary ? summary.avg_power_w : '--'} <span className="text-xs text-slate-400">W</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Power</span>
          <p className="mt-1 text-base font-bold text-amber-400">
            {summary ? summary.max_power_w : '--'} <span className="text-xs text-slate-400">W</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Time</span>
          <p className="mt-1 text-sm font-bold text-sky-400 truncate" title={summary?.peak_usage_time}>
            {summary?.peak_usage_time.split(' ')[1] || '20:00'} <span className="text-xs text-slate-400">hrs</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Duration</span>
          <p className="mt-1 text-base font-bold text-rose-400">
            {summary ? `${summary.peak_usage_duration_hours} hrs` : '--'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">30D Energy</span>
          <p className="mt-1 text-base font-bold text-emerald-400">
            {summary ? `${summary.total_energy_kwh}` : '--'} <span className="text-xs text-slate-400">kWh</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">30D Total Cost</span>
          <p className="mt-1 text-base font-bold text-white">
            ฿{summary ? summary.total_cost_thb : '--'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">CO₂ Footprint</span>
          <p className="mt-1 text-base font-bold text-teal-400 flex items-center gap-1">
            <Leaf className="h-3 w-3" />
            {summary ? summary.total_co2_kg : '--'} <span className="text-xs text-slate-400">kg</span>
          </p>
        </div>
      </div>

      {/* Chart View Content */}
      {activeChart === 'daily' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Daily Consumption (Last 14 Days)</span>
            <span>kWh / Day</span>
          </div>

          <div className="mt-3 flex h-48 items-end gap-1.5 sm:gap-2.5 overflow-x-auto pt-4 pb-2">
            {daily.slice(-14).map((d, i) => {
              const heightPct = Math.min(100, Math.max(10, (d.energy_kwh / maxDailyKwh) * 100));
              return (
                <div key={i} className="group relative flex flex-1 min-w-[28px] flex-col items-center h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] font-medium text-white shadow group-hover:block whitespace-nowrap">
                    {d.date}: <strong>{d.energy_kwh} kWh</strong> (฿{d.cost_thb})
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-blue-700 via-sky-500 to-emerald-400 transition-all duration-300 group-hover:brightness-125"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-1.5 text-[9px] text-slate-400 truncate w-full text-center">
                    {d.date.split('-')[2] || d.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeChart === 'devices' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Device Energy Consumption Share</span>
            <span>Total: {devices.reduce((acc, d) => acc + d.total_kwh, 0).toFixed(1)} kWh</span>
          </div>

          <div className="space-y-2.5">
            {devices.map((dev) => (
              <div key={dev.device_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{dev.name}</span>
                    <span className="text-[11px] text-slate-500">({dev.room_name})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{dev.total_kwh} kWh</span>
                    <span className="font-bold text-sky-400 w-12 text-right">{dev.percentage}%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${dev.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'hourly' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>24-Hour Energy Load Pattern (Average Watts)</span>
            <span className="text-amber-400">Peak Window: 19:00–22:00</span>
          </div>

          <div className="mt-3 flex h-48 items-end gap-1 overflow-x-auto pt-4 pb-2">
            {hourlyDist.map((h) => {
              const heightPct = Math.min(100, Math.max(8, (h.avg_power_w / maxHourlyPower) * 100));
              return (
                <div key={h.hour} className="group relative flex flex-1 min-w-[18px] flex-col items-center h-full justify-end">
                  <div className="pointer-events-none absolute -top-10 z-20 hidden rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] font-medium text-white shadow group-hover:block whitespace-nowrap">
                    {h.label}: <strong>{h.avg_power_w} W</strong>
                  </div>

                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 group-hover:brightness-125 ${
                      h.is_peak
                        ? 'bg-gradient-to-t from-amber-600 to-rose-400'
                        : 'bg-gradient-to-t from-slate-700 to-blue-500'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-1 text-[8px] text-slate-500">
                    {h.hour % 3 === 0 ? `${h.hour}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
