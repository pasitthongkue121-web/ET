from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend.services.simulation_service import simulation_service
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

router = APIRouter(prefix="/api/simulation", tags=["What-If Simulation"])

@router.post("/run", response_model=SimulationResult)
def run_simulation(params: SimulationParameters):
    """
    Executes a What-If simulation replaying the 30-day baseline with modified parameters.
    Zero real database mutation occurs.
    """
    return simulation_service.run_simulation(params)

@router.get("/templates", response_model=List[SimulationTemplateItem])
def get_simulation_templates():
    """
    Returns 5 predefined What-If simulation templates (AC 26°C, AC reduction, Standby cut, Inverter upgrade, Peak shift).
    """
    return simulation_service.get_templates()

@router.get("/history", response_model=List[SimulationResult])
def get_simulation_history():
    """
    Returns history of previously executed simulations in current session.
    """
    return simulation_service.get_history()

@router.get("/scenarios", response_model=ScenarioComparisonTable)
def get_scenarios_comparison():
    """
    Returns comparison table of all configured scenarios (Baseline vs Scenarios B, C, D, etc.).
    """
    return simulation_service.get_scenarios()

@router.post("/scenario", response_model=ScenarioItem)
def create_scenario_from_simulation(result: SimulationResult):
    """
    Saves a simulation result as a named scenario in the comparison matrix.
    """
    return simulation_service.add_scenario_from_result(result)

@router.delete("/scenario/{scenario_id}")
def delete_scenario(scenario_id: str):
    """
    Deletes a scenario from the comparison matrix.
    """
    success = simulation_service.delete_scenario(scenario_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return {"status": "deleted", "scenario_id": scenario_id}

@router.post("/score", response_model=List[ScenarioScoreResult])
def calculate_scenario_scores(weights: Optional[ScenarioScoreWeights] = None):
    """
    Calculates multi-criteria scenario scores (Efficiency, Cost, Peak, Comfort) with customizable weights.
    """
    return simulation_service.score_scenarios(weights)

@router.get("/recommendation", response_model=AIRecommendationResult)
def get_ai_recommendation():
    """
    Generates data-backed AI recommendation identifying the optimal scenario based on simulation trade-offs.
    """
    return simulation_service.get_ai_recommendation()

@router.get("/{simulation_id}", response_model=SimulationResult)
def get_simulation_by_id(simulation_id: str):
    """
    Fetches a specific simulation result by ID.
    """
    result = simulation_service.get_simulation(simulation_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found")
    return result
