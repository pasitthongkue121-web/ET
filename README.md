# ENERGY TWINS AI

> **"จำลองก่อนเปลี่ยนจริง ประหยัดก่อนจ่ายจริง"**  
> *(See it. Simulate it. Save it.)*

ระบบบริหารจัดการพลังงานไฟฟ้าภายในบ้านด้วย **AI + Digital Twin** โดยเก็บข้อมูลการใช้ไฟ วิเคราะห์รูปแบบการใช้พลังงาน เรียนรู้กิจวัตรของผู้ใช้งาน คาดการณ์การใช้ไฟ จำลองสถานการณ์ และให้คำแนะนำเพื่อช่วยลดค่าไฟอย่างมีประสิทธิภาพ

---

## สถาปัตยกรรมระบบ (System Architecture)

```
Synthetic 30-Day Data Generator  -->  Future Physical ESP32 (POST /api/energy)
               │                                      │
               ▼                                      ▼
     SQLite Database / Data Abstraction Layer (Repository Pattern)
                               │
               ┌───────────────┼───────────────┬───────────────┐
               ▼               ▼               ▼               ▼
      [Phase 1 Core]    [Phase 2 Analytics] [Phase 2 AI]    [Phase 3 Twin & Sim]
       /api/dashboard    /api/analytics/*    /api/routine/*  /api/twin/*
       /api/energy       - summary, daily    /api/prediction - home, rooms, devices
       /api/devices      - weekly, monthly   - forecast ML   - state, device details
       /api/rooms        - devices, peak     - models XAI    /api/simulation/*
                         - cost, co2         - 7 insights    - run (in-memory physics)
                                                             - templates, scenarios
                                                             - scoring & AI recommend
                               │
                               ▼
        Next.js + TypeScript + Tailwind CSS Frontend (Port 3000)
   ├── Modern AI Energy Theme (Deep Navy, Electric Blue, Energy Green)
   ├── Main Dashboard (KPIs, Charts, Active Routine, AI Insights)
   ├── Energy Monitor (/monitor - Real-time electrical telemetry)
   ├── Personal Energy Routine (/routine - Empirical transitions & heatmap)
   ├── AI Energy Forecast (/forecast - ML models, XAI & 7-detector insights)
   ├── Digital Twin Virtual Home (/twin - Floorplan & device inspection drawer)
   ├── What-If Studio (/simulation - Temperature, schedule, upgrade & scoring)
   └── Strict Data Badges: [MEASURED], [PREDICTED], [SIMULATED], [RECOMMENDED]
```

---

## โครงสร้างโปรเจกต์ (Project Structure)

```
ENERGY SERVE/
├── backend/
│   ├── config.py                   # Settings (Rates, CO2 factors, thermodynamic sensitivity, scenario weights)
│   ├── main.py                     # FastAPI application & router registrations
│   ├── requirements.txt            # Python dependencies (scikit-learn, pandas, numpy, fastapi)
│   ├── api/
│   │   ├── dashboard.py            # /api/dashboard router
│   │   ├── energy.py               # /api/energy router (GET history & POST ESP32)
│   │   ├── devices.py              # /api/devices router
│   │   ├── rooms.py                # /api/rooms router
│   │   ├── analytics.py            # Phase 2: STEP 6 - Energy Analytics router (8 endpoints)
│   │   ├── routine.py              # Phase 2: STEP 7 - Personal Energy Routine router (4 endpoints)
│   │   ├── prediction.py           # Phase 2: STEP 8 - AI Energy Prediction router (4 endpoints)
│   │   ├── twin.py                 # Phase 3: Digital Twin router (5 endpoints)
│   │   └── simulation.py           # Phase 3: What-If Simulation router (8 endpoints)
│   ├── database/
│   │   ├── connection.py           # SQLite connection & schema tables
│   │   ├── models.py               # Pydantic schemas & response contracts (Phases 1, 2 & 3)
│   │   └── repository.py           # BaseEnergyRepository & SQLiteEnergyRepository
│   ├── services/
│   │   ├── energy_service.py       # Time-series aggregation & ESP32 ingestion
│   │   ├── dashboard_service.py    # Live power, costs, energy score, AI insights
│   │   ├── analytics_service.py    # Real statistical analytics & cost/CO2 calculations
│   │   ├── routine_service.py      # Routine extraction & probability calculations
│   │   ├── prediction_service.py   # Model evaluation, forecasting & automated insights
│   │   ├── twin_service.py         # Digital Twin state synchronization & device inspection
│   │   └── simulation_service.py   # What-If execution, scenario storage & recommendation
│   ├── ai/
│   │   ├── data_generator.py       # 30-day realistic synthetic energy data generator
│   │   ├── analytics.py            # Statistical engine (Peak power, durations, cost, carbon)
│   │   ├── routine.py              # Empirical routine learner, Markov/clustering transitions
│   │   ├── prediction.py           # Scikit-learn multi-model benchmark & multi-horizon forecast
│   │   ├── insight_engine.py       # 7-detector automated insight generation
│   │   ├── digital_twin.py         # Digital Twin engine (live floorplan & state synchronization)
│   │   └── simulation_engine.py    # What-If thermodynamic engine (zero DB writes, scenario scoring)
│   └── tests/
│       ├── test_analytics.py       # Unit tests for Step 6 Analytics
│       ├── test_routine.py         # Unit tests for Step 7 Routine Engine
│       ├── test_prediction.py      # Unit tests for Step 8 Prediction & Insights
│       ├── test_digital_twin.py    # Unit tests for Phase 3 Digital Twin State & Rooms
│       └── test_simulation.py      # Unit tests for Phase 3 Simulation & DB Immutability
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── app/
│   │   ├── layout.tsx              # Root layout with dark energy theme
│   │   ├── page.tsx                # Smart Home Energy Dashboard with AI Intelligence & Analytics
│   │   ├── monitor/page.tsx        # Energy Monitor & Analytics (V, A, W, kWh)
│   │   ├── routine/page.tsx        # Personal Energy Routine (/routine)
│   │   ├── forecast/page.tsx       # AI Energy Prediction & Model Evaluation (/forecast)
│   │   ├── twin/page.tsx           # Digital Twin Interactive Virtual Home (/twin)
│   │   ├── simulation/page.tsx     # What-If Simulation Studio (/simulation)
│   │   └── globals.css
│   ├── components/
│   │   ├── Navbar.tsx              # Navigation bar with links to Dashboard, Monitor, Routine, Forecast, Twin, Sim
│   │   ├── AIIntelligenceWidget.tsx# 3-section AI Intelligence Widget
│   │   ├── AnalyticsSection.tsx    # Statistical metrics & 3 interactive charts
│   │   ├── MetricCard.tsx          # KPI cards
│   │   ├── PowerChart.tsx          # Responsive SVG Area chart with tooltips
│   │   ├── DeviceGrid.tsx          # Digital Twin appliance status
│   │   ├── EnergyScoreCard.tsx     # Circular score meter & 5 sub-dimensions
│   │   ├── AIInsightCard.tsx       # Insights computed from dataset
│   │   ├── RecentActivityList.tsx  # Device event stream
│   │   └── Icons.tsx               # Crisp SVG icons
│   └── lib/
│       ├── api.ts                  # Typed client with fetch & error handling (Phases 1, 2 & 3)
│       └── types.ts                # Full TypeScript interfaces
├── data/
│   └── energy_twins.db             # SQLite database (>23,000 telemetry readings)
└── README.md
```

---

## ขั้นตอนการติดตั้งและรันระบบ (Quickstart Guide)

### 1. ติดตั้ง Python Dependencies
```bash
python -m pip install fastapi uvicorn pydantic pandas numpy scikit-learn scipy
```

### 2. รัน Automated Unit Tests (23 Unit Tests)
```bash
python -m unittest discover backend/tests -v
```
> ทดสอบ 23 unit tests ครอบคลุม Analytics, Routine Transitions, ML Forecasting, Digital Twin State, และ Simulation Thermodynamic Models พร้อมทดสอบ Database Immutability

### 3. รัน Backend (FastAPI)
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
- API Root: `http://127.0.0.1:8000/`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs` (31 OpenAPI Endpoints)

### 4. รัน Frontend (Next.js)
```bash
cd frontend
node node_modules/next/dist/bin/next start -p 3000
# หรือสำหรับการพัฒนา:
# node node_modules/next/dist/bin/next dev --webpack -p 3000
```
- **Dashboard**: `http://localhost:3000`
- **Energy Monitor**: `http://localhost:3000/monitor`
- **Personal Routine**: `http://localhost:3000/routine`
- **AI Forecast & Insights**: `http://localhost:3000/forecast`
- **Digital Twin Virtual Home**: `http://localhost:3000/twin`
- **What-If Simulation Studio**: `http://localhost:3000/simulation`

---

## REST API Documentation

### Digital Twin APIs (Phase 3)
- `GET /api/twin/home` — Overall digital twin summary (Power kW, Energy kWh, Costs, Device Counts)
- `GET /api/twin/rooms` — Virtual home floorplan layout (4 Rooms, 2 Floors, Device states)
- `GET /api/twin/devices` — Flat list of all 8 smart home appliances with live status
- `GET /api/twin/state` — Instantaneous synchronized home state (`[MEASURED]` tag)
- `GET /api/twin/device/{device_id}` — Detailed operational statistics & telemetry for an appliance

### What-If Simulation APIs (Phase 3)
- `POST /api/simulation/run` — Executes in-memory thermodynamic simulation replaying 30-day baseline
- `GET /api/simulation/templates` — 5 pre-configured simulation templates (AC 26°C, Shift Peak, etc.)
- `GET /api/simulation/history` — Session history of executed simulations
- `GET /api/simulation/scenarios` — Scenario comparison table (Baseline vs Scenarios B, C, D)
- `POST /api/simulation/scenario` — Saves a simulation run as a named scenario
- `DELETE /api/simulation/scenario/{id}` — Removes a scenario from the comparison matrix
- `POST /api/simulation/score` — Computes multi-criteria score with configurable weights
- `GET /api/simulation/recommendation` — Generates AI recommendation explaining optimal scenario

---

## การเชื่อมต่อ ESP32 ในอนาคต (ESP32 Integration)

ฮาร์ดแวร์ ESP32 หรือ IoT Gateway สามารถส่งข้อมูลเซนเซอร์จริงเข้ามาที่ endpoint:
`POST http://127.0.0.1:8000/api/energy`

**ตัวอย่าง Payload JSON:**
```json
{
  "device_id": "AC_BEDROOM",
  "voltage": 230.2,
  "current": 5.4,
  "power": 1242.0,
  "energy": 0.031,
  "temperature": 25.0,
  "occupancy": true
}
```
เมื่อข้อมูลถูกส่งเข้ามา ระบบจะบันทึกลง Database อัตโนมัติ อัปเดตสถานะของอุปกรณ์ และ Dashboard รวมทั้ง Digital Twin จะสะท้อนข้อมูลทันทีโดยไม่ต้องแก้ไขสถาปัตยกรรมระบบ
