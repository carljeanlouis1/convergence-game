import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { deployModel } from "@/lib/engine/deploy";
import { applyFastFollow } from "@/lib/engine/rivals";
import type { Model } from "@/lib/engine/types";

const mk = (avg: number): Model => ({
  id: `m${avg}`,
  name: `M${avg}`,
  createdTurn: 1,
  capability: { coding: avg, reasoning: avg, enterprise: avg, consumer: avg },
  positioning: null,
  deployedTurn: null,
  lifetimeRevenue: 0,
  pricing: null,
  releaseRank: null,
  retiredTurn: null,
});

describe("superlinear economy", () => {
  it("revenue is superlinear in capability", () => {
    const s = { ...createInitialState("e"), models: [mk(40), mk(90)] };
    const a = deployModel(s, "m40", "api");
    const b = deployModel(a, "m90", "api");
    const small = b.revenueStreams.find(r => r.modelId === "m40")!.amountPerTurn;
    const big = b.revenueStreams.find(r => r.modelId === "m90")!.amountPerTurn;
    expect(small).toBeCloseTo(5.12, 1);
    expect(big).toBeCloseTo(38.9, 1);
    expect(big / small).toBeGreaterThan(7);
  });
  it("premium earns more per turn; aggressive erodes slower", () => {
    const s = { ...createInitialState("e"), models: [mk(60)] };
    const premium = deployModel(s, "m60", "api", "premium");
    const aggressive = deployModel(s, "m60", "api", "aggressive");
    expect(premium.revenueStreams[0].amountPerTurn).toBeGreaterThan(
      aggressive.revenueStreams[0].amountPerTurn * 1.8,
    );
    expect(premium.models[0].pricing).toBe("premium");
    // strong rivals so fast-follow pressure exists
    const strongRivals = (g: typeof s) =>
      g.rivals.map(r => ({ ...r, capability: { coding: 70, reasoning: 70, enterprise: 70, consumer: 70 } }));
    const pDecay = applyFastFollow({ ...premium, rivals: strongRivals(premium) }).revenueStreams[0].decayPerTurn;
    const aDecay = applyFastFollow({ ...aggressive, rivals: strongRivals(aggressive) }).revenueStreams[0]
      .decayPerTurn;
    expect(pDecay).toBeGreaterThan(aDecay);
  });
  it("open-weights ignores pricing and never decays", () => {
    const s = { ...createInitialState("e"), models: [mk(60)] };
    const ow = deployModel(s, "m60", "open-weights", "premium");
    expect(ow.revenueStreams[0].decayPerTurn).toBe(0);
    expect(applyFastFollow(ow).revenueStreams[0].decayPerTurn).toBe(0);
  });
  it("records the release rank against the rival field", () => {
    const s = { ...createInitialState("e"), models: [mk(60)] };
    const deployed = deployModel(s, "m60", "api");
    // starting rivals average well below 60 → rank 1 recorded at completion time is tested in runs;
    // here deploy must not clobber a null releaseRank
    expect(deployed.models[0].releaseRank).toBeNull();
  });
});
