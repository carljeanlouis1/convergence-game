import { BALANCE } from "./balance";
import { TECHNIQUES } from "./content";
import { freePF } from "./compute";
import { gaussian, makeRng } from "./rng";
import type {
  CheckpointBand,
  GameState,
  Model,
  RunDecisionKind,
  RunDesign,
  Technique,
  TrainingRun,
} from "./types";

export function resolveTechniques(ids: string[], era: number): Technique[] {
  return ids.map(id => {
    const t = TECHNIQUES.find(t => t.id === id);
    if (!t || t.era > era) throw new Error("unknown or locked technique");
    return t;
  });
}

export function expectedQuality(design: RunDesign, state: GameState): number {
  const tier = BALANCE.runTiers[design.scaleTier];
  const lead = state.stars.find(s => s.id === design.leadId);
  const techs = resolveTechniques(design.techniqueIds, state.era);
  const raw =
    BALANCE.run.baseQuality +
    (lead ? lead.skill * BALANCE.run.leadSkillWeight : 0) +
    state.teamStrength * BALANCE.run.teamStrengthWeight +
    techs.reduce((a, t) => a + t.qualityBonus, 0);
  return Math.min(raw, tier.cap);
}

export function riskBand(design: RunDesign): "low" | "medium" | "high" {
  const v = design.techniqueIds
    .map(id => TECHNIQUES.find(t => t.id === id)?.variance ?? 0)
    .reduce((a, b) => a + b, 0);
  return v <= 1 ? "low" : v <= 3 ? "medium" : "high";
}

export function launchRun(state: GameState, design: RunDesign): GameState {
  const tier = BALANCE.runTiers[design.scaleTier];
  resolveTechniques(design.techniqueIds, state.era);
  if (
    state.interimUntilTurn !== null &&
    state.turn < state.interimUntilTurn &&
    design.scaleTier > BALANCE.funding.interimRunTierCap
  ) {
    throw new Error("the interim board won't approve a run this large");
  }
  if (design.leadId) {
    const lead = state.stars.find(s => s.id === design.leadId);
    if (!lead) throw new Error("unknown lead");
    if (lead.onRunId) throw new Error("lead already committed");
  }
  if (freePF(state) < tier.computePerTurn) throw new Error("insufficient free compute");
  const id = `run-${state.turn}-${state.runs.length + 1}`;
  const rng = makeRng(state.seed, state.turn, "run-launch", id);
  const expected = expectedQuality(design, state);
  const run: TrainingRun = {
    id,
    name: design.name,
    scaleTier: design.scaleTier,
    techniqueIds: [...design.techniqueIds],
    leadId: design.leadId,
    computePerTurn: tier.computePerTurn,
    turnsTotal: tier.turns,
    turnsElapsed: 0,
    spentToDate: 0,
    expectedAtLaunch: expected,
    hiddenQuality: Math.max(5, expected + gaussian(rng, 0, BALANCE.run.noiseSd * 1.5)),
    checkpoints: [],
    status: "active",
    startedTurn: state.turn,
  };
  return {
    ...state,
    runs: [...state.runs, run],
    stars: state.stars.map(s => (s.id === design.leadId ? { ...s, onRunId: id } : s)),
  };
}

export function checkpointBand(reading: number, expected: number): CheckpointBand {
  const d = reading - expected;
  const b = BALANCE.run.bands;
  if (d >= b.ahead) return "ahead";
  if (d >= b.onTrack) return "on-track";
  if (d >= b.wobbly) return "wobbly";
  return "troubled";
}

const BAND_NOTES: Record<CheckpointBand, string> = {
  ahead: "Loss curve is beating projections. The team is quietly excited.",
  "on-track": "Metrics tracking the plan. No surprises in the eval samples.",
  wobbly: "Some instability in the curve. Could be noise. Could not be.",
  troubled: "Evals are coming back soft. The room has gone quiet.",
};

export function advanceRuns(state: GameState): GameState {
  let models = state.models;
  let stars = state.stars;
  const runs = state.runs.map(run => {
    if (run.status !== "active") return run;
    const tier = BALANCE.runTiers[run.scaleTier];
    const techs = resolveTechniques(run.techniqueIds, state.era);
    const rng = makeRng(state.seed, state.turn, "run-advance", run.id);
    const varianceSd = BALANCE.run.noiseSd + techs.reduce((a, t) => a + t.variance, 0);
    const turnsElapsed = run.turnsElapsed + 1;
    let quality = run.hiddenQuality + BALANCE.run.fundedDrift + gaussian(rng, 0, varianceSd);
    quality = Math.max(0, Math.min(quality, tier.cap + 8));
    const next: TrainingRun = {
      ...run,
      turnsElapsed,
      hiddenQuality: quality,
      spentToDate: run.spentToDate + run.computePerTurn * tier.costPerPFTurn,
    };
    if (turnsElapsed >= run.turnsTotal) {
      next.status = quality < BALANCE.run.failThreshold ? "failed" : "completed";
      stars = stars.map(s => (s.onRunId === run.id ? { ...s, onRunId: null } : s));
      if (next.status === "completed") {
        const capability = { coding: 0, reasoning: 0, enterprise: 0, consumer: 0 };
        for (const k of Object.keys(capability) as (keyof typeof capability)[]) {
          const w = techs.reduce((a, t) => a * t.categoryWeights[k], 1);
          capability[k] = Math.max(0, Math.min(100, quality * w));
        }
        const model: Model = {
          id: `model-${run.id}`,
          name: run.name,
          createdTurn: state.turn,
          capability,
          positioning: null,
          deployedTurn: null,
        };
        models = [...models, model];
      }
    } else if (turnsElapsed % BALANCE.run.checkpointEvery === 0) {
      const reading = quality + gaussian(rng, 0, BALANCE.run.checkpointNoiseSd);
      const band = checkpointBand(reading, run.expectedAtLaunch);
      next.checkpoints = [...run.checkpoints, { turn: state.turn, band, note: BAND_NOTES[band] }];
    }
    return next;
  });
  return { ...state, runs, models, stars };
}

export function applyRunDecision(state: GameState, runId: string, decision: RunDecisionKind): GameState {
  const run = state.runs.find(r => r.id === runId);
  if (!run || run.status !== "active") return state;
  if (decision === "push") return state;
  if (decision === "scrap") {
    return {
      ...state,
      runs: state.runs.map(r => (r.id === runId ? { ...r, status: "scrapped" as const } : r)),
      stars: state.stars.map(s => (s.onRunId === runId ? { ...s, onRunId: null } : s)),
    };
  }
  // boost: pay a premium this turn for a quality bump
  const tier = BALANCE.runTiers[run.scaleTier];
  const cost = run.computePerTurn * tier.costPerPFTurn * (BALANCE.run.boostCostMultiplier - 1);
  if (state.capital < cost) throw new Error("insufficient capital");
  return {
    ...state,
    capital: state.capital - cost,
    runs: state.runs.map(r =>
      r.id === runId ? { ...r, hiddenQuality: r.hiddenQuality + BALANCE.run.boostQuality } : r,
    ),
  };
}
