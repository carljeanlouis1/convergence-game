import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { availableBuilds, startBuild, buildsTurn } from "@/lib/engine/facilities";

describe("facility building", () => {
  it("builds a facility over multiple turns", () => {
    let s = createInitialState("b");
    s = startBuild(s, "colo-expansion");
    expect(s.capital).toBeCloseTo(120 - 12, 5);
    expect(s.builds).toHaveLength(1);
    expect(() => startBuild(s, "colo-expansion")).toThrow(/already building/);
    s = buildsTurn(s).state; // 1 turn left
    const done = buildsTurn({ ...s, turn: s.turn + 1 }).state;
    expect(done.builds).toHaveLength(0);
    expect(done.facilities.some(f => f.id === "fac-colo-expansion")).toBe(true);
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
