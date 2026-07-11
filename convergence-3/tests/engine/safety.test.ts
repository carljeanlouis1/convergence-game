import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { capabilityTier, deployRiskBand, safetyTurn, riskBandLabel } from "@/lib/engine/safety";
import { deployModel } from "@/lib/engine/deploy";
import type { Model } from "@/lib/engine/types";

const strong: Model = {
  id: "m",
  name: "Titan",
  createdTurn: 1,
  capability: { coding: 60, reasoning: 60, enterprise: 60, consumer: 60 },
  positioning: null,
  deployedTurn: null,
  lifetimeRevenue: 0,
  pricing: null,
  releaseRank: null,
          retiredTurn: null,
};

describe("safety", () => {
  it("tiers follow deployed capability", () => {
    const s = createInitialState("s");
    expect(capabilityTier(s)).toBe(0);
    const deployed = deployModel({ ...s, models: [strong] }, "m", "api");
    expect(capabilityTier(deployed)).toBe(2); // avg 60 ≥ t2 55, < t3 70
  });
  it("deploying past your eval capacity accrues incident risk", () => {
    const s = { ...createInitialState("s"), models: [strong], evalCapacity: 0 };
    expect(deployRiskBand(s, "m")).toBe("severe");
    const out = deployModel(s, "m", "api");
    expect(out.incidentRisk).toBeGreaterThan(0);
    const covered = { ...s, evalCapacity: 50 };
    expect(deployRiskBand(covered, "m")).toBe("clear");
    expect(deployModel(covered, "m", "api").incidentRisk).toBe(0);
  });
  it("safety allocation builds capacity; incident fires deterministically per seed", () => {
    let s = { ...createInitialState("s"), allocation: { inference: 0, experiments: 0, safety: 10 } };
    s = safetyTurn(s).state;
    expect(s.evalCapacity).toBeCloseTo(5, 5);
    const risky = { ...s, incidentRisk: 100, revenueStreams: [{ source: "x", amountPerTurn: 10, decayPerTurn: 0 }] };
    const { state: hit, lines } = safetyTurn(risky);
    expect(hit.trust).toBeLessThan(risky.trust);
    expect(hit.revenueStreams[0].amountPerTurn).toBeCloseTo(7, 5);
    expect(hit.incidentRisk).toBeCloseTo(50, 5);
    expect(lines.some(l => /jailbreak|incident/i.test(l))).toBe(true);
    expect(riskBandLabel(risky)).toBe("severe");
    expect(riskBandLabel(createInitialState("s"))).toBe("low");
  });
});
