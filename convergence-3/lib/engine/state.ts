import { BALANCE } from "./balance";
import { STARTING_STARS, STARTING_FACILITIES, RIVALS, CANDIDATE_POOL, FRONTIER_DEFS } from "./content";
import type { Candidate, GameState } from "./types";

export function initialMarket(): Candidate[] {
  return CANDIDATE_POOL.slice(0, BALANCE.talent.marketSize).map(c => ({
    ...c,
    exitTurn: 1 + BALANCE.talent.candidateExitAfter,
  }));
}

export function v2Defaults() {
  return {
    rivals: structuredClone(RIVALS),
    market: initialMarket(),
    poachOffers: [],
    fundingOffers: [],
    lastRaiseTurn: 0,
    fundingRound: 0,
    evalCapacity: 0,
    incidentRisk: 0,
    fireSaleCount: 0,
    activeDilemma: null,
    usedDilemmas: [],
    chronicle: [],
    ending: null,
    interimUntilTurn: null,
  } satisfies Partial<GameState>;
}

export function v3Defaults() {
  return {
    stats: {
      profitStreak: 0,
      topStreak: 0,
      topStreakSpansEra: false,
      laggingStreak: 0,
      openShare: 0,
      incidents: 0,
      standardsAdopted: false,
      agiTurn: null,
      crowns: [],
    },
    builds: [],
    frontierProjects: structuredClone(FRONTIER_DEFS),
    pendingEraBriefing: null,
    endingResult: null,
  } satisfies Partial<GameState>;
}

export function v4Defaults() {
  return {
    pendingRelease: null,
  } satisfies Partial<GameState>;
}

export function createInitialState(seed: string): GameState {
  return {
    version: 3,
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
    ...v2Defaults(),
    ...v3Defaults(),
    ...v4Defaults(),
  };
}
