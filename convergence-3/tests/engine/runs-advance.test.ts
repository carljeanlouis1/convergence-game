import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun, advanceRuns, applyRunDecision, checkpointBand } from "@/lib/engine/runs";

const design = { name: "Nimbus-1", scaleTier: 1 as const, techniqueIds: ["rlhf"], leadId: "star-imara" };

function stateWithRun(seed: string) {
  return launchRun(createInitialState(seed), design);
}

describe("run advance", () => {
  it("accrues elapsed turns and spend deterministically", () => {
    const s1 = advanceRuns(stateWithRun("adv"));
    expect(s1.runs[0].turnsElapsed).toBe(1);
    expect(s1.runs[0].spentToDate).toBeCloseTo(8 * 0.32, 5);
    expect(advanceRuns(stateWithRun("adv")).runs[0].hiddenQuality).toBe(s1.runs[0].hiddenQuality);
  });
  it("emits a checkpoint at the cadence, with band not raw quality", () => {
    let s = stateWithRun("cp");
    s = advanceRuns(s);
    s = advanceRuns(s);
    expect(s.runs[0].checkpoints).toHaveLength(1);
    expect(["ahead", "on-track", "wobbly", "troubled"]).toContain(s.runs[0].checkpoints[0].band);
  });
  it("completes a tier-1 run after 3 turns and mints a model", () => {
    let s = stateWithRun("done");
    for (let i = 0; i < 3; i++) s = advanceRuns(s);
    expect(s.runs[0].status).toBe("completed");
    expect(s.models).toHaveLength(1);
    const cap = s.models[0].capability;
    for (const k of ["coding", "reasoning", "enterprise", "consumer"] as const) {
      expect(cap[k]).toBeGreaterThan(0);
      expect(cap[k]).toBeLessThanOrEqual(100);
    }
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBeNull();
  });
  it("scrap frees the lead and halts the run", () => {
    let s = stateWithRun("scrap");
    s = applyRunDecision(s, s.runs[0].id, "scrap");
    expect(s.runs[0].status).toBe("scrapped");
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBeNull();
    expect(advanceRuns(s).runs[0].turnsElapsed).toBe(0); // scrapped runs don't advance
  });
  it("boost raises quality and charges capital", () => {
    let s = stateWithRun("boost");
    const before = { q: s.runs[0].hiddenQuality, c: s.capital };
    s = applyRunDecision(s, s.runs[0].id, "boost");
    expect(s.runs[0].hiddenQuality).toBeCloseTo(before.q + 4.5, 5);
    expect(s.capital).toBeLessThan(before.c);
  });
  it("bands classify against expected", () => {
    expect(checkpointBand(60, 45)).toBe("ahead");
    expect(checkpointBand(46, 45)).toBe("on-track");
    expect(checkpointBand(40, 45)).toBe("wobbly");
    expect(checkpointBand(30, 45)).toBe("troubled");
  });
});
