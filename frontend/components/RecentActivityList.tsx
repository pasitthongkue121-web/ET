'use client';

import React from 'react';
import { RecentActivityItem } from '../lib/types';
import { History, Zap, CheckCircle2 } from './Icons';

interface RecentActivityListProps {
  activities: RecentActivityItem[];
}

export default function RecentActivityList({ activities }: RecentActivityListProps) {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <History className="h-4 w-4" />
        </div>
        <h3 className="text-base font-bold text-white">Recent Energy Activity</h3>
      </div>

      <div className="mt-4 divide-y divide-slate-800/80">
        {activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No recent activity recorded
          </div>
        ) : (
          activities.map((act, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {act.device_name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {act.room_name} • {act.event}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-sky-400">
                  {act.power_w.toFixed(0)} W
                </div>
                <div className="text-[10px] text-slate-500">
                  {act.timestamp.split(' ')[1] || act.timestamp}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
