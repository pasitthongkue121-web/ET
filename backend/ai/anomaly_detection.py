"""
Anomaly Detection Engine
=========================
Detects power anomalies, energy spikes, and suspicious standby loads
from energy reading time-series data.
"""

from typing import List, Dict, Any, Optional
import math
import logging

logger = logging.getLogger(__name__)

# Thresholds
Z_SCORE_THRESHOLD = 3.0       # flag readings >3 std-devs from device mean
STANDBY_THRESHOLD_W = 50.0    # devices consuming >50W when "off" hours
SPIKE_RATIO_THRESHOLD = 2.0   # flag if current > 2x 7-day average


# ---------------------------------------------------------------------------
# Helper stats
# ---------------------------------------------------------------------------
def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    variance = sum((v - m) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


# ---------------------------------------------------------------------------
# Public detection functions
# ---------------------------------------------------------------------------

def detect_power_anomalies(readings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Z-Score anomaly detection per device.

    Args:
        readings: List of reading dicts with keys: device_id, power, timestamp

    Returns:
        List of anomaly event dicts with severity (low/medium/high)
    """
    if not readings:
        return []

    # Group by device
    from collections import defaultdict
    by_device: Dict[str, List[float]] = defaultdict(list)
    for r in readings:
        by_device[r.get("device_id", "unknown")].append(float(r.get("power", 0.0)))

    anomalies = []
    for device_id, powers in by_device.items():
        if len(powers) < 5:
            continue
        mean_p = _mean(powers)
        std_p = _std(powers)
        if std_p == 0:
            continue

        for i, r in enumerate(readings):
            if r.get("device_id") != device_id:
                continue
            pwr = float(r.get("power", 0.0))
            z = abs(pwr - mean_p) / std_p
            if z > Z_SCORE_THRESHOLD:
                severity = "high" if z > 5.0 else ("medium" if z > 4.0 else "low")
                anomalies.append({
                    "type": "power_spike",
                    "device_id": device_id,
                    "timestamp": r.get("timestamp", ""),
                    "power_w": round(pwr, 1),
                    "expected_w": round(mean_p, 1),
                    "z_score": round(z, 2),
                    "severity": severity,
                    "message": (
                        f"{device_id.replace('_', ' ').title()} reading {round(pwr,0)}W "
                        f"is {round(z,1)}× above normal ({round(mean_p,0)}W avg)"
                    ),
                })

    return anomalies


def detect_standby_anomalies(
    readings: List[Dict[str, Any]],
    off_hours: Optional[List[int]] = None
) -> List[Dict[str, Any]]:
    """
    Detect devices consuming above STANDBY_THRESHOLD_W during expected off hours.

    Args:
        readings: time-series readings
        off_hours: list of hours (0-23) considered off hours; defaults to [1,2,3,4,5]
    """
    if off_hours is None:
        off_hours = [1, 2, 3, 4, 5]

    anomalies = []
    for r in readings:
        try:
            hour = int(r.get("timestamp", "00:00:00")[11:13])
        except (ValueError, IndexError):
            continue

        if hour not in off_hours:
            continue

        pwr = float(r.get("power", 0.0))
        dev_id = r.get("device_id", "unknown")

        if pwr > STANDBY_THRESHOLD_W:
            anomalies.append({
                "type": "standby_high",
                "device_id": dev_id,
                "timestamp": r.get("timestamp", ""),
                "power_w": round(pwr, 1),
                "threshold_w": STANDBY_THRESHOLD_W,
                "severity": "medium" if pwr < 200 else "high",
                "message": (
                    f"{dev_id.replace('_', ' ').title()} consuming {round(pwr,0)}W "
                    f"at {hour:02d}:00 (expected standby)"
                ),
            })

    return anomalies


def detect_energy_spike(
    device_id: str,
    current_power: float,
    historical_readings: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Compare current power reading against 7-day rolling average for a device.

    Returns anomaly dict if spike detected, else None.
    """
    device_powers = [
        float(r.get("power", 0.0))
        for r in historical_readings
        if r.get("device_id") == device_id and float(r.get("power", 0.0)) > 0
    ]

    if len(device_powers) < 10:
        return None

    avg_power = _mean(device_powers)
    if avg_power == 0:
        return None

    ratio = current_power / avg_power
    if ratio >= SPIKE_RATIO_THRESHOLD:
        severity = "high" if ratio >= 3.0 else "medium"
        return {
            "type": "energy_spike",
            "device_id": device_id,
            "timestamp": "",
            "power_w": round(current_power, 1),
            "avg_7d_w": round(avg_power, 1),
            "ratio": round(ratio, 2),
            "severity": severity,
            "message": (
                f"{device_id.replace('_', ' ').title()} using {round(ratio, 1)}× "
                f"its 7-day average ({round(avg_power, 0)}W → {round(current_power, 0)}W)"
            ),
        }

    return None


def run_full_anomaly_scan(
    readings: List[Dict[str, Any]],
    latest_readings: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Run all anomaly detectors and return a combined report.

    Args:
        readings: Historical time-series (last 7 days)
        latest_readings: Most recent reading per device (optional)

    Returns:
        Dict with anomaly counts, list of anomalies, and summary.
    """
    all_anomalies: List[Dict[str, Any]] = []

    # 1. Z-Score spikes in historical data
    power_anomalies = detect_power_anomalies(readings)
    all_anomalies.extend(power_anomalies)

    # 2. Standby consumption
    standby_anomalies = detect_standby_anomalies(readings)
    all_anomalies.extend(standby_anomalies)

    # 3. Spike detection on latest readings vs history
    if latest_readings:
        for lr in latest_readings:
            dev_id = lr.get("device_id", "")
            current_pwr = float(lr.get("power", 0.0))
            spike = detect_energy_spike(dev_id, current_pwr, readings)
            if spike:
                spike["timestamp"] = lr.get("timestamp", "")
                all_anomalies.append(spike)

    # Deduplicate by device+type keeping highest severity
    seen: Dict[str, Dict] = {}
    severity_rank = {"high": 3, "medium": 2, "low": 1}
    for a in all_anomalies:
        key = f"{a['device_id']}:{a['type']}"
        if key not in seen or severity_rank.get(a["severity"], 0) > severity_rank.get(seen[key]["severity"], 0):
            seen[key] = a

    deduped = sorted(seen.values(), key=lambda x: severity_rank.get(x["severity"], 0), reverse=True)

    counts = {"high": 0, "medium": 0, "low": 0}
    for a in deduped:
        counts[a.get("severity", "low")] += 1

    return {
        "total_anomalies": len(deduped),
        "high_severity": counts["high"],
        "medium_severity": counts["medium"],
        "low_severity": counts["low"],
        "anomalies": deduped[:20],  # cap at 20 for API response size
        "scan_summary": (
            f"Detected {len(deduped)} anomalies: "
            f"{counts['high']} high, {counts['medium']} medium, {counts['low']} low."
        ) if deduped else "No anomalies detected — system operating normally.",
    }
