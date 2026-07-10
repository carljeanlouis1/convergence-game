import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { deployModel } from "@/lib/engine/deploy";
import type { Model } from "@/lib/engine/types";

const model: Model = {
  id: "model-x",
  name: "Nimbus-1",
  createdTurn: 3,
  capability: { coding: 40, reasoning: 40, enterprise: 60, consumer: 20 },
  positioning: null,
  deployedTurn: null,
  lifetimeRevenue: 0,
  pricing: null,
  releaseRank: null,
};

describe("deployModel", () => {
  it("positions a model and opens a revenue stream", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "enterprise");
    expect(s.models[0].positioning).toBe("enterprise");
    // avg 40 → 4 base × 1.35 = 5.4
    expect(s.revenueStreams[0].amountPerTurn).toBeCloseTo(5.4, 5);
    expect(s.revenueStreams[0].decayPerTurn).toBeCloseTo(0.06, 5);
  });
  it("open-weights earns little but does not decay", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "open-weights");
    expect(s.revenueStreams[0].amountPerTurn).toBeCloseTo(0.6, 5);
    expect(s.revenueStreams[0].decayPerTurn).toBe(0);
  });
  it("rejects unknown and double deploys", () => {
    const s = { ...createInitialState("d"), models: [model] };
    expect(() => deployModel(s, "nope", "api")).toThrow(/not found/);
    const once = deployModel(s, "model-x", "api");
    expect(() => deployModel(once, "model-x", "api")).toThrow(/already deployed/);
  });
});
