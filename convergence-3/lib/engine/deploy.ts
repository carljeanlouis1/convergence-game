import { BALANCE } from "./balance";
import { recordDeploymentRisk } from "./safety";
import type { GameState, Positioning } from "./types";

export function projectedDeployRevenue(avgCapability: number, positioning: Positioning): number {
  return (avgCapability / 10) * BALANCE.finance.positioningMultipliers[positioning];
}

export function deployModel(state: GameState, modelId: string, positioning: Positioning): GameState {
  const model = state.models.find(m => m.id === modelId);
  if (!model) throw new Error("model not found");
  if (model.positioning) throw new Error("model already deployed");
  const avg =
    (model.capability.coding + model.capability.reasoning + model.capability.enterprise + model.capability.consumer) / 4;
  const state2 = recordDeploymentRisk(state, modelId);
  return {
    ...state2,
    models: state.models.map(m => (m.id === modelId ? { ...m, positioning, deployedTurn: state.turn } : m)),
    revenueStreams: [
      ...state.revenueStreams,
      {
        source: model.name,
        amountPerTurn: projectedDeployRevenue(avg, positioning),
        decayPerTurn: positioning === "open-weights" ? 0 : BALANCE.finance.revenueDecayPerTurn,
      },
    ],
  };
}
