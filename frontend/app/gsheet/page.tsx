'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import {
  getGSheetStatus,
  connectGoogleSheet,
  syncGSheet,
  previewGSheet,
  disconnectGSheet,
  getGSheetAppsScriptTemplate,
  GSheetStatus,
  GSheetPreview,
} from '../../lib/api';
import {
  RefreshCw, AlertCircle, CheckCircle, ExternalLink, Copy, Zap, FileSpreadsheet, Trash2
} from '../../components/Icons';
import ResetDataModal from '../../components/ResetDataModal';


// ── Step Badge ────────────────────────────────────────────────────────────────
function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
      {n}
    </div>
  );
}

// ── Code Block with copy ──────────────────────────────────────────────────────
function CodeBlock({ code, language = 'javascript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900">
        <span className="text-xs font-mono text-slate-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-green-300 font-mono overflow-x-auto p-4 max-h-72 whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

// ── Sheet Column Template ─────────────────────────────────────────────────────
const SHEET_COLUMNS = ['timestamp', 'device_id', 'power_w', 'energy_kwh', 'voltage', 'current', 'temperature', 'humidity'];
const SAMPLE_ROWS = [
  ['2026-09-15 12:00:00', 'living_room_ac', '1200', '0.5', '230', '5.2', '27.5', '65'],
  ['2026-09-15 12:01:00', 'kitchen_fridge', '150', '0.0025', '228', '0.65', '25.0', '60'],
  ['2026-09-15 12:02:00', 'bedroom_fan', '55', '0.0009', '231', '0.24', '26.0', '62'],
];

function SheetTemplate() {
  const [copied, setCopied] = useState(false);
  const csv = [SHEET_COLUMNS.join(','), ...SAMPLE_ROWS.map(r => r.join(','))].join('\n');
  const copy = () => {
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-300">📋 Sheet Column Format</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
          <Copy className="h-3 w-3" />
          {copied ? 'Copied CSV!' : 'Copy as CSV'}
        </button>
      </div>
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-slate-900">
            {SHEET_COLUMNS.map(col => (
              <th key={col} className="px-3 py-2 text-left text-cyan-400 font-mono font-semibold whitespace-nowrap border-r border-slate-700 last:border-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ROWS.map((row, i) => (
            <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap border-r border-slate-800 last:border-0 font-mono">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Preview Table ─────────────────────────────────────────────────────────────
function PreviewTable({ rows }: { rows: Record<string, any>[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No rows to show.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-slate-900">
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-left text-cyan-400 font-mono whitespace-nowrap border-r border-slate-700 last:border-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
              {cols.map(col => (
                <td key={col} className="px-3 py-2 text-slate-300 whitespace-nowrap border-r border-slate-800 last:border-0 font-mono">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GSheetPage() {
  const [status, setStatus] = useState<GSheetStatus | null>(null);
  const [preview, setPreview] = useState<GSheetPreview | null>(null);
  const [scriptCode, setScriptCode] = useState('');
  const [scriptInstructions, setScriptInstructions] = useState<string[]>([]);

  const [urlInput, setUrlInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'preview' | 'status'>('setup');

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getGSheetStatus();
      setStatus(s);
      if (s.web_app_url) setUrlInput(s.web_app_url);
    } catch { /* backend may not be up */ }
  }, []);

  const fetchPreview = useCallback(async () => {
    try {
      const p = await previewGSheet(15);
      setPreview(p);
    } catch { }
  }, []);

  const fetchScript = useCallback(async () => {
    try {
      const t = await getGSheetAppsScriptTemplate();
      setScriptCode(t.code);
      setScriptInstructions(t.instructions);
    } catch { }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchScript();
  }, [fetchStatus, fetchScript]);

  useEffect(() => {
    if (activeTab === 'preview') fetchPreview();
  }, [activeTab, fetchPreview]);

  // Auto-refresh status every 30s
  useEffect(() => {
    const id = setInterval(() => {
      fetchStatus();
      if (activeTab === 'preview') fetchPreview();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchStatus, fetchPreview, activeTab]);

  const handleConnect = async () => {
    if (!urlInput.trim()) return;
    setIsConnecting(true);
    setMessage(null);
    try {
      const result = await connectGoogleSheet(urlInput.trim());
      setMessage({ type: 'success', text: result.message });
      await fetchStatus();
      setActiveTab('preview');
      await fetchPreview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const result = await syncGSheet();
      setMessage({ type: 'success', text: `✅ Synced! ${result.row_count} rows fetched, ${result.new_rows_inserted} new rows added to database.` });
      await fetchStatus();
      if (activeTab === 'preview') await fetchPreview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Sheet? Existing data in the database will be preserved.')) return;
    setIsDisconnecting(true);
    try {
      const result = await disconnectGSheet();
      setMessage({ type: 'success', text: result.message });
      setUrlInput('');
      await fetchStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = status?.connected ?? false;

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100">
      <Navbar isBackendOnline={true} />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Google Sheets Live Data</h1>
            <p className="text-sm text-slate-400">เชื่อมต่อ Google Sheet → ข้อมูลอัปเดตอัตโนมัติทุก 30 วินาที</p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {isConnected && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE Connected
              </span>
            )}
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition shadow-xs"
              title="ล้างข้อมูลพลังงาน (Reset Data)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>


        {/* Status Summary Banner */}
        {isConnected && status && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Last sync</span>
              <p className="font-semibold text-emerald-300">{status.last_sync_at ? new Date(status.last_sync_at).toLocaleString('th-TH') : 'Never'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Rows in sheet</span>
              <p className="font-semibold text-white">{status.last_row_count.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Auto-refresh</span>
              <p className="font-semibold text-cyan-300">Every {status.cache_ttl_seconds}s</p>
            </div>
            {status.last_error && (
              <div>
                <span className="text-slate-400 text-xs">Last error</span>
                <p className="font-semibold text-rose-400">{status.last_error}</p>
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}

        {/* Message Banner */}
        {message && (
          <div className={`rounded-xl border p-3 flex items-start gap-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/30 text-rose-300'
          }`}>
            {message.type === 'success'
              ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1 w-fit">
          {(['setup', 'preview', 'status'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'setup' ? '⚙️ Setup' : tab === 'preview' ? '👁️ Live Preview' : '📊 Status'}
            </button>
          ))}
        </div>

        {/* ── SETUP TAB ── */}
        {activeTab === 'setup' && (
          <div className="space-y-6">
            {/* Step 1: Create Sheet */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={1} />
                <h2 className="font-bold text-white">สร้าง Google Sheet ด้วย Columns เหล่านี้</h2>
              </div>
              <p className="text-sm text-slate-400">
                เปิด <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Sheets</a>{' '}
                แล้วสร้าง Sheet ใหม่ ใส่ Column headers ด้านล่างในแถวที่ 1 จากนั้นกรอกข้อมูลพลังงานของคุณ
              </p>
              <SheetTemplate />
              <p className="text-xs text-slate-500">
                💡 Tip: ชื่อ Column ไม่จำเป็นต้อง match ทุกตัว — ระบบรองรับ aliases เช่น <code className="text-cyan-300">power</code> แทน <code className="text-cyan-300">power_w</code>, <code className="text-cyan-300">temp</code> แทน <code className="text-cyan-300">temperature</code> เป็นต้น
              </p>
            </div>

            {/* Step 2: Apps Script */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={2} />
                <h2 className="font-bold text-white">เพิ่ม Google Apps Script ให้ Sheet ของคุณ</h2>
              </div>
              <p className="text-sm text-slate-400">
                ใน Google Sheet: คลิก <strong className="text-white">Extensions → Apps Script</strong> → วาง code ด้านล่างทั้งหมด → กด Save
              </p>
              {scriptCode && <CodeBlock code={scriptCode} language="Google Apps Script (JavaScript)" />}
            </div>

            {/* Step 3: Deploy */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <StepBadge n={3} />
                <h2 className="font-bold text-white">Deploy เป็น Web App</h2>
              </div>
              <ol className="space-y-2">
                {[
                  'คลิก Deploy → New deployment',
                  'ตั้งค่า "Execute as" = Me (your Gmail)',
                  'ตั้งค่า "Who has access" = Anyone',
                  'คลิก Deploy → อนุมัติ permissions',
                  'Copy Web App URL ที่ได้',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Step 4: Connect URL */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={4} />
                <h2 className="font-bold text-white">วาง Web App URL ด้านล่าง</h2>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfy.../exec"
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !urlInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition whitespace-nowrap"
                >
                  {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {isConnecting ? 'Connecting...' : isConnected ? 'Update URL' : 'Connect'}
                </button>
              </div>
              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="text-xs text-rose-400 hover:text-rose-300 underline transition"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect this sheet'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PREVIEW TAB ── */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">Live Data Preview</h2>
              <button
                onClick={async () => { await handleSync(); await fetchPreview(); }}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {!isConnected ? (
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>ยังไม่ได้เชื่อมต่อ Google Sheet</p>
                <button onClick={() => setActiveTab('setup')} className="mt-3 text-blue-400 text-sm underline">
                  ไปที่ Setup
                </button>
              </div>
            ) : preview ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">{preview.row_count} rows from your Google Sheet (showing last 15)</p>
                <PreviewTable rows={preview.rows} />
                <p className="text-xs text-slate-500">
                  ✅ ข้อมูลเหล่านี้ถูกบันทึกเข้า database แล้ว — ดู Dashboard เพื่อเห็น Charts อัปเดต
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            )}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            <h2 className="font-bold text-white">Connection Status</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Connection', value: isConnected ? '🟢 Connected' : '🔴 Not connected', color: isConnected ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Web App URL', value: status?.web_app_url ? status.web_app_url.slice(0, 50) + '...' : 'Not set', color: 'text-blue-400' },
                { label: 'Last Sync', value: status?.last_sync_at ? new Date(status.last_sync_at).toLocaleString('th-TH') : 'Never', color: 'text-white' },
                { label: 'Rows in Sheet', value: `${status?.last_row_count ?? 0} rows`, color: 'text-white' },
                { label: 'Auto-refresh Interval', value: `${status?.cache_ttl_seconds ?? 30} seconds`, color: 'text-cyan-400' },
                { label: 'Last Error', value: status?.last_error || 'None', color: status?.last_error ? 'text-rose-400' : 'text-slate-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-sm font-semibold ${color} break-all`}>{value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Status
            </button>
          </div>
        )}
      </main>

      <ResetDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={() => {
          fetchStatus();
          fetchPreview();
        }}
      />
    </div>
  );
}

