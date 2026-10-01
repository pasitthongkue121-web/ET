'use client';

import React, { useState, useEffect } from 'react';
import { getTwinState, getTwinHome, checkBackendHealth } from '../../../lib/api';
import { DigitalTwinState, DigitalTwinHome } from '../../../lib/types';
import { Zap, Thermometer, DollarSign, Activity, Power, ShieldCheck, RefreshCw } from '../../../components/Icons';

export default function CompactKPIWidget() {
  const [state, setState] = useState<DigitalTwinState | null>(null);
  const [home, setHome] = useState<DigitalTwinHome | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [s, h] = await Promise.all([getTwinState(), getTwinHome()]);
      setState(s);
      setHome(h);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-950 text-slate-100 p-4 font-sans rounded-2xl border border-slate-800 shadow-2xl max-w-xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-xs tracking-tight text-white">
            ENERGY <span className="text-emerald-400">TWINS</span> AI
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-semibold">
            [MEASURED]
          </span>
        </div>

        <button
          onClick={loadData}
          className="text-slate-500 hover:text-white transition-colors"
          title="Refresh Telemetry"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-medium">Power Load</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-emerald-400">
              {state ? state.total_power_kw.toFixed(2) : '--'}
            </span>
            <span className="text-[10px] text-slate-500">kW</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-medium">Today Cost</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-rose-400">
              ฿{state ? state.estimated_cost_today_thb.toFixed(1) : '--'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-medium">Environment</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-sky-400">
              {state ? state.temperature_c.toFixed(1) : '--'}
            </span>
            <span className="text-[10px] text-slate-500">°C</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-medium">Active Load</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-amber-400">
              {state ? `${state.active_devices_count}/${state.total_devices_count}` : '--'}
            </span>
            <span className="text-[10px] text-slate-500">dev</span>
          </div>
        </div>
      </div>
    </div>
  );
}
