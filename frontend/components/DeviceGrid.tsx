'use client';

import React, { useState } from 'react';
import { Device } from '../lib/types';
import { createDevice, deleteDevice, CreateDeviceInput } from '../lib/api';
import { Power, Wind, Tv, Monitor, Refrigerator, Microwave, Lightbulb } from './Icons';

interface DeviceGridProps {
  devices: Device[];
  onToggleDevice?: (deviceId: string) => void;
  onDeviceChanged?: () => void;
}

function getCategoryIcon(cat: string, devId: string) {
  if (cat === 'hvac' || devId.toLowerCase().includes('ac') || cat === 'heavy_load') return Wind;
  if (cat === 'entertainment' || devId.toLowerCase().includes('tv')) return Tv;
  if (cat === 'computing' || devId.toLowerCase().includes('pc')) return Monitor;
  if (devId.toLowerCase().includes('fridge')) return Refrigerator;
  if (devId.toLowerCase().includes('micro')) return Microwave;
  if (cat === 'lighting' || devId.toLowerCase().includes('light')) return Lightbulb;
  return Power;
}

export default function DeviceGrid({ devices, onToggleDevice, onDeviceChanged }: DeviceGridProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<Device | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('ห้องนั่งเล่น');
  const [category, setCategory] = useState('heavy_load');
  const [ratedPower, setRatedPower] = useState('1500');

  const activeCount = devices.filter((d) => d.status).length;

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('กรุณากรอกชื่ออุปกรณ์');
      return;
    }
    const power = parseFloat(ratedPower);
    if (isNaN(power) || power <= 0) {
      setFormError('กรุณาระบุกำลังไฟ (วัตต์) ที่ถูกต้อง');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await createDevice({
        name: name.trim(),
        room_id: roomId.trim(),
        category,
        rated_power: power,
      });
      setName('');
      setRatedPower('1500');
      setIsAddModalOpen(false);
      if (onDeviceChanged) onDeviceChanged();
    } catch (err: any) {
      setFormError(err.message || 'ไม่สามารถเพิ่มอุปกรณ์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDevice = async (dev: Device) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบอุปกรณ์ "${dev.name}"?`)) {
      return;
    }
    setDeleteLoadingId(dev.device_id);
    try {
      await deleteDevice(dev.device_id);
      if (onDeviceChanged) onDeviceChanged();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการลบอุปกรณ์');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'code') => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    }
  };

  const generateArduinoSnippet = (dev: Device) => {
    return `// ==========================================
// การตั้งค่า ESP32 สำหรับอุปกรณ์: ${dev.name}
// ไฟล์: firmware/esp32_energy_meter.ino
// ==========================================
#define TARGET_MODE 1  // 1: Backend API, 2: GSheet, 3: Dual
const char* API_URL = "https://energy-twins-ai.onrender.com/api/esp32/energy";
const char* DEVICE_ID = "${dev.device_id}";
const char* API_KEY = "${dev.api_key || 'et_dev_default'}";

// HTTP POST Payload Header:
// X-API-Key: ${dev.api_key || 'et_dev_default'}`;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            ⚡ อุปกรณ์และวงจรไฟฟ้า (Connected Circuits)
          </h3>
          <p className="text-[10px] text-slate-400">
            วงจรดิจิทัลทวินส่วนบุคคล เชื่อมต่อบอร์ด ESP32 ผ่าน API Key
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount} กำลังทำงาน
            </span>
            <span className="text-slate-400 text-[11px]">/ {devices.length} วงจร</span>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold px-2.5 py-1 transition shadow-sm hover:shadow-blue-500/20"
          >
            <span className="text-sm leading-none">+</span> เพิ่มอุปกรณ์
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {devices.map((dev) => {
          const Icon = getCategoryIcon(dev.category, dev.device_id);
          const isActive = dev.status;

          return (
            <div
              key={dev.device_id}
              className={`rounded-lg border p-2.5 transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-blue-500/30 bg-blue-950/20 hover:border-blue-500/50'
                  : 'border-slate-800 bg-slate-950/40 opacity-80 hover:opacity-100 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top: Icon + Status */}
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded-md ${isActive ? 'text-blue-400 bg-blue-500/15' : 'text-slate-400 bg-slate-800/60'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isActive ? 'ACTIVE' : 'STANDBY'}
                    </span>
                    <button
                      onClick={() => handleDeleteDevice(dev)}
                      disabled={deleteLoadingId === dev.device_id}
                      title="ลบอุปกรณ์นี้"
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                    >
                      {deleteLoadingId === dev.device_id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>

                {/* Middle: Name & Room */}
                <div className="mt-2">
                  <div className="text-xs font-semibold text-white truncate" title={dev.name}>
                    {dev.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <span>📍 {dev.room_name || 'ทั่วไป'}</span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-500 text-[9px]">{dev.device_id}</span>
                  </div>
                </div>
              </div>

              {/* Bottom: Power info & API Key button */}
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <div className="font-mono text-slate-300">
                  <span className="text-blue-400 font-bold">{dev.current_power ? dev.current_power.toFixed(0) : '0'}W</span>
                  <span className="text-slate-500 text-[9px]"> / {dev.rated_power.toFixed(0)}W</span>
                </div>
                <button
                  onClick={() => setSelectedDeviceKey(dev)}
                  className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 px-2 py-0.5 font-mono text-[10px] border border-slate-700 transition"
                  title="ดู ESP32 API Key สำหรับต่อบอร์ดจริง"
                >
                  🔑 <span>API Key</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: Add Device */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                ⚡ เพิ่มอุปกรณ์ / วงจรไฟฟ้าใหม่
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="mt-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ชื่ออุปกรณ์ / วงจรไฟฟ้า *
                </label>
                <input
                  type="text"
                  placeholder="เช่น แอร์ห้องนอนใหญ่, ปั๊มน้ำ, ตู้เย็น inverter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    หมวดหมู่อุปกรณ์
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="heavy_load">แอร์ / โหลดหนัก (Heavy Load)</option>
                    <option value="receptacle">เต้ารับทั่วไป (Receptacle)</option>
                    <option value="lighting">แสงสว่าง (Lighting)</option>
                    <option value="appliance">เครื่องใช้ไฟฟ้า (Appliance)</option>
                    <option value="solar">โซลาร์เซลล์ (Solar PV)</option>
                    <option value="ev">เครื่องชาร์จ EV (EV Charger)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    กำลังไฟพิกัด (วัตต์) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20000"
                    value={ratedPower}
                    onChange={(e) => setRatedPower(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ตำแหน่ง / ห้อง
                </label>
                <input
                  type="text"
                  placeholder="เช่น ห้องนั่งเล่น, ห้องครัว, โรงรถ"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกอุปกรณ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: ESP32 Device API Key & Code */}
      {selectedDeviceKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">🔑</span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    ESP32 Device Connection Key
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    สำหรับอุปกรณ์: <span className="text-white font-medium">{selectedDeviceKey.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeviceKey(null)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Keys display */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Device ID (รหัสอุปกรณ์)
                </label>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
                  <span>{selectedDeviceKey.device_id}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Device API Key (นำไปใส่ Header: X-API-Key)
                </label>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400">
                  <span className="truncate mr-2">{selectedDeviceKey.api_key || 'กำลังสร้าง Key...'}</span>
                  <button
                    onClick={() => copyToClipboard(selectedDeviceKey.api_key || '', 'key')}
                    className="shrink-0 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-white border border-slate-700 transition"
                  >
                    {copiedKey ? '✅ คัดลอกแล้ว' : '📋 คัดลอก Key'}
                  </button>
                </div>
              </div>
            </div>

            {/* Ready C++ snippet */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-400">
                  โค้ดตั้งค่าใน <code className="text-sky-300">firmware/esp32_energy_meter.ino</code>
                </label>
                <button
                  onClick={() => copyToClipboard(generateArduinoSnippet(selectedDeviceKey), 'code')}
                  className="text-[10px] text-sky-400 hover:text-sky-300 transition"
                >
                  {copiedCode ? '✅ คัดลอกโค้ดแล้ว' : '📋 คัดลอกทั้งหมด'}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-36">
                {generateArduinoSnippet(selectedDeviceKey)}
              </pre>
            </div>

            {/* Instruction */}
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
              💡 <strong>วิธีต่อฮาร์ดแวร์:</strong> ก๊อปปี้ค่า <code className="text-amber-300">DEVICE_ID</code> และ <code className="text-amber-300">API_KEY</code> ด้านบนไปใส่ในบอร์ด ESP32 เมื่อบอร์ดเริ่มส่งข้อมูล ข้อมูลกระแสไฟและกำลังไฟฟ้าจะวิ่งเข้าสู่แดชบอร์ดเฉพาะของคุณโดยตรง
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setSelectedDeviceKey(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
