
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from backend.database.repository import get_repository
from backend.services.tou_service import calculate_cost_from_readings


class DigitalTwinDevice(BaseModel):
    device_id: str
    name: str
    room_id: str
    room_name: str
    device_type: str
    rated_power: float
    status: bool
    current_power_w: float
    temperature_setting: Optional[float] = None
    schedule: str


class DigitalTwinRoom(BaseModel):
    room_id: str
    name: str
    floor: int
    icon: str
    active_devices: int
    total_devices: int
    current_power_w: float
    devices: List[DigitalTwinDevice]


class DigitalTwinDeviceDetail(DigitalTwinDevice):
    rated_power_w: float
    today_energy_kwh: float
    monthly_energy_kwh: float
    runtime_hours: float
    confidence_pct: int
    tag: str


class DigitalTwinState(BaseModel):
    timestamp: str
    status: str
    current_power_kw: float
    daily_energy_kwh: float
    monthly_energy_kwh: float
    total_devices: int
    active_devices: int
    cost_today_thb: float


class DigitalTwinEngine:
    def get_system_state(self) -> DigitalTwinState:
        repo = get_repository()
        now = datetime.now()
        start_of_day = now.replace(hour=0, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        devices = repo.get_devices()
        latest_readings = repo.get_latest_device_readings()

        total_devices = len(devices)
        active_devices = sum(1 for dev in latest_readings if dev.get("power", 0.0) > 15.0)
        current_power = sum(dev.get("power", 0.0) for dev in latest_readings) / 1000.0

        today_readings = repo.get_readings_timeseries(start_of_day, now_str)
        today_kwh = sum(r.get("energy", 0.0) for r in today_readings)

        month_readings = repo.get_readings_timeseries(start_of_month, now_str)
        month_kwh = sum(r.get("energy", 0.0) for r in month_readings)

        cost_result = calculate_cost_from_readings(today_readings)
        cost_thb = cost_result.get("total_cost_thb", 0.0) if isinstance(cost_result, dict) else float(cost_result)

        return DigitalTwinState(
            timestamp=now_str,
            status="ONLINE" if active_devices > 0 else "IDLE",
            current_power_kw=round(current_power, 2),
            daily_energy_kwh=round(today_kwh, 2),
            monthly_energy_kwh=round(month_kwh, 2),
            total_devices=total_devices,
            active_devices=active_devices,
            cost_today_thb=round(cost_thb, 2)
        )

    def get_rooms(self) -> List[DigitalTwinRoom]:
        repo = get_repository()
        rooms_list = repo.get_rooms()
        devices = repo.get_devices()
        latest = repo.get_latest_device_readings()

        latest_map = {r.get("device_id"): r for r in latest if r.get("device_id")}

        rooms_dict: Dict[str, Dict[str, Any]] = {}
        for r in rooms_list:
            r_id = r["id"]
            rooms_dict[r_id] = {
                "room_id": r_id,
                "name": r["name"],
                "floor": r.get("floor", 1),
                "icon": r.get("icon", "home"),
                "devices": [],
                "active_devices": 0,
                "total_devices": 0,
                "current_power_w": 0.0
            }

        for dev in devices:
            r_id = dev.get("room_id")
            if not r_id or r_id not in rooms_dict:
                continue

            dev_id = dev["device_id"]
            latest_r = latest_map.get(dev_id, {})
            p_w = float(latest_r.get("power", 0.0))
            is_active = p_w > 15.0 or bool(dev.get("status", 0))

            sched = "24/7 Continuous" if "fridge" in dev_id.lower() else "Intermittent / Routine"

            twin_dev = DigitalTwinDevice(
                device_id=dev_id,
                name=dev.get("name", dev_id),
                room_id=r_id,
                room_name=rooms_dict[r_id]["name"],
                device_type=dev.get("category", "general"),
                rated_power=float(dev.get("rated_power", 0.0)),
                status=is_active,
                current_power_w=round(p_w, 1),
                temperature_setting=None,
                schedule=sched
            )

            rooms_dict[r_id]["devices"].append(twin_dev)
            rooms_dict[r_id]["total_devices"] += 1
            rooms_dict[r_id]["current_power_w"] += p_w
            if is_active:
                rooms_dict[r_id]["active_devices"] += 1

        result = []
        for r_data in rooms_dict.values():
            result.append(DigitalTwinRoom(
                room_id=r_data["room_id"],
                name=r_data["name"],
                floor=r_data["floor"],
                icon=r_data["icon"],
                active_devices=r_data["active_devices"],
                total_devices=r_data["total_devices"],
                current_power_w=round(r_data["current_power_w"], 1),
                devices=r_data["devices"]
            ))

        return sorted(result, key=lambda r: (r.floor, r.name))

    def get_devices(self) -> List[DigitalTwinDevice]:
        rooms = self.get_rooms()
        devices = []
        for r in rooms:
            devices.extend(r.devices)
        return devices

    def get_device_detail(self, device_id: str) -> Optional[DigitalTwinDeviceDetail]:
        repo = get_repository()
        dev = repo.get_device(device_id)
        if not dev:
            return None

        rooms = repo.get_rooms()
        room_name = next((r["name"] for r in rooms if r["id"] == dev.get("room_id")), "Unknown")

        now = datetime.now()
        start_of_day = now.replace(hour=0, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        today_reads = repo.get_readings_timeseries(start_of_day, now_str, device_id)
        month_reads = repo.get_readings_timeseries(start_of_month, now_str, device_id)

        latest_r = today_reads[-1] if today_reads else {}
        p_w = float(latest_r.get("power", 0.0))

        today_kwh = sum(r.get("energy", 0.0) for r in today_reads)
        month_kwh = sum(r.get("energy", 0.0) for r in month_reads)
        runtime_h = sum(1 for r in today_reads if r.get("power", 0.0) > 15.0) / 4.0

        sched = "24/7 Continuous" if "fridge" in device_id.lower() else "Flexible Usage"

        return DigitalTwinDeviceDetail(
            device_id=device_id,
            name=dev.get("name", device_id),
            room_id=dev.get("room_id", ""),
            room_name=room_name,
            device_type=dev.get("category", "general"),
            status=p_w > 15.0 or bool(dev.get("status", 0)),
            current_power_w=round(p_w, 1),
            rated_power=float(dev.get("rated_power", 0.0)),
            rated_power_w=float(dev.get("rated_power", 0.0)),
            today_energy_kwh=round(today_kwh, 2),
            monthly_energy_kwh=round(month_kwh, 2),
            runtime_hours=round(runtime_h, 1),
            temperature_setting=None,
            schedule=sched,
            confidence_pct=95,
            tag="MEASURED"
        )


digital_twin_engine = DigitalTwinEngine()
