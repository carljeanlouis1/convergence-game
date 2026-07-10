import { BUILD_OPTIONS } from "./content";
import type { BuildOption, GameState } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function availableBuilds(state: GameState): BuildOption[] {
  const taken = new Set([
    ...state.builds.map(b => b.optionId),
    ...state.facilities.map(f => f.id.replace(/^fac-/, "")),
  ]);
  return BUILD_OPTIONS.filter(o => o.era <= state.era && !taken.has(o.id));
}

export function startBuild(state: GameState, optionId: string): GameState {
  const option = availableBuilds(state).find(o => o.id === optionId);
  if (!option) {
    if (state.builds.some(b => b.optionId === optionId)) throw new Error("already building");
    if (state.facilities.some(f => f.id === `fac-${optionId}`)) throw new Error("already building");
    throw new Error("unknown build");
  }
  if (state.capital < option.costM) throw new Error("insufficient capital");
  return {
    ...state,
    capital: state.capital - option.costM,
    trust: clamp(state.trust + option.trustDelta),
    builds: [...state.builds, { optionId: option.id, name: option.name, capacityPF: option.capacityPF, turnsLeft: option.turns }],
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "world", text: `Ground broken: ${option.name} (+${option.capacityPF} PF in ${option.turns} quarters).` },
    ],
  };
}

export function buildsTurn(state: GameState): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let facilities = state.facilities;
  const builds = state.builds
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => {
      if (b.turnsLeft > 0) return true;
      facilities = [
        ...facilities,
        { id: `fac-${b.optionId}`, name: b.name, capacityPF: b.capacityPF, upkeepPerTurn: 0, onlineTurn: state.turn + 1 },
      ];
      lines.push(`${b.name} is online — +${b.capacityPF} PF next quarter.`);
      return false;
    });
  return { state: { ...state, builds, facilities }, lines };
}
