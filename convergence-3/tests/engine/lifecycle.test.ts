import { describe, it, expect } from "vitest";
import { BALANCE } from "@/lib/engine/balance";
import { createInitialState } from "@/lib/engine/state";
import { deprecateModel } from "@/lib/engine/deploy";
import { servingDemandFor, totalServingDemand, servingRatio, revenuePerTurn } from "@/lib/engine/finance";
import { launchRun, expectedQuality, advanceRuns } from "@/lib/engine/runs";
import type { Model } from "@/lib/engine/types";

const mk = (id: string, positioning: Model["positioning"], retired = false): Model => ({
  id,
  name: id,
  createdTurn: 1,
  capability: { coding: 60, reasoning: 60, enterprise: 60, consumer: 60 },
  positioning,
  deployedTurn: positioning ? 1 : null,
  lifetimeRevenue: 0,
  pricing: positioning ? "standard" : null,
  releaseRank: null,
  retiredTurn: retired ? 2 : null,
});

describe("serving compute", () => {
  it("deployed models demand serving PF; open-weights, retired, and undeployed cost nothing", () => {
    expect(servingDemandFor(mk("a", "api"))).toBeGreaterThan(0);
    expect(servingDemandFor(mk("b", "open-weights"))).toBe(0);
    expect(servingDemandFor(mk("c", "api", true))).toBe(0);
    expect(servingDemandFor(mk("d", null))).toBe(0);
  });
  it("under-provisioning the serving pool throttles revenue", () => {
    const base = {
      ...createInitialState("srv"),
      models: [mk("a", "api")],
      revenueStreams: [{ source: "a", amountPerTurn: 20, decayPerTurn: 0.06, modelId: "a", pricing: "standard" as const }],
    };
    const demand = totalServingDemand(base);
    expect(demand).toBeGreaterThan(0);
    const starved = { ...base, allocation: { inference: 0, experiments: 0, safety: 0 } };
    const fed = { ...base, allocation: { inference: Math.ceil(demand), experiments: 0, safety: 0 } };
    expect(servingRatio(starved)).toBeLessThan(1);
    expect(servingRatio(fed)).toBeCloseTo(1, 5);
    expect(revenuePerTurn(fed)).toBeGreaterThan(revenuePerTurn(starved));
  });
  it("no deployed models means full serving ratio", () => {
    expect(servingRatio(createInitialState("srv"))).toBe(1);
  });
});

describe("deprecation", () => {
  it("retires a model, ends its revenue, and frees its serving demand", () => {
    const s = {
      ...createInitialState("dep"),
      models: [mk("a", "api")],
      revenueStreams: [{ source: "a", amountPerTurn: 20, decayPerTurn: 0.06, modelId: "a", pricing: "standard" as const }],
    };
    expect(totalServingDemand(s)).toBeGreaterThan(0);
    const out = deprecateModel(s, "a");
    expect(out.models[0].retiredTurn).toBe(s.turn);
    expect(out.revenueStreams).toHaveLength(0);
    expect(totalServingDemand(out)).toBe(0);
    expect(() => deprecateModel(out, "a")).toThrow(/already retired/);
    expect(() => deprecateModel(s, "nope")).toThrow(/not found/);
  });
});

describe("model families", () => {
  it("a run built on a base model inherits a capability floor", () => {
    const base = mk("base", null);
    base.capability = { coding: 90, reasoning: 90, enterprise: 90, consumer: 90 };
    let s = { ...createInitialState("fam"), models: [base] };
    // a weak run that would normally produce a low model
    s = launchRun(s, { name: "V2", scaleTier: 1, techniqueIds: ["rlhf"], leadId: null, baseModelId: "base" });
    for (let i = 0; i < 3; i++) s = advanceRuns({ ...s, turn: s.turn + 1 });
    const v2 = s.models.find(m => m.name === "V2");
    if (v2) {
      // inherits ≥ 70% of 90 = 63 in each category
      expect(v2.capability.coding).toBeGreaterThanOrEqual(62);
    }
  });
});

describe("technique affinity", () => {
  it("a lead's affinity technique adds exactly the affinity bonus", () => {
    const specialist = { id: "sp", name: "Sp", specialty: "reasoning" as const, skill: 6, salaryPerQuarter: 1, onRunId: null, burnout: 0, affinity: "rlvr" };
    const generalist = { id: "gp", name: "Gp", specialty: "reasoning" as const, skill: 6, salaryPerQuarter: 1, onRunId: null, burnout: 0, affinity: null };
    // low team/momentum and tier-4 ceiling so the bonus is not clipped by the cap
    const s = { ...createInitialState("aff"), era: 2 as const, teamStrength: 0, researchMomentum: 0, stars: [specialist, generalist] };
    const withAff = expectedQuality({ name: "R", scaleTier: 4, techniqueIds: ["rlvr"], leadId: "sp" }, s);
    const withoutAff = expectedQuality({ name: "R", scaleTier: 4, techniqueIds: ["rlvr"], leadId: "gp" }, s);
    expect(withAff - withoutAff).toBeCloseTo(BALANCE.talent.affinityBonus, 5);
  });
});
