import { BALANCE } from "./balance";
import { BUILD_OPTIONS } from "./content";
import type { BuildOption, GameState } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** How many facilities of this lineage already exist or are under construction. */
export function builtCount(state: GameState, optionId: string): number {
  const facs = state.facilities.filter(
    f => f.id === `fac-${optionId}` || f.id.startsWith(`fac-${optionId}-`),
  ).length;
  const inProgress = state.builds.filter(b => b.optionId === optionId).length;
  return facs + inProgress;
}

/** Escalating cost — each additional facility of the same kind costs more. */
export function buildCost(state: GameState, option: BuildOption): number {
  const n = builtCount(state, option.id);
  return Math.round(option.costM * Math.pow(BALANCE.facilities.repeatCostMultiplier, n));
}

/** Era-appropriate builds. Repeatable — kept in the list even after you've built one. */
export function availableBuilds(state: GameState): BuildOption[] {
  return BUILD_OPTIONS.filter(o => o.era <= state.era);
}

export function startBuild(state: GameState, optionId: string): GameState {
  const option = BUILD_OPTIONS.find(o => o.id === optionId);
  if (!option || option.era > state.era) throw new Error("unknown build");
  if (state.builds.length > 0) throw new Error("a facility is already under construction");
  const cost = buildCost(state, option);
  if (state.capital < cost) throw new Error("insufficient capital");
  return {
    ...state,
    capital: state.capital - cost,
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
      // unique id per lineage so repeated builds never collide
      const n = facilities.filter(
        f => f.id === `fac-${b.optionId}` || f.id.startsWith(`fac-${b.optionId}-`),
      ).length;
      facilities = [
        ...facilities,
        { id: `fac-${b.optionId}-${n + 1}`, name: b.name, capacityPF: b.capacityPF, upkeepPerTurn: 0, onlineTurn: state.turn + 1 },
      ];
      lines.push(`${b.name} is online — +${b.capacityPF} PF next quarter.`);
      return false;
    });
  return { state: { ...state, builds, facilities }, lines };
}
