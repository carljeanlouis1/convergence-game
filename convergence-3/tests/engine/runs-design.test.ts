import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun, expectedQuality, riskBand } from "@/lib/engine/runs";
import { committedRunPF } from "@/lib/engine/compute";

const design = { name: "Nimbus-1", scaleTier: 1 as const, techniqueIds: ["rlhf"], leadId: "star-imara" };

describe("run design + launch", () => {
  it("computes expected quality from lead, team, techniques", () => {
    const s = createInitialState("r");
    // 32 base + 7*2.2 + 30*0.28 + 3 = 58.8, tier-1 cap 45 → 45
    expect(expectedQuality(design, s)).toBeCloseTo(45, 5);
  });
  it("classifies risk from technique variance", () => {
    expect(riskBand(design)).toBe("low");
    expect(riskBand({ ...design, techniqueIds: ["synthetic-data", "dpo"] })).toBe("high");
  });
  it("launches a run: commits compute, locks the lead", () => {
    const s = launchRun(createInitialState("r"), design);
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].status).toBe("active");
    expect(committedRunPF(s)).toBe(8);
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBe(s.runs[0].id);
    expect(s.runs[0].hiddenQuality).toBeGreaterThan(20);
    expect(s.runs[0].expectedAtLaunch).toBeCloseTo(45, 5);
  });
  it("rejects double-committing a lead and over-compute", () => {
    const s = launchRun(createInitialState("r"), design);
    expect(() => launchRun(s, { ...design, name: "Nimbus-2" })).toThrow(/lead already committed/);
    const big = { name: "Goliath", scaleTier: 4 as const, techniqueIds: ["rlhf"], leadId: null };
    expect(() => launchRun(s, big)).toThrow(/insufficient free compute/);
  });
  it("rejects unknown techniques and unknown leads", () => {
    const s = createInitialState("r");
    expect(() => launchRun(s, { ...design, techniqueIds: ["quantum-annealing"] })).toThrow(/unknown or locked technique/);
    expect(() => launchRun(s, { ...design, leadId: "star-nobody" })).toThrow(/unknown lead/);
  });
  it("is deterministic per seed", () => {
    const a = launchRun(createInitialState("same"), design).runs[0].hiddenQuality;
    const b = launchRun(createInitialState("same"), design).runs[0].hiddenQuality;
    expect(a).toBe(b);
  });
});
