import { BALANCE } from "./balance";
import { applyFinance, revenuePerTurn, burnPerTurn, runwayMonths } from "./finance";
import { advanceRuns } from "./runs";
import { advanceRivals, applyFastFollow } from "./rivals";
import { talentTurn } from "./talent";
import { safetyTurn } from "./safety";
import { fundingTurn } from "./funding";
import { maybeOpenDilemma } from "./events";
import type { DebriefLine, GameState, TurnDebrief } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function turnLabel(turn: number): string {
  return `${2026 + Math.floor((turn - 1) / 4)} Q${((turn - 1) % 4) + 1}`;
}

export function advanceTurn(state: GameState): GameState {
  if (state.ended) throw new Error("game ended");
  if (state.activeDilemma) throw new Error("resolve the dilemma first");

  const lines: DebriefLine[] = [];
  const revenue = revenuePerTurn(state);
  const burn = burnPerTurn(state);
  const runsBefore = state.runs;

  // 1-2. fast-follow repricing, then cashflow
  const fin = applyFinance(applyFastFollow(state));
  let s = fin.state;

  // 3. runs advance (+ morale from completions/failures)
  s = advanceRuns(s);
  lines.push({
    kind: "finance",
    text: `Net ${fin.net >= 0 ? "+" : ""}$${fin.net.toFixed(1)}M (revenue $${revenue.toFixed(1)}M, burn $${burn.toFixed(1)}M).`,
  });
  for (const run of s.runs) {
    const before = runsBefore.find(r => r.id === run.id);
    if (!before || before.status !== "active") continue;
    if (run.status === "completed") {
      lines.push({ kind: "run", text: `${run.name} finished training — model ready to position.` });
      s = { ...s, morale: clamp(s.morale + BALANCE.talent.runCompleteMorale) };
    } else if (run.status === "failed") {
      lines.push({
        kind: "run",
        text: `${run.name} failed. $${run.spentToDate.toFixed(1)}M spent for nothing shippable.`,
      });
      s = { ...s, morale: clamp(s.morale - BALANCE.talent.runFailMorale) };
    } else if (run.checkpoints.length > before.checkpoints.length) {
      const cp = run.checkpoints[run.checkpoints.length - 1];
      lines.push({ kind: "run", text: `${run.name} checkpoint: ${cp.band}. ${cp.note}` });
    }
  }

  // 4. rivals
  const rivalStep = advanceRivals(s);
  s = rivalStep.state;
  for (const r of rivalStep.releases) lines.push({ kind: "rival", text: r });

  // 5. talent
  const talentStep = talentTurn(s);
  s = talentStep.state;
  for (const l of talentStep.lines) lines.push({ kind: "talent", text: l });

  // 6. safety
  const safetyStep = safetyTurn(s);
  s = safetyStep.state;
  for (const l of safetyStep.lines) lines.push({ kind: "safety", text: l });

  // 7. funding & governance
  const fundingStep = fundingTurn(s);
  s = fundingStep.state;
  for (const l of fundingStep.lines) lines.push({ kind: "funding", text: l });

  const runway = runwayMonths(s);
  if (runway < 9) {
    lines.push({ kind: "finance", text: `Runway ${runway.toFixed(1)} months. The board is watching.` });
  }

  const debrief: TurnDebrief = {
    turn: state.turn,
    headline: `${turnLabel(state.turn)} closed.`,
    lines,
  };

  // 8-9. clock forward, then maybe open a dilemma on the new turn
  const nextTurn = state.turn + 1;
  s = {
    ...s,
    turn: nextTurn,
    lastDebrief: debrief,
    chronicle: s.chronicle.slice(-60),
    ended: s.ended || s.ending !== null || nextTurn > BALANCE.totalTurns,
  };
  if (!s.ended) s = maybeOpenDilemma(s);
  return s;
}
