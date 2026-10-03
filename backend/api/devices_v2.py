from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend.database.database import get_db
from backend.database.orm_models import Device, User
from backend.core.auth import get_current_user
import uuid

router = APIRouter(prefix="/api/devices", tags=["Devices v2"])

class DeviceCreate(BaseModel):
    device_name: str
    device_type: str
    rated_power: float
    location: Optional[str] = None

class DeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    rated_power: Optional[float] = None
    location: Optional[str] = None

class DeviceResponse(BaseModel):
    id: str
    user_id: str
    device_name: str
    device_type: str
    rated_power: float
    location: Optional[str]
    api_key: Optional[str]
    class Config:
        from_attributes = True

@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Device).filter(Device.user_id == current_user.id).all()

@router.post("", response_model=DeviceResponse, status_code=201)
def create_device(body: DeviceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = Device(
        id=uuid.uuid4().hex[:8],
        user_id=current_user.id,
        device_name=body.device_name,
        device_type=body.device_type,
        rated_power=body.rated_power,
        location=body.location,
        api_key=uuid.uuid4().hex,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, body: DeviceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    for field, value in body.dict(exclude_unset=True).items():
        setattr(device, field, value)
    db.commit()
    db.refresh(device)
    return device

@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(device)
    db.commit()
    return {"success": True, "message": "Device deleted"}
