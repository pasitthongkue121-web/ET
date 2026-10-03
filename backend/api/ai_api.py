from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional
from backend.database.database import get_db
from backend.database.orm_models import EnergyData, Device, User, Prediction, Recommendation
from backend.core.auth import get_current_user
import numpy as np

router = APIRouter(prefix="/api/ai", tags=["AI"])

class PredictResponse(BaseModel):
    predicted_energy: float
    predicted_power: float
    confidence: float
    method: str

@router.post("/predict", response_model=PredictResponse)
def predict(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(days=7)
    rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= cutoff
    ).order_by(EnergyData.timestamp).all()

    if len(rows) < 5:
        # Insufficient data — simple fallback
        avg_power = sum(r.power or 0 for r in rows) / max(len(rows), 1)
        predicted_energy = avg_power * 24 / 1000
        method = "average"
        confidence = 0.4
    else:
        try:
            from sklearn.linear_model import LinearRegression
            X = np.array([(r.timestamp.hour + r.timestamp.minute / 60) for r in rows]).reshape(-1, 1)
            y = np.array([r.power or 0 for r in rows])
            model = LinearRegression().fit(X, y)
            hours = np.arange(0, 24, 0.5).reshape(-1, 1)
            preds = model.predict(hours)
            predicted_power = float(np.mean(np.clip(preds, 0, None)))
            predicted_energy = predicted_power * 24 / 1000
            r2 = float(model.score(X, y))
            confidence = max(0.5, min(0.95, abs(r2)))
            method = "linear_regression"
        except Exception:
            avg_power = float(np.mean([r.power or 0 for r in rows]))
            predicted_energy = avg_power * 24 / 1000
            predicted_power = avg_power
            confidence = 0.5
            method = "average_fallback"

    # Save prediction
    pred = Prediction(
        user_id=current_user.id,
        timestamp=datetime.utcnow(),
        predicted_power=round(predicted_power if 'predicted_power' in dir() else rows[-1].power, 2),
        predicted_energy=round(predicted_energy, 4),
        prediction_type=method,
    )
    db.add(pred)
    db.commit()

    return {"predicted_energy": round(predicted_energy, 4), "predicted_power": round(pred.predicted_power, 2), "confidence": round(confidence, 2), "method": method}

@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(hours=24)
    rows = db.query(EnergyData).filter(
        EnergyData.user_id == current_user.id,
        EnergyData.timestamp >= cutoff
    ).all()

    recs = []
    devices_power: dict = {}
    peak_usage: dict = {}

    for r in rows:
        devices_power.setdefault(r.device_id, []).append(r.power or 0)
        if 9 <= r.timestamp.hour < 22:
            peak_usage.setdefault(r.device_id, []).append(r.power or 0)

    for device_id, powers in devices_power.items():
        avg = sum(powers) / len(powers)
        peak_avg = sum(peak_usage.get(device_id, [0])) / max(len(peak_usage.get(device_id, [1])), 1)

        device = db.query(Device).filter(Device.id == device_id).first()
        name = device.device_name if device else device_id

        if avg > 1000:
            energy_saving = avg * 0.2 * 24 / 1000
            cost_saving = energy_saving * 3.0
            recs.append({
                "device_id": device_id,
                "device_name": name,
                "recommendation": f"อุปกรณ์ '{name}' มีกำลังไฟเฉลี่ยสูง ({avg:.0f}W) ควรตรวจสอบประสิทธิภาพ",
                "estimated_energy_saving": round(energy_saving, 3),
                "estimated_cost_saving": round(cost_saving, 2),
            })
        if peak_avg > 500 and peak_usage.get(device_id):
            energy_saving = peak_avg * 0.3 * 8 / 1000
            cost_saving = energy_saving * (5.0 - 3.0)
            recs.append({
                "device_id": device_id,
                "device_name": name,
                "recommendation": f"อุปกรณ์ '{name}' ใช้ไฟสูงช่วง Peak ({peak_avg:.0f}W) ควรเลื่อนไปช่วง Off-Peak เพื่อประหยัดค่าไฟ",
                "estimated_energy_saving": round(energy_saving, 3),
                "estimated_cost_saving": round(cost_saving, 2),
            })

    # Save recommendations
    for rec in recs:
        db.add(Recommendation(
            user_id=current_user.id,
            device_id=rec["device_id"],
            recommendation=rec["recommendation"],
            estimated_energy_saving=rec["estimated_energy_saving"],
            estimated_cost_saving=rec["estimated_cost_saving"],
        ))
    db.commit()

    if not recs:
        recs.append({
            "device_id": None,
            "device_name": None,
            "recommendation": "การใช้พลังงานของคุณอยู่ในระดับดีแล้ว ยังไม่มีคำแนะนำพิเศษในขณะนี้",
            "estimated_energy_saving": 0,
            "estimated_cost_saving": 0,
        })

    return {"recommendations": recs, "generated_at": datetime.utcnow().isoformat()}
