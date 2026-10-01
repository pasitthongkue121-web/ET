import os

class Settings:
    # Electricity Tariff Configuration (Thailand average residential rate in THB / kWh)
    # Allows easy override via environment variable without modifying business logic
    ELECTRICITY_RATE: float = float(os.getenv("ENERGY_ELECTRICITY_RATE", "4.42"))

    # Carbon Emission Factor for Grid Electricity (Thailand EGAT average in kg CO2 per kWh)
    CO2_EMISSION_FACTOR: float = float(os.getenv("ENERGY_CO2_FACTOR", "0.4999"))

    # Peak Power Threshold (Watts) for anomaly and peak duration detection
    PEAK_POWER_THRESHOLD_W: float = float(os.getenv("ENERGY_PEAK_THRESHOLD", "1500.0"))

    # Machine Learning Train/Test split ratio
    ML_TRAIN_RATIO: float = 0.80

    # Random seed for reproducible ML training
    RANDOM_SEED: int = 42

    # Phase 3: What-If Simulation Parameters
    # Thermodynamic cooling sensitivity: percentage reduction in AC power per 1°C increase in target temperature
    THERMODYNAMIC_AC_SENSITIVITY_PER_DEGREE: float = 0.07  # 7% reduction per °C

    # Default baseline temperature for AC (°C)
    BASELINE_AC_TEMP_C: float = 24.0

    # Multi-criteria scenario scoring default weights
    DEFAULT_WEIGHT_EFFICIENCY: float = 0.40
    DEFAULT_WEIGHT_COST: float = 0.30
    DEFAULT_WEIGHT_PEAK: float = 0.20
    DEFAULT_WEIGHT_COMFORT: float = 0.10

settings = Settings()
