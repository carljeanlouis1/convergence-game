import type { ComputeAllocation, GameState } from "./types";

export function totalCapacityPF(state: GameState): number {
  return state.facilities.filter(f => f.onlineTurn <= state.turn).reduce((a, f) => a + f.capacityPF, 0);
}

export function committedRunPF(state: GameState): number {
  return state.runs.filter(r => r.status === "active").reduce((a, r) => a + r.computePerTurn, 0);
}

export function allocatedPF(a: ComputeAllocation): number {
  return a.inference + a.experiments + a.safety;
}

export function freePF(state: GameState): number {
  return totalCapacityPF(state) - committedRunPF(state) - allocatedPF(state.allocation);
}

export function setAllocation(state: GameState, alloc: ComputeAllocation): GameState {
  if (alloc.inference < 0 || alloc.experiments < 0 || alloc.safety < 0) {
    throw new Error("allocation negative");
  }
  if (committedRunPF(state) + allocatedPF(alloc) > totalCapacityPF(state)) {
    throw new Error("allocation exceeds free compute");
  }
  return { ...state, allocation: { ...alloc } };
}
