import unittest
from backend.services.twin_service import twin_service

class TestDigitalTwinService(unittest.TestCase):
    def test_get_state(self):
        state = twin_service.get_state()
        self.assertIsNotNone(state.timestamp)
        self.assertGreater(state.total_power_kw, 0.0)
        self.assertGreater(state.temperature_c, 15.0)
        self.assertGreater(state.total_devices_count, 0)
        self.assertEqual(state.tag, "MEASURED")

    def test_get_home(self):
        home = twin_service.get_home()
        self.assertEqual(home.home_id, "HOME_TWIN_01")
        self.assertGreater(home.monthly_energy_kwh, 50.0)
        self.assertGreater(home.cost_today_thb, 0.0)
        self.assertEqual(home.total_devices, 8)

    def test_get_rooms(self):
        rooms = twin_service.get_rooms()
        self.assertEqual(len(rooms), 4) # Kitchen, Living Room, Bedroom, Study
        room_names = [r.name for r in rooms]
        self.assertIn("Living Room", room_names)
        self.assertIn("Kitchen", room_names)
        
        # Check devices inside rooms
        total_devs = sum(len(r.devices) for r in rooms)
        self.assertEqual(total_devs, 8)

    def test_get_devices(self):
        devices = twin_service.get_devices()
        self.assertEqual(len(devices), 8)
        dev_ids = [d.device_id for d in devices]
        self.assertIn("AC_LIVING", dev_ids)
        self.assertIn("FRIDGE_KITCHEN", dev_ids)

    def test_get_device_detail(self):
        detail = twin_service.get_device_detail("AC_LIVING")
        self.assertIsNotNone(detail)
        self.assertEqual(detail.device_id, "AC_LIVING")
        self.assertGreater(detail.monthly_energy_kwh, 0.0)
        self.assertGreaterEqual(detail.confidence_pct, 40)
        self.assertEqual(detail.tag, "MEASURED")

        # Non-existent device returns None
        not_found = twin_service.get_device_detail("NON_EXISTENT_DEV")
        self.assertIsNone(not_found)

if __name__ == '__main__':
    unittest.main()
