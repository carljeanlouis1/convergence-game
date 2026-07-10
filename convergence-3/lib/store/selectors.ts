import { freePF } from "@/lib/engine/compute";
import { runwayMonths } from "@/lib/engine/finance";
import { turnLabel } from "@/lib/engine/turn";
import type { GameState } from "@/lib/engine/types";

export const selectTopBar = (g: GameState) => ({
  turnText: turnLabel(g.turn),
  capital: g.capital,
  runwayText:
    runwayMonths(g) === Infinity ? "∞" : runwayMonths(g) > 99 ? "99+mo" : `${runwayMonths(g).toFixed(0)}mo`,
  freePFText: `${freePF(g).toFixed(0)} PF free`,
  trust: g.trust,
  board: g.boardConfidence,
});

export const selectActiveRuns = (g: GameState) => g.runs.filter(r => r.status === "active");

export const selectUndeployedModels = (g: GameState) => g.models.filter(m => m.positioning === null);

export const selectAlerts = (g: GameState) => ({
  poachCount: g.poachOffers.filter(o => o.expiresTurn !== -1).length,
  offerCount: g.fundingOffers.length,
  dilemmaOpen: g.activeDilemma !== null,
  undeployedCount: g.models.filter(m => m.positioning === null).length,
});

export const selectRoster = (g: GameState) =>
  g.stars.map(s => ({
    ...s,
    burnoutBand: (s.burnout < 40 ? "fresh" : s.burnout < 75 ? "strained" : "critical") as
      | "fresh"
      | "strained"
      | "critical",
    leadingRun: g.runs.find(r => r.id === s.onRunId && r.status === "active")?.name ?? null,
  }));
