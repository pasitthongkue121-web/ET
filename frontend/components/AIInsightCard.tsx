'use client';

import React from 'react';
import { AIInsightItem } from '../lib/types';
import { Sparkles, AlertCircle, CheckCircle2, Info } from './Icons';

interface AIInsightCardProps {
  insights: AIInsightItem[];
}

export default function AIInsightCard({ insights }: AIInsightCardProps) {
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'warning':
        return {
          border: 'border-amber-500/30 bg-amber-950/20',
          icon: AlertCircle,
          iconColor: 'text-amber-400',
          badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        };
      case 'success':
        return {
          border: 'border-emerald-500/30 bg-emerald-950/20',
          icon: CheckCircle2,
          iconColor: 'text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        };
      default:
        return {
          border: 'border-blue-500/30 bg-blue-950/20',
          icon: Info,
          iconColor: 'text-blue-400',
          badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI System Insights</h3>
        </div>
        <span className="text-[10px] text-emerald-400 font-medium">
          ● Data Driven
        </span>
      </div>

      <div className="space-y-2">
        {insights.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            ยังไม่มีข้อมูลเพียงพอสำหรับประมวลผล Insight
          </div>
        ) : (
          insights.slice(0, 3).map((item) => {
            const style = getSeverityStyle(item.severity);
            const Icon = style.icon;

            return (
              <div
                key={item.id}
                className={`rounded-lg border ${style.border} p-2.5 text-xs transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-white">
                        {item.title}
                      </h4>
                      {item.metric_value && (
                        <span className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] font-bold ${style.badge}`}>
                          {item.metric_value}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
