import { describe, it, expect } from "vitest";
import { BALANCE } from "@/lib/engine/balance";

describe("balance invariants", () => {
  it("run tiers escalate in commitment and ceiling", () => {
    const t = BALANCE.runTiers;
    expect(t[2].computePerTurn).toBeGreaterThan(t[1].computePerTurn);
    expect(t[4].cap).toBeGreaterThan(t[1].cap);
    expect(t[1].turns).toBeLessThan(t[4].turns);
  });
  it("tier-1 run is affordable at start", () => {
    const t1 = BALANCE.runTiers[1];
    const runCost = t1.computePerTurn * t1.costPerPFTurn * t1.turns;
    expect(runCost).toBeLessThan(BALANCE.startingCapital / 4);
    expect(t1.computePerTurn).toBeLessThan(BALANCE.startingComputePF);
  });
});
