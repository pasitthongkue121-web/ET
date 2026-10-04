'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import {
  getPipelineHealth,
  getESP32SimStatus,
  startESP32Sim,
  stopESP32Sim,
  sendESP32TestPacket,
  PipelineHealthResponse,
  ESP32SimStatus,
  } from '../../lib/api';
import {
  Zap, Activity, Cpu, Layers, RefreshCw, CheckCircle, AlertCircle,
  Copy, ExternalLink, } from '../../components/Icons';

// ----------------------------------------------------------------------
// Code Viewer Component
// ----------------------------------------------------------------------
function CodeBlock({ code, language = 'cpp' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/90">
        <span className="text-xs font-mono text-slate-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <pre className="text-xs text-green-300 font-mono overflow-x-auto p-4 max-h-80 whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

// ----------------------------------------------------------------------
// Status Dot Helper
// ----------------------------------------------------------------------
function StatusPill({ status }: { status: string }) {
  if (status === 'online') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ONLINE
      </span>
    );
  }
  if (status === 'idle') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        IDLE
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400 border border-slate-700">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      STANDBY
    </span>
  );
}

// ----------------------------------------------------------------------
// MAIN PIPELINE PAGE
// ----------------------------------------------------------------------
export default function PipelinePage() {
  const [health, setHealth] = useState<PipelineHealthResponse | null>(null);
  const [simStatus, setSimStatus] = useState<ESP32SimStatus | null>(null);
    
  // Simulator controls
  const [selectedDevice, setSelectedDevice] = useState<string>('living_room_ac');
  const [sliderWatts, setSliderWatts] = useState<number>(1200);
    const [isStartingSim, setIsStartingSim] = useState(false);
  const [isSendingPacket, setIsSendingPacket] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'simulator' | 'firmware' | 'appsscript'>('simulator');

  const refreshData = useCallback(async () => {
    try {
      const [h, s, gs] = await Promise.all([
        getPipelineHealth().catch(() => null),
        getESP32SimStatus().catch(() => null),
        get().catch(() => null),
      ]);
      setHealth(h);
      setSimStatus(s);
          } catch {}
  }, []);

  // Auto-poll pipeline STATUS only (does not start simulator or write data)
  useEffect(() => {
    refreshData();
        const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);



  const handleToggleSim = async () => {
    setIsStartingSim(true);
    setActionMessage(null);
    try {
      if (simStatus?.running) {
        await stopESP32Sim();
        setActionMessage({ type: 'success', text: 'Virtual ESP32 Simulator stopped.' });
      } else {
        await startESP32Sim(selectedDevice, 'direct_db', 15, sliderWatts);
        setActionMessage({ type: 'success', text: `Virtual ESP32 Simulator started! Transmitting ${sliderWatts}W every 15s.` });
      }
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setIsStartingSim(false);
    }
  };

  const handleSendSinglePacket = async () => {
    setIsSendingPacket(true);
    setActionMessage(null);
    try {
      const res = await sendESP32TestPacket(selectedDevice, sliderWatts, 230.0);
      setActionMessage({
        type: 'success',
        text: `Telemetry packet injected! (${res.payload.device_id}: ${res.payload.power_w}W, ${res.payload.voltage}V) -> Check Google Sheet & Dashboard!`
      });
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Send failed' });
    } finally {
      setIsSendingPacket(false);
    }
  };

    const stages = [
    {
      num: 1,
      title: 'Hardware ESP32',
      sub: 'Physical IoT Sensors',
      status: 'online',
      icon: <Cpu className="h-5 w-5 text-sky-400" />
    },
    {
      num: 2,
      title: 'FastAPI Backend',
      sub: health?.stage4_brain ? ${health.stage4_brain.total_readings} records in DB : 'AI & Digital Twin Database',
      status: 'online',
      icon: <Zap className="h-5 w-5 text-amber-400" />
    },
    {
      num: 3,
      title: 'Website Dashboard',
      sub: 'Live 30s Visualizer',
      status: 'online',
      icon: <Activity className="h-5 w-5 text-cyan-400" />
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100">
      <Navbar isBackendOnline={true} />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Zap className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                IoT Telemetry Pipeline
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">Hardware ESP32 ? FastAPI Backend ? Website Dashboard</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Status
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PIPELINE FLOWCHART                                    */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Live Pipeline Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {stages.map((stage, idx) => (
              <div
                key={stage.num}
                className="flex flex-col items-center text-center p-4 rounded-xl border border-slate-800 bg-slate-950/80 relative group hover:border-slate-700 transition"
              >
                <div className="absolute top-2 right-2">
                  <StatusPill status={stage.status} />
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  {stage.icon}
                </div>
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                  Stage {stage.num}
                </span>
                <h3 className="text-sm font-bold text-white mb-1">{stage.title}</h3>
                <p className="text-xs text-slate-400">{stage.sub}</p>

                {/* Arrow to next hop */}
                {idx < stages.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                    ➔
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Notice */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
            actionMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/30 text-rose-300'
          }`}>
            {actionMessage.type === 'success' ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TABS CONTROLS                                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'simulator'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Virtual ESP32 Simulator
          </button>
          <button
            onClick={() => setActiveTab('firmware')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'firmware'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="h-4 w-4" />
            ESP32 Arduino Firmware (.ino)
          </button>
          <button
            onClick={() => setActiveTab('appsscript')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'appsscript'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe className="h-4 w-4" />
            Google Apps Script 2-Way Code
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: VIRTUAL ESP32 SIMULATOR                                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Control Panel */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-sky-400" />
                  Virtual ESP32 Device Console
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  จำลองการส่งข้อมูลเสมือนมีบอร์ด ESP32 วัดพลังงานจริง ยิงเข้า Google Sheet และแสดงผลบนแดชบอร์ด
                </p>
              </div>

              {/* Device Preset */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Select Appliance (อุปกรณ์):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'living_room_ac', name: 'Inverter AC', w: 1250 },
                    { id: 'kitchen_fridge', name: 'Refrigerator', w: 140 },
                    { id: 'study_pc', name: 'Workstation', w: 320 },
                    { id: 'solar_rooftop', name: 'Solar PV', w: 2200 },
                  ].map(dev => (
                    <button
                      key={dev.id}
                      onClick={() => { setSelectedDevice(dev.id); setSliderWatts(dev.w); }}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                        selectedDevice === dev.id
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{dev.name}</div>
                      <div className="text-[11px] text-slate-500">~{dev.w} W</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Watts Slider */}
              <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">Simulated Power (กำลังไฟฟ้า):</span>
                  <span className="font-mono text-cyan-400 font-bold text-sm">{sliderWatts} Watts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3500"
                  step="25"
                  value={sliderWatts}
                  onChange={e => setSliderWatts(Number(e.target.value))}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 W (Off)</span>
                  <span>1,500 W (High)</span>
                  <span>3,500 W (Peak)</span>
                </div>
              </div>

              {/* Target Destination */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Data Transmission Target (เส้นทางการส่ง):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'both', label: 'Apps Script & DB (Full Pipeline)' },
                    { id: 'apps_script', label: 'Google Apps Script Only' },
                    { id: 'direct_db', label: 'Direct to DB Only' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSimTarget(t.id as any)}
                      className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition ${
                        simTarget === t.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleToggleSim}
                  disabled={isStartingSim}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white transition shadow-md ${
                    simStatus?.running
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                  {simStatus?.running ? 'Stop Continuous Simulator' : 'Start Virtual ESP32 Stream'}
                </button>

                <button
                  onClick={handleSendSinglePacket}
                  disabled={isSendingPacket}
                  className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-3 text-xs font-bold text-blue-300 hover:bg-blue-600/30 transition"
                >
                  <Zap className={`h-4 w-4 ${isSendingPacket ? 'animate-spin' : ''}`} />
                  Send 1 Test Packet
                </button>
              </div>
            </div>

            {/* Telemetry Monitor */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Live Telemetry Stream
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                  <div className="text-[11px] text-slate-500">Packets Sent</div>
                  <div className="text-xl font-black text-white">{simStatus?.packets_sent || 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                  <div className="text-[11px] text-slate-500">Stream Status</div>
                  <div className="text-sm font-bold text-cyan-400">
                    {simStatus?.running ? '🟢 Active (15s)' : '⚪ Idle'}
                  </div>
                </div>
              </div>

              {/* Last Packet Payload */}
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-semibold">Last Outgoing JSON Payload:</span>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-cyan-300 max-h-56 overflow-auto">
                  {simStatus?.last_payload ? (
                    <pre>{JSON.stringify(simStatus.last_payload, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-600 italic">No packets transmitted yet. Click "Send 1 Test Packet" above.</span>
                  )}
                </div>
              </div>

              {simStatus?.last_sent_at && (
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Last timestamp:</span>
                  <span className="font-mono text-slate-400">{new Date(simStatus.last_sent_at).toLocaleTimeString('th-TH')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ESP32 ARDUINO C++ FIRMWARE CODE                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'firmware' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <h3 className="text-lg font-bold text-white">ESP32 Arduino C++ Firmware (`esp32_energy_meter.ino`)</h3>
              <p className="text-xs text-slate-400">
                โค้ดภาษา C++ สำหรับแฟลชลงชิป ESP32 จริง (ESP32 Dev Module) พร้อมระบบเชื่อมต่อ WiFi อัตโนมัติ, รองรับ SSL 302 Redirect ของ Google Apps Script, และโหมดเซนเซอร์เสมือนในตัว (ทดสอบได้ทันทีแม้ยังไม่ต่อ PZEM-004T / CT clamp)
              </p>
              <div className="flex gap-2 text-xs text-cyan-400">
                <span>📁 บันทึกไว้ที่: <code className="bg-slate-800 px-2 py-0.5 rounded">firmware/esp32_energy_meter.ino</code></span>
              </div>
            </div>

            <CodeBlock
              language="Arduino C++ (ESP32)"
              code={`#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* GOOGLE_SCRIPT_URL = "${sheetStatus?.web_app_url || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'}";

void sendTelemetry(float power_w, float energy_kwh) {
  WiFiClientSecure client;
  client.setInsecure(); // Bypass CA validation

  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); // Follow Google 302 redirect
  http.begin(client, GOOGLE_SCRIPT_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{\\"device_id\\":\\"living_room_ac\\",\\"power_w\\":" + String(power_w) + ",\\"voltage\\":230.0,\\"energy_kwh\\":" + String(energy_kwh) + "}";
  int httpCode = http.POST(json);
  Serial.printf("Response: %d\\n", httpCode);
  http.end();
}`}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: UPGRADED GOOGLE APPS SCRIPT CODE                       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'appsscript' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <h3 className="text-lg font-bold text-white">Google Apps Script 2-Way IoT Telemetry Hub</h3>
              <p className="text-xs text-slate-400">
                สคริปต์นี้ติดตั้งใน Google Sheet เพื่อรับข้อมูลจาก ESP32 (`doPost`) และส่งต่อไปยัง FastAPI (`doGet`) พร้อมระบบสร้างหัวตารางอัตโนมัติ และจำกัดความยาว 5,000 แถวเพื่อไม่ให้ชีตช้า
              </p>
            </div>

            {appsScriptCode && (
              <CodeBlock
                language="Google Apps Script (JavaScript)"
                code={appsScriptCode}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
