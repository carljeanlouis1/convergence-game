import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { updateStats, evaluateEndings, finalizeEnding, trajectory } from "@/lib/engine/endings";

describe("endings", () => {
  it("evaluates enterprise-titan from stats", () => {
    let s = {
      ...createInitialState("en"),
      control: 60,
      revenueStreams: [{ source: "x", amountPerTurn: 45, decayPerTurn: 0 }],
    };
    s = { ...s, stats: { ...s.stats, profitStreak: 4 } };
    expect(evaluateEndings(s)).toBe("enterprise-titan");
  });
  it("catastrophe outranks victories", () => {
    const base = createInitialState("en");
    const s = {
      ...base,
      control: 60,
      revenueStreams: [{ source: "x", amountPerTurn: 45, decayPerTurn: 0 }],
      stats: { ...base.stats, profitStreak: 9, incidents: 3 },
    };
    expect(evaluateEndings(s)).toBe("catastrophe");
  });
  it("irrelevance triggers from the lagging streak", () => {
    const base = createInitialState("en");
    const s = { ...base, stats: { ...base.stats, laggingStreak: 6 } };
    expect(evaluateEndings(s)).toBe("irrelevant");
  });
  it("the-standard triggers from open share", () => {
    const base = createInitialState("en");
    expect(evaluateEndings({ ...base, stats: { ...base.stats, openShare: 60 } })).toBe("the-standard");
  });
  it("frontier-crown needs an era-spanning streak AND a frontier-class model", () => {
    const base = createInitialState("en");
    const frontierModel = {
      id: "fm", name: "FM", createdTurn: 1,
      capability: { coding: 75, reasoning: 75, enterprise: 75, consumer: 75 },
      positioning: "api" as const, deployedTurn: 1,
      lifetimeRevenue: 0, pricing: "standard" as const, releaseRank: null,
          retiredTurn: null,
    };
    // streak without era span → no
    expect(evaluateEndings({ ...base, models: [frontierModel], stats: { ...base.stats, topStreak: 6, topStreakSpansEra: false } })).toBeNull();
    // streak + span but weak model (turn-12 exploit) → no
    expect(evaluateEndings({ ...base, stats: { ...base.stats, topStreak: 6, topStreakSpansEra: true } })).toBeNull();
    // streak + span + frontier model → crown
    expect(evaluateEndings({ ...base, models: [frontierModel], stats: { ...base.stats, topStreak: 6, topStreakSpansEra: true } })).toBe("frontier-crown");
  });
  it("pyrrhic overlay and grades", () => {
    const base = { ...createInitialState("en"), control: 20, trust: 80 };
    const done = finalizeEnding(base, "enterprise-titan");
    expect(done.ended).toBe(true);
    expect(done.endingResult!.victory).toBe(true);
    expect(done.endingResult!.pyrrhic).toBe(true);
    expect(["S", "A", "B", "C", "D"]).toContain(done.endingResult!.grade);
    const defeat = finalizeEnding(createInitialState("en"), "absorbed");
    expect(defeat.endingResult!.victory).toBe(false);
    expect(defeat.endingResult!.pyrrhic).toBe(false);
  });
  it("trajectory exposes progress and hides the secret", () => {
    const t = trajectory(createInitialState("en"));
    expect(t.length).toBeGreaterThanOrEqual(10);
    expect(t.every(e => e.progress >= 0 && e.progress <= 1)).toBe(true);
    expect(t.find(e => e.id === "simulation-revelation")!.hidden).toBe(true);
    expect(t.find(e => e.id === "enterprise-titan")!.pull.length).toBeGreaterThan(0);
  });
  it("updateStats tracks streaks and open share", () => {
    let s = createInitialState("en");
    s = updateStats(s, 5);
    expect(s.stats.profitStreak).toBe(1);
    s = updateStats(s, -1);
    expect(s.stats.profitStreak).toBe(0);
    const open = {
      ...s,
      models: [
        {
          id: "m", name: "OW", createdTurn: 1,
          capability: { coding: 50, reasoning: 50, enterprise: 50, consumer: 50 },
          positioning: "open-weights" as const, deployedTurn: 1,
          lifetimeRevenue: 0, pricing: "standard" as const, releaseRank: null, retiredTurn: null,
        },
      ],
    };
    expect(updateStats(open, 0).stats.openShare).toBe(2);
  });
});
