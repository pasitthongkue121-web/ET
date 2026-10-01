'use client';

import React from 'react';
import { IconProps } from './Icons';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon: React.ComponentType<IconProps>;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  accent?: 'blue' | 'emerald' | 'indigo' | 'amber' | 'purple';
}

const ACCENT_MAP = {
  blue: {
    border: 'border-slate-800 hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10 text-blue-400',
    valColor: 'text-white',
  },
  emerald: {
    border: 'border-slate-800 hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    valColor: 'text-white',
  },
  indigo: {
    border: 'border-slate-800 hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
    valColor: 'text-white',
  },
  amber: {
    border: 'border-slate-800 hover:border-amber-500/50',
    iconBg: 'bg-amber-500/10 text-amber-400',
    valColor: 'text-white',
  },
  purple: {
    border: 'border-slate-800 hover:border-purple-500/50',
    iconBg: 'bg-purple-500/10 text-purple-400',
    valColor: 'text-white',
  },
};

export default function MetricCard({
  title,
  value,
  unit,
  subtext,
  icon: Icon,
  trend,
  trendType = 'neutral',
  accent = 'blue',
}: MetricCardProps) {
  const styles = ACCENT_MAP[accent] || ACCENT_MAP.blue;

  return (
    <div
      className={`relative rounded-xl border ${styles.border} bg-slate-900/60 p-3.5 transition-colors`}
    >
      {/* Header: Title + Compact Icon */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400 truncate">
          {title}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.iconBg} shrink-0`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Main Value */}
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${styles.valColor}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {/* Footer: Subtext & Trend */}
      <div className="mt-1.5 flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/50">
        <span className="text-slate-400 truncate max-w-[65%]">
          {subtext || '—'}
        </span>
        {trend && (
          <span
            className={`font-medium shrink-0 ${
              trendType === 'positive'
                ? 'text-emerald-400'
                : trendType === 'negative'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
