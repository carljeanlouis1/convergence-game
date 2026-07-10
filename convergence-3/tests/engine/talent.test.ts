import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { hireCandidate, respondToPoach, talentTurn } from "@/lib/engine/talent";
import { BALANCE } from "@/lib/engine/balance";

describe("talent", () => {
  it("hires from the market for the signing bonus", () => {
    const s = createInitialState("t");
    const c = s.market[0];
    const out = hireCandidate(s, c.id);
    expect(out.stars.some(st => st.id === c.id)).toBe(true);
    expect(out.capital).toBeCloseTo(s.capital - c.signingBonus, 5);
    expect(out.market.some(m => m.id === c.id)).toBe(false);
    expect(out.teamStrength).toBe(s.teamStrength + BALANCE.talent.hireTeamStrength);
    expect(() => hireCandidate(out, c.id)).toThrow(/candidate gone/);
  });
  it("match retains the star at a price; equity costs control; decline loses them", () => {
    const s = {
      ...createInitialState("t"),
      poachOffers: [{ starId: "star-imara", rivalId: "velocity", packageM: 20, expiresTurn: 99 }],
    };
    const matched = respondToPoach(s, "star-imara", "match");
    expect(matched.capital).toBeCloseTo(s.capital - 20 * BALANCE.talent.matchCostFactor, 5);
    expect(matched.poachOffers).toHaveLength(0);
    expect(matched.stars.find(st => st.id === "star-imara")!.salaryPerQuarter).toBeCloseTo(0.9 * 1.2, 5);
    const equity = respondToPoach(s, "star-imara", "equity");
    expect(equity.control).toBeCloseTo(s.control - BALANCE.talent.equityControlCost, 5);
    expect(equity.poachOffers).toHaveLength(0);
    const declined = respondToPoach(s, "star-imara", "decline");
    expect(declined.poachOffers[0].expiresTurn).toBe(-1);
    const after = talentTurn(declined).state;
    expect(after.stars.some(st => st.id === "star-imara")).toBe(false);
    expect(after.morale).toBeLessThan(s.morale);
    expect(after.rivals.find(r => r.id === "velocity")!.capability.reasoning).toBeGreaterThan(
      s.rivals.find(r => r.id === "velocity")!.capability.reasoning,
    );
  });
  it("burnout climbs on runs, recovers off them, deterministic", () => {
    let s = createInitialState("t");
    s = {
      ...s,
      stars: s.stars.map(st => (st.id === "star-imara" ? { ...st, onRunId: "run-x", burnout: 40 } : st)),
    };
    const after = talentTurn(s).state;
    expect(after.stars.find(st => st.id === "star-imara")!.burnout).toBe(40 + BALANCE.talent.burnoutPerRunTurn);
    expect(talentTurn(s).state).toEqual(after);
  });
  it("market churns but never exceeds marketSize", () => {
    let s = createInitialState("t");
    for (let i = 0; i < 6; i++) {
      s = { ...s, turn: s.turn + 1 };
      s = talentTurn(s).state;
    }
    expect(s.market.length).toBeLessThanOrEqual(BALANCE.talent.marketSize);
  });
});
