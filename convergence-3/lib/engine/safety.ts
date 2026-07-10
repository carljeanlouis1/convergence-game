import { BALANCE } from "./balance";
import { makeRng } from "./rng";
import type { GameState, Model } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function modelAvg(m: Model): number {
  return (m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer) / 4;
}

function tierForAvg(avgCap: number): 0 | 1 | 2 | 3 {
  const T = BALANCE.safety.tierThresholds;
  if (avgCap >= T.t3) return 3;
  if (avgCap >= T.t2) return 2;
  if (avgCap >= T.t1) return 1;
  return 0;
}

export function capabilityTier(state: GameState): 0 | 1 | 2 | 3 {
  const deployed = state.models.filter(m => m.positioning !== null);
  if (!deployed.length) return 0;
  return tierForAvg(Math.max(...deployed.map(modelAvg)));
}

export function requiredEvalFor(tier: 0 | 1 | 2 | 3): number {
  const R = BALANCE.safety.requiredEval;
  return tier === 0 ? R.t0 : tier === 1 ? R.t1 : tier === 2 ? R.t2 : R.t3;
}

function evalGapForModel(state: GameState, modelId: string): number {
  const model = state.models.find(m => m.id === modelId);
  if (!model) throw new Error("model not found");
  const wouldBeTier = tierForAvg(modelAvg(model));
  return requiredEvalFor(wouldBeTier) - state.evalCapacity;
}

export function deployRiskBand(state: GameState, modelId: string): "clear" | "elevated" | "severe" {
  const gap = evalGapForModel(state, modelId);
  if (gap <= 0) return "clear";
  if (gap <= 15) return "elevated";
  return "severe";
}

export function recordDeploymentRisk(state: GameState, modelId: string): GameState {
  const gap = evalGapForModel(state, modelId);
  if (gap <= 0) return state;
  return { ...state, incidentRisk: state.incidentRisk + gap * BALANCE.safety.riskPerEvalGap };
}

export function riskBandLabel(state: GameState): "low" | "elevated" | "severe" {
  if (state.incidentRisk < 10) return "low";
  if (state.incidentRisk < 30) return "elevated";
  return "severe";
}

export function safetyTurn(state: GameState): { state: GameState; lines: string[] } {
  const B = BALANCE.safety;
  const lines: string[] = [];
  let s = {
    ...state,
    evalCapacity: state.evalCapacity * (1 - B.evalDecay) + state.allocation.safety * B.evalPerSafetyPF,
    trust: clamp(state.trust + state.allocation.safety * B.safetyTrustDriftPerPF),
  };
  const rng = makeRng(s.seed, s.turn, "safety");
  if (rng() < s.incidentRisk * B.incidentChancePerRisk) {
    const newest = [...s.models].sort((a, b) => b.createdTurn - a.createdTurn)[0];
    const subject = newest ? newest.name : "your deployed system";
    s = {
      ...s,
      trust: clamp(s.trust - B.incidentTrustHit),
      boardConfidence: clamp(s.boardConfidence - B.incidentBoardHit),
      revenueStreams: s.revenueStreams.map(r => ({
        ...r,
        amountPerTurn: r.amountPerTurn * (1 - B.incidentRevenueHit),
      })),
      incidentRisk: s.incidentRisk * B.incidentRiskRelief,
      chronicle: [
        ...s.chronicle,
        { turn: s.turn, kind: "safety", text: `A jailbreak of ${subject} is everywhere. Screenshots. Headlines. Hearings.` },
      ],
    };
    lines.push(`Incident: a jailbreak of ${subject} went viral. Trust and revenue take the hit.`);
  }
  return { state: s, lines };
}
