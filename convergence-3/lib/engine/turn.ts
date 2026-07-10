import { BALANCE } from "./balance";
import { applyFinance, revenuePerTurn, burnPerTurn, runwayMonths } from "./finance";
import { advanceRuns } from "./runs";
import type { DebriefLine, GameState, TurnDebrief } from "./types";

export function turnLabel(turn: number): string {
  return `${2026 + Math.floor((turn - 1) / 4)} Q${((turn - 1) % 4) + 1}`;
}

export function advanceTurn(state: GameState): GameState {
  if (state.ended) throw new Error("game ended");
  const lines: DebriefLine[] = [];
  const revenue = revenuePerTurn(state);
  const burn = burnPerTurn(state);
  const runsBefore = state.runs;

  const fin = applyFinance(state);
  const s = advanceRuns(fin.state);

  lines.push({
    kind: "finance",
    text: `Net ${fin.net >= 0 ? "+" : ""}$${fin.net.toFixed(1)}M (revenue $${revenue.toFixed(1)}M, burn $${burn.toFixed(1)}M).`,
  });
  for (const run of s.runs) {
    const before = runsBefore.find(r => r.id === run.id);
    if (!before || before.status !== "active") continue;
    if (run.status === "completed") {
      lines.push({ kind: "run", text: `${run.name} finished training — model ready to position.` });
    } else if (run.status === "failed") {
      lines.push({
        kind: "run",
        text: `${run.name} failed. $${run.spentToDate.toFixed(1)}M spent for nothing shippable.`,
      });
    } else if (run.checkpoints.length > before.checkpoints.length) {
      const cp = run.checkpoints[run.checkpoints.length - 1];
      lines.push({ kind: "run", text: `${run.name} checkpoint: ${cp.band}. ${cp.note}` });
    }
  }
  const runway = runwayMonths(s);
  if (runway < 9) {
    lines.push({ kind: "finance", text: `Runway ${runway.toFixed(1)} months. The board is watching.` });
  }

  const debrief: TurnDebrief = {
    turn: state.turn,
    headline: `${turnLabel(state.turn)} closed.`,
    lines,
  };
  const nextTurn = state.turn + 1;
  return { ...s, turn: nextTurn, lastDebrief: debrief, ended: nextTurn > BALANCE.totalTurns };
}
