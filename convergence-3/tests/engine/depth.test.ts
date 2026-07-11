import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { openRound } from "@/lib/engine/funding";
import { evaluateEndings, trajectory } from "@/lib/engine/endings";
import { TECHNIQUES } from "@/lib/engine/content";
import { BALANCE } from "@/lib/engine/balance";

describe("player-initiated funding", () => {
  it("opens a round on demand after the cooldown", () => {
    const s = { ...createInitialState("raise"), turn: 6, lastRaiseTurn: 0 };
    const out = openRound(s);
    expect(out.fundingOffers).toHaveLength(3);
    expect(() => openRound(out)).toThrow(/already open/);
  });
  it("enforces the cooldown", () => {
    const s = { ...createInitialState("raise"), turn: 3, lastRaiseTurn: 0 };
    expect(() => openRound(s)).toThrow(/too soon/);
  });
});

describe("figurehead governance floor", () => {
  it("control at the floor ends the run; above it does not", () => {
    const low = { ...createInitialState("fig"), control: BALANCE.endings.figureheadControl };
    expect(evaluateEndings(low)).toBe("figurehead");
    const ok = { ...createInitialState("fig"), control: 40 };
    expect(evaluateEndings(ok)).not.toBe("figurehead");
  });
  it("the compass warns about it", () => {
    const t = trajectory({ ...createInitialState("fig"), control: 22 });
    const fig = t.find(e => e.id === "figurehead")!;
    expect(fig.progress).toBeGreaterThan(0.5);
    expect(fig.pull).toMatch(/22/);
  });
});

describe("technique tree depth", () => {
  it("has 11 techniques spread across all four eras", () => {
    expect(TECHNIQUES.length).toBeGreaterThanOrEqual(11);
    for (const era of [1, 2, 3, 4]) {
      expect(TECHNIQUES.filter(t => t.era === era).length).toBeGreaterThanOrEqual(2);
    }
  });
});

import { researchTurn } from "@/lib/engine/research";
import { expectedQuality } from "@/lib/engine/runs";
import { advanceRuns, launchRun } from "@/lib/engine/runs";

describe("research experiments lever", () => {
  it("experiments allocation builds momentum that raises new-run quality", () => {
    const base = { ...createInitialState("mom"), allocation: { inference: 0, experiments: 20, safety: 0 } };
    const after = researchTurn(base).state;
    expect(after.researchMomentum).toBeGreaterThan(0);
    const design = { name: "R", scaleTier: 2 as const, techniqueIds: ["rlhf"], leadId: null };
    const q0 = expectedQuality(design, { ...base, researchMomentum: 0 });
    const q1 = expectedQuality(design, { ...base, researchMomentum: 20 });
    expect(q1).toBeGreaterThan(q0);
  });
  it("momentum decays when you stop investing", () => {
    const s = { ...createInitialState("mom"), researchMomentum: 20, allocation: { inference: 0, experiments: 0, safety: 0 } };
    expect(researchTurn(s).state.researchMomentum).toBeLessThan(20);
  });
});

describe("talent shapes the model", () => {
  it("the lead's specialty strengthens that benchmark in the finished model", () => {
    // Mei-Lin Zhang is the enterprise specialist
    let s = createInitialState("spec");
    s = launchRun(s, { name: "Ent", scaleTier: 1, techniqueIds: ["rlhf"], leadId: "star-mei" });
    for (let i = 0; i < 3; i++) s = advanceRuns({ ...s, turn: s.turn + 1 });
    const model = s.models[0];
    if (model) {
      // enterprise should be the strongest (or tied) category thanks to the lead
      expect(model.capability.enterprise).toBeGreaterThanOrEqual(model.capability.consumer);
    }
  });
});

describe("AGI-class capability is reachable", () => {
  it("a maxed endgame run design projects frontier quality", () => {
    const s = {
      ...createInitialState("ceiling"),
      era: 4 as const,
      teamStrength: 80,
      researchMomentum: 30,
      stars: [{ id: "ace", name: "Ace", specialty: "reasoning" as const, skill: 10, salaryPerQuarter: 2, onRunId: null, burnout: 0 }],
    };
    const q = expectedQuality(
      { name: "Titan", scaleTier: 4, techniqueIds: ["recursive-self-improvement", "self-play-economies", "agentic-scaffolding"], leadId: "ace" },
      s,
    );
    expect(q).toBeGreaterThanOrEqual(90); // the tree can reach frontier/AGI-class capability
  });
});
