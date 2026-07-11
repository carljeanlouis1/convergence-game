import { BALANCE } from "./balance";
import type { GameState } from "./types";

/** Expected-quality bonus a new run gets from current research momentum. */
export function momentumBonus(state: GameState): number {
  return state.researchMomentum * BALANCE.experiments.momentumQualityWeight;
}

/** Experiments allocation builds research momentum; it decays if you stop investing. */
export function researchTurn(state: GameState): { state: GameState; lines: string[] } {
  const E = BALANCE.experiments;
  const next = Math.max(
    0,
    Math.min(E.momentumCap, state.researchMomentum * (1 - E.momentumDecay) + state.allocation.experiments * E.momentumPerPF),
  );
  const lines: string[] = [];
  if (state.allocation.experiments > 0 && next >= 1) {
    lines.push(
      `Research momentum at ${next.toFixed(0)} — your next run starts +${(next * E.momentumQualityWeight).toFixed(0)} quality.`,
    );
  }
  return { state: { ...state, researchMomentum: next }, lines };
}
