"""
Thai Electricity Tariff Engine (MEA & PEA Official Residential Tariffs)
======================================================================
Official calculation standards following Energy Regulatory Commission (ERC / กกพ.),
Metropolitan Electricity Authority (MEA / กฟน.), and Provincial Electricity Authority (PEA / กฟภ.).

1. Residential Category 1.2 (อัตราก้าวหน้า Progressive Step Rate):
   - 1 – 150 kWh    : 3.2484 THB/kWh
   - 151 – 400 kWh  : 4.2233 THB/kWh
   - 401+ kWh       : 4.4217 THB/kWh
   - Service Charge : 38.22 THB/month
   - Ft (2024)      : 0.3972 THB/kWh
   - VAT            : 7.0%

2. Residential Category 1.3 (Time of Use Rate - TOU แรงดัน < 22 kV):
   - On-Peak (Mon-Fri 09:00 - 22:00) : 5.1135 THB/kWh (Base) + Ft 0.3972 = 5.5107 THB/kWh
   - Off-Peak (Mon-Fri 22:00 - 09:00, Sat-Sun 24h) : 2.6007 THB/kWh (Base) + Ft 0.3972 = 2.9979 THB/kWh
   - Service Charge : 38.22 THB/month
   - Ft (2024)      : 0.3972 THB/kWh
   - VAT            : 7.0%
   - Solar Export Feed-in Tariff (FiT): 2.20 THB/kWh (โครงการโซลาร์ภาคประชาชน)
"""

from typing import Dict, Any

# Official Base Energy Rates (THB / kWh excluding Ft & VAT)
NORMAL_STEP_1_LIMIT = 150.0
NORMAL_STEP_1_RATE = 3.2484

NORMAL_STEP_2_LIMIT = 400.0
NORMAL_STEP_2_RATE = 4.2233

NORMAL_STEP_3_RATE = 4.4217

TOU_ON_PEAK_BASE = 5.1135
TOU_OFF_PEAK_BASE = 2.6007

# Ancillary Charges
SERVICE_CHARGE_THB = 38.22
FT_RATE_THB = 0.3972
FIT_EXPORT_RATE_THB = 2.20
VAT_RATE_PCT = 7.0

# Pre-computed effective rates including Ft (for quick telemetry/instant estimates)
TOU_ON_PEAK_WITH_FT = round(TOU_ON_PEAK_BASE + FT_RATE_THB, 4)     # 5.5107
TOU_OFF_PEAK_WITH_FT = round(TOU_OFF_PEAK_BASE + FT_RATE_THB, 4)   # 2.9979
NORMAL_AVERAGE_WITH_FT = 4.4217 + FT_RATE_THB                       # ~4.8189


def calculate_normal_progressive_bill(monthly_kwh: float) -> Dict[str, Any]:
    """
    Calculates authentic MEA/PEA residential electricity bill for Normal Meter (Category 1.2).
    """
    kwh = max(0.0, float(monthly_kwh))
    
    # Step 1: 0 - 150 kWh
    step1_kwh = min(kwh, NORMAL_STEP_1_LIMIT)
    step1_cost = step1_kwh * NORMAL_STEP_1_RATE
    
    # Step 2: 151 - 400 kWh
    step2_kwh = max(0.0, min(kwh - NORMAL_STEP_1_LIMIT, NORMAL_STEP_2_LIMIT - NORMAL_STEP_1_LIMIT))
    step2_cost = step2_kwh * NORMAL_STEP_2_RATE
    
    # Step 3: 401+ kWh
    step3_kwh = max(0.0, kwh - NORMAL_STEP_2_LIMIT)
    step3_cost = step3_kwh * NORMAL_STEP_3_RATE
    
    base_energy_cost = step1_cost + step2_cost + step3_cost
    ft_cost = kwh * FT_RATE_THB
    service_cost = SERVICE_CHARGE_THB if kwh > 0 else 0.0
    
    subtotal = base_energy_cost + ft_cost + service_cost
    vat_cost = subtotal * (VAT_RATE_PCT / 100.0)
    total_bill = subtotal + vat_cost
    
    effective_rate = (total_bill / kwh) if kwh > 0 else 0.0

    return {
        "meter_type": "normal_progressive",
        "category": "บ้านอยู่อาศัย อัตรา 1.2 (เกิน 150 หน่วย/เดือน)",
        "total_kwh": round(kwh, 2),
        "steps_breakdown": [
            {"label": "1 - 150 หน่วยแรก", "kwh": round(step1_kwh, 2), "rate": NORMAL_STEP_1_RATE, "cost": round(step1_cost, 2)},
            {"label": "151 - 400 หน่วยถัดไป", "kwh": round(step2_kwh, 2), "rate": NORMAL_STEP_2_RATE, "cost": round(step2_cost, 2)},
            {"label": "401 หน่วยขึ้นไป", "kwh": round(step3_kwh, 2), "rate": NORMAL_STEP_3_RATE, "cost": round(step3_cost, 2)},
        ],
        "base_energy_cost_thb": round(base_energy_cost, 2),
        "service_charge_thb": round(service_cost, 2),
        "ft_rate_thb": FT_RATE_THB,
        "ft_cost_thb": round(ft_cost, 2),
        "subtotal_thb": round(subtotal, 2),
        "vat_pct": VAT_RATE_PCT,
        "vat_cost_thb": round(vat_cost, 2),
        "total_bill_thb": round(total_bill, 2),
        "effective_rate_thb_kwh": round(effective_rate, 2),
    }


def calculate_tou_bill(
    on_peak_kwh: float, 
    off_peak_kwh: float, 
    export_kwh: float = 0.0
) -> Dict[str, Any]:
    """
    Calculates authentic MEA/PEA residential electricity bill for TOU Meter (Category 1.3).
    Includes on-peak, off-peak, Ft, service charge, feed-in tariff income, and VAT.
    """
    on_kwh = max(0.0, float(on_peak_kwh))
    off_kwh = max(0.0, float(off_peak_kwh))
    exp_kwh = max(0.0, float(export_kwh))
    total_import_kwh = on_kwh + off_kwh

    on_cost = on_kwh * TOU_ON_PEAK_BASE
    off_cost = off_kwh * TOU_OFF_PEAK_BASE
    base_energy_cost = on_cost + off_cost

    ft_cost = total_import_kwh * FT_RATE_THB
    service_cost = SERVICE_CHARGE_THB if total_import_kwh > 0 else 0.0

    # Grid export income (Feed-in Tariff 2.20 THB/kWh)
    export_income = exp_kwh * FIT_EXPORT_RATE_THB

    subtotal_before_vat = base_energy_cost + ft_cost + service_cost
    vat_cost = subtotal_before_vat * (VAT_RATE_PCT / 100.0)
    total_bill_before_export = subtotal_before_vat + vat_cost

    # Net payable bill (subtract export credit)
    net_payable_thb = max(0.0, total_bill_before_export - export_income)
    effective_rate = (net_payable_thb / total_import_kwh) if total_import_kwh > 0 else 0.0

    return {
        "meter_type": "tou_time_of_use",
        "category": "บ้านอยู่อาศัย อัตรา 1.3 (TOU แรงดันต่ำกว่า 22 kV)",
        "on_peak_kwh": round(on_kwh, 2),
        "off_peak_kwh": round(off_kwh, 2),
        "total_import_kwh": round(total_import_kwh, 2),
        "on_peak_base_rate": TOU_ON_PEAK_BASE,
        "off_peak_base_rate": TOU_OFF_PEAK_BASE,
        "on_peak_with_ft": TOU_ON_PEAK_WITH_FT,
        "off_peak_with_ft": TOU_OFF_PEAK_WITH_FT,
        "on_peak_cost_thb": round(on_cost, 2),
        "off_peak_cost_thb": round(off_cost, 2),
        "base_energy_cost_thb": round(base_energy_cost, 2),
        "service_charge_thb": round(service_cost, 2),
        "ft_rate_thb": FT_RATE_THB,
        "ft_cost_thb": round(ft_cost, 2),
        "subtotal_thb": round(subtotal_before_vat, 2),
        "vat_pct": VAT_RATE_PCT,
        "vat_cost_thb": round(vat_cost, 2),
        "total_import_bill_thb": round(total_bill_before_export, 2),
        "export_kwh": round(exp_kwh, 2),
        "export_rate_thb": FIT_EXPORT_RATE_THB,
        "export_income_thb": round(export_income, 2),
        "total_bill_thb": round(net_payable_thb, 2),
        "effective_rate_thb_kwh": round(effective_rate, 2),
    }


def compare_bills(
    total_kwh: float, 
    on_peak_ratio: float = 0.40,
    solar_kwh_generated: float = 0.0,
    export_kwh: float = 0.0
) -> Dict[str, Any]:
    """
    Compares real Normal Meter bill vs real TOU Meter bill side-by-side with full MEA/PEA breakdowns.
    """
    normal_bill = calculate_normal_progressive_bill(total_kwh)
    
    on_peak_kwh = total_kwh * on_peak_ratio
    off_peak_kwh = total_kwh * (1.0 - on_peak_ratio)
    tou_bill = calculate_tou_bill(on_peak_kwh, off_peak_kwh, export_kwh)

    monthly_savings = max(0.0, normal_bill["total_bill_thb"] - tou_bill["total_bill_thb"])
    savings_pct = (monthly_savings / normal_bill["total_bill_thb"] * 100.0) if normal_bill["total_bill_thb"] > 0 else 0.0

    return {
        "normal_bill": normal_bill,
        "tou_bill": tou_bill,
        "monthly_savings_thb": round(monthly_savings, 2),
        "yearly_savings_thb": round(monthly_savings * 12.0, 2),
        "savings_pct": round(savings_pct, 1),
    }
