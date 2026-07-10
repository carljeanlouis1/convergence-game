import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { deployModel } from "@/lib/engine/deploy";
import { categoryLeaders } from "@/lib/engine/rivals";
import { crownsOf, streamYield, revenuePerTurn, applyFinance } from "@/lib/engine/finance";
import { updateStats } from "@/lib/engine/endings";
import { BALANCE } from "@/lib/engine/balance";
import type { Model } from "@/lib/engine/types";

const coder: Model = {
  id: "coder",
  name: "Coder-1",
  createdTurn: 1,
  capability: { coding: 95, reasoning: 10, enterprise: 10, consumer: 10 },
  positioning: null,
  deployedTurn: null,
  lifetimeRevenue: 0,
  pricing: null,
  releaseRank: null,
};

function crowned() {
  const s = { ...createInitialState("c"), models: [coder] };
  return deployModel(s, "coder", "api");
}

describe("benchmark crowns", () => {
  it("a category-leading deployed model holds the crown", () => {
    const s = crowned();
    const leaders = categoryLeaders(s);
    expect(leaders.coding.isPlayer).toBe(true);
    expect(leaders.reasoning.isPlayer).toBe(false);
    expect(crownsOf(s, "coder")).toBe(1);
  });
  it("crowns boost stream yield", () => {
    const s = crowned();
    const stream = s.revenueStreams[0];
    expect(streamYield(s, stream)).toBeCloseTo(stream.amountPerTurn * (1 + BALANCE.finance.crownYieldBonus), 5);
    expect(revenuePerTurn(s)).toBeGreaterThan(stream.amountPerTurn);
  });
  it("updateStats tracks crowns and board reacts to gain/loss", () => {
    const s = updateStats(crowned(), 5);
    expect(s.stats.crowns).toEqual(["coding"]);
    expect(s.boardConfidence).toBeGreaterThan(crowned().boardConfidence); // gain bonus (+ profit drift)
    const overtaken = {
      ...s,
      rivals: s.rivals.map(r =>
        r.id === "velocity" ? { ...r, capability: { ...r.capability, coding: 99 } } : r,
      ),
    };
    const after = updateStats(overtaken, 5);
    expect(after.stats.crowns).toEqual([]);
    expect(after.boardConfidence).toBeLessThanOrEqual(s.boardConfidence);
  });
  it("lifetime revenue accrues to the source model", () => {
    const s = crowned();
    const { state: after } = applyFinance(s);
    expect(after.models[0].lifetimeRevenue).toBeGreaterThan(0);
  });
});
