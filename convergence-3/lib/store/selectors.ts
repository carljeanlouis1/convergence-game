import { freePF } from "@/lib/engine/compute";
import { runwayMonths } from "@/lib/engine/finance";
import { turnLabel } from "@/lib/engine/turn";
import type { GameState } from "@/lib/engine/types";

export const selectTopBar = (g: GameState) => ({
  turnText: turnLabel(g.turn),
  capital: g.capital,
  runwayText: runwayMonths(g) === Infinity ? "∞" : `${runwayMonths(g).toFixed(0)}mo`,
  freePFText: `${freePF(g).toFixed(0)} PF free`,
  trust: g.trust,
  board: g.boardConfidence,
});

export const selectActiveRuns = (g: GameState) => g.runs.filter(r => r.status === "active");

export const selectUndeployedModels = (g: GameState) => g.models.filter(m => m.positioning === null);
