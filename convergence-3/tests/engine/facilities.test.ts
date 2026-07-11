import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { availableBuilds, startBuild, buildsTurn, buildCost } from "@/lib/engine/facilities";
import { BALANCE } from "@/lib/engine/balance";

describe("facility building", () => {
  it("builds a facility over multiple turns", () => {
    let s = createInitialState("b");
    s = startBuild(s, "colo-expansion");
    expect(s.capital).toBeCloseTo(120 - 12, 5);
    expect(s.builds).toHaveLength(1);
    expect(() => startBuild(s, "colo-expansion")).toThrow(/already under construction/);
    s = buildsTurn(s).state; // 1 turn left
    const done = buildsTurn({ ...s, turn: s.turn + 1 }).state;
    expect(done.builds).toHaveLength(0);
    expect(done.facilities.some(f => f.id.startsWith("fac-colo-expansion"))).toBe(true);
  });
  it("is repeatable with an escalating cost", () => {
    let s = createInitialState("b");
    expect(buildCost(s, availableBuilds(s)[0])).toBe(12);
    // build one and bring it online
    s = startBuild(s, "colo-expansion");
    s = buildsTurn(s).state;
    s = buildsTurn({ ...s, turn: s.turn + 1 }).state;
    // the option is still offered, now more expensive
    expect(availableBuilds(s).some(o => o.id === "colo-expansion")).toBe(true);
    const next = buildCost(s, availableBuilds(s).find(o => o.id === "colo-expansion")!);
    expect(next).toBe(Math.round(12 * BALANCE.facilities.repeatCostMultiplier));
    // second one lands with a distinct id
    s = startBuild(s, "colo-expansion");
    s = buildsTurn(s).state;
    const done = buildsTurn({ ...s, turn: s.turn + 1 }).state;
    const coloFacs = done.facilities.filter(f => f.id.startsWith("fac-colo-expansion"));
    expect(coloFacs).toHaveLength(2);
    expect(new Set(coloFacs.map(f => f.id)).size).toBe(2);
  });
  it("era-gates options and enforces capital", () => {
    const s = createInitialState("b");
    expect(availableBuilds(s).map(o => o.id)).toEqual(["colo-expansion"]);
    expect(availableBuilds({ ...s, era: 2 }).length).toBe(3);
    expect(availableBuilds({ ...s, era: 4 }).length).toBe(5);
    expect(() => startBuild({ ...s, capital: 5 }, "colo-expansion")).toThrow(/insufficient capital/);
    expect(() => startBuild(s, "nope")).toThrow(/unknown build/);
    expect(() => startBuild(s, "gigacluster")).toThrow(/unknown build/); // era-gated
  });
  it("the power plant gamble costs trust", () => {
    const s = { ...createInitialState("b"), era: 2 as const };
    const out = startBuild(s, "own-power-plant");
    expect(out.trust).toBe(s.trust - 4);
  });
});
