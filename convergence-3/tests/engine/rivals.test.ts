import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { advanceRivals, leaderboard, applyFastFollow, spawnWildcard } from "@/lib/engine/rivals";
import { BALANCE } from "@/lib/engine/balance";
import type { Model } from "@/lib/engine/types";

const model: Model = {
  id: "m",
  name: "Nimbus",
  createdTurn: 1,
  capability: { coding: 50, reasoning: 50, enterprise: 50, consumer: 50 },
  positioning: "api",
  deployedTurn: 1,
};

describe("rivals", () => {
  it("schedules hidden clocks deterministically, then releases", () => {
    let s = createInitialState("rv");
    s = advanceRivals(s).state;
    expect(s.rivals.filter(r => r.active).every(r => r.runFinishTurn !== null)).toBe(true);
    const first = Math.min(...s.rivals.filter(r => r.active).map(r => r.runFinishTurn!));
    const cur = { ...s, turn: first };
    const { state: after, releases } = advanceRivals(cur);
    expect(releases.length).toBeGreaterThan(0);
    expect(after.chronicle.some(c => c.kind === "rival")).toBe(true);
    // determinism
    expect(advanceRivals(cur).state).toEqual(after);
  });
  it("ranks the leaderboard with the player", () => {
    const s = { ...createInitialState("rv"), models: [model] };
    const lb = leaderboard(s);
    expect(lb.find(e => e.isPlayer)!.overall).toBe(50);
    expect(lb).toHaveLength(1 + s.rivals.filter(r => r.active).length);
    expect(lb[0].overall).toBeGreaterThanOrEqual(lb[lb.length - 1].overall);
  });
  it("fast-follow scales decay with rival pressure and spares open-weights", () => {
    const base = createInitialState("rv");
    const strongRivals = base.rivals.map(r => ({
      ...r,
      capability: { coding: 60, reasoning: 60, enterprise: 60, consumer: 60 },
    }));
    const s = {
      ...base,
      rivals: strongRivals,
      models: [model],
      revenueStreams: [
        { source: "Nimbus", amountPerTurn: 5, decayPerTurn: 0.06 },
        { source: "Nimbus-OW", amountPerTurn: 1, decayPerTurn: 0 },
      ],
    };
    const out = applyFastFollow(s);
    const activeCount = s.rivals.filter(r => r.active).length; // 4 — wildcard inactive
    const expected = Math.min(
      BALANCE.rivals.fastFollowBaseDecay + activeCount * BALANCE.rivals.fastFollowPerRival,
      BALANCE.rivals.fastFollowCap,
    );
    expect(out.revenueStreams[0].decayPerTurn).toBeCloseTo(expected, 5);
    expect(out.revenueStreams[0].decayPerTurn).toBeGreaterThan(0.06);
    expect(out.revenueStreams[1].decayPerTurn).toBe(0);
  });
  it("weak rivals apply only base decay", () => {
    const base = createInitialState("rv");
    const weakRivals = base.rivals.map(r => ({
      ...r,
      capability: { coding: 10, reasoning: 10, enterprise: 10, consumer: 10 },
    }));
    const s = {
      ...base,
      rivals: weakRivals,
      models: [model],
      revenueStreams: [{ source: "Nimbus", amountPerTurn: 5, decayPerTurn: 0.06 }],
    };
    expect(applyFastFollow(s).revenueStreams[0].decayPerTurn).toBeCloseTo(BALANCE.rivals.fastFollowBaseDecay, 5);
  });
  it("spawns the wildcard", () => {
    const s = spawnWildcard(createInitialState("rv"), "Dr. Imara Osei");
    const w = s.rivals.find(r => r.archetype === "wildcard")!;
    expect(w.active).toBe(true);
    expect(w.name).toContain("Imara");
  });
});
