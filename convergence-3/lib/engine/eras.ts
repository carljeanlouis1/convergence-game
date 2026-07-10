import { BALANCE } from "./balance";
import { ERA_BRIEFINGS } from "./content";
import type { GameState } from "./types";

export function eraForTurn(turn: number): 1 | 2 | 3 | 4 {
  const S = BALANCE.eras.startTurns;
  if (turn >= S[4]) return 4;
  if (turn >= S[3]) return 3;
  if (turn >= S[2]) return 2;
  return 1;
}

export function eraScalar(kind: "rivalJump" | "fastFollow" | "poachChance", era: number): number {
  const table = BALANCE.eras.scalars[kind] as Record<number, number>;
  return table[era] ?? 1;
}

export function applyEraTransition(state: GameState): GameState {
  const target = eraForTurn(state.turn);
  if (target <= state.era) return state;
  const briefing = ERA_BRIEFINGS[target as 2 | 3 | 4];
  return {
    ...state,
    era: target,
    pendingEraBriefing: target,
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "world", text: `A new era begins: ${briefing.title}.` },
    ],
  };
}
