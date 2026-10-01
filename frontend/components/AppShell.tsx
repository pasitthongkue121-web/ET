'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Activity,
  Cpu,
  Layers,
  Clock,
  Brain,
  Globe,
  FileSpreadsheet,
  BatteryCharging,
  Sliders,
  RefreshCw,
  Sparkles,
  Info,
  Trash2,
} from './Icons';
import ResetDataModal from './ResetDataModal';


interface AppShellProps {
  children: React.ReactNode;
  isBackendOnline?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdated?: string;
  autoRefreshCountdown?: number;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Activity, badge: null },
  { href: '/monitor', label: 'Energy Monitor', icon: Zap, badge: 'Live' },
  { href: '/routine', label: 'Analytics', icon: Clock, badge: null },
  { href: '/forecast', label: 'AI Forecast', icon: Brain, badge: 'ML' },
  { href: '/twin', label: 'Digital Twin', icon: Layers, badge: null },
  { href: '/energy-plan', label: 'Devices & Plan', icon: Sliders, badge: null },
  { href: '/tou-calculator', label: 'TOU & Solar & EV', icon: BatteryCharging, badge: 'Smart' },
];

const SECONDARY_ITEMS = [
  { href: '/simulation', label: 'What-If Simulation', icon: Sparkles },
  { href: '/pipeline', label: 'Pipeline Hub', icon: Cpu },
  { href: '/gsheet', label: 'Google Sheets', icon: FileSpreadsheet },
  { href: '/integration', label: 'Sync & Integration', icon: Globe },
];

export default function AppShell({
  children,
  isBackendOnline = true,
  onRefresh,
  isLoading = false,
  lastUpdated,
  autoRefreshCountdown,
}: AppShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showTools, setShowTools] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 flex flex-col antialiased">
      {/* ─── Top Header (Compact & Clean) ─────────────────────────── */}
      <header className="sticky top-0 z-40 h-13 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-500 transition">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-white sm:text-base leading-none">
                  ENERGY <span className="text-emerald-400">TWINS</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">v1.2</span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block leading-tight mt-0.5">
                Smart Home Energy Management
              </p>
            </div>
          </Link>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* API Status Dot */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px]">
            <span
              className={`h-2 w-2 rounded-full ${
                isBackendOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-slate-300 hidden sm:inline">
              {isBackendOnline ? 'API Connected' : 'Offline'}
            </span>
          </div>

          {/* Auto-refresh indicator */}
          {autoRefreshCountdown !== undefined && (
            <span className="text-[11px] text-slate-400 hidden md:inline font-mono">
              {autoRefreshCountdown}s
            </span>
          )}

          {/* Quick Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Reset Data Button */}
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition shadow-xs"
            title="ล้างข้อมูลพลังงาน (Reset Data)"
          >
            <Trash2 className="h-3 w-3 text-rose-400" />
            <span className="hidden sm:inline font-semibold">Reset Data</span>
          </button>
        </div>
      </header>


      {/* ─── Main Content Body with Sidebar ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Desktop / Laptop) */}
        <aside
          className={`hidden lg:flex flex-col border-r border-slate-800/80 bg-slate-950/70 transition-all duration-200 select-none ${
            isCollapsed ? 'w-16' : 'w-56'
          }`}
        >
          {/* Navigation Links */}
          <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
            <div className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
              {isCollapsed ? '•••' : 'Main Menu'}
            </div>

            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-850 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!isCollapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                      item.badge === 'Live' ? 'bg-emerald-500/20 text-emerald-300' :
                      item.badge === 'Smart' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-sky-500/20 text-sky-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Tools & Utilities Section */}
            <div className="pt-3">
              <div className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
                {isCollapsed ? '•••' : 'Utilities'}
              </div>
              {SECONDARY_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}

              {/* Reset Data Sidebar Action */}
              <button
                onClick={() => setIsResetModalOpen(true)}
                title={isCollapsed ? 'Reset Data' : undefined}
                className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-rose-400/90 hover:text-rose-200 hover:bg-rose-950/40 transition text-left mt-1`}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                {!isCollapsed && <span className="truncate font-medium">Reset Data</span>}
              </button>
            </div>
          </div>


          {/* Bottom Collapse Toggle */}
          <div className="p-2 border-t border-slate-800/80">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
              title={isCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {!isCollapsed && <span className="text-[11px]">Collapse Menu</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Off-Canvas Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsMobileOpen(false)}
            />
            <div className="relative w-64 bg-slate-950 border-r border-slate-800 p-4 flex flex-col z-10 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-sm font-black text-white">Menu Navigation</span>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <div className="pt-3 border-t border-slate-800/80 mt-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-3 pb-1">Utilities</div>
                  {SECONDARY_ITEMS.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs ${
                          isActive ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      setIsResetModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-950/30 transition text-left mt-1"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    <span className="font-medium">Reset Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden sticky bottom-0 z-40 h-12 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md grid grid-cols-5 items-center px-1">
        {[
          { href: '/', label: 'Home', icon: Activity },
          { href: '/monitor', label: 'Monitor', icon: Zap },
          { href: '/forecast', label: 'Forecast', icon: Brain },
          { href: '/tou-calculator', label: 'TOU & Solar', icon: BatteryCharging },
          { href: '/energy-plan', label: 'Devices', icon: Sliders },
        ].map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 text-[10px] transition ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate max-w-[56px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Reset Data Modal */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}

