import { describe, it, expect } from "vitest";
import { makeRng, rollRange, pick, gaussian } from "@/lib/engine/rng";

describe("rng", () => {
  it("is deterministic for identical parts", () => {
    const a = makeRng("seed-1", 7, "runs");
    const b = makeRng("seed-1", 7, "runs");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("differs across salts", () => {
    expect(makeRng("seed-1", 7, "runs")()).not.toBe(makeRng("seed-1", 7, "news")());
  });
  it("stays in [0,1)", () => {
    const r = makeRng("bounds");
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("rollRange and pick respect bounds", () => {
    const r = makeRng("x");
    for (let i = 0; i < 100; i++) {
      const v = rollRange(r, 5, 9);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(9);
    }
    expect(["a", "b"]).toContain(pick(makeRng("y"), ["a", "b"] as const));
  });
  it("gaussian roughly centers on mean", () => {
    const r = makeRng("g");
    const n = 2000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += gaussian(r, 50, 10);
    expect(Math.abs(sum / n - 50)).toBeLessThan(1.5);
  });
});
