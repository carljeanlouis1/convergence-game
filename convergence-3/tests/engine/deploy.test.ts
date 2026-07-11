import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { deployModel, bestFitPositioning } from "@/lib/engine/deploy";
import type { Model } from "@/lib/engine/types";

// enterprise-strong model (60 EnterpriseBench, weaker elsewhere)
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
  it("positions a model and opens a decaying revenue stream", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "enterprise");
    expect(s.models[0].positioning).toBe("enterprise");
    expect(s.revenueStreams[0].amountPerTurn).toBeGreaterThan(0);
    expect(s.revenueStreams[0].decayPerTurn).toBeCloseTo(0.06, 5);
    expect(s.revenueStreams[0].modelId).toBe("model-x");
  });
  it("rewards matching the model's strength to the market", () => {
    const base = { ...createInitialState("d"), models: [model] };
    // this model is enterprise-strong; enterprise positioning should out-earn consumer positioning
    const asEnterprise = deployModel(base, "model-x", "enterprise").revenueStreams[0].amountPerTurn;
    const asConsumer = deployModel(base, "model-x", "consumer").revenueStreams[0].amountPerTurn;
    expect(asEnterprise).toBeGreaterThan(asConsumer);
    expect(bestFitPositioning(model.capability)).toBe("enterprise");
  });
  it("premium pricing out-earns aggressive on the same market", () => {
    const base = { ...createInitialState("d"), models: [model] };
    const premium = deployModel(base, "model-x", "enterprise", "premium").revenueStreams[0].amountPerTurn;
    const aggressive = deployModel(base, "model-x", "enterprise", "aggressive").revenueStreams[0].amountPerTurn;
    expect(premium).toBeGreaterThan(aggressive);
  });
  it("open-weights earns little but does not decay", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "open-weights");
    expect(s.revenueStreams[0].amountPerTurn).toBeGreaterThan(0);
    expect(s.revenueStreams[0].amountPerTurn).toBeLessThan(2);
    expect(s.revenueStreams[0].decayPerTurn).toBe(0);
  });
  it("rejects unknown and double deploys", () => {
    const s = { ...createInitialState("d"), models: [model] };
    expect(() => deployModel(s, "nope", "api")).toThrow(/not found/);
    const once = deployModel(s, "model-x", "api");
    expect(() => deployModel(once, "model-x", "api")).toThrow(/already deployed/);
  });
});
