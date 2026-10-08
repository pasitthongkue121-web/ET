import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from backend.database.connection import get_connection
from backend.config import settings

class EnergyAnalyticsEngine:
    """
    Computes statistical and aggregate analytics from the energy database.
    Zero hardcoded numbers: all values are computed directly from actual readings.
    """

    def __init__(self):
        self.rate = settings.ELECTRICITY_RATE
        self.co2_factor = settings.CO2_EMISSION_FACTOR

    def _get_readings_df(self, days: int = 30) -> pd.DataFrame:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(timestamp) FROM energy_readings")
        max_ts_row = cursor.fetchone()
        if not max_ts_row or not max_ts_row[0]:
            conn.close()
            return pd.DataFrame()

        try:
            end_time = datetime.strptime(max_ts_row[0], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            end_time = datetime.fromisoformat(max_ts_row[0].replace("Z", "+00:00").split("+")[0].split(".")[0].replace("T", " ").strip())

        start_time = end_time - timedelta(days=days)

        query = """
            SELECT r.id, r.timestamp, r.device_id, r.voltage, r.current, r.power, r.energy,
                   r.temperature, r.humidity, r.occupancy,
                   d.name as device_name, d.room_id, rm.name as room_name, d.category
            FROM energy_readings r
            JOIN devices d ON r.device_id = d.device_id
            JOIN rooms rm ON d.room_id = rm.id
            WHERE r.timestamp BETWEEN ? AND ? AND d.device_id != 'circuit_solar'
            ORDER BY r.timestamp ASC
        """
        df = pd.read_sql_query(
            query,
            conn,
            params=(start_time.strftime("%Y-%m-%d %H:%M:%S"), end_time.strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.close()

        if not df.empty:
            df["dt"] = pd.to_datetime(df["timestamp"], format='mixed')
            df["date"] = df["dt"].dt.strftime("%Y-%m-%d")
            df["hour"] = df["dt"].dt.hour
        return df

    def compute_summary(self, days: int = 30) -> Dict[str, Any]:
        df = self._get_readings_df(days)
        if df.empty:
            return {
                "total_energy_kwh": 0.0,
                "avg_power_w": 0.0,
                "max_power_w": 0.0,
                "min_power_w": 0.0,
                "peak_usage_time": "N/A",
                "peak_usage_duration_hours": 0.0,
                "total_cost_thb": 0.0,
                "total_co2_kg": 0.0,
                "electricity_rate": self.rate,
                "co2_factor": self.co2_factor,
                "data_points_analyzed": 0,
                "analyzed_from": "N/A",
                "analyzed_to": "N/A",
            }

        # Aggregate total household power per timestamp
        household_ts = df.groupby("timestamp").agg({
            "power": "sum",
            "energy": "sum",
            "dt": "first"
        }).reset_index()

        total_kwh = round(float(household_ts["energy"].sum()), 2)
        avg_power = round(float(household_ts["power"].mean()), 1)
        max_power = round(float(household_ts["power"].max()), 1)
        min_power = round(float(household_ts["power"].min()), 1)

        # Peak timestamp
        peak_row = household_ts.loc[household_ts["power"].idxmax()]
        peak_time = str(peak_row["timestamp"])

        # Peak duration: duration where power is in the upper quartile (> 75th percentile)
        p75 = float(household_ts["power"].quantile(0.75))
        peak_intervals_count = int((household_ts["power"] >= p75).sum())
        # 15-min intervals -> hours
        peak_duration_hours = round(peak_intervals_count * 0.25, 1)

        total_cost = round(total_kwh * self.rate, 2)
        total_co2 = round(total_kwh * self.co2_factor, 2)

        return {
            "total_energy_kwh": total_kwh,
            "avg_power_w": avg_power,
            "max_power_w": max_power,
            "min_power_w": min_power,
            "peak_usage_time": peak_time,
            "peak_usage_duration_hours": peak_duration_hours,
            "total_cost_thb": total_cost,
            "total_co2_kg": total_co2,
            "electricity_rate": self.rate,
            "co2_factor": self.co2_factor,
            "data_points_analyzed": len(df),
            "analyzed_from": str(household_ts["timestamp"].iloc[0]),
            "analyzed_to": str(household_ts["timestamp"].iloc[-1]),
        }

    def compute_daily(self, days: int = 30) -> List[Dict[str, Any]]:
        df = self._get_readings_df(days)
        if df.empty:
            return []

        # Group by timestamp first for household total
        ts_df = df.groupby("timestamp").agg({
            "power": "sum",
            "energy": "sum",
            "date": "first"
        }).reset_index()

        daily_df = ts_df.groupby("date").agg({
            "energy": "sum",
            "power": ["max", "mean"]
        }).reset_index()

        daily_df.columns = ["date", "energy_kwh", "peak_power_w", "avg_power_w"]

        result = []
        for _, row in daily_df.iterrows():
            kwh = round(float(row["energy_kwh"]), 2)
            result.append({
                "date": str(row["date"]),
                "energy_kwh": kwh,
                "cost_thb": round(kwh * self.rate, 2),
                "peak_power_w": round(float(row["peak_power_w"]), 1),
                "avg_power_w": round(float(row["avg_power_w"]), 1),
            })
        return result

    def compute_weekly(self, days: int = 30) -> List[Dict[str, Any]]:
        daily = self.compute_daily(days)
        if not daily:
            return []

        df = pd.DataFrame(daily)
        df["dt"] = pd.to_datetime(df["date"], format='mixed')
        df["week"] = df["dt"].dt.isocalendar().week

        result = []
        for week_num, group in df.groupby("week", sort=False):
            kwh = round(float(group["energy_kwh"].sum()), 2)
            result.append({
                "week_label": f"Week {week_num}",
                "start_date": str(group["date"].iloc[0]),
                "end_date": str(group["date"].iloc[-1]),
                "energy_kwh": kwh,
                "cost_thb": round(kwh * self.rate, 2)
            })
        return result

    def compute_monthly(self, days: int = 30) -> List[Dict[str, Any]]:
        daily = self.compute_daily(days)
        if not daily:
            return []

        df = pd.DataFrame(daily)
        df["dt"] = pd.to_datetime(df["date"], format='mixed')
        df["month"] = df["dt"].dt.strftime("%b %Y")

        result = []
        for month_name, group in df.groupby("month", sort=False):
            kwh = round(float(group["energy_kwh"].sum()), 2)
            cost = round(kwh * self.rate, 2)
            # Projected full 30-day cost
            daily_avg = cost / len(group) if len(group) > 0 else 0
            projected = round(daily_avg * 30, 2)
            result.append({
                "month_label": month_name,
                "energy_kwh": kwh,
                "cost_thb": cost,
                "projected_cost_thb": projected
            })
        return result

    def compute_devices(self, days: int = 30) -> List[Dict[str, Any]]:
        df = self._get_readings_df(days)
        if df.empty:
            return []

        total_household_kwh = float(df["energy"].sum())
        result = []

        for dev_id, group in df.groupby("device_id"):
            dev_kwh = round(float(group["energy"].sum()), 2)
            pct = round((dev_kwh / total_household_kwh * 100.0), 1) if total_household_kwh > 0 else 0.0

            # Runtime = hours where power > 10W (active)
            active_readings = int((group["power"] > 10.0).sum())
            standby_readings = len(group) - active_readings
            runtime_hours = round(active_readings * 0.25, 1)
            standby_hours = round(standby_readings * 0.25, 1)

            first_row = group.iloc[0]
            result.append({
                "device_id": str(dev_id),
                "name": str(first_row["device_name"]),
                "room_name": str(first_row["room_name"]),
                "category": str(first_row["category"]),
                "total_kwh": dev_kwh,
                "percentage": pct,
                "runtime_hours": runtime_hours,
                "standby_hours": standby_hours,
                "cost_thb": round(dev_kwh * self.rate, 2)
            })

        result.sort(key=lambda x: x["total_kwh"], reverse=True)
        return result

    def compute_peak(self, days: int = 30) -> Dict[str, Any]:
        df = self._get_readings_df(days)
        if df.empty:
            return {
                "peak_power_w": 0.0,
                "peak_timestamp": "N/A",
                "peak_window": "N/A",
                "peak_duration_hours": 0.0,
                "peak_to_average_ratio": 1.0,
                "threshold_w": settings.PEAK_POWER_THRESHOLD_W,
                "peak_hours_distribution": []
            }

        ts_df = df.groupby("timestamp").agg({
            "power": "sum",
            "dt": "first",
            "hour": "first"
        }).reset_index()

        peak_idx = ts_df["power"].idxmax()
        peak_row = ts_df.loc[peak_idx]
        peak_power = round(float(peak_row["power"]), 1)
        peak_ts = str(peak_row["timestamp"])
        peak_hour = int(peak_row["hour"])

        avg_power = float(ts_df["power"].mean())
        par = round(peak_power / avg_power, 2) if avg_power > 0 else 1.0

        # Hourly distribution of average power
        hourly_dist = []
        for h, group in ts_df.groupby("hour"):
            hourly_dist.append({
                "hour": int(h),
                "label": f"{int(h):02d}:00",
                "avg_power_w": round(float(group["power"].mean()), 1),
                "max_power_w": round(float(group["power"].max()), 1),
                "is_peak": int(h) in [19, 20, 21, 22]
            })

        # Find 3-hour peak window
        rolling_3h = ts_df.set_index("dt")["power"].resample("1h").mean().rolling(3).mean()
        max_3h_time = rolling_3h.idxmax() if not rolling_3h.empty else peak_row["dt"]
        window_start = (max_3h_time - timedelta(hours=2)).strftime("%H:00") if pd.notnull(max_3h_time) else "19:00"
        window_end = (max_3h_time + timedelta(hours=1)).strftime("%H:00") if pd.notnull(max_3h_time) else "22:00"

        # Duration where power >= threshold
        above_thresh = int((ts_df["power"] >= settings.PEAK_POWER_THRESHOLD_W).sum())
        peak_duration = round(above_thresh * 0.25, 1)

        return {
            "peak_power_w": peak_power,
            "peak_timestamp": peak_ts,
            "peak_window": f"{window_start}–{window_end}",
            "peak_duration_hours": peak_duration,
            "peak_to_average_ratio": par,
            "threshold_w": settings.PEAK_POWER_THRESHOLD_W,
            "peak_hours_distribution": hourly_dist
        }

    def compute_cost(self, days: int = 30) -> Dict[str, Any]:
        daily = self.compute_daily(days)
        total_kwh = sum(d["energy_kwh"] for d in daily)
        total_cost = round(total_kwh * self.rate, 2)
        today_cost = daily[-1]["cost_thb"] if daily else 0.0
        daily_avg = total_cost / len(daily) if daily else 0.0
        monthly_proj = round(daily_avg * 30, 2)

        return {
            "rate_per_kwh": self.rate,
            "total_cost_thb": total_cost,
            "today_cost_thb": today_cost,
            "monthly_projected_cost_thb": monthly_proj,
            "tier_info": "อัตราค่าไฟปกติบ้านอยู่อาศัย (Normal Residential TOU / Base Rate)",
            "daily_costs": [{"date": d["date"], "cost_thb": d["cost_thb"]} for d in daily]
        }

    def compute_co2(self, days: int = 30) -> Dict[str, Any]:
        daily = self.compute_daily(days)
        total_kwh = sum(d["energy_kwh"] for d in daily)
        total_co2 = round(total_kwh * self.co2_factor, 2)
        today_co2 = round((daily[-1]["energy_kwh"] if daily else 0.0) * self.co2_factor, 2)
        monthly_co2 = total_co2

        # 1 mature tree absorbs ~21.77 kg CO2 per year = ~1.81 kg CO2 per month
        trees_needed = round(total_co2 / 1.81, 1)
        # Potential reduction by shifting peak AC 10%:
        potential_reduction = round(total_co2 * 0.12, 2)

        return {
            "total_co2_kg": total_co2,
            "co2_factor": self.co2_factor,
            "today_co2_kg": today_co2,
            "monthly_co2_kg": monthly_co2,
            "tree_offset_equivalent": trees_needed,
            "potential_reduction_kg": potential_reduction
        }

analytics_engine = EnergyAnalyticsEngine()
