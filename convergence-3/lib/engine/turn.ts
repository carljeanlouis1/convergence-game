import { BALANCE } from "./balance";
import { applyEraTransition } from "./eras";
import { buildsTurn } from "./facilities";
import { applyFinance, revenuePerTurn, burnPerTurn, runwayMonths } from "./finance";
import { checkAgi, frontiersTurn } from "./frontiers";
import { advanceRuns } from "./runs";
import { advanceRivals, applyFastFollow } from "./rivals";
import { talentTurn } from "./talent";
import { safetyTurn } from "./safety";
import { fundingTurn } from "./funding";
import { evaluateEndings, finalizeEnding, updateStats } from "./endings";
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

  // 0. era transition (uses the current turn number)
  const eraState = applyEraTransition(state);
  if (eraState.era !== state.era) {
    lines.push({ kind: "world", text: `A new era begins.` });
  }

  const revenue = revenuePerTurn(eraState);
  const burn = burnPerTurn(eraState);
  const runsBefore = eraState.runs;

  // 1-2. fast-follow repricing, then cashflow
  const fin = applyFinance(applyFastFollow(eraState));
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

  // 3b. facility builds
  const buildStep = buildsTurn(s);
  s = buildStep.state;
  for (const l of buildStep.lines) lines.push({ kind: "world", text: l });

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

  // 6b. AGI check + applied frontiers
  s = checkAgi(s);
  const frontierStep = frontiersTurn(s);
  s = frontierStep.state;
  for (const l of frontierStep.lines) lines.push({ kind: "world", text: l });

  // 7. funding & governance
  const fundingStep = fundingTurn(s);
  s = fundingStep.state;
  for (const l of fundingStep.lines) lines.push({ kind: "funding", text: l });

  // 7b. stats + endings
  const crownsBefore = s.stats.crowns;
  s = updateStats(s, fin.net);
  for (const c of s.stats.crowns.filter(c => !crownsBefore.includes(c))) {
    lines.push({ kind: "world", text: `Crown claimed: your model now leads the field on ${c}. The board noticed.` });
  }
  for (const c of crownsBefore.filter(c => !s.stats.crowns.includes(c))) {
    lines.push({ kind: "rival", text: `Crown lost: a rival now leads on ${c}. The premium goes with it.` });
  }
  if (s.ending !== null && s.endingResult === null) {
    // ousted/absorbed arrive from fundingTurn without a result — grade them
    s = finalizeEnding(s, s.ending);
  } else if (s.ending === null) {
    const endingId = evaluateEndings(s);
    if (endingId) {
      s = finalizeEnding(s, endingId);
      lines.push({ kind: "world", text: `This is how it ends: ${endingId.replace(/-/g, " ")}.` });
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

  // 8-9. clock forward, then maybe open a dilemma on the new turn
  const nextTurn = state.turn + 1;
  s = {
    ...s,
    turn: nextTurn,
    lastDebrief: debrief,
    chronicle: s.chronicle.slice(-60),
    ended: s.ended || s.ending !== null,
  };
  if (!s.ended && nextTurn > BALANCE.totalTurns) {
    s = finalizeEnding(s, "open-road");
  }
  if (!s.ended) s = maybeOpenDilemma(s);
  return s;
}
