'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import {
  getTwinState,
  getTwinRooms,
  getTwinDeviceDetail,
  checkBackendHealth
} from '../../lib/api';
import {
  DigitalTwinState,
  DigitalTwinRoom,
  DigitalTwinDevice,
  DigitalTwinDeviceDetail
} from '../../lib/types';
import {
  Zap,
  Thermometer,
  Activity,
  Layers,
  Power,
  Wind,
  Tv,
  Monitor,
  Refrigerator,
  Microwave,
  Lightbulb,
  Clock,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Sparkles,
  ArrowRight
} from '../../components/Icons';

export default function DigitalTwinPage() {
  const [state, setState] = useState<DigitalTwinState | null>(null);
  const [rooms, setRooms] = useState<DigitalTwinRoom[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DigitalTwinDeviceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);
      if (isHealthy) {
        const [stateRes, roomsRes] = await Promise.all([
          getTwinState(),
          getTwinRooms()
        ]);
        setState(stateRes);
        setRooms(roomsRes);
      }
    } catch (err) {
      console.error('Failed to load Digital Twin data:', err);
      setIsBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDeviceClick = async (device: DigitalTwinDevice) => {
    setIsDetailLoading(true);
    try {
      const detail = await getTwinDeviceDetail(device.device_id);
      setSelectedDevice(detail);
    } catch (err) {
      console.error('Failed to fetch device detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const getDeviceIcon = (devId: string, category: string) => {
    const id = devId.toUpperCase();
    if (id.includes('AC')) return <Wind className="h-5 w-5" />;
    if (id.includes('TV')) return <Tv className="h-5 w-5" />;
    if (id.includes('PC') || id.includes('COMPUTER')) return <Monitor className="h-5 w-5" />;
    if (id.includes('FRIDGE')) return <Refrigerator className="h-5 w-5" />;
    if (id.includes('MICROWAVE')) return <Microwave className="h-5 w-5" />;
    if (id.includes('LIGHT')) return <Lightbulb className="h-5 w-5" />;
    return <Power className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar isBackendOnline={isBackendOnline} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Title & Synchronization Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                  DIGITAL TWIN
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                    [MEASURED] Live Sync
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  บ้านเสมือนจริงที่สะท้อนสถานะและพฤติกรรมการใช้พลังงานแบบ Real-time จากเซนเซอร์จริง
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync State
            </button>
            <Link
              href="/simulation"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all"
            >
              <Sliders className="h-3.5 w-3.5" />
              Open What-If Studio
            </Link>
          </div>
        </div>

        {/* Section 1: Home Status Ribbon (Real State) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Current Power</span>
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight">
                {state ? state.total_power_kw.toFixed(2) : '--'}
              </span>
              <span className="text-xs text-slate-400 font-medium">kW</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-400 font-medium">
              ● Live House Load
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Environment</span>
              <Thermometer className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight">
                {state ? state.temperature_c.toFixed(1) : '--'}
              </span>
              <span className="text-xs text-slate-400 font-medium">°C</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Humidity {state ? state.humidity_pct.toFixed(0) : '--'}%
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Occupancy</span>
              <Activity className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight">
                {state ? (state.occupancy ? `${state.occupancy_count} People` : 'Empty') : '--'}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-indigo-400">
              {state?.occupancy ? 'At Home' : 'Away for Work'}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Devices</span>
              <Power className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight">
                {state ? state.active_devices_count : '--'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                / {state ? state.total_devices_count : '--'}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-amber-400">
              Running Appliances
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Cost Today</span>
              <DollarSign className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight">
                ฿{state ? state.estimated_cost_today_thb.toFixed(2) : '--'}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Rate @ ฿4.42/kWh
            </div>
          </div>
        </div>

        {/* Section 2: Virtual House Interactive Floorplan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                VIRTUAL HOME FLOORPLAN
              </h2>
              <p className="text-xs text-slate-400">
                คลิกที่อุปกรณ์เพื่อเปิดหน้าต่างตรวจสอบสถานะเชิงลึก หรือกดจำลอง What-If
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
              4 Rooms • 2 Floors
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className="bg-slate-900/50 border border-slate-800/90 rounded-2xl p-5 hover:border-slate-700/80 transition-all shadow-lg shadow-black/20"
              >
                {/* Room Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs border border-slate-700/50">
                      FL {room.floor}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base tracking-tight">{room.name}</h3>
                      <p className="text-xs text-slate-400">
                        {room.active_devices} of {room.total_devices} devices active
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">
                      {room.current_power_w > 0 ? `${room.current_power_w.toFixed(0)} W` : '0 W'}
                    </span>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Room Load</p>
                  </div>
                </div>

                {/* Device Tiles inside Room */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {room.devices.map((device) => {
                    const isSelected = selectedDevice?.device_id === device.device_id;
                    return (
                      <button
                        key={device.device_id}
                        onClick={() => handleDeviceClick(device)}
                        className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden group ${
                          device.status
                            ? 'bg-gradient-to-br from-slate-900 to-slate-900/80 border-emerald-500/40 shadow-sm shadow-emerald-500/5 hover:border-emerald-400'
                            : 'bg-slate-900/40 border-slate-800/70 hover:border-slate-700 opacity-75 hover:opacity-100'
                        } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
                      >
                        {device.status && (
                          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/10 blur-xl rounded-full pointer-events-none" />
                        )}

                        <div className="flex items-start justify-between">
                          <div
                            className={`p-2 rounded-lg ${
                              device.status
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                            }`}
                          >
                            {getDeviceIcon(device.device_id, device.device_type)}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              device.status
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {device.status ? '● ON' : '○ OFF'}
                          </span>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                            {device.name}
                          </p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-sm font-bold text-slate-200">
                              {device.status ? `${device.current_power_w.toFixed(0)} W` : '0 W'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Rated {device.rated_power.toFixed(0)}W
                            </span>
                          </div>
                        </div>

                        {device.temperature_setting && (
                          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-sky-400">
                            <span>Setpoint: {device.temperature_setting}°C</span>
                            <span className="text-slate-500 text-[10px]">{device.schedule}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Device Interaction Drawer / Detail Modal */}
        {selectedDevice && (
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-48 w-48 bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                  {getDeviceIcon(selectedDevice.device_id, selectedDevice.device_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{selectedDevice.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedDevice.status
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {selectedDevice.status ? '● Active' : '○ Standby'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Location: <span className="text-slate-300 font-medium">{selectedDevice.room_name}</span> • ID: <code className="text-indigo-300">{selectedDevice.device_id}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/simulation?device=${selectedDevice.device_id}&temp=${selectedDevice.temperature_setting || 26}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  WHAT IF? จำลองการปรับแต่งอุปกรณ์นี้
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-5">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Current Power</span>
                <p className="text-lg font-bold text-white mt-1">
                  {selectedDevice.current_power_w.toFixed(0)} <span className="text-xs text-slate-400 font-normal">W</span>
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Rated Capacity</span>
                <p className="text-lg font-bold text-white mt-1">
                  {selectedDevice.rated_power_w.toFixed(0)} <span className="text-xs text-slate-400 font-normal">W</span>
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Energy Today</span>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {selectedDevice.today_energy_kwh.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kWh</span>
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Monthly Energy</span>
                <p className="text-lg font-bold text-sky-400 mt-1">
                  {selectedDevice.monthly_energy_kwh.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kWh</span>
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Runtime Today</span>
                <p className="text-lg font-bold text-white mt-1">
                  {selectedDevice.runtime_hours.toFixed(1)} <span className="text-xs text-slate-400 font-normal">h</span>
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Confidence Score</span>
                <p className="text-lg font-bold text-amber-400 mt-1">
                  {selectedDevice.confidence_pct}%
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>Learned Schedule: <strong className="text-slate-200">{selectedDevice.schedule}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Digital Twin Model: Verified against 30-Day Physical Telemetry</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
