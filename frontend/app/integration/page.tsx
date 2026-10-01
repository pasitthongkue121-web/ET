'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import {
  FileSpreadsheet,
  Globe,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  Sliders,
  Table,
  Sparkles,
  RefreshCw
} from '../../components/Icons';

export default function GoogleIntegrationPage() {
  const [activeTab, setActiveTab] = useState<'sheets' | 'sites'>('sheets');
  const [originUrl, setOriginUrl] = useState<string>('https://cowboy-pointed-syracuse-wednesday.trycloudflare.com');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Sites Embed State
  const [embedWidget, setEmbedWidget] = useState<'twin' | 'simulation' | 'monitor' | 'kpi'>('twin');
  const [embedHeight, setEmbedHeight] = useState<number>(750);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handlePushToSheets = async () => {
    if (!webhookUrl) return;
    setIsPushing(true);
    setPushStatus(null);
    try {
      const res = await fetch(`${originUrl}/api/export/google-sheets/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setPushStatus({ success: true, message: 'ส่งข้อมูลขึ้น Google Sheets สำเร็จเรียบร้อย!' });
      } else {
        setPushStatus({ success: false, message: data.detail || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
      }
    } catch (err: any) {
      setPushStatus({ success: false, message: err.message || 'Network error' });
    } finally {
      setIsPushing(false);
    }
  };

  const getEmbedPath = () => {
    switch (embedWidget) {
      case 'twin':
        return '/twin';
      case 'simulation':
        return '/simulation';
      case 'monitor':
        return '/monitor';
      case 'kpi':
        return '/embed/kpi';
      default:
        return '/twin';
    }
  };

  const embedCode = `<iframe src="${originUrl}${getEmbedPath()}" width="100%" height="${embedHeight}" frameborder="0" style="border:0; border-radius:16px; overflow:hidden;" allowfullscreen></iframe>`;

  const appsScriptCode = `// ========================================================
// ENERGY TWINS AI - Google Sheets Auto-Sync Webhook Receiver
// Paste this code into: Extensions > Apps Script in Google Sheets
// ========================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "Power (kW)", "Daily (kWh)", "Cost Today (THB)", 
        "Monthly (kWh)", "Active Devices", "Temperature (C)"
      ]);
      sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
    }
    
    // Append real-time telemetry row
    sheet.appendRow([
      data.timestamp,
      data.summary.power_kw,
      data.summary.daily_kwh,
      data.summary.cost_today_thb,
      data.summary.monthly_kwh,
      data.summary.active_devices,
      data.summary.temperature_c
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar isBackendOnline={true} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                  GOOGLE INTEGRATION HUB
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                    Google Sheets & Sites
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  เชื่อมต่อข้อมูลการใช้พลังงานและแบบจำลอง Digital Twin เข้าสู่ Google Sheets และฝัง (Embed) ลงใน Google Sites
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sheets'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Google Sheets
            </button>
            <button
              onClick={() => setActiveTab('sites')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sites'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="h-4 w-4" />
              Google Sites Embed
            </button>
          </div>
        </div>

        {/* ================= TAB 1: GOOGLE SHEETS ================= */}
        {activeTab === 'sheets' && (
          <div className="space-y-8">
            {/* Method A: Live IMPORTDATA Formulas */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      วิธีที่ 1: ดึงข้อมูลสดผ่านสูตร =IMPORTDATA(...) (ง่ายที่สุด ไม่ต้องเขียนโค้ด)
                    </h3>
                    <p className="text-xs text-slate-400">
                      คัดลอกสูตรด้านล่างไปวางในเซลล์ A1 ของ Google Sheets ข้อมูลจะอัปเดตแบบ Real-time จากเซิร์ฟเวอร์
                    </p>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                  Auto-Refresh Live
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Formula 1: Summary */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">1. ข้อมูลสรุปภาพรวมบ้าน (Home Summary)</span>
                    <a
                      href={`${originUrl}/api/export/summary.csv`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Download CSV <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                    <span className="truncate">{`=IMPORTDATA("${originUrl}/api/export/summary.csv")`}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(`=IMPORTDATA("${originUrl}/api/export/summary.csv")`, 'f_summary')
                      }
                      className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                    >
                      {copiedKey === 'f_summary' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ดึงค่ากำลังไฟฟ้าปัจจุบัน (kW), พลังงานวันนี้/เดือน, อุณหภูมิ, และค่าไฟสะสม
                  </p>
                </div>

                {/* Formula 2: Daily */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">2. ข้อมูลการใช้ไฟรายวัน 30 วัน (Daily Energy)</span>
                    <a
                      href={`${originUrl}/api/export/daily.csv`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Download CSV <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                    <span className="truncate">{`=IMPORTDATA("${originUrl}/api/export/daily.csv")`}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(`=IMPORTDATA("${originUrl}/api/export/daily.csv")`, 'f_daily')
                      }
                      className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                    >
                      {copiedKey === 'f_daily' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ดึงสถิติย้อนหลัง 30 วัน: วันที่, kWh, ค่าไฟ (THB), CO2 (kg), และ Peak Load (W)
                  </p>
                </div>

                {/* Formula 3: Devices */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">3. สัดส่วนการใช้ไฟตามอุปกรณ์ (Device Breakdown)</span>
                    <a
                      href={`${originUrl}/api/export/devices.csv`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Download CSV <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                    <span className="truncate">{`=IMPORTDATA("${originUrl}/api/export/devices.csv")`}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(`=IMPORTDATA("${originUrl}/api/export/devices.csv")`, 'f_devices')
                      }
                      className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                    >
                      {copiedKey === 'f_devices' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ดึงสัดส่วน % การใช้ไฟของอุปกรณ์แต่ละตัว, ชั่วโมงการเปิดใช้งาน และค่าไฟรายอุปกรณ์
                  </p>
                </div>

                {/* Formula 4: Scenarios */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">4. ผลการจำลอง What-If Scenarios</span>
                    <a
                      href={`${originUrl}/api/export/scenarios.csv`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Download CSV <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                    <span className="truncate">{`=IMPORTDATA("${originUrl}/api/export/scenarios.csv")`}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(`=IMPORTDATA("${originUrl}/api/export/scenarios.csv")`, 'f_scenarios')
                      }
                      className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                    >
                      {copiedKey === 'f_scenarios' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ดึงตารางเปรียบเทียบ Scenario: ค่าไฟที่ประหยัดได้, Peak ที่ลดลง และ Scenario Score
                  </p>
                </div>
              </div>
            </div>

            {/* Method B: Webhook Direct Push & Google Apps Script */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Push Trigger Form */}
              <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">วิธีที่ 2: กด Push ไปยัง Google Sheets</h3>
                    <p className="text-[11px] text-slate-400">ผ่าน Google Apps Script Webhook</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">
                    Google Apps Script Web App URL:
                  </label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    นำ Web App URL ที่ได้จากการ Deploy ใน Google Sheets มาวางที่นี่
                  </p>
                </div>

                <button
                  onClick={handlePushToSheets}
                  disabled={isPushing || !webhookUrl}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isPushing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      กำลังส่งข้อมูลไปยัง Google Sheets...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4" />
                      Sync Data to Google Sheets Now
                    </>
                  )}
                </button>

                {pushStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      pushStatus.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {pushStatus.message}
                  </div>
                )}
              </div>

              {/* Apps Script Code Template */}
              <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      GOOGLE APPS SCRIPT TEMPLATE
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      วางโค้ดนี้ใน Google Sheets &gt; Extensions &gt; Apps Script แล้วกด Deploy &gt; Web App
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(appsScriptCode, 'apps_script')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                  >
                    {copiedKey === 'apps_script' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                  {appsScriptCode}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: GOOGLE SITES EMBED ================= */}
        {activeTab === 'sites' && (
          <div className="space-y-8">
            {/* Embed Generator Controls */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-400" />
                    GOOGLE SITES EMBED CODE GENERATOR
                  </h3>
                  <p className="text-xs text-slate-400">
                    สร้างโค้ด iframe สำหรับฝังหน้าต่าง Interactive ลงใน Google Sites ของคุณได้ทันที
                  </p>
                </div>
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md font-semibold">
                  SSL / HTTPS Compatible
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setEmbedWidget('twin')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    embedWidget === 'twin'
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Layers className="h-5 w-5 text-indigo-400 mb-2" />
                  <span className="text-xs font-bold block text-white">Digital Twin Floorplan</span>
                  <span className="text-[11px] text-slate-400">บ้านเสมือนจริง 4 ห้อง + ตรวจสอบอุปกรณ์</span>
                </button>

                <button
                  onClick={() => setEmbedWidget('simulation')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    embedWidget === 'simulation'
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sliders className="h-5 w-5 text-amber-400 mb-2" />
                  <span className="text-xs font-bold block text-white">What-If Studio</span>
                  <span className="text-[11px] text-slate-400">แบบจำลองทดลองปรับอุณหภูมิและตารางเวลา</span>
                </button>

                <button
                  onClick={() => setEmbedWidget('monitor')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    embedWidget === 'monitor'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Zap className="h-5 w-5 text-emerald-400 mb-2" />
                  <span className="text-xs font-bold block text-white">Live Monitor</span>
                  <span className="text-[11px] text-slate-400">กราฟกำลังไฟฟ้าและสถิติการใช้ไฟฟ้ารายวัน</span>
                </button>

                <button
                  onClick={() => {
                    setEmbedWidget('kpi');
                    setEmbedHeight(240);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    embedWidget === 'kpi'
                      ? 'bg-sky-950/40 border-sky-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className="h-5 w-5 text-sky-400 mb-2" />
                  <span className="text-xs font-bold block text-white">Compact KPI Badge</span>
                  <span className="text-[11px] text-slate-400">วิดเจ็ตขนาดกะทัดรัด เหมาะสำหรับแถบด้านข้าง</span>
                </button>
              </div>

              {/* Generated Embed Code Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">Embed Code (HTML iFrame):</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">
                      ความสูง: {embedHeight}px
                    </span>
                    <input
                      type="range"
                      min="200"
                      max="1200"
                      step="50"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(parseInt(e.target.value))}
                      className="w-28 accent-blue-500 h-1 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-blue-300">
                  <span className="truncate">{embedCode}</span>
                  <button
                    onClick={() => copyToClipboard(embedCode, 'embed_code')}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-md"
                  >
                    {copiedKey === 'embed_code' ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy iFrame Code
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4-Step Guide for Google Sites */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  ขั้นตอนการนำไปติดใน GOOGLE SITES (4 ขั้นตอนง่ายๆ)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="h-5 w-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold mb-1.5">
                      1
                    </span>
                    <p className="font-bold text-white">เปิด Google Sites</p>
                    <p className="text-[11px] text-slate-400 mt-1">ไปที่ sites.google.com และเปิดหน้าที่ต้องการ</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="h-5 w-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold mb-1.5">
                      2
                    </span>
                    <p className="font-bold text-white">เลือกเมนู 'ฝัง' (Embed)</p>
                    <p className="text-[11px] text-slate-400 mt-1">คลิกปุ่ม 'ฝัง' (ไอคอน &lt;/&gt;) ในแถบเครื่องมือด้านขวา</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="h-5 w-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold mb-1.5">
                      3
                    </span>
                    <p className="font-bold text-white">เลือก 'ด้วยโค้ด' (Embed Code)</p>
                    <p className="text-[11px] text-slate-400 mt-1">หรือเลือก 'ตาม URL' แล้ววางลิงก์สาธารณะ</p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="h-5 w-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold mb-1.5">
                      4
                    </span>
                    <p className="font-bold text-white">กดแทรก (Insert)</p>
                    <p className="text-[11px] text-slate-400 mt-1">ปรับขนาดกรอบตามต้องการและกดเผยแพร่ (Publish)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  LIVE PREVIEW (ตัวอย่างการแสดงผลเสมือนบน Google Sites)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {originUrl}{getEmbedPath()}
                </span>
              </div>

              <div className="rounded-2xl border-2 border-slate-800 overflow-hidden bg-slate-950 shadow-2xl">
                <iframe
                  src={`${originUrl}${getEmbedPath()}`}
                  width="100%"
                  height={Math.min(embedHeight, 600)}
                  title="Google Sites Embed Preview"
                  className="w-full bg-slate-950"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
