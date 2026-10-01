'use client';

import React from 'react';
import { Device } from '../lib/types';
import { Power, Wind, Tv, Monitor, Refrigerator, Microwave, Lightbulb, Thermometer, Clock } from './Icons';

interface DeviceGridProps {
  devices: Device[];
  onToggleDevice?: (deviceId: string) => void;
}

function getCategoryIcon(cat: string, devId: string) {
  if (cat === 'hvac' || devId.includes('AC')) return Wind;
  if (cat === 'entertainment' || devId.includes('TV')) return Tv;
  if (cat === 'computing' || devId.includes('PC')) return Monitor;
  if (devId.includes('FRIDGE')) return Refrigerator;
  if (devId.includes('MICROWAVE')) return Microwave;
  if (cat === 'lighting' || devId.includes('LIGHT')) return Lightbulb;
  return Power;
}

export default function DeviceGrid({ devices, onToggleDevice }: DeviceGridProps) {
  const activeCount = devices.filter((d) => d.status).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Connected Devices & Telemetry
          </h3>
          <p className="text-[10px] text-slate-400">
            Real-time status of household digital twins
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {activeCount} Active
          </span>
          <span className="text-slate-400 text-[11px]">/ {devices.length} Total</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {devices.map((dev) => {
          const Icon = getCategoryIcon(dev.category, dev.device_id);
          const isActive = dev.status;

          return (
            <div
              key={dev.device_id}
              className={`rounded-lg border p-2.5 transition-colors ${
                isActive
                  ? 'border-blue-500/30 bg-blue-950/15'
                  : 'border-slate-800 bg-slate-950/40 opacity-75 hover:opacity-100'
              }`}
            >
              {/* Top: Icon + Status */}
              <div className="flex items-center justify-between">
                <div className={`p-1 rounded ${isActive ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-800/50'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                  isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isActive ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Middle: Name */}
              <div className="mt-1.5 truncate">
                <div className="text-xs font-semibold text-white truncate" title={dev.name}>
                  {dev.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">
                  {dev.device_id}
                </div>
              </div>

              {/* Bottom: Power info */}
              <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-800/40 text-[10px]">
                <span className="text-slate-400 font-mono">
                  Rated {dev.rated_power.toFixed(0)}W
                </span>
                {dev.temperature && (
                  <span className="text-sky-300 font-mono">
                    {dev.temperature}°C
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
