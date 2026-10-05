'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Activity,
  Cpu,
  Layers,
  Sliders,
  Clock,
  Brain,
  BatteryCharging
} from './Icons';

interface NavbarProps {
  isBackendOnline?: boolean;
}

const PRIMARY_LINKS = [
  { href: '/', label: 'Dashboard', icon: Activity },
  { href: '/monitor', label: 'Monitor', icon: Zap },
  { href: '/routine', label: 'Analytics', icon: Clock },
  { href: '/forecast', label: 'Forecast', icon: Brain },
  { href: '/twin', label: 'Digital Twin', icon: Layers },
  { href: '/energy-plan', label: 'Devices', icon: Sliders },
  { href: '/tou-calculator', label: 'TOU & Solar', icon: BatteryCharging },
];

const UTILITY_LINKS = [
  { href: '/simulation', label: 'Simulation' },
  { href: '/pipeline', label: 'Pipeline' },
];

export default function Navbar({ isBackendOnline = true }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6">
        {/* Brand & Slogan */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-500 transition">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white sm:text-base leading-none">
                ENERGY <span className="text-emerald-400">TWINS</span>
              </span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-bold text-blue-400 border border-blue-500/20">
                v1.2
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block leading-tight mt-0.5">
              Smart Home Energy Management
            </p>
          </div>
        </Link>

        {/* Navigation Tabs (Compact) */}
        <nav className="hidden lg:flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800">
          {PRIMARY_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <span className="h-4 w-px bg-slate-800 mx-1" />

          {UTILITY_LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                  isActive
                    ? 'text-white font-semibold bg-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* System Telemetry & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-[11px] hidden sm:inline">
              {isBackendOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
