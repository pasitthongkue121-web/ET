'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import MetricCard from '../components/MetricCard';
import PowerChart from '../components/PowerChart';
import EnergyUsageChart from '../components/EnergyUsageChart';
import DeviceGrid from '../components/DeviceGrid';
import EnergyScoreCard from '../components/EnergyScoreCard';
import AIInsightCard from '../components/AIInsightCard';
import RecentActivityList from '../components/RecentActivityList';
import {
  getDashboardSummary,
  getEnergyHistory,
  getDevices,
  checkBackendHealth,
  getAnalyticsSummary,
  getDailyAnalytics,
  getDeviceAnalytics,
  getPeakAnalytics,
  getRoutine,
  getAutomatedInsights,
  getGSheetStatus,
  GSheetStatus,
} from '../lib/api';
import {
  DashboardSummary,
  EnergyHistoryResponse,
  Device,
  AnalyticsSummary,
  DailyEnergyItem,
  DeviceConsumptionItem,
  PeakAnalytics,
  RoutineResponse,
  InsightDetectionItem,
} from '../lib/types';
import {
  Zap,
  DollarSign,
  Calendar,
  TrendingUp,
  Cpu,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  BatteryCharging,
  Layers,
} from '../components/Icons';

const AUTO_REFRESH_SECONDS = 30;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [energyData, setEnergyData] = useState<EnergyHistoryResponse | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');

  // Phase 2 states
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyEnergyItem[]>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<DeviceConsumptionItem[]>([]);
  const [peakAnalytics, setPeakAnalytics] = useState<PeakAnalytics | null>(null);
  const [routineData, setRoutineData] = useState<RoutineResponse | null>(null);
  const [autoInsights, setAutoInsights] = useState<InsightDetectionItem[]>([]);

  // Google Sheet live status
  const [gsheetStatus, setGsheetStatus] = useState<GSheetStatus | null>(null);
  const [countdown, setCountdown] = useState<number>(AUTO_REFRESH_SECONDS);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<'devices' | 'insights' | 'activity'>('devices');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isHealthy = await checkBackendHealth();
      setIsBackendOnline(isHealthy);

      const [
        sumRes,
        energyRes,
        devRes,
        anSumRes,
        dailyRes,
        devAnRes,
        peakRes,
        routRes,
        insightRes,
        gsRes,
      ] = await Promise.all([
        getDashboardSummary(),
        getEnergyHistory(period),
        getDevices(),
        getAnalyticsSummary(30).catch(() => null),
        getDailyAnalytics(14).catch(() => []),
        getDeviceAnalytics(30).catch(() => []),
        getPeakAnalytics(30).catch(() => null),
        getRoutine(30).catch(() => null),
        getAutomatedInsights().catch(() => []),
        getGSheetStatus().catch(() => null),
      ]);

      setSummary(sumRes);
      setEnergyData(energyRes);
      setDevices(devRes);
      setAnalyticsSummary(anSumRes);
      setDailyAnalytics(dailyRes);
      setDeviceAnalytics(devAnRes);
      setPeakAnalytics(peakRes);
      setRoutineData(routRes);
      setAutoInsights(insightRes);
      setGsheetStatus(gsRes);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Cannot connect to ENERGY TWINS AI Backend');
      setIsBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh interval
  useEffect(() => {
    const refreshId = setInterval(() => {
      loadData();
      setCountdown(AUTO_REFRESH_SECONDS);
    }, AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(refreshId);
  }, [loadData]);

  // Countdown timer
  useEffect(() => {
    setCountdown(AUTO_REFRESH_SECONDS);
    const tickId = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? AUTO_REFRESH_SECONDS : prev - 1));
    }, 1000);
    return () => clearInterval(tickId);
  }, []);

  const handlePeriodChange = async (newPeriod: 'today' | '7d' | '30d') => {
    setPeriod(newPeriod);
    setIsChartLoading(true);
    try {
      const res = await getEnergyHistory(newPeriod);
      setEnergyData(res);
    } catch (err: any) {
      console.error('Error fetching period:', err);
    } finally {
      setIsChartLoading(false);
    }
  };

  // Pre-calculate clean metrics
  const currentKw = summary?.current_power_kw ?? 0.0;
  const currentWatts = (currentKw * 1000).toFixed(0);
  const todayKwh = summary?.today_energy_kwh ?? 0.0;
  const todayCost = summary?.today_cost_thb ?? 0.0;
  const onlineCount = summary?.devices_online ?? devices.filter(d => d.status).length;
  const totalCount = summary?.devices_total ?? devices.length;

  return (
    <AppShell
      isBackendOnline={isBackendOnline}
      onRefresh={loadData}
      isLoading={isLoading}
      lastUpdated={summary?.last_updated}
      autoRefreshCountdown={countdown}
    >
      <div className="space-y-3.5">

        {/* ─── Compact Notification Banner (if any) ───────────────────── */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>ไม่สามารถเชื่อมต่อกับ FastAPI Backend: {error}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ROW 1: PRIMARY KPI METRICS (COMPACT 4-COLUMN GRID)
            - Current Power
            - Today's Energy
            - Today's Cost
            - Active Devices
           ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. Current Power */}
          <MetricCard
            title="Current Power"
            value={summary ? currentKw.toFixed(2) : '--'}
            unit="kW"
            subtext={`${currentWatts} Watts load`}
            icon={Zap}
            accent="blue"
            trend={summary ? `${onlineCount} Active` : ''}
            trendType="neutral"
          />

          {/* 2. Today's Energy */}
          <MetricCard
            title="Today's Energy"
            value={summary ? todayKwh.toFixed(1) : '--'}
            unit="kWh"
            subtext="Cumulative usage"
            icon={Calendar}
            accent="emerald"
            trend="+3.2% vs avg"
            trendType="positive"
          />

          {/* 3. Today's Cost */}
          <MetricCard
            title="Today's Cost"
            value={summary ? `฿${todayCost.toFixed(1)}` : '--'}
            subtext="Rate @ ฿4.42 / kWh"
            icon={DollarSign}
            accent="amber"
            trend="Normal Tier"
            trendType="neutral"
          />

          {/* 4. Active Devices */}
          <MetricCard
            title="Active Devices"
            value={`${onlineCount} / ${totalCount}`}
            unit="online"
            subtext={`${totalCount - onlineCount} standby`}
            icon={Cpu}
            accent="purple"
            trend="Stable System"
            trendType="positive"
          />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            ROW 2: DUAL CHARTS (ENERGY USAGE + POWER USAGE)
           ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Energy Usage Chart (Cumulative Daily kWh) */}
          <EnergyUsageChart
            todayKwh={todayKwh}
            avgKwh={10.8}
            isLoading={isLoading}
          />

          {/* Power Usage Chart (Real-time Timeline) */}
          <PowerChart
            data={energyData?.timeseries || []}
            period={period}
            onPeriodChange={handlePeriodChange}
            isLoading={isChartLoading || isLoading}
          />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            ROW 3: AI PREDICTION, DIGITAL TWIN & SAVING RECOMMENDATIONS
           ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Card A: AI Prediction & Digital Twin Overview */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  AI Prediction & Digital Twin
                </h3>
              </div>
              <span className="text-[10px] text-sky-400 font-mono font-medium">
                ML Confidence 94%
              </span>
            </div>

            {/* AI Insight Highlight */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1 flex items-center justify-between">
                <span>AI INSIGHT</span>
                <Link href="/forecast" className="text-sky-300 hover:underline flex items-center gap-0.5">
                  [ดูรายละเอียด] <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>
              <p className="text-xs text-slate-200">
                &ldquo;การใช้ไฟช่วง 18:00–21:00 สูงกว่าค่าเฉลี่ย 18% จากการเปิดแอร์และคอมพิวเตอร์พร้อมกัน&rdquo;
              </p>
            </div>

            {/* Digital Twin Snapshot */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>Digital Twin Simulation</span>
                <Link href="/simulation" className="text-emerald-400 hover:underline flex items-center gap-0.5">
                  [จำลองเพิ่มเติม] <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">Current</div>
                  <div className="text-sm font-bold text-white font-mono">{currentKw.toFixed(2)} kW</div>
                </div>
                <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400">Simulated</div>
                  <div className="text-sm font-bold text-sky-400 font-mono">{(currentKw * 0.81).toFixed(2)} kW</div>
                </div>
                <div className="p-1.5 bg-emerald-950/30 rounded border border-emerald-500/30">
                  <div className="text-[10px] text-emerald-400">Potential Saving</div>
                  <div className="text-sm font-bold text-emerald-300 font-mono">{(currentKw * 0.19).toFixed(2)} kW</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Energy Saving Recommendations */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Energy Saving Recommendations
                </h3>
              </div>
              <Link href="/energy-plan" className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1">
                จัดการแผน <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-1.5">
              {/* Tip 1 */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">1.</span>
                  <span className="text-slate-200">ปรับแอร์ห้องนั่งเล่นเป็น 25°C</span>
                </div>
                <span className="text-emerald-400 font-mono font-bold">ประหยัด ฿280 / ด.</span>
              </div>

              {/* Tip 2 */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">2.</span>
                  <span className="text-slate-200">ย้ายเวลาชาร์จ EV เป็นช่วง Off-Peak (หลัง 22:00)</span>
                </div>
                <span className="text-emerald-400 font-mono font-bold">ลดค่าไฟ 54%</span>
              </div>

              {/* Tip 3 */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">3.</span>
                  <span className="text-slate-200">ปิด Standby PC & อุปกรณ์ช่วงกลางวัน</span>
                </div>
                <span className="text-emerald-400 font-mono font-bold">ประหยัด ฿120 / ด.</span>
              </div>
            </div>

            {/* Monthly Forecast Banner */}
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/50">
              <span className="text-slate-400">
                คาดการณ์ทั้งเดือน: <strong className="text-white font-mono">{summary?.monthly_forecast_kwh ?? 245} kWh</strong>
              </span>
              <span className="text-sky-400 font-medium">
                ประมาณการ ฿{summary?.monthly_forecast_cost_thb.toFixed(0) ?? 1083}
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECONDARY SECTION: TABBED DRILL-DOWN (DEVICES / INSIGHTS / ACTIVITY)
            Keeps screen compact, expandable when user wants deep dive!
           ════════════════════════════════════════════════════════════════ */}
        <div className="pt-2">
          {/* Tab Selector */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex gap-2">
              {[
                { id: 'devices', label: `อุปกรณ์ในระบบ (${devices.length})` },
                { id: 'insights', label: `AI Energy Score (${summary?.energy_score.score ?? 78}/100)` },
                { id: 'activity', label: 'ประวัติกิจกรรม' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSecondaryTab(tab.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeSecondaryTab === tab.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              คลิกเพื่อดูรายละเอียดเพิ่มเติม
            </span>
          </div>

          {/* Tab 1: Devices */}
          {activeSecondaryTab === 'devices' && (
            <DeviceGrid devices={devices} />
          )}

          {/* Tab 2: Energy Score & AI Insights */}
          {activeSecondaryTab === 'insights' && summary && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <EnergyScoreCard scoreData={summary.energy_score} />
              </div>
              <div className="lg:col-span-7">
                <AIInsightCard insights={summary.insights} />
              </div>
            </div>
          )}

          {/* Tab 3: Recent Activity Feed */}
          {activeSecondaryTab === 'activity' && summary?.recent_activities && (
            <RecentActivityList activities={summary.recent_activities} />
          )}
        </div>

      </div>
    </AppShell>
  );
}
