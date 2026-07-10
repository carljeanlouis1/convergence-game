import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { openRound } from "@/lib/engine/funding";
import { evaluateEndings, trajectory } from "@/lib/engine/endings";
import { TECHNIQUES } from "@/lib/engine/content";
import { BALANCE } from "@/lib/engine/balance";

describe("player-initiated funding", () => {
  it("opens a round on demand after the cooldown", () => {
    const s = { ...createInitialState("raise"), turn: 6, lastRaiseTurn: 0 };
    const out = openRound(s);
    expect(out.fundingOffers).toHaveLength(3);
    expect(() => openRound(out)).toThrow(/already open/);
  });
  it("enforces the cooldown", () => {
    const s = { ...createInitialState("raise"), turn: 3, lastRaiseTurn: 0 };
    expect(() => openRound(s)).toThrow(/too soon/);
  });
});

describe("figurehead governance floor", () => {
  it("control at the floor ends the run; above it does not", () => {
    const low = { ...createInitialState("fig"), control: BALANCE.endings.figureheadControl };
    expect(evaluateEndings(low)).toBe("figurehead");
    const ok = { ...createInitialState("fig"), control: 40 };
    expect(evaluateEndings(ok)).not.toBe("figurehead");
  });
  it("the compass warns about it", () => {
    const t = trajectory({ ...createInitialState("fig"), control: 22 });
    const fig = t.find(e => e.id === "figurehead")!;
    expect(fig.progress).toBeGreaterThan(0.5);
    expect(fig.pull).toMatch(/22/);
  });
});

describe("technique tree depth", () => {
  it("has 11 techniques spread across all four eras", () => {
    expect(TECHNIQUES.length).toBeGreaterThanOrEqual(11);
    for (const era of [1, 2, 3, 4]) {
      expect(TECHNIQUES.filter(t => t.era === era).length).toBeGreaterThanOrEqual(2);
    }
  });
});
