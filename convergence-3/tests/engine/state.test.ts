import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { BALANCE } from "@/lib/engine/balance";

describe("createInitialState", () => {
  const s = createInitialState("alpha");
  it("matches balance starting values", () => {
    expect(s.capital).toBe(BALANCE.startingCapital);
    expect(s.turn).toBe(1);
    expect(s.era).toBe(1);
    expect(s.version).toBe(1);
    expect(s.facilities.reduce((a, f) => a + f.capacityPF, 0)).toBe(BALANCE.startingComputePF);
  });
  it("starts with 4 stars, none assigned", () => {
    expect(s.stars).toHaveLength(4);
    expect(s.stars.every(st => st.onRunId === null)).toBe(true);
  });
  it("starts with no runs, no models, zeroed allocation fits capacity", () => {
    expect(s.runs).toEqual([]);
    expect(s.models).toEqual([]);
    const alloc = s.allocation.inference + s.allocation.experiments + s.allocation.safety;
    expect(alloc).toBeLessThanOrEqual(BALANCE.startingComputePF);
  });
  it("is deterministic and JSON-safe", () => {
    expect(createInitialState("alpha")).toEqual(s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
