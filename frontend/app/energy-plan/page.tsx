'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { Zap, Activity, Cpu, RefreshCw, CheckCircle, AlertCircle, Layers } from '../../components/Icons';

const API = '';  // Next.js proxy

const RATE = 4.42;  // THB/kWh

const DEVICE_ICONS: Record<string, string> = {
  hvac: '❄️', appliance: '🔌', computing: '💻', entertainment: '📺',
  lighting: '💡', solar: '☀️', default: '⚡',
};
const PLAN_PRESETS = [
  {
    name: 'ประหยัดสูงสุด (Max Savings)',
    desc: 'เปิดเฉพาะจำเป็น ลดค่าไฟสูงสุด',
    color: 'emerald',
    hours: { ac: [18, 6], fridge: [0, 24], lights: [18, 23], pc: [9, 17] },
  },
  {
    name: 'ทำงานกลางวัน (Day Worker)',
    desc: 'เหมาะสำหรับ WFH ช่วงกลางวัน',
    color: 'blue',
    hours: { ac: [8, 18], fridge: [0, 24], lights: [7, 8], pc: [8, 19] },
  },
  {
    name: 'กลางคืน (Night Mode)',
    desc: 'ใช้ไฟช่วงกลางคืน อัตราถูกกว่า',
    color: 'purple',
    hours: { ac: [20, 6], fridge: [0, 24], lights: [18, 23], pc: [20, 23] },
  },
];

interface Device {
  device_id: string;
  name: string;
  category: string;
  rated_power: number;
  status: number;
  current_power_w: number;
  daily_kwh_estimate: number;
  daily_cost_thb: number;
  last_seen?: string;
}

interface ScheduleRow {
  device_id: string;
  on_hour: number;
  off_hour: number;
  enabled: boolean;
}

interface SimResult {
  plan_name: string;
  total_kwh: number;
  total_cost_thb: number;
  baseline_kwh_24h: number;
  baseline_cost_thb_24h: number;
  savings_kwh: number;
  savings_thb: number;
  savings_pct: number;
  breakdown: any[];
}

export default function EnergyPlanPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [simulating, setSimulating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDays, setResetDays] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'plan' | 'reset'>('control');
  const [planName, setPlanName] = useState('แผนของฉัน');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceRoom, setNewDeviceRoom] = useState('living_room');
  const [newDevicePower, setNewDevicePower] = useState(1200);
  const [newDeviceCategory, setNewDeviceCategory] = useState('appliance');
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    setIsAddingDevice(true);
    try {
      const cleanId = 'dev_' + newDeviceName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const r = await fetch(`${API}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: cleanId,
          name: newDeviceName.trim(),
          room_id: newDeviceRoom,
          rated_power: Number(newDevicePower) || 1000,
          category: newDeviceCategory,
        }),
      });
      if (!r.ok) throw new Error('Failed to create device');
      showNotice('ok', `เพิ่มอุปกรณ์ "${newDeviceName}" ลงในระบบเรียบร้อยแล้ว`);
      setShowAddModal(false);
      setNewDeviceName('');
      await loadDevices();
    } catch {
      showNotice('err', 'ไม่สามารถเพิ่มอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAddingDevice(false);
    }
  };

  const loadDevices = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/schedule/devices`);
      if (!r.ok) throw new Error('Failed');
      const data: Device[] = await r.json();
      setDevices(data);
      // Initialise schedule rows if not set
      setSchedules(prev => {
        if (prev.length > 0) return prev;
        return data.map(d => ({
          device_id: d.device_id,
          on_hour: 8,
          off_hour: 22,
          enabled: true,
        }));
      });
    } catch {
      showNotice('err', 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const iv = setInterval(loadDevices, 15000);
    return () => clearInterval(iv);
  }, [loadDevices]);

  const toggleDevice = async (device_id: string, turnOn: boolean) => {
    setToggling(p => ({ ...p, [device_id]: true }));
    try {
      const r = await fetch(`${API}/api/schedule/device/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id, turn_on: turnOn }),
      });
      const d = await r.json();
      showNotice('ok', d.message);
      await loadDevices();
    } catch {
      showNotice('err', 'การสั่งงานอุปกรณ์ล้มเหลว');
    } finally {
      setToggling(p => ({ ...p, [device_id]: false }));
    }
  };

  const simulatePlan = async () => {
    setSimulating(true);
    try {
      const r = await fetch(`${API}/api/schedule/plan/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: planName, schedules }),
      });
      const d: SimResult = await r.json();
      setSimResult(d);
    } catch {
      showNotice('err', 'จำลองแผนล้มเหลว');
    } finally {
      setSimulating(false);
    }
  };

  const applyPreset = (preset: typeof PLAN_PRESETS[0]) => {
    setPlanName(preset.name);
    setSchedules(prev => prev.map(s => {
      const did = s.device_id.toLowerCase();
      let on = 0, off = 24;
      if (did.includes('ac') || did.includes('bedroom')) {
        [on, off] = preset.hours.ac;
      } else if (did.includes('fridge') || did.includes('micro')) {
        [on, off] = preset.hours.fridge;
      } else if (did.includes('light')) {
        [on, off] = preset.hours.lights;
      } else if (did.includes('pc') || did.includes('study') || did.includes('computer')) {
        [on, off] = preset.hours.pc;
      }
      return { ...s, on_hour: on, off_hour: off, enabled: true };
    }));
    showNotice('ok', `นำแผน "${preset.name}" มาใช้แล้ว กด "คำนวณประหยัด" เพื่อดูผล`);
  };

  const resetData = async () => {
    if (!window.confirm('⚠️ ยืนยันการลบข้อมูล? การกระทำนี้ไม่สามารถย้อนกลับได้!')) return;
    setResetting(true);
    try {
      const body: any = { confirm: true };
      if (resetDays && resetDays > 0) body.keep_days = resetDays;
      const r = await fetch(`${API}/api/schedule/data/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      showNotice('ok', `✅ ${d.message} (ลบ ${d.rows_deleted} แถว)`);
      await loadDevices();
    } catch {
      showNotice('err', 'การล้างข้อมูลล้มเหลว');
    } finally {
      setResetting(false);
    }
  };

  const updateSchedule = (device_id: string, field: keyof ScheduleRow, value: any) => {
    setSchedules(prev => prev.map(s => s.device_id === device_id ? { ...s, [field]: value } : s));
  };

  // ---- Render -----------------------------------------------------------
  const totalCurrentW = devices.reduce((acc, d) => acc + (d.current_power_w || 0), 0);

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100">
      <Navbar isBackendOnline={true} />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* ─── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Zap className="h-5 w-5 text-emerald-400" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white">Energy Plan & Device Control</h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">ควบคุมอุปกรณ์แบบ Real-time · วางแผนการใช้ไฟ · ประหยัดค่าไฟ</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
              <div className="text-xs text-amber-400/70">กำลังไฟรวมปัจจุบัน</div>
              <div className="text-lg font-black text-amber-400">{(totalCurrentW / 1000).toFixed(2)} kW</div>
            </div>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition shadow-lg shadow-emerald-950/40"
            >
              ➕ เพิ่มอุปกรณ์
            </button>
            <button onClick={loadDevices} className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition">
              <RefreshCw className="h-3.5 w-3.5" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* ─── Notice ─────────────────────────────────────────────────── */}
        {notice && (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${notice.type === 'ok' ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' : 'border-rose-500/30 bg-rose-950/30 text-rose-300'}`}>
            {notice.type === 'ok' ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            {notice.text}
          </div>
        )}

        {/* ─── Tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {([
            { id: 'control', label: '⚡ ควบคุมอุปกรณ์', icon: '⚡' },
            { id: 'plan', label: '📊 วางแผนประหยัดไฟ', icon: '📊' },
            { id: 'reset', label: '🗑️ จัดการข้อมูล', icon: '🗑️' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB 1 : DEVICE CONTROL
           ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'control' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading && <p className="text-slate-500 col-span-3 text-center py-12">กำลังโหลดอุปกรณ์...</p>}
            {devices.map(device => {
              const isOn = device.current_power_w > 5 || device.status === 1;
              const icon = DEVICE_ICONS[device.category] || DEVICE_ICONS.default;
              const pct = Math.min(100, (device.current_power_w / (device.rated_power || 1)) * 100);
              return (
                <div key={device.device_id}
                  className={`rounded-2xl border p-5 space-y-4 transition ${isOn ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xl mb-1">{icon}</div>
                      <h3 className="font-bold text-white text-sm leading-tight">{device.name}</h3>
                      <p className="text-[11px] text-slate-500">{device.device_id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {isOn ? '● เปิดอยู่' : '○ ปิด'}
                      </span>
                    </div>
                  </div>

                  {/* Power bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>กำลัง: <span className="font-mono font-bold text-white">{device.current_power_w.toFixed(0)}W</span></span>
                      <span>Rated: {device.rated_power.toFixed(0)}W</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-rose-500' : pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>ค่าไฟ/วัน (est.): <span className="text-white font-semibold">฿{device.daily_cost_thb}</span></span>
                    <span>{device.daily_kwh_estimate} kWh</span>
                  </div>

                  {/* Toggle button */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => toggleDevice(device.device_id, true)}
                      disabled={toggling[device.device_id] || isOn}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${isOn ? 'bg-emerald-500/20 text-emerald-400 cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                    >
                      {toggling[device.device_id] ? '...' : '▶ เปิด'}
                    </button>
                    <button
                      onClick={() => toggleDevice(device.device_id, false)}
                      disabled={toggling[device.device_id] || !isOn}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${!isOn ? 'bg-slate-800 text-slate-600 cursor-default' : 'bg-rose-700 hover:bg-rose-600 text-white'}`}
                    >
                      {toggling[device.device_id] ? '...' : '■ ปิด'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 2 : ENERGY PLAN SCHEDULER
           ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'plan' && (
          <div className="space-y-6">

            {/* Presets */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">⚡ เลือกแผนสำเร็จรูป</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PLAN_PRESETS.map(p => (
                  <button key={p.name} onClick={() => applyPreset(p)}
                    className="text-left p-4 rounded-xl border border-slate-700 bg-slate-900 hover:border-blue-500/50 hover:bg-blue-500/5 transition"
                  >
                    <div className="font-bold text-sm text-white">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Plan name */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">ชื่อแผน:</label>
              <input
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <button onClick={simulatePlan} disabled={simulating}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
              >
                <Layers className="h-3.5 w-3.5" />
                {simulating ? 'กำลังคำนวณ...' : 'คำนวณประหยัด'}
              </button>
            </div>

            {/* Schedule table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">เปิด</div>
                <div className="col-span-4">อุปกรณ์</div>
                <div className="col-span-3">เปิดเวลา (ชม.)</div>
                <div className="col-span-3">ปิดเวลา (ชม.)</div>
                <div className="col-span-1 text-right">W</div>
              </div>
              {schedules.map(s => {
                const device = devices.find(d => d.device_id === s.device_id);
                const icon = DEVICE_ICONS[device?.category || 'default'] || '⚡';
                return (
                  <div key={s.device_id}
                    className={`grid grid-cols-12 gap-2 items-center px-4 py-3 border-t border-slate-800/50 text-sm ${!s.enabled ? 'opacity-40' : ''}`}
                  >
                    <div className="col-span-1">
                      <input type="checkbox" checked={s.enabled}
                        onChange={e => updateSchedule(s.device_id, 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                      />
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="text-xs text-slate-200 truncate">{device?.name || s.device_id}</span>
                    </div>
                    <div className="col-span-3">
                      <input type="number" min={0} max={23} value={s.on_hour}
                        onChange={e => updateSchedule(s.device_id, 'on_hour', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min={0} max={24} value={s.off_hour}
                        onChange={e => updateSchedule(s.device_id, 'off_hour', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white text-center"
                      />
                    </div>
                    <div className="col-span-1 text-right text-[11px] font-mono text-slate-400">
                      {device?.rated_power?.toFixed(0) || '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sim result */}
            {simResult && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6 space-y-4">
                <h3 className="font-black text-lg text-white">{simResult.plan_name} — ผลการจำลอง</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <div className="text-[11px] text-slate-400">พลังงานรวม</div>
                    <div className="text-xl font-black text-white">{simResult.total_kwh} kWh</div>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <div className="text-[11px] text-slate-400">ค่าไฟต่อวัน</div>
                    <div className="text-xl font-black text-amber-400">฿{simResult.total_cost_thb}</div>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-emerald-500/30">
                    <div className="text-[11px] text-slate-400">ประหยัด</div>
                    <div className="text-xl font-black text-emerald-400">฿{simResult.savings_thb}</div>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-emerald-500/30">
                    <div className="text-[11px] text-slate-400">% ลดลงจากเดิม</div>
                    <div className="text-xl font-black text-emerald-400">{simResult.savings_pct}%</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  เทียบกับเปิดทุกอุปกรณ์ตลอด 24 ชม. = ฿{simResult.baseline_cost_thb_24h} ({simResult.baseline_kwh_24h} kWh)
                </div>
                {/* Breakdown bars */}
                <div className="space-y-2">
                  {simResult.breakdown.map(b => (
                    <div key={b.device_id} className="flex items-center gap-3 text-xs">
                      <span className="w-36 text-slate-300 truncate">{b.device_name}</span>
                      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (b.hours_on / 24) * 100)}%` }} />
                      </div>
                      <span className="w-20 text-right font-mono text-slate-300">{b.hours_on}h · ฿{b.cost_thb}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 3 : DATA MANAGEMENT / RESET
           ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reset' && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-black text-rose-400 flex items-center gap-2">
                  🗑️ ล้างข้อมูล Energy Readings
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  ลบข้อมูลการอ่านค่าพลังงานทั้งหมดหรือเฉพาะข้อมูลเก่า (อุปกรณ์ยังคงอยู่) 
                  การกระทำนี้<strong className="text-rose-400"> ไม่สามารถย้อนกลับได้</strong>
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">ตัวเลือกการล้างข้อมูล:</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-700 hover:border-rose-500/30 transition">
                    <input type="radio" name="resetType" defaultChecked
                      onChange={() => setResetDays(null)}
                      className="accent-rose-500"
                    />
                    <div>
                      <div className="font-semibold text-sm text-white">ลบข้อมูลทั้งหมด</div>
                      <div className="text-xs text-slate-400">ลบ Energy Readings ทุกแถว รีเซ็ตเป็นหน้าเปล่า</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-700 hover:border-amber-500/30 transition">
                    <input type="radio" name="resetType"
                      onChange={() => setResetDays(7)}
                      className="accent-amber-500"
                    />
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold text-sm text-white">เก็บข้อมูลล่าสุด</div>
                        <div className="text-xs text-slate-400">ลบข้อมูลเก่ากว่า N วัน</div>
                      </div>
                      <input
                        type="number" min={1} max={365}
                        defaultValue={7}
                        onChange={e => setResetDays(Number(e.target.value))}
                        className="w-20 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white text-center"
                      />
                      <span className="text-xs text-slate-400">วัน</span>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={resetData}
                disabled={resetting}
                className="w-full rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-50 py-3 text-sm font-black text-white transition"
              >
                {resetting ? '⏳ กำลังล้างข้อมูล...' : '🗑️ ยืนยันลบข้อมูล'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Add Device Modal ─────────────────────────────────────── */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">➕</span>
                  <h3 className="text-lg font-bold text-white">เพิ่มอุปกรณ์ใหม่ (Digital Twin)</h3>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddDevice} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ชื่ออุปกรณ์ *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น แอร์ห้องนอน, ปั๊มน้ำ, ทีวีห้องนั่งเล่น"
                    value={newDeviceName}
                    onChange={e => setNewDeviceName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">พื้นที่ / ห้อง (Room)</label>
                    <select
                      value={newDeviceRoom}
                      onChange={e => setNewDeviceRoom(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="main_panel">Main Panel (แผงไฟรวม)</option>
                      <option value="living_room">Living Room (ห้องนั่งเล่น)</option>
                      <option value="bedroom_1">Bedroom 1 (ห้องนอน 1)</option>
                      <option value="bedroom_2">Bedroom 2 (ห้องนอน 2)</option>
                      <option value="kitchen">Kitchen (ห้องครัว)</option>
                      <option value="bathroom">Bathroom (ห้องน้ำ)</option>
                      <option value="garage">Garage (โรงรถ / EV)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">ประเภท (Category)</label>
                    <select
                      value={newDeviceCategory}
                      onChange={e => setNewDeviceCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="lighting">💡 แสงสว่าง (Lighting)</option>
                      <option value="receptacle">🔌 เต้ารับ (Receptacle)</option>
                      <option value="heavy_load">⚡ โหลดหนัก (Heavy Load)</option>
                      <option value="hvac">❄️ เครื่องปรับอากาศ (HVAC)</option>
                      <option value="appliance">🍳 เครื่องใช้ไฟฟ้า (Appliance)</option>
                      <option value="computing">💻 คอมพิวเตอร์ (Computing)</option>
                      <option value="solar">☀️ Solar PV</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">กำลังไฟสูงสุด (Rated Power in Watts)</label>
                  <input
                    type="number"
                    min={1}
                    max={20000}
                    value={newDevicePower}
                    onChange={e => setNewDevicePower(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingDevice}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-emerald-950/40"
                  >
                    {isAddingDevice ? 'กำลังบันทึก...' : 'บันทึกอุปกรณ์'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
