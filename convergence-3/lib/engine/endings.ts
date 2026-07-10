import { BALANCE } from "./balance";
import { eraForTurn } from "./eras";
import { revenuePerTurn } from "./finance";
import { bestDeployedAvg, leaderboard } from "./rivals";
import type { EndingResult, GameState } from "./types";

const E = () => BALANCE.endings;

const VICTORY_IDS = [
  "enterprise-titan",
  "frontier-crown",
  "the-standard",
  "the-conscience",
  "beneficial-asi",
  "transcendence",
  "simulation-revelation",
] as const;

export function updateStats(state: GameState, netThisTurn: number): GameState {
  const stats = { ...state.stats };
  stats.profitStreak = netThisTurn >= 0 ? stats.profitStreak + 1 : 0;

  const lb = leaderboard(state);
  const playerIndex = lb.findIndex(e => e.isPlayer);
  if (playerIndex === 0) {
    const wasStreaking = stats.topStreak > 0;
    const crossedEra = wasStreaking && eraForTurn(state.turn) !== eraForTurn(state.turn - 1);
    stats.topStreak += 1;
    if (crossedEra) stats.topStreakSpansEra = true;
  } else {
    stats.topStreak = 0;
    stats.topStreakSpansEra = false;
  }

  const leaderOverall = lb[0]?.overall ?? 0;
  const playerOverall = lb[playerIndex]?.overall ?? 0;
  if (state.turn > E().laggingFromTurn && leaderOverall > 0 && playerOverall < leaderOverall * E().laggingFraction) {
    stats.laggingStreak += 1;
  } else {
    stats.laggingStreak = 0;
  }

  const liveOpen = state.models.filter(m => m.positioning === "open-weights").length;
  stats.openShare += liveOpen * E().openSharePerModelPerTurn;

  return { ...state, stats };
}

export function evaluateEndings(state: GameState): string | null {
  const s = state.stats;
  const completedFrontiers = state.frontierProjects.filter(p => p.status === "completed");
  // defeats first
  if (s.incidents >= E().catastropheIncidents) return "catastrophe";
  if (s.laggingStreak >= E().laggingTurns) return "irrelevant";
  // convergence-era victories
  if (
    s.agiTurn !== null &&
    bestDeployedAvg(state) >= E().asiCapability &&
    state.trust >= E().asiTrust &&
    state.evalCapacity >= E().asiEval &&
    s.incidents === 0
  ) {
    return "beneficial-asi";
  }
  if (completedFrontiers.length >= BALANCE.frontiers.transcendenceCount) return "transcendence";
  if (
    completedFrontiers.some(p => p.id === "simulation") &&
    state.evalCapacity >= E().asiEval &&
    s.openShare === 0
  ) {
    return "simulation-revelation";
  }
  // grounded victories
  if (s.topStreak >= E().crownStreak && s.topStreakSpansEra) return "frontier-crown";
  if (s.profitStreak >= E().titanStreak && revenuePerTurn(state) >= E().titanRevenue && state.control >= E().titanControl) {
    return "enterprise-titan";
  }
  if (s.openShare >= E().standardShare) return "the-standard";
  if (s.standardsAdopted && state.trust >= E().conscienceTrust && state.evalCapacity >= E().conscienceEval) {
    return "the-conscience";
  }
  return null;
}

export function finalizeEnding(state: GameState, endingId: string): GameState {
  const victory = (VICTORY_IDS as readonly string[]).includes(endingId);
  const pyrrhic = victory && (state.control < E().pyrrhicControl || state.trust < E().pyrrhicTrust);
  const completedFrontiers = state.frontierProjects.filter(p => p.status === "completed").length;
  const lb = leaderboard(state);
  const score =
    state.capital * 0.05 +
    revenuePerTurn(state) +
    state.trust / 2 +
    state.control / 2 +
    completedFrontiers * 20 -
    state.stats.incidents * 10 +
    (lb[0]?.isPlayer ? 30 : 0);
  const g = E().gradeThresholds;
  const grade: EndingResult["grade"] = score >= g.S ? "S" : score >= g.A ? "A" : score >= g.B ? "B" : score >= g.C ? "C" : "D";
  return {
    ...state,
    ending: endingId,
    ended: true,
    endingResult: { id: endingId, victory, pyrrhic, grade },
  };
}

export interface TrajectoryEntry {
  id: string;
  label: string;
  progress: number;
  pull: string;
  hidden: boolean;
  victory: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function trajectory(state: GameState): TrajectoryEntry[] {
  const s = state.stats;
  const rev = revenuePerTurn(state);
  const completedFrontiers = state.frontierProjects.filter(p => p.status === "completed").length;
  const cap = bestDeployedAvg(state);

  const titanParts = [s.profitStreak / E().titanStreak, rev / E().titanRevenue, state.control >= E().titanControl ? 1 : state.control / E().titanControl];
  const titanBind =
    titanParts[0] <= titanParts[1] && titanParts[0] <= titanParts[2]
      ? `Need ${E().titanStreak - s.profitStreak} more profitable quarter(s)`
      : titanParts[1] <= titanParts[2]
        ? `Revenue $${rev.toFixed(0)}M of $${E().titanRevenue}M`
        : `Control ${state.control.toFixed(0)} — need ${E().titanControl}+`;

  return [
    {
      id: "enterprise-titan", label: "Enterprise Titan", victory: true, hidden: false,
      progress: clamp01(Math.min(...titanParts)), pull: titanBind,
    },
    {
      id: "frontier-crown", label: "The Frontier Crown", victory: true, hidden: false,
      progress: clamp01((s.topStreak / E().crownStreak) * (s.topStreakSpansEra ? 1 : 0.8)),
      pull: s.topStreak === 0 ? "Take the #1 spot and hold it" : `#1 for ${s.topStreak}/${E().crownStreak} quarters${s.topStreakSpansEra ? " (spans an era)" : " — must span an era"}`,
    },
    {
      id: "the-standard", label: "The Standard", victory: true, hidden: false,
      progress: clamp01(s.openShare / E().standardShare),
      pull: s.openShare === 0 ? "Ship open-weights models" : `Open share ${s.openShare.toFixed(0)}/${E().standardShare}`,
    },
    {
      id: "the-conscience", label: "The Conscience", victory: true, hidden: false,
      progress: clamp01(Math.min(state.trust / E().conscienceTrust, state.evalCapacity / E().conscienceEval, s.standardsAdopted ? 1 : 0.5)),
      pull: !s.standardsAdopted ? "Chair the standards body when asked" : `Trust ${state.trust.toFixed(0)}/${E().conscienceTrust}, evals ${state.evalCapacity.toFixed(0)}/${E().conscienceEval}`,
    },
    {
      id: "beneficial-asi", label: "Beneficial ASI", victory: true, hidden: false,
      progress: clamp01(Math.min(cap / E().asiCapability, state.trust / E().asiTrust, state.evalCapacity / E().asiEval) * (s.incidents === 0 ? 1 : 0.3)),
      pull: s.incidents > 0 ? "A clean record is required — incidents on file" : `Capability ${cap.toFixed(0)}/${E().asiCapability}, aligned and trusted`,
    },
    {
      id: "transcendence", label: "Transcendence", victory: true, hidden: false,
      progress: clamp01(completedFrontiers / BALANCE.frontiers.transcendenceCount),
      pull: s.agiTurn === null ? "Reach AGI, then complete 3 Applied Frontiers" : `${completedFrontiers}/${BALANCE.frontiers.transcendenceCount} frontiers complete`,
    },
    {
      id: "simulation-revelation", label: "???", victory: true, hidden: true,
      progress: 0, pull: "",
    },
    {
      id: "ousted", label: "Ousted", victory: false, hidden: false,
      progress: clamp01(1 - state.boardConfidence / 100),
      pull: `Board confidence ${state.boardConfidence.toFixed(0)} — the coup comes at ${BALANCE.funding.coupThreshold}`,
    },
    {
      id: "absorbed", label: "Absorbed", victory: false, hidden: false,
      progress: clamp01(state.fireSaleCount / 3),
      pull: state.fireSaleCount === 0 ? "Stay solvent" : `${state.fireSaleCount}/3 fire sales — the acquihire is circling`,
    },
    {
      id: "irrelevant", label: "Irrelevant", victory: false, hidden: false,
      progress: clamp01(s.laggingStreak / E().laggingTurns),
      pull: s.laggingStreak === 0 ? "Stay in the race" : `${s.laggingStreak}/${E().laggingTurns} quarters far behind the leader`,
    },
    {
      id: "catastrophe", label: "Catastrophe", victory: false, hidden: false,
      progress: clamp01(s.incidents / E().catastropheIncidents),
      pull: s.incidents === 0 ? "Keep the incidents at zero" : `${s.incidents}/${E().catastropheIncidents} incidents — the next one might not be survivable`,
    },
  ];
}
