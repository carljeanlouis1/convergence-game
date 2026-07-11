import { BALANCE } from "./balance";
import { totalCapacityPF } from "./compute";
import { categoryLeaders } from "./rivals";
import type { GameState, RevenueStream } from "./types";

export function payrollPerTurn(state: GameState): number {
  return (
    state.stars.reduce((a, s) => a + s.salaryPerQuarter, 0) +
    state.teamStrength * BALANCE.finance.teamCostPerPoint
  );
}

export function computeUpkeepPerTurn(state: GameState): number {
  return totalCapacityPF(state) * BALANCE.finance.computeUpkeepPerPF;
}

export function runSpendPerTurn(state: GameState): number {
  return state.runs
    .filter(r => r.status === "active")
    .reduce((a, r) => a + r.computePerTurn * BALANCE.runTiers[r.scaleTier].costPerPFTurn, 0);
}

function bestDeployedCapabilityAvg(state: GameState): number {
  const deployed = state.models.filter(m => m.positioning !== null);
  if (!deployed.length) return 0;
  return Math.max(
    ...deployed.map(
      m => (m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer) / 4,
    ),
  );
}

/** Number of benchmark categories this deployed model currently leads across the whole field. */
export function crownsOf(state: GameState, modelId: string): number {
  const leaders = categoryLeaders(state);
  return Object.values(leaders).filter(l => l.isPlayer && l.modelId === modelId).length;
}

/** A stream's actual yield this turn: base amount boosted by its model's crowns. */
export function streamYield(state: GameState, stream: RevenueStream): number {
  if (!stream.modelId) return stream.amountPerTurn;
  return stream.amountPerTurn * (1 + BALANCE.finance.crownYieldBonus * crownsOf(state, stream.modelId));
}

function avgOf(m: { capability: { coding: number; reasoning: number; enterprise: number; consumer: number } }): number {
  return (m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer) / 4;
}

/** Compute a deployed model demands to keep serving. Open-weights & retired models cost nothing. */
export function servingDemandFor(model: GameState["models"][number]): number {
  if (model.positioning === null || model.retiredTurn !== null || model.positioning === "open-weights") return 0;
  const S = BALANCE.finance.serving;
  return (S.basePF + avgOf(model) * S.perCapPF) * S.volume[model.positioning];
}

export function totalServingDemand(state: GameState): number {
  return state.models.reduce((a, m) => a + servingDemandFor(m), 0);
}

/** Your inference allocation is the serving pool. Under-provisioned models are throttled. */
export function servingRatio(state: GameState): number {
  const demand = totalServingDemand(state);
  if (demand <= 0) return 1;
  const S = BALANCE.finance.serving;
  const provisioned = state.allocation.inference;
  return Math.max(S.throttleFloor, Math.min(1, S.throttleFloor + (1 - S.throttleFloor) * Math.min(1, provisioned / demand)));
}

export function revenuePerTurn(state: GameState): number {
  const ratio = servingRatio(state);
  return state.revenueStreams.reduce((a, r) => a + streamYield(state, r) * (r.modelId ? ratio : 1), 0);
}

export function burnPerTurn(state: GameState): number {
  return payrollPerTurn(state) + computeUpkeepPerTurn(state) + runSpendPerTurn(state);
}

export function runwayMonths(state: GameState): number {
  const net = burnPerTurn(state) - revenuePerTurn(state);
  if (net <= 0) return Infinity;
  return state.capital / Math.max(net / 3, BALANCE.finance.runwayFloorBurn);
}

export function applyFinance(state: GameState): { state: GameState; net: number } {
  const net = revenuePerTurn(state) - burnPerTurn(state);
  const ratio = servingRatio(state);
  // accrue lifetime revenue per source model before decay (throttled the same as live revenue)
  const earnedByModel = new Map<string, number>();
  for (const r of state.revenueStreams) {
    if (r.modelId) earnedByModel.set(r.modelId, (earnedByModel.get(r.modelId) ?? 0) + streamYield(state, r) * ratio);
  }
  const models = state.models.map(m =>
    earnedByModel.has(m.id) ? { ...m, lifetimeRevenue: m.lifetimeRevenue + earnedByModel.get(m.id)! } : m,
  );
  const revenueStreams = state.revenueStreams
    .map(r => ({ ...r, amountPerTurn: r.amountPerTurn * (1 - r.decayPerTurn) }))
    .filter(r => r.amountPerTurn >= 0.05);
  return { state: { ...state, capital: state.capital + net, revenueStreams, models }, net };
}
