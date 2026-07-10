import { BALANCE } from "./balance";
import { recordDeploymentRisk } from "./safety";
import type { GameState, Positioning, Pricing } from "./types";

export function modelAvg(capability: { coding: number; reasoning: number; enterprise: number; consumer: number }): number {
  return (capability.coding + capability.reasoning + capability.enterprise + capability.consumer) / 4;
}

/** Projected $/turn for a deployment — used by the UI before committing (transparency law). */
export function projectedRevenue(avg: number, positioning: Positioning, pricing: Pricing): number {
  const F = BALANCE.finance;
  const effectivePricing = positioning === "open-weights" ? "standard" : pricing;
  return (
    Math.pow(avg / 10, F.revenueExponent) *
    F.revenueScale *
    F.positioningMultipliers[positioning] *
    F.pricingMultipliers[effectivePricing].revenue
  );
}

export function deployModel(
  state: GameState,
  modelId: string,
  positioning: Positioning,
  pricing: Pricing = "standard",
): GameState {
  const model = state.models.find(m => m.id === modelId);
  if (!model) throw new Error("model not found");
  if (model.positioning) throw new Error("model already deployed");
  const avg = modelAvg(model.capability);
  const effectivePricing: Pricing = positioning === "open-weights" ? "standard" : pricing;
  const amount = projectedRevenue(avg, positioning, pricing);
  const state2 = recordDeploymentRisk(state, modelId);
  return {
    ...state2,
    models: state2.models.map(m =>
      m.id === modelId ? { ...m, positioning, deployedTurn: state2.turn, pricing: effectivePricing } : m,
    ),
    revenueStreams: [
      ...state2.revenueStreams,
      {
        source: model.name,
        amountPerTurn: amount,
        decayPerTurn: positioning === "open-weights" ? 0 : BALANCE.finance.revenueDecayPerTurn,
        modelId,
        pricing: effectivePricing,
      },
    ],
  };
}
