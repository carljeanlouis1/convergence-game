import { BALANCE } from "./balance";
import { DILEMMAS } from "./content";
import { makeRng } from "./rng";
import type { DilemmaDef, GameState } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function getDilemmaDef(id: string): DilemmaDef {
  const def = DILEMMAS.find(d => d.id === id);
  if (!def) throw new Error("unknown dilemma");
  return def;
}

export function maybeOpenDilemma(state: GameState): GameState {
  if (
    state.turn % BALANCE.events.cadence !== 0 ||
    state.turn <= 2 ||
    state.activeDilemma !== null ||
    state.ending !== null
  ) {
    return state;
  }
  const eligible = DILEMMAS.filter(
    d => d.era <= state.era && !state.usedDilemmas.includes(d.id) && d.trigger?.(state) !== false,
  );
  if (!eligible.length) return state;
  const rng = makeRng(state.seed, state.turn, "dilemma");
  const pickIndex = Math.floor(rng() * eligible.length);
  return { ...state, activeDilemma: { defId: eligible[pickIndex].id, openedTurn: state.turn } };
}

export function resolveDilemma(
  state: GameState,
  optionId: string,
): { state: GameState; outcomeText: string } {
  if (!state.activeDilemma) throw new Error("no active dilemma");
  const def = getDilemmaDef(state.activeDilemma.defId);
  const option = def.options.find(o => o.id === optionId);
  if (!option) throw new Error("unknown option");

  const rng = makeRng(state.seed, state.turn, "dilemma-resolve", def.id, optionId);
  const totalWeight = option.outcomes.reduce((a, o) => a + o.chance, 0);
  let roll = rng() * totalWeight;
  let outcome = option.outcomes[option.outcomes.length - 1];
  for (const o of option.outcomes) {
    roll -= o.chance;
    if (roll <= 0) {
      outcome = o;
      break;
    }
  }

  const d = outcome.deltas;
  const next: GameState = {
    ...state,
    capital: state.capital + (d.capital ?? 0),
    trust: clamp(state.trust + (d.trust ?? 0)),
    boardConfidence: clamp(state.boardConfidence + (d.boardConfidence ?? 0)),
    control: clamp(state.control + (d.control ?? 0)),
    morale: clamp(state.morale + (d.morale ?? 0)),
    incidentRisk: Math.max(0, state.incidentRisk + (d.incidentRisk ?? 0)),
    teamStrength: clamp(state.teamStrength + (d.teamStrength ?? 0)),
    stats: d.standardsAdopted ? { ...state.stats, standardsAdopted: true } : state.stats,
    activeDilemma: null,
    usedDilemmas: [...state.usedDilemmas, def.id],
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "dilemma", text: `${def.title}: ${outcome.text}` },
    ],
  };
  return { state: next, outcomeText: outcome.text };
}
