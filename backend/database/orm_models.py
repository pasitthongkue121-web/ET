from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True) # e.g. user_001
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    devices = relationship("Device", back_populates="owner")
    energy_data = relationship("EnergyData", back_populates="owner")

class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    device_name = Column(String, nullable=False)
    device_type = Column(String, nullable=False)
    rated_power = Column(Float, nullable=False)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="devices")
    energy_data = relationship("EnergyData", back_populates="device")

class EnergyData(Base):
    __tablename__ = "energy_data"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    voltage = Column(Float)
    current = Column(Float)
    power = Column(Float)
    energy_kwh = Column(Float)
    temperature = Column(Float)
    
    owner = relationship("User", back_populates="energy_data")
    device = relationship("Device", back_populates="energy_data")

class TOUData(Base):
    __tablename__ = "tou_data"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    period = Column(String) # Peak, Off-Peak
    energy_kwh = Column(Float)
    rate = Column(Float)
    cost = Column(Float)

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    predicted_power = Column(Float)
    predicted_energy = Column(Float)
    prediction_type = Column(String)

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    recommendation = Column(String)
    estimated_energy_saving = Column(Float)
    estimated_cost_saving = Column(Float)
