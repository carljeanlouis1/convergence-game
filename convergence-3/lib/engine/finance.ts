import { BALANCE } from "./balance";
import { totalCapacityPF } from "./compute";
import type { GameState } from "./types";

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

export function revenuePerTurn(state: GameState): number {
  const streams = state.revenueStreams.reduce((a, r) => a + r.amountPerTurn, 0);
  const inference =
    state.allocation.inference *
    BALANCE.finance.inferenceRevenuePerPF *
    (bestDeployedCapabilityAvg(state) / 100);
  return streams + inference;
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
  const revenueStreams = state.revenueStreams
    .map(r => ({ ...r, amountPerTurn: r.amountPerTurn * (1 - r.decayPerTurn) }))
    .filter(r => r.amountPerTurn >= 0.05);
  return { state: { ...state, capital: state.capital + net, revenueStreams }, net };
}
