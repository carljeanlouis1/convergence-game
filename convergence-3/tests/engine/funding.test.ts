import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { valuation, acceptFunding, fundingTurn } from "@/lib/engine/funding";
import { launchRun } from "@/lib/engine/runs";

describe("funding & governance", () => {
  it("opens three offers when runway is short, terms visible", () => {
    const s = { ...createInitialState("f"), capital: 20 }; // short runway
    const { state } = fundingTurn(s);
    expect(state.fundingOffers).toHaveLength(3);
    expect(new Set(state.fundingOffers.map(o => o.kind))).toEqual(new Set(["vc", "strategic", "mission"]));
    expect(state.fundingOffers.every(o => o.amountM > 0)).toBe(true);
    expect(valuation(s)).toBeGreaterThan(0);
  });
  it("accepting strategic money grants compute next turn and costs control", () => {
    let s = { ...createInitialState("f"), capital: 20 };
    s = fundingTurn(s).state;
    const strat = s.fundingOffers.find(o => o.kind === "strategic")!;
    const out = acceptFunding(s, strat.id);
    expect(out.capital).toBeCloseTo(20 + strat.amountM, 5);
    expect(out.control).toBeCloseTo(s.control - strat.controlCost, 5);
    expect(out.facilities.some(f => f.name.includes("Partner"))).toBe(true);
    expect(out.fundingOffers).toHaveLength(0);
    expect(out.fundingRound).toBe(1);
    expect(() => acceptFunding(out, strat.id)).toThrow(/no such offer/);
  });
  it("coup: high morale survives, mid morale is interim, low morale is ousted", () => {
    const base = { ...createInitialState("f"), boardConfidence: 10 };
    const survived = fundingTurn({ ...base, morale: 80 }).state;
    expect(survived.ending).toBeNull();
    expect(survived.boardConfidence).toBe(45);
    const interim = fundingTurn({ ...base, morale: 50 }).state;
    expect(interim.ending).toBeNull();
    expect(interim.interimUntilTurn).toBeGreaterThan(interim.turn);
    const ousted = fundingTurn({ ...base, morale: 20 }).state;
    expect(ousted.ending).toBe("ousted");
    expect(ousted.ended).toBe(true);
  });
  it("interim mode blocks big runs", () => {
    const s = { ...createInitialState("f"), interimUntilTurn: 10 };
    expect(() =>
      launchRun(s, { name: "Goliath", scaleTier: 3, techniqueIds: ["rlhf"], leadId: null }),
    ).toThrow(/interim board/);
    expect(() =>
      launchRun(s, { name: "Small", scaleTier: 1, techniqueIds: ["rlhf"], leadId: null }),
    ).not.toThrow();
  });
  it("fire-sale chain: facility sale → down round → absorbed", () => {
    let s = { ...createInitialState("f"), capital: -5 };
    s = fundingTurn(s).state;
    expect(s.fireSaleCount).toBe(1);
    expect(s.facilities[0].capacityPF).toBeLessThan(40);
    s = fundingTurn({ ...s, capital: -5 }).state;
    expect(s.fireSaleCount).toBe(2);
    expect(s.capital).toBeGreaterThan(-5);
    s = fundingTurn({ ...s, capital: -5 }).state;
    expect(s.ending).toBe("absorbed");
    expect(s.ended).toBe(true);
  });
});
