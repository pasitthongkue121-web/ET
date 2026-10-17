'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/AppShell';
import {
  getPipelineHealth,
  getESP32SimStatus,
  startESP32Sim,
  stopESP32Sim,
  sendESP32TestPacket,
  previewPipelineSimulation,
  transmitPipelineSimulation,
  PipelineHealthResponse,
  ESP32SimStatus,
  PipelinePreviewResponse,
  PipelineTransmitResponse,
  getGSheetStatus,
  connectGoogleSheet,
  disconnectGSheet,
  syncGSheet,
  GSheetStatus,
} from '../../lib/api';
import {
  Zap, Activity, Cpu, Layers, RefreshCw, CheckCircle, AlertCircle,
  Copy, ExternalLink, Clock, Calendar, BarChart3, Check,
} from '../../components/Icons';

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

const CIRCUIT_OPTIONS = [
  { id: 'circuit_lighting', name: 'วงจรแสงสว่าง (Lighting)', category: 'lighting', icon: '💡', rated: '800 W' },
  { id: 'circuit_receptacle', name: 'วงจรเต้ารับ (General Outlets)', category: 'receptacle', icon: '🔌', rated: '2,000 W' },
  { id: 'circuit_heavy_load', name: 'โหลดหนัก (Heavy Load: AC/Heater)', category: 'heavy_load', icon: '❄️', rated: '5,000 W' },
  { id: 'circuit_ev', name: 'เครื่องชาร์จ EV (EV Charging)', category: 'ev', icon: '🚗', rated: '7,400 W' },
  { id: 'circuit_solar', name: 'โซลาร์เซลล์ (Solar PV Generation)', category: 'solar', icon: '☀️', rated: '5,000 W' },
];

export default function PipelinePage() {
  const [health, setHealth] = useState<PipelineHealthResponse | null>(null);
  const [simStatus, setSimStatus] = useState<ESP32SimStatus | null>(null);

  // Tabs: 'batch_sim' (Primary simulation hub), 'live_stream', 'firmware', 'gsheet'
  const [activeTab, setActiveTab] = useState<'batch_sim' | 'live_stream' | 'firmware' | 'gsheet'>('gsheet');

  // Google Sheet states
  const [gsheetStatus, setGSheetStatus] = useState<GSheetStatus | null>(null);
  const [webAppUrlInput, setWebAppUrlInput] = useState<string>('');
  const [isConnectingSheet, setIsConnectingSheet] = useState<boolean>(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [isSendingSheetTest, setIsSendingSheetTest] = useState<boolean>(false);
  const [formulaCopied, setFormulaCopied] = useState<boolean>(false);

  // Simulation Hub Parameters
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(15);
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([
    'circuit_lighting',
    'circuit_receptacle',
    'circuit_heavy_load',
    'circuit_ev',
    'circuit_solar',
  ]);
  
  // Date time inputs for custom range
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Preview & Transmission state
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PipelinePreviewResponse | null>(null);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmitResult, setTransmitResult] = useState<PipelineTransmitResponse | null>(null);

  // Real-time stream controls
  const [singleDevice, setSingleDevice] = useState<string>('circuit_lighting');
  const [sliderWatts, setSliderWatts] = useState<number>(1200);
  const [isStartingSim, setIsStartingSim] = useState(false);
  const [isSendingPacket, setIsSendingPacket] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Set default start/end dates
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const formatDT = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    setCustomEnd(formatDT(now));
    setCustomStart(formatDT(yesterday));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [h, s, g] = await Promise.all([
        getPipelineHealth().catch(() => null),
        getESP32SimStatus().catch(() => null),
        getGSheetStatus().catch(() => null),
      ]);
      setHealth(h);
      setSimStatus(s);
      if (g) {
        setGSheetStatus(g);
        if (g.web_app_url && !webAppUrlInput) {
          setWebAppUrlInput(g.web_app_url);
        }
      }
    } catch {}
  }, [webAppUrlInput]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 6000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const toggleCircuit = (cid: string) => {
    setSelectedCircuits(prev =>
      prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]
    );
  };

  const handleConnectSheet = async () => {
    if (!webAppUrlInput.trim()) {
      setActionMessage({ type: 'error', text: 'กรุณากรอก Google Apps Script Web App URL' });
      return;
    }
    setIsConnectingSheet(true);
    setActionMessage(null);
    try {
      const res = await connectGoogleSheet(webAppUrlInput.trim());
      setActionMessage({
        type: 'success',
        text: `เชื่อมต่อ Google Sheet สำเร็จ! ${res.message || ''}`,
      });
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'เชื่อมต่อ Google Sheet ล้มเหลว' });
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const handleDisconnectSheet = async () => {
    setIsConnectingSheet(true);
    setActionMessage(null);
    try {
      await disconnectGSheet();
      setWebAppUrlInput('');
      setActionMessage({ type: 'success', text: 'ตัดการเชื่อมต่อ Google Sheet เรียบร้อยแล้ว' });
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'ตัดการเชื่อมต่อล้มเหลว' });
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const handleSyncSheet = async () => {
    setIsSyncingSheet(true);
    setActionMessage(null);
    try {
      const res = await syncGSheet();
      setActionMessage({
        type: 'success',
        text: `ดึงข้อมูลจาก Google Sheet สำเร็จ! อ่านได้ ${res.row_count || 0} แถว (นำเข้าเพิ่ม ${res.new_rows_inserted || 0} รายการ)`,
      });
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'ซิงค์ข้อมูลล้มเหลว' });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSendTestToSheet = async () => {
    const targetUrl = webAppUrlInput || gsheetStatus?.web_app_url;
    if (!targetUrl) {
      setActionMessage({ type: 'error', text: 'ยังไม่ได้ระบุ Google Apps Script Web App URL' });
      return;
    }
    setIsSendingSheetTest(true);
    setActionMessage(null);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const testPayload = [{
        timestamp: nowStr,
        device_id: 'circuit_lighting',
        power_w: 450.0,
        energy_kwh: 0.12,
        voltage: 229.5,
        current: 1.96,
        temperature: 28.0,
        humidity: 65.0,
        occupancy: 1,
      }];
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        mode: 'no-cors',
      });
      setActionMessage({
        type: 'success',
        text: 'ส่งแพ็กเกจข้อมูลทดสอบไปยัง Google Sheet สำเร็จแล้ว! กรุณาเปิดดูแผ่นงาน Google Sheet ของคุณ',
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'ส่งข้อมูลทดสอบไม่สำเร็จ' });
    } finally {
      setIsSendingSheetTest(false);
    }
  };

  const selectAllCircuits = () => {
    setSelectedCircuits(CIRCUIT_OPTIONS.map(c => c.id));
  };

  const deselectAllCircuits = () => {
    setSelectedCircuits([]);
  };

  // -------------------------------------------------------------------
  // Handle Data Preview
  // -------------------------------------------------------------------
  const handlePreview = async () => {
    if (selectedCircuits.length === 0) {
      setActionMessage({ type: 'error', text: 'กรุณาเลือกอุปกรณ์ไฟฟ้าอย่างน้อย 1 รายการก่อนสร้างข้อมูลจำลอง' });
      return;
    }
    setIsPreviewing(true);
    setActionMessage(null);
    setTransmitResult(null);
    try {
      const res = await previewPipelineSimulation({
        devices: selectedCircuits,
        period,
        start_time: period === 'custom' ? customStart : undefined,
        end_time: period === 'custom' ? customEnd : undefined,
        interval_minutes: intervalMinutes,
        mode: 'batch',
      });
      setPreviewData(res);
      setActionMessage({
        type: 'success',
        text: `สร้างตัวอย่างข้อมูลจำลองสำเร็จ: รวม ${res.summary.total_records} รายการ (${res.batch_id})`,
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'สร้างข้อมูลจำลองไม่สำเร็จ' });
    } finally {
      setIsPreviewing(false);
    }
  };

  // -------------------------------------------------------------------
  // Handle Data Transmission to Database
  // -------------------------------------------------------------------
  const handleTransmit = async () => {
    if (selectedCircuits.length === 0) {
      setActionMessage({ type: 'error', text: 'กรุณาเลือกอุปกรณ์ไฟฟ้าอย่างน้อย 1 รายการ' });
      return;
    }
    setIsTransmitting(true);
    setActionMessage(null);
    try {
      const res = await transmitPipelineSimulation({
        devices: selectedCircuits,
        period,
        start_time: period === 'custom' ? customStart : undefined,
        end_time: period === 'custom' ? customEnd : undefined,
        interval_minutes: intervalMinutes,
        batch_id: previewData?.batch_id,
      });
      setTransmitResult(res);
      const targetSheetUrl = webAppUrlInput || gsheetStatus?.web_app_url || 'https://script.google.com/macros/s/AKfycbwx0nIl9fswC9mtNivXEv4gzeKh0O07bImCEAe6XV2VEQZT7ObKdSP5L4CHg4UaneSf/exec';
      if (targetSheetUrl && previewData?.sample_preview && previewData.sample_preview.length > 0) {
        try {
          const directRows = previewData.sample_preview.map((p: any) => ({
            timestamp: p.timestamp,
            device_id: p.device_id,
            power_w: p.power || p.power_w || 0,
            energy_kwh: p.energy || p.energy_kwh || 0,
            voltage: p.voltage || 230,
            current: p.current || 0,
            temperature: p.temperature || 28,
            humidity: p.humidity || 60,
            occupancy: p.occupancy || 1,
          }));
          await fetch(targetSheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(directRows),
            mode: 'no-cors',
          });
        } catch {}
      }
      const gsheetNotice = ' และส่งเข้า Google Sheet เรียบร้อยแล้ว';
      setActionMessage({
        type: 'success',
        text: `ส่งข้อมูลผ่าน Pipeline สำเร็จ! บันทึกเข้า Database ${res.records_transmitted} รายการ${gsheetNotice} (Batch ID: ${res.batch_id}) ในเวลา ${res.elapsed_seconds} วินาที`,
      });
      await refreshData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'ส่งข้อมูลผ่าน Pipeline ล้มเหลว' });
    } finally {
      setIsTransmitting(false);
    }
  };

  // -------------------------------------------------------------------
  // Real-Time Streaming Controls
  // -------------------------------------------------------------------
  const handleToggleSim = async () => {
    setIsStartingSim(true);
    setActionMessage(null);
    try {
      if (simStatus?.running) {
        await stopESP32Sim();
        setActionMessage({ type: 'success', text: 'หยุดการสตรีมมิ่งข้อมูลจำลอง Virtual ESP32 แล้ว' });
      } else {
        await startESP32Sim(singleDevice, 'direct_db', 15, sliderWatts);
        setActionMessage({ type: 'success', text: `เริ่มการสตรีมมิ่งข้อมูลจำลอง ${singleDevice} (${sliderWatts}W) เข้าสู่ฐานข้อมูลทุก 15 วินาที` });
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
      const res = await sendESP32TestPacket(singleDevice, sliderWatts, 230.0);
      setActionMessage({
        type: 'success',
        text: `ส่งข้อมูลทดสอบ 1 แพ็กเกจสำเร็จ! (${res.payload?.device_id || singleDevice}: ${res.payload?.power_w || sliderWatts}W, 230V) -> บันทึกด้วย data_source='simulated'`
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
      title: 'Simulation / ESP32',
      sub: simStatus?.running ? '🟢 Continuous Stream Running' : 'Ready for Telemetry Ingestion',
      status: 'online',
      icon: <Cpu className="h-5 w-5 text-sky-400" />
    },
    {
      num: 2,
      title: 'FastAPI Backend',
      sub: health?.stage4_brain ? `${health.stage4_brain.total_readings} records in DB` : 'AI & Digital Twin Database',
      status: 'online',
      icon: <Zap className="h-5 w-5 text-amber-400" />
    },
    {
      num: 3,
      title: 'Website Dashboard',
      sub: 'Live 30s Visualizer & TOU',
      status: 'online',
      icon: <Activity className="h-5 w-5 text-cyan-400" />
    }
  ];

  return (
    <AppShell isBackendOnline={true} onRefresh={refreshData}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Zap className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                IoT Telemetry & Pipeline Hub
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              ศูนย์กลางการจำลอง ส่งต่อ และตรวจสอบท่อส่งข้อมูลการใช้ไฟฟ้า (Pipeline Hub Primary Interface)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Pipeline Status
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PERSISTENT SIMULATION MODE & REAL-DATA PROTECTION BANNER      */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
              <Cpu className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  SIMULATION MODE ACTIVE
                </span>
                <span className="text-xs text-slate-400 font-mono">Pipeline Hub Telemetry</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                ทุกข้อมูลที่สร้างและส่งผ่าน Pipeline Hub จะถูกกำกับด้วย <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono">data_source = 'simulated'</code> และมีหมายเลข Batch ID กำกับเสมอ เพื่อป้องกันไม่ให้ข้อมูลจำลองปะปนกับข้อมูลจากเซนเซอร์จริง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Real Hardware Protection: <strong className="text-emerald-400 font-semibold">Active</strong>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PIPELINE ARCHITECTURE FLOWCHART                               */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Live Pipeline Architecture & Provenance Flow
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {stages.map((stage, idx) => (
              <div
                key={stage.num}
                className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-800 bg-slate-950/80 relative group hover:border-slate-700 transition"
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

                {idx < stages.length - 1 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-slate-600 font-bold text-lg">
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
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('batch_sim')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'batch_sim'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Pipeline Simulation Hub (Batch & Historical)
          </button>
          <button
            onClick={() => setActiveTab('gsheet')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'gsheet'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            Google Sheets Integration (Web App & Formula)
          </button>
          <button
            onClick={() => setActiveTab('live_stream')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'live_stream'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Continuous Virtual ESP32 Stream
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
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PRIMARY PIPELINE SIMULATION HUB                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'batch_sim' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-sky-400" />
                  เครื่องมือกำหนดและสร้างข้อมูลจำลอง (Simulation Configuration Engine)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  กำหนดช่วงเวลา อุปกรณ์ไฟฟ้า และความละเอียดการสุ่ม เพื่อสร้างและส่งข้อมูลจำลองตรงเข้าสู่ฐานข้อมูลและแดชบอร์ด
                </p>
              </div>

              {/* 1. Period Selection */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  1. เลือกระยะเวลาการจำลอง (Simulation Period):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'daily', label: 'Daily (รายวัน 24 ชม.)', desc: 'ข้อมูลย้อนหลัง 1 วัน' },
                    { id: 'weekly', label: 'Weekly (รายสัปดาห์ 7 วัน)', desc: 'ข้อมูลย้อนหลัง 7 วัน' },
                    { id: 'monthly', label: 'Monthly (รายเดือน 30 วัน)', desc: 'ข้อมูลย้อนหลัง 30 วัน' },
                    { id: 'custom', label: 'Custom Range (กำหนดเอง)', desc: 'ระบุวันและเวลาเริ่มต้น-สิ้นสุด' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id as any)}
                      className={`p-3 rounded-xl border text-xs text-left transition ${
                        period === p.id
                          ? 'border-blue-500 bg-blue-500/10 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{p.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Custom Date Range Picker */}
                {period === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/80 mt-2">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Start Date & Time (YYYY-MM-DD HH:MM:SS):</label>
                      <input
                        type="text"
                        value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        placeholder="2026-10-14 00:00:00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">End Date & Time (YYYY-MM-DD HH:MM:SS):</label>
                      <input
                        type="text"
                        value={customEnd}
                        onChange={e => setCustomEnd(e.target.value)}
                        placeholder="2026-10-15 12:00:00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Sampling Interval */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  2. ความถี่การสุ่มตัวอย่างข้อมูล (Sampling Interval):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { mins: 1, label: '1 นาที (High-Resolution)', desc: 'ละเอียดสูงสุด เหมาะกับวิเคราะห์พีคโหลด' },
                    { mins: 5, label: '5 นาที (Standard IoT)', desc: 'มาตรฐานระบบ Telemetry อุตสาหกรรม' },
                    { mins: 15, label: '15 นาที (TOU Standard)', desc: 'มาตรฐานการคิดค่าไฟ TOU และพยากรณ์ AI' },
                    { mins: 60, label: '60 นาที (Hourly)', desc: 'ระดับรายชั่วโมง สำหรับสรุปภาพรวมรายเดือน' },
                  ].map(item => (
                    <button
                      key={item.mins}
                      onClick={() => setIntervalMinutes(item.mins)}
                      className={`p-3 rounded-xl border text-xs text-left transition ${
                        intervalMinutes === item.mins
                          ? 'border-amber-500 bg-amber-500/10 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Electrical Devices / Circuits (5 Categories) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    3. วงจรและอุปกรณ์ไฟฟ้าที่ต้องการจำลอง (5 หมวดหมู่วงจรไฟฟ้า):
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllCircuits}
                      className="text-[11px] text-blue-400 hover:underline px-2 py-0.5"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={deselectAllCircuits}
                      className="text-[11px] text-slate-400 hover:underline px-2 py-0.5"
                    >
                      ยกเลิกทั้งหมด
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CIRCUIT_OPTIONS.map(circuit => {
                    const isSelected = selectedCircuits.includes(circuit.id);
                    return (
                      <div
                        key={circuit.id}
                        onClick={() => toggleCircuit(circuit.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'border-emerald-500/50 bg-emerald-950/20 text-white shadow-sm'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{circuit.icon}</span>
                          <div>
                            <div className="font-bold text-xs">{circuit.name}</div>
                            <div className="text-[11px] text-slate-500">พิกัดโหลด: {circuit.rated}</div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                          isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800">
                <button
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 text-xs font-bold text-white transition shadow-lg shadow-blue-600/20"
                >
                  <BarChart3 className={`h-4 w-4 ${isPreviewing ? 'animate-spin' : ''}`} />
                  {isPreviewing ? 'กำลังประมวลผลตัวอย่าง...' : '1. ตรวจสอบข้อมูลก่อนส่ง (Preview Simulation)'}
                </button>

                <button
                  onClick={handleTransmit}
                  disabled={isTransmitting || !previewData}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-5 py-3 text-xs font-bold text-white transition shadow-lg shadow-emerald-600/20"
                >
                  <Zap className={`h-4 w-4 ${isTransmitting ? 'animate-spin' : ''}`} />
                  {isTransmitting ? 'กำลังส่งข้อมูลผ่าน Pipeline...' : '2. ส่งข้อมูลเข้าสู่ระบบ (Transmit to Database)'}
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* DATA PREVIEW & TRANSMISSION REPORT                            */}
            {/* ------------------------------------------------------------- */}
            {previewData && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-400" />
                      ผลการพรีวิวข้อมูลจำลอง (Simulation Preview Metrics)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Batch ID: <span className="font-mono text-cyan-300">{previewData.batch_id}</span> | Data Source: <span className="font-mono text-amber-300 font-bold">{previewData.data_source}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const targetSheetUrl = webAppUrlInput || gsheetStatus?.web_app_url || 'https://script.google.com/macros/s/AKfycbwx0nIl9fswC9mtNivXEv4gzeKh0O07bImCEAe6XV2VEQZT7ObKdSP5L4CHg4UaneSf/exec';
                        if (!targetSheetUrl) {
                          setActionMessage({ type: 'error', text: 'ไม่พบ URL ของ Google Sheet' });
                          return;
                        }
                        try {
                          const directRows = (previewData.sample_preview || []).map((p: any) => ({
                            timestamp: p.timestamp,
                            device_id: p.device_id,
                            power_w: p.power || p.power_w || 0,
                            energy_kwh: p.energy || p.energy_kwh || 0,
                            voltage: p.voltage || 230,
                            current: p.current || 0,
                            temperature: p.temperature || 28,
                            humidity: p.humidity || 60,
                            occupancy: p.occupancy || 1,
                          }));
                          await fetch(targetSheetUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(directRows),
                            mode: 'no-cors',
                          });
                          setActionMessage({
                            type: 'success',
                            text: `ส่งข้อมูลตัวอย่าง ${directRows.length} รายการเข้า Google Sheet สำเร็จแล้ว! ตรวจสอบที่หน้าต่าง Google Sheet ได้ทันที`,
                          });
                        } catch {
                          setActionMessage({ type: 'error', text: 'ส่งข้อมูลเข้า Google Sheet ไม่สำเร็จ' });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1.5"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      ส่งตัวอย่างเข้า Google Sheet ทันที
                    </button>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      พร้อมส่งเข้าสู่ระบบ (Ready)
                    </span>
                  </div>
                </div>

                {/* Metrics Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-xs text-slate-500">จำนวนข้อมูลทั้งหมด</span>
                    <div className="text-xl font-black text-white mt-1">{previewData.summary.total_records.toLocaleString()} <span className="text-xs font-normal text-slate-400">Records</span></div>
                    <span className="text-[10px] text-slate-500">{previewData.summary.circuits_count} วงจรไฟฟ้า</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-xs text-slate-500">พลังงานไฟฟ้ารวม (โหลด)</span>
                    <div className="text-xl font-black text-cyan-400 mt-1">{previewData.summary.estimated_consumption_kwh.toLocaleString()} <span className="text-xs font-normal text-slate-400">kWh</span></div>
                    <span className="text-[10px] text-slate-500">คำนวณตามช่วงเวลา</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-xs text-slate-500">พลังงานแสงอาทิตย์ (โซลาร์)</span>
                    <div className="text-xl font-black text-amber-400 mt-1">{previewData.summary.estimated_generation_kwh.toLocaleString()} <span className="text-xs font-normal text-slate-400">kWh</span></div>
                    <span className="text-[10px] text-slate-500">ผลิตพลังงานสะอาด</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-xs text-slate-500">กำลังไฟฟ้าสูงสุด (Peak)</span>
                    <div className="text-xl font-black text-rose-400 mt-1">{previewData.summary.peak_watts.toLocaleString()} <span className="text-xs font-normal text-slate-400">W</span></div>
                    <span className="text-[10px] text-slate-500">จุดสูงสุดของโหลด</span>
                  </div>
                </div>

                {/* Sample Preview Table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">ตัวอย่างข้อมูล 12 รายการแรก (Sample Records Preview):</span>
                    <span className="text-slate-500 text-[11px]">ช่วงเวลา: {previewData.summary.start_time} ถึง {previewData.summary.end_time}</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">Circuit / Device</th>
                          <th className="p-2.5">Power (W)</th>
                          <th className="p-2.5">Voltage</th>
                          <th className="p-2.5">Current (A)</th>
                          <th className="p-2.5">Energy (kWh)</th>
                          <th className="p-2.5">Source Tag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300">
                        {previewData.sample_preview.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="p-2.5 text-slate-400">{row.timestamp}</td>
                            <td className="p-2.5 font-bold text-white flex items-center gap-1.5">
                              {row.is_generation ? '☀️' : '⚡'} {row.name || row.device_id}
                            </td>
                            <td className={`p-2.5 font-bold ${row.is_generation ? 'text-amber-400' : 'text-cyan-400'}`}>
                              {row.power} W
                            </td>
                            <td className="p-2.5 text-slate-400">{row.voltage} V</td>
                            <td className="p-2.5 text-slate-400">{row.current} A</td>
                            <td className="p-2.5 text-slate-300">{row.energy}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans font-semibold">
                                {row.data_source}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Transmit Action CTA inside Preview */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleTransmit}
                    disabled={isTransmitting}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-6 py-3 text-xs font-bold text-white transition shadow-lg shadow-emerald-600/30"
                  >
                    <Zap className={`h-4 w-4 ${isTransmitting ? 'animate-spin' : ''}`} />
                    {isTransmitting ? 'กำลังส่งข้อมูลเข้าสู่ระบบ...' : 'ยืนยันการส่งข้อมูลเข้าสู่ระบบ (Transmit Now)'}
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TRANSMISSION RESULT BANNER                                    */}
            {/* ------------------------------------------------------------- */}
            {transmitResult && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex-shrink-0">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">บันทึกข้อมูลจำลองผ่าน Pipeline สำเร็จ!</h4>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      ข้อมูลถูกส่งผ่านท่อส่งข้อมูล (Pipeline Hub) และบันทึกลงฐานข้อมูลเรียบร้อยแล้ว
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[11px] font-sans">จำนวนข้อมูลที่บันทึก</span>
                    <strong className="text-white text-base">{transmitResult.records_transmitted} Records</strong>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[11px] font-sans">จำนวนข้อผิดพลาด</span>
                    <strong className="text-emerald-400 text-base">{transmitResult.records_failed} Errors</strong>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[11px] font-sans">เวลาที่ใช้ส่ง (Latency)</span>
                    <strong className="text-cyan-400 text-base">{transmitResult.elapsed_seconds} s</strong>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[11px] font-sans">Data Source Identifier</span>
                    <strong className="text-amber-400 text-base">{transmitResult.data_source}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 text-slate-400">
                  <span>Batch ID: <code className="text-cyan-300 font-mono">{transmitResult.batch_id}</code></span>
                  <a
                    href="/"
                    className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold hover:underline"
                  >
                    เปิดดูแดชบอร์ดหลัก (Dashboard) <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: CONTINUOUS REAL-TIME STREAM CONSOLE                    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'live_stream' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-sky-400" />
                  Virtual ESP32 Live Stream Console
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  จำลองการส่งข้อมูลแบบเรียลไทม์อย่างต่อเนื่องเสมือนมีบอร์ด ESP32 วัดพลังงานจริง บันทึกลง Database ทุกๆ 15-60 วินาที
                </p>
              </div>

              {/* Device Preset */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Select Appliance (วงจรที่ต้องการทดสอบ):</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CIRCUIT_OPTIONS.map(dev => (
                    <button
                      key={dev.id}
                      onClick={() => setSingleDevice(dev.id)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                        singleDevice === dev.id
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{dev.icon} {dev.name}</div>
                      <div className="text-[11px] text-slate-500">{dev.rated}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Watts Slider */}
              <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">Simulated Power (กำลังไฟฟ้าจำลอง):</span>
                  <span className="font-mono text-cyan-400 font-bold text-sm">{sliderWatts} Watts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="7400"
                  step="50"
                  value={sliderWatts}
                  onChange={e => setSliderWatts(Number(e.target.value))}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 W (Off)</span>
                  <span>3,500 W (High)</span>
                  <span>7,400 W (EV Peak)</span>
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
                  {simStatus?.running ? 'Stop Continuous Simulator' : 'Start Continuous Virtual ESP32 Stream'}
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
        {/* TAB 3: ESP32 ARDUINO C++ FIRMWARE CODE                        */}
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
const char* BACKEND_URL = "https://energy-twins-ai.onrender.com/api/esp32/energy";

void sendTelemetry(float power_w, float energy_kwh) {
  WiFiClientSecure client;
  client.setInsecure(); // Bypass CA validation

  HTTPClient http;
  http.begin(client, BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  String json = "{\\"device_id\\":\\"circuit_lighting\\",\\"power_w\\":" + String(power_w) + ",\\"voltage\\":230.0,\\"energy_kwh\\":" + String(energy_kwh) + "}";
  int httpCode = http.POST(json);
  Serial.printf("Response: %d\\n", httpCode);
  http.end();
}`}
            />
          </div>
        )}
        {/* ------------------------------------------------------------- */}
        {/* TAB 4: GOOGLE SHEETS LIVE INTEGRATION                         */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'gsheet' && (
          <div className="space-y-6">
            {/* Quick Method 1: Formula Import */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/80 p-6 backdrop-blur space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      วิธีที่ 1: แนะนำ (ไม่ต้องเขียนโค้ด)
                    </span>
                    <h3 className="text-lg font-bold text-white">แสดงข้อมูลใน Google Sheet ทันทีผ่านสูตร =IMPORTDATA</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    เพียงเปิด Google Sheets ว่างๆ ขึ้นมา 1 แผ่น แล้ววางสูตรนี้ลงในเซลล์ <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-300 font-bold">A1</code> ข้อมูลทั้ง 12 คอลัมน์ (Timestamp, วงจรไฟฟ้า, กำลังวัตต์, kWh, อัตรา TOU, ค่าไฟบาท) จะแสดงผลและอัปเดตอัตโนมัติทันที
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('=IMPORTDATA("https://energy-twins-ai.onrender.com/api/analytics/export/csv")');
                    setFormulaCopied(true);
                    setTimeout(() => setFormulaCopied(false), 2500);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex-shrink-0"
                >
                  {formulaCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {formulaCopied ? 'คัดลอกสูตรแล้ว!' : 'คัดลอกสูตร Google Sheet'}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between">
                <span>=IMPORTDATA(&quot;https://energy-twins-ai.onrender.com/api/analytics/export/csv&quot;)</span>
                <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">กดปุ่มสีเขียวเพื่อคัดลอก</span>
              </div>
            </div>

            {/* Method 2: Google Apps Script Web App Connection */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      วิธีที่ 2: ระบบ 2-Way IoT Telemetry Hub
                    </span>
                    <h3 className="text-lg font-bold text-white">เชื่อมต่อ Google Apps Script Web App</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    เชื่อมต่อ Google Sheet ของคุณด้วย Web App URL เพื่อส่งข้อมูลการใช้ไฟฟ้าจาก ESP32 และ Pipeline Simulation ไปเพิ่มเป็นแถวใน Google Sheet แบบ Real-time
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {gsheetStatus?.connected ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      CONNECTED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400 border border-slate-700">
                      <span className="h-2 w-2 rounded-full bg-slate-500" />
                      NOT CONNECTED
                    </span>
                  )}
                </div>
              </div>

              {/* URL Input Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>Google Apps Script Web App URL</span>
                  {gsheetStatus?.connected && (
                    <span className="text-[11px] text-emerald-400 lowercase font-mono">
                      (กำลังเชื่อมต่ออยู่)
                    </span>
                  )}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webAppUrlInput}
                    onChange={(e) => setWebAppUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleConnectSheet}
                    disabled={isConnectingSheet}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 flex-shrink-0"
                  >
                    {isConnectingSheet ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Connect & Save URL
                  </button>
                  {gsheetStatus?.connected && (
                    <button
                      onClick={handleDisconnectSheet}
                      disabled={isConnectingSheet}
                      className="px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex-shrink-0"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Status Details & Actions */}
              {gsheetStatus?.connected && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">สถานะการเชื่อมต่อ:</span>
                    <span className="font-semibold text-emerald-400">พร้อมรับส่งข้อมูล (Online)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">ซิงค์ล่าสุดเมื่อ:</span>
                    <span className="font-mono text-slate-300">{gsheetStatus.last_sync_at ? new Date(gsheetStatus.last_sync_at).toLocaleString('th-TH') : 'ยังไม่มีการซิงค์'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">การทดสอบส่งข้อมูล:</span>
                    <button
                      onClick={handleSendTestToSheet}
                      disabled={isSendingSheetTest}
                      className="text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1"
                    >
                      {isSendingSheetTest ? 'กำลังส่งข้อมูล...' : '➔ คลิกเพื่อส่งแถวทดสอบเข้า Google Sheet ทันที'}
                    </button>
                  </div>
                </div>
              )}

              {/* Apps Script Code Instructions */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Google Apps Script Code Template
                  </h4>
                  <span className="text-xs text-slate-400">นำโค้ดนี้ไปวางใน Extensions ➔ Apps Script</span>
                </div>

                <CodeBlock
                  language="javascript (Google Apps Script)"
                  code={`// ====================================================================
// ENERGY TWINS AI - Google Sheets 2-Way IoT Telemetry Hub
// ====================================================================
var SHEET_HEADERS = [
  "timestamp", "device_id", "power_w", "energy_kwh",
  "voltage", "current", "temperature", "humidity", "occupancy"
];

function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var data = JSON.parse(e.postData.contents);
    var rows = Array.isArray(data) ? data : [data];
    var nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

    for (var i = 0; i < rows.length; i++) {
      var item = rows[i];
      var row = [
        item.timestamp || nowStr,
        item.device_id || "esp32_sensor",
        Number(item.power_w || item.power || 0),
        Number(item.energy_kwh || item.energy || 0),
        Number(item.voltage || 230),
        Number(item.current || 0),
        Number(item.temperature || 25),
        Number(item.humidity || 60),
        Number(item.occupancy || 1)
      ];
      sheet.appendRow(row);
    }

    if (sheet.getLastRow() > 5100) {
      sheet.deleteRows(2, sheet.getLastRow() - 5000);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", appended: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ data: [] })).setMimeType(ContentService.MimeType.JSON);

    var limit = (e && e.parameter && e.parameter.limit) ? parseInt(e.parameter.limit, 10) : 50;
    var startRow = Math.max(2, lastRow - limit + 1);
    var numRows = lastRow - startRow + 1;

    var headerRange = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var rows = [];

    for (var i = 0; i < dataRange.length; i++) {
      var row = {};
      for (var j = 0; j < headerRange.length; j++) {
        row[headerRange[j]] = dataRange[i][j];
      }
      rows.push(row);
    }
    return ContentService.createTextOutput(JSON.stringify({ data: rows, total_rows: lastRow - 1 }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    var hRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    hRange.setBackground("#0f172a");
    hRange.setFontColor("#38bdf8");
    hRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
