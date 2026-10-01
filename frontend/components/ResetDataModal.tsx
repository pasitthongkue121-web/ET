'use client';

import React, { useState } from 'react';
import { Trash2, AlertCircle, CheckCircle, RefreshCw } from './Icons';
import { resetTelemetryData, ResetDataResponse } from '../lib/api';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResetDataModal({
  isOpen,
  onClose,
  onSuccess,
}: ResetDataModalProps) {
  const [keepOption, setKeepOption] = useState<'all' | '7d' | '30d'>('all');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetDataResponse | null>(null);

  if (!isOpen) return null;

  const handleReset = async () => {
    if (!confirmed) return;
    setIsSubmitting(true);
    setError(null);

    const keepDays = keepOption === '7d' ? 7 : keepOption === '30d' ? 30 : null;

    try {
      const res = await resetTelemetryData(keepDays);
      setResult(res);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการล้างข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setResult(null);
    setError(null);
    setConfirmed(false);
    setKeepOption('all');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Dark Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-6 shadow-2xl shadow-black/80 z-10 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                ล้างข้อมูลพลังงาน (Reset Data)
              </h3>
              <p className="text-[11px] text-slate-400">
                ลบประวัติ telemetry และรีเซ็ตสถานะระบบ
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success View */}
        {result ? (
          <div className="py-3 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">ล้างข้อมูลสำเร็จ</h4>
              <p className="text-xs text-slate-300 mt-1">
                ลบข้อมูลบันทึกทั้งหมด <span className="text-emerald-400 font-bold font-mono">{result.rows_deleted}</span> รายการ
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{result.message}</p>
            </div>
            <button
              onClick={handleClose}
              className="w-full mt-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              ตกลง (Close)
            </button>
          </div>
        ) : (
          /* Form Content */
          <div className="space-y-3.5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                เลือกขอบเขตข้อมูลที่ต้องการลบ:
              </label>

              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                    keepOption === 'all'
                      ? 'border-rose-500/50 bg-rose-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="keepOption"
                    value="all"
                    checked={keepOption === 'all'}
                    onChange={() => setKeepOption('all')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="text-xs leading-tight">
                    <span className="font-semibold text-rose-300">ลบข้อมูลทั้งหมด (Wipe All Data)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      เริ่มระบบใหม่จากศูนย์ ลบ energy_readings ทั้งหมด และรีเซ็ตสถานะอุปกรณ์
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                    keepOption === '7d'
                      ? 'border-amber-500/50 bg-amber-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="keepOption"
                    value="7d"
                    checked={keepOption === '7d'}
                    onChange={() => setKeepOption('7d')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-xs leading-tight">
                    <span className="font-semibold text-amber-300">เก็บ 7 วันล่าสุด (Keep Last 7 Days)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ลบเฉพาะข้อมูลที่เก่ากว่า 7 วัน เพื่อประหยัดพื้นที่
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                    keepOption === '30d'
                      ? 'border-blue-500/50 bg-blue-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="keepOption"
                    value="30d"
                    checked={keepOption === '30d'}
                    onChange={() => setKeepOption('30d')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-xs leading-tight">
                    <span className="font-semibold text-blue-300">เก็บ 30 วันล่าสุด (Keep Last 30 Days)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ลบเฉพาะข้อมูลที่เก่ากว่า 1 เดือน
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] text-slate-300 select-none">
                  ฉันเข้าใจว่าการกระทำนี้ลบแล้ว<strong className="text-rose-400"> ไม่สามารถย้อนกลับได้</strong>
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
              >
                ยกเลิก (Cancel)
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!confirmed || isSubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white shadow-md shadow-rose-900/30 hover:bg-rose-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>กำลังล้าง...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>ยืนยันล้างข้อมูล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
