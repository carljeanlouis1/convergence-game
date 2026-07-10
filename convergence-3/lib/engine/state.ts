import { BALANCE } from "./balance";
import { STARTING_STARS, STARTING_FACILITIES } from "./content";
import type { GameState } from "./types";

export function createInitialState(seed: string): GameState {
  return {
    version: 1,
    seed,
    turn: 1,
    era: 1,
    capital: BALANCE.startingCapital,
    trust: BALANCE.startingTrust,
    boardConfidence: BALANCE.startingBoard,
    control: BALANCE.startingControl,
    morale: BALANCE.startingMorale,
    facilities: structuredClone(STARTING_FACILITIES),
    allocation: { inference: 0, experiments: 0, safety: 0 },
    stars: structuredClone(STARTING_STARS),
    teamStrength: BALANCE.startingTeamStrength,
    runs: [],
    models: [],
    revenueStreams: [],
    lastDebrief: null,
    ended: false,
  };
}
