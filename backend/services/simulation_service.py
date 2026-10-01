from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.ai.simulation_engine import simulation_engine
from backend.database.models import (
    SimulationParameters,
    SimulationResult,
    ScenarioItem,
    ScenarioComparisonTable,
    ScenarioScoreWeights,
    ScenarioScoreResult,
    AIRecommendationResult,
    SimulationTemplateItem
)

class SimulationService:
    def __init__(self):
        self.engine = simulation_engine
        self._history: Dict[str, SimulationResult] = {}
        self._scenarios: Dict[str, ScenarioItem] = {}
        self._seed_default_scenarios()

    def _seed_default_scenarios(self):
        """
        Seeds standard baseline and initial comparison scenarios.
        """
        try:
            # Baseline (Current)
            base_res = self.engine.run_simulation(SimulationParameters(scenario_name="Current Baseline"))
            self._history[base_res.simulation_id] = base_res
            self._scenarios["current"] = ScenarioItem(
                id="current",
                name="Current Behavior",
                description="พฤติกรรมการใช้งานจริงตามข้อมูลประวัติปัจจุบัน",
                energy_kwh=base_res.current_monthly_kwh,
                cost_thb=base_res.current_monthly_cost_thb,
                saving_kwh=0.0,
                saving_thb=0.0,
                peak_kw=base_res.current_peak_kw,
                reduction_pct=0.0,
                score=70.0,
                tag="MEASURED"
            )

            # Scenario B: AC 26°C
            b_res = self.engine.run_simulation(SimulationParameters(
                ac_target_temp=26.0,
                scenario_name="Scenario B: AC 26°C"
            ))
            self._history[b_res.simulation_id] = b_res
            self._scenarios["scenario_b"] = ScenarioItem(
                id="scenario_b",
                name="Scenario B: AC 26°C",
                description="ปรับอุณหภูมิแอร์ห้องนั่งเล่นเป็น 26°C",
                energy_kwh=b_res.simulated_monthly_kwh,
                cost_thb=b_res.simulated_monthly_cost_thb,
                saving_kwh=b_res.energy_saving_kwh,
                saving_thb=b_res.cost_saving_thb,
                peak_kw=b_res.simulated_peak_kw,
                reduction_pct=b_res.energy_saving_pct,
                score=82.5,
                tag="SIMULATED"
            )

            # Scenario C: AC 26°C + Schedule Optimization
            c_res = self.engine.run_simulation(SimulationParameters(
                ac_target_temp=26.0,
                ac_start_hour=18,
                ac_end_hour=22,
                scenario_name="Scenario C: AC 26°C + Schedule"
            ))
            self._history[c_res.simulation_id] = c_res
            self._scenarios["scenario_c"] = ScenarioItem(
                id="scenario_c",
                name="Scenario C: AC + Schedule",
                description="แอร์ 26°C พร้อมปิดเร็วขึ้น 1 ชั่วโมง (18:00 - 22:00)",
                energy_kwh=c_res.simulated_monthly_kwh,
                cost_thb=c_res.simulated_monthly_cost_thb,
                saving_kwh=c_res.energy_saving_kwh,
                saving_thb=c_res.cost_saving_thb,
                peak_kw=c_res.simulated_peak_kw,
                reduction_pct=c_res.energy_saving_pct,
                score=89.0,
                tag="SIMULATED"
            )

            # Scenario D: Full Optimization
            d_res = self.engine.run_simulation(SimulationParameters(
                ac_target_temp=26.0,
                ac_start_hour=18,
                ac_end_hour=22,
                standby_reduction_w=35.0,
                scenario_name="Scenario D: Fully Optimized"
            ))
            self._history[d_res.simulation_id] = d_res
            self._scenarios["scenario_d"] = ScenarioItem(
                id="scenario_d",
                name="Scenario D: Fully Optimized",
                description="แอร์ 26°C + ตารางเวลา + ตัดไฟ Standby 35W",
                energy_kwh=d_res.simulated_monthly_kwh,
                cost_thb=d_res.simulated_monthly_cost_thb,
                saving_kwh=d_res.energy_saving_kwh,
                saving_thb=d_res.cost_saving_thb,
                peak_kw=d_res.simulated_peak_kw,
                reduction_pct=d_res.energy_saving_pct,
                score=94.5,
                tag="SIMULATED"
            )
        except Exception as e:
            print(f"[WARN] Error seeding scenarios: {e}")

    def run_simulation(self, params: SimulationParameters) -> SimulationResult:
        result = self.engine.run_simulation(params)
        self._history[result.simulation_id] = result
        return result

    def get_simulation(self, sim_id: str) -> Optional[SimulationResult]:
        return self._history.get(sim_id)

    def get_history(self) -> List[SimulationResult]:
        return list(self._history.values())[::-1]

    def get_templates(self) -> List[SimulationTemplateItem]:
        return self.engine.get_templates()

    def get_scenarios(self) -> ScenarioComparisonTable:
        items = list(self._scenarios.values())
        baseline = self._scenarios.get("current")
        b_kwh = baseline.energy_kwh if baseline else 245.0
        b_cost = baseline.cost_thb if baseline else 1082.9
        b_peak = baseline.peak_kw if baseline else 2.1
        return ScenarioComparisonTable(
            scenarios=items,
            baseline_kwh=b_kwh,
            baseline_cost_thb=b_cost,
            baseline_peak_kw=b_peak
        )

    def add_scenario_from_result(self, result: SimulationResult) -> ScenarioItem:
        sc_id = f"custom_{result.simulation_id}"
        score_res = self.engine.calculate_scenario_score(result)
        item = ScenarioItem(
            id=sc_id,
            name=result.scenario_name,
            description=f"จำลองอุณหภูมิ {result.parameters.ac_target_temp or 24}°C พร้อมปรับแต่งพารามิเตอร์",
            energy_kwh=result.simulated_monthly_kwh,
            cost_thb=result.simulated_monthly_cost_thb,
            saving_kwh=result.energy_saving_kwh,
            saving_thb=result.cost_saving_thb,
            peak_kw=result.simulated_peak_kw,
            reduction_pct=result.energy_saving_pct,
            score=score_res.total_score,
            tag="SIMULATED"
        )
        self._scenarios[sc_id] = item
        return item

    def delete_scenario(self, scenario_id: str) -> bool:
        if scenario_id in self._scenarios:
            del self._scenarios[scenario_id]
            return True
        return False

    def score_scenarios(self, weights: Optional[ScenarioScoreWeights] = None) -> List[ScenarioScoreResult]:
        results = []
        for sc in self._scenarios.values():
            if sc.id in ["current", "baseline"]:
                continue
            # Look up corresponding simulation in history
            sim_match = next((s for s in self._history.values() if s.scenario_name == sc.name or sc.id.endswith(s.simulation_id)), None)
            if sim_match:
                results.append(self.engine.calculate_scenario_score(sim_match, weights))
        return results

    def get_ai_recommendation(self, weights: Optional[ScenarioScoreWeights] = None) -> AIRecommendationResult:
        scenarios = list(self._scenarios.values())
        scores = self.score_scenarios(weights)
        return self.engine.generate_recommendation(scenarios, scores)

simulation_service = SimulationService()
