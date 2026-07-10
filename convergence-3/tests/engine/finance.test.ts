import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import {
  payrollPerTurn,
  computeUpkeepPerTurn,
  burnPerTurn,
  revenuePerTurn,
  runwayMonths,
  applyFinance,
} from "@/lib/engine/finance";

describe("finance", () => {
  const s = createInitialState("f");
  it("computes payroll from stars + team", () => {
    // 0.9+0.7+0.55+0.5 + 30*0.09 = 5.35
    expect(payrollPerTurn(s)).toBeCloseTo(5.35, 5);
  });
  it("computes upkeep from capacity", () => {
    expect(computeUpkeepPerTurn(s)).toBeCloseTo(40 * 0.045, 5);
  });
  it("no deployed model → inference allocation earns nothing", () => {
    const alloc = { ...s, allocation: { inference: 20, experiments: 0, safety: 0 } };
    expect(revenuePerTurn(alloc)).toBe(0);
  });
  it("applyFinance nets capital and decays streams", () => {
    const withStream = { ...s, revenueStreams: [{ source: "api", amountPerTurn: 10, decayPerTurn: 0.5 }] };
    const { state: next, net } = applyFinance(withStream);
    expect(net).toBeCloseTo(10 - burnPerTurn(s), 5);
    expect(next.capital).toBeCloseTo(s.capital + net, 5);
    expect(next.revenueStreams[0].amountPerTurn).toBeCloseTo(5, 5);
  });
  it("drops streams that decay to dust", () => {
    const dusty = { ...s, revenueStreams: [{ source: "old", amountPerTurn: 0.08, decayPerTurn: 0.5 }] };
    expect(applyFinance(dusty).state.revenueStreams).toHaveLength(0);
  });
  it("runway is finite when burning, infinite when profitable", () => {
    expect(runwayMonths(s)).toBeGreaterThan(0);
    expect(runwayMonths(s)).toBeLessThan(200);
    const rich = { ...s, revenueStreams: [{ source: "api", amountPerTurn: 999, decayPerTurn: 0 }] };
    expect(runwayMonths(rich)).toBe(Infinity);
  });
});
