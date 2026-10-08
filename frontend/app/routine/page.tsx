'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import { getRoutine, getRoutineProbabilities, checkBackendHealth } from '../../lib/api';
import { RoutineResponse, RoutineProbability, RoutineTimelineItem, DeviceRoutineProfile } from '../../lib/types';
import {
  Clock,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck,
  RefreshCw,
  Table,
  CheckCircle2,
  AlertCircle
} from '../../components/Icons';

export default function PersonalRoutinePage() {
  const [routine, setRoutine] = useState<RoutineResponse | null>(null);
  const [probabilities, setProbabilities] = useState<RoutineProbability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);

      const [routRes, probRes] = await Promise.all([
        getRoutine(days).catch(() => null),
        getRoutineProbabilities(days).catch(() => null),
      ]);

      setRoutine(routRes);
      setProbabilities(probRes);
    } catch (err) {
      console.error('Error loading routine data:', err);
      setIsBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const transitions = routine?.detected_transitions || [
    { time: '06:30', title: 'Morning Routine', desc: 'Wakeup & kitchen activation' },
    { time: '08:00', title: 'House Empty', desc: 'Occupancy drops to 0' },
    { time: '18:00', title: 'Evening Routine', desc: 'Return home & AC on' },
    { time: '20:00', title: 'Peak Energy', desc: 'Entertainment & computer load' },
    { time: '23:00', title: 'Night Routine', desc: 'Sleep mode & bedroom AC' },
  ];

  const timeline = routine?.timeline || [];
  const maxTimelinePower = timeline.length > 0 ? Math.max(...timeline.map((t) => t.power_w), 100) : 100;
  const devicesRoutine = routine?.devices_routine || [];

  return (
    <AppShell isBackendOnline={isBackendOnline} onRefresh={loadData} isLoading={isLoading}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Personal Energy Routine
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" />
                AI Learned Routine
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              ระบบเรียนรู้รูปแบบและกิจวัตรการใช้พลังงานไฟฟ้าของบ้านจากข้อมูลย้อนหลัง {days} วัน
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Routine
            </button>
          </div>
        </div>

        {/* Section 1: YOUR HOME ROUTINE Transition Cards */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                YOUR HOME ROUTINE
              </h3>
            </div>
            <span className="text-xs text-slate-400">ตรวจพบจากแบบแผนทางสถิติและ Occupancy</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {transitions.map((t, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950/70 to-slate-900/90 p-4 transition duration-200 hover:border-blue-500/40"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 border border-blue-500/20">
                    {t.time}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-white">{t.title}</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: 24-Hour Energy Intensity Timeline */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                24-Hour Energy Routine Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ระดับการใช้พลังงานตามช่วงเวลาของวัน (00:00 ถึง 23:00)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-600" /> Low
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Moderate
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> High
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Peak
              </span>
            </div>
          </div>

          <div className="flex h-36 items-end gap-1 sm:gap-2 overflow-x-auto pt-4 pb-2">
            {timeline.map((item) => {
              const heightPct = Math.min(100, Math.max(12, (item.power_w / maxTimelinePower) * 100));
              const isPeak = item.intensity === 'Peak';

              return (
                <div
                  key={item.hour}
                  className="group relative flex flex-1 min-w-[20px] flex-col items-center h-full justify-end"
                >
                  <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] font-medium text-white shadow group-hover:block whitespace-nowrap">
                    {item.time_label}: <strong>{item.power_w} W</strong> ({item.intensity})
                  </div>

                  <div
                    className={`w-full rounded-t transition-all duration-300 group-hover:brightness-125 ${
                      isPeak
                        ? 'bg-gradient-to-t from-amber-600 to-rose-400'
                        : item.intensity === 'High'
                        ? 'bg-gradient-to-t from-blue-600 to-sky-400'
                        : item.intensity === 'Moderate'
                        ? 'bg-gradient-to-t from-slate-700 to-blue-500'
                        : 'bg-slate-800'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-1 text-[9px] font-mono text-slate-500">
                    {item.hour % 2 === 0 ? `${item.hour.toString().padStart(2, '0')}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: AI Learned Devices & Routine Confidence */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Learned Device Profiles */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  AI Learned Devices
                </h3>
              </div>
              <span className="text-xs text-slate-400">Confidence Score</span>
            </div>

            <div className="space-y-3">
              {devicesRoutine.map((dev) => (
                <div
                  key={dev.device_id}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">{dev.name}</h4>
                      <span className="text-[11px] text-slate-400">{dev.room_name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          dev.confidence_level === 'High'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : dev.confidence_level === 'Medium'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {dev.confidence_level} ({dev.confidence_pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-900/60 rounded-lg p-2 border border-slate-800/50">
                    <div>
                      <span className="text-slate-500 block">Typical Start</span>
                      <strong className="text-slate-200">{dev.typical_start}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Typical Stop</span>
                      <strong className="text-slate-200">{dev.typical_stop}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Avg Runtime</span>
                      <strong className="text-sky-400">{dev.average_runtime_hours} hrs</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    "{dev.pattern_summary}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Time Slot Aggregate Breakdown */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Routine Time Slots Breakdown
                </h3>
              </div>
              <span className="text-xs text-slate-400">Daily Distribution</span>
            </div>

            <div className="space-y-3">
              {(routine?.slots || []).map((slot) => (
                <div key={slot.slot_id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{slot.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">({slot.time_range})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-400">{slot.percentage}%</span>
                      <span className="text-slate-500 text-[11px]">({slot.energy_kwh} kWh)</span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                      style={{ width: `${slot.percentage}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{slot.primary_activity}</span>
                    <span>Occupancy: {slot.occupancy_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Appliance Hourly Activation Probability Table P(ON | Hour) */}
        {probabilities && probabilities.probabilities.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Appliance Activation Probability Matrix P(Device Active | Hour)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Probability calculated strictly from 30-day dataset
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Hour</th>
                    {probabilities.devices.map((devId) => (
                      <th key={devId} className="py-2.5 px-3 font-semibold">
                        {devId}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {probabilities.probabilities.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-200">{row.hour}</td>
                      {probabilities.devices.map((devId) => {
                        const probVal = Math.round((row[devId] || 0) * 100);
                        return (
                          <td key={devId} className="py-2 px-3">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                                probVal >= 70
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                                  : probVal >= 30
                                  ? 'bg-blue-500/15 text-sky-400'
                                  : probVal > 0
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'text-slate-600'
                              }`}
                            >
                              {probVal}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
