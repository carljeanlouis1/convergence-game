import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { totalCapacityPF, committedRunPF, freePF, setAllocation } from "@/lib/engine/compute";

describe("compute allocation", () => {
  it("reports starting capacity and zero commitments", () => {
    const s = createInitialState("c");
    expect(totalCapacityPF(s)).toBe(40);
    expect(committedRunPF(s)).toBe(0);
    expect(freePF(s)).toBe(40);
  });
  it("accepts a valid allocation immutably", () => {
    const s = createInitialState("c");
    const next = setAllocation(s, { inference: 10, experiments: 6, safety: 4 });
    expect(next.allocation.inference).toBe(10);
    expect(s.allocation.inference).toBe(0); // original untouched
    expect(freePF(next)).toBe(20);
  });
  it("rejects over-allocation and negatives", () => {
    const s = createInitialState("c");
    expect(() => setAllocation(s, { inference: 41, experiments: 0, safety: 0 })).toThrow(/exceeds/);
    expect(() => setAllocation(s, { inference: -1, experiments: 0, safety: 0 })).toThrow(/negative/);
  });
});
