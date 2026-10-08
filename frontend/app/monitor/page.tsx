'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import PowerChart from '../../components/PowerChart';
import { getEnergyHistory, getDevices, checkBackendHealth } from '../../lib/api';
import { EnergyHistoryResponse, Device } from '../../lib/types';
import { Zap, Activity, Gauge, BatteryCharging, DollarSign, Filter, RefreshCw, Layers } from '../../components/Icons';

export default function EnergyMonitorPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<EnergyHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);

      const [devRes, histRes] = await Promise.all([
        getDevices().catch(() => []),
        getEnergyHistory(period, selectedDevice || undefined),
      ]);
      setDevices(devRes);
      setHistory(histRes);
    } catch (err) {
      console.error('Error loading monitor data:', err);
      setIsBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedDevice]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const timeseries = history?.timeseries || [];
  const latestPoint = timeseries.length > 0 ? timeseries[timeseries.length - 1] : null;

  return (
    <AppShell isBackendOnline={isBackendOnline} onRefresh={loadData} isLoading={isLoading}>
      <div className="space-y-6">
        {/* Page Title & Filter Bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Energy Monitor & Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              วิเคราะห์และตรวจสอบสัญญาณไฟฟ้า (Voltage, Current, Power, Energy) แบบเจาะลึก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Device Filter */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="bg-transparent text-slate-200 outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">All Devices (ทั้งบ้าน)</option>
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id} className="bg-slate-900 text-white">
                    {d.name} ({d.room_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Real-time Electrical Parameters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Gauge className="h-3.5 w-3.5 text-sky-400" />
              Voltage
            </div>
            <p className="mt-1.5 text-xl font-black text-white">
              {latestPoint ? latestPoint.voltage : '--'} <span className="text-xs font-normal text-slate-400">V</span>
            </p>
            <span className="text-[10px] text-slate-500">Grid Nominal 230V</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              Current
            </div>
            <p className="mt-1.5 text-xl font-black text-white">
              {latestPoint ? latestPoint.current_a : '--'} <span className="text-xs font-normal text-slate-400">A</span>
            </p>
            <span className="text-[10px] text-slate-500">Active Load</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Active Power
            </div>
            <p className="mt-1.5 text-xl font-black text-white">
              {latestPoint ? latestPoint.power_w : '--'} <span className="text-xs font-normal text-slate-400">W</span>
            </p>
            <span className="text-[10px] text-slate-500">Real-time demand</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <BatteryCharging className="h-3.5 w-3.5 text-indigo-400" />
              Period Energy
            </div>
            <p className="mt-1.5 text-xl font-black text-white">
              {history ? history.total_energy_kwh : '--'} <span className="text-xs font-normal text-slate-400">kWh</span>
            </p>
            <span className="text-[10px] text-slate-500">{period} accumulated</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              Period Cost
            </div>
            <p className="mt-1.5 text-xl font-black text-white">
              ฿{history ? history.total_cost_thb : '--'}
            </p>
            <span className="text-[10px] text-slate-500">@ ฿4.42/kWh base</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              Telemetry Status
            </div>
            <p className="mt-1.5 text-base font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ESP32 Ready
            </p>
            <span className="text-[10px] text-slate-500">Continuous Ingestion</span>
          </div>
        </div>

        {/* Historical Power Chart */}
        <PowerChart
          data={timeseries}
          period={period}
          onPeriodChange={(p) => setPeriod(p)}
          isLoading={isLoading}
        />

        {/* Detailed Electrical Breakdown Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">
              Energy Logs & Telemetry Table ({period.toUpperCase()})
            </h3>
            <span className="text-xs text-slate-400">
              Showing {timeseries.length} aggregated time slices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                  <th className="py-2.5 px-3 font-semibold">Power (W)</th>
                  <th className="py-2.5 px-3 font-semibold">Energy (kWh)</th>
                  <th className="py-2.5 px-3 font-semibold">Voltage (V)</th>
                  <th className="py-2.5 px-3 font-semibold">Current (A)</th>
                  <th className="py-2.5 px-3 font-semibold">Cost (THB)</th>
                  <th className="py-2.5 px-3 font-semibold">Ambient Temp</th>
                  <th className="py-2.5 px-3 font-semibold">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {timeseries.slice(-15).reverse().map((pt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-white">{pt.time}</td>
                    <td className="py-2.5 px-3 font-bold text-sky-400">{pt.power_w} W</td>
                    <td className="py-2.5 px-3 text-slate-200">{pt.energy_kwh} kWh</td>
                    <td className="py-2.5 px-3 text-slate-400">{pt.voltage} V</td>
                    <td className="py-2.5 px-3 text-slate-400">{pt.current_a} A</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">฿{pt.cost_thb}</td>
                    <td className="py-2.5 px-3 text-amber-400">{pt.temperature}°C</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        pt.occupancy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {pt.occupancy ? 'Occupied' : 'Empty'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
