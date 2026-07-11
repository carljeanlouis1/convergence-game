import { BALANCE } from "./balance";
import { recordDeploymentRisk } from "./safety";
import type { BenchCategory, GameState, Positioning, Pricing } from "./types";

type Capability = Record<BenchCategory, number>;

const POSITIONINGS: Positioning[] = ["api", "enterprise", "consumer", "open-weights"];

export function modelAvg(capability: Capability): number {
  return (capability.coding + capability.reasoning + capability.enterprise + capability.consumer) / 4;
}

/** The score a market actually pays for — weighted toward the benchmarks that market buys. */
export function positionedScore(capability: Capability, positioning: Positioning): number {
  const w = BALANCE.finance.positioningWeights[positioning];
  return (
    capability.coding * w.coding +
    capability.reasoning * w.reasoning +
    capability.enterprise * w.enterprise +
    capability.consumer * w.consumer
  );
}

/** Projected $/turn for a deployment — used by the UI before committing (transparency law). */
export function projectedRevenue(capability: Capability, positioning: Positioning, pricing: Pricing): number {
  const F = BALANCE.finance;
  const effectivePricing = positioning === "open-weights" ? "standard" : pricing;
  const score = positionedScore(capability, positioning);
  return (
    Math.pow(score / 10, F.revenueExponent) *
    F.revenueScale *
    F.positioningMultipliers[positioning] *
    F.pricingMultipliers[effectivePricing].revenue
  );
}

/** Which market maximizes this model's revenue at standard pricing — shown as "best fit". */
export function bestFitPositioning(capability: Capability): Positioning {
  return POSITIONINGS.filter(p => p !== "open-weights").reduce((best, p) =>
    projectedRevenue(capability, p, "standard") > projectedRevenue(capability, best, "standard") ? p : best,
  );
}

/** Retire a deployed model: frees its serving compute, ends its revenue. History keeps it. */
export function deprecateModel(state: GameState, modelId: string): GameState {
  const model = state.models.find(m => m.id === modelId);
  if (!model) throw new Error("model not found");
  if (model.positioning === null) throw new Error("model not deployed");
  if (model.retiredTurn !== null) throw new Error("model already retired");
  return {
    ...state,
    models: state.models.map(m => (m.id === modelId ? { ...m, retiredTurn: state.turn } : m)),
    revenueStreams: state.revenueStreams.filter(r => r.modelId !== modelId),
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "world", text: `${model.name} deprecated — serving compute reclaimed, revenue ends.` },
    ],
  };
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
  const effectivePricing: Pricing = positioning === "open-weights" ? "standard" : pricing;
  const amount = projectedRevenue(model.capability, positioning, pricing);
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
