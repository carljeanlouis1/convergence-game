// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { migrateSnapshot } from "@/lib/store/gameStore";
import { createInitialState } from "@/lib/engine/state";

function v1Game() {
  const g = structuredClone(createInitialState("mig")) as unknown as Record<string, unknown>;
  for (const k of [
    "rivals", "market", "poachOffers", "fundingOffers", "lastRaiseTurn", "fundingRound",
    "evalCapacity", "incidentRisk", "fireSaleCount", "activeDilemma", "usedDilemmas",
    "chronicle", "ending", "interimUntilTurn",
    "stats", "builds", "frontierProjects", "pendingEraBriefing", "endingResult",
  ]) {
    delete g[k];
  }
  g.version = 1;
  (g.stars as Array<Record<string, unknown>>).forEach(s => delete s.burnout);
  return g;
}

describe("save migration chain", () => {
  it("upgrades a v1 save all the way to v3", () => {
    const out = migrateSnapshot({ game: v1Game() });
    expect(out.game).not.toBeNull();
    expect(out.game!.version).toBe(3);
    expect(out.game!.rivals.length).toBeGreaterThanOrEqual(5);
    expect(out.game!.market.length).toBeGreaterThan(0);
    expect(out.game!.stars.every(s => s.burnout === 0)).toBe(true);
    expect(out.game!.ending).toBeNull();
    expect(out.game!.interimUntilTurn).toBeNull();
    expect(out.game!.stats.profitStreak).toBe(0);
    expect(out.game!.frontierProjects).toHaveLength(5);
  });
  it("upgrades v2 saves to v3 with stats backfilled", () => {
    const g = structuredClone(createInitialState("m3")) as unknown as Record<string, unknown>;
    for (const k of ["stats", "builds", "frontierProjects", "pendingEraBriefing", "endingResult"]) delete g[k];
    g.version = 2;
    const out = migrateSnapshot({ game: g });
    expect(out.game!.version).toBe(3);
    expect(out.game!.stats.profitStreak).toBe(0);
    expect(out.game!.frontierProjects).toHaveLength(5);
  });
  it("keeps v3 saves and rejects garbage", () => {
    expect(migrateSnapshot({ game: createInitialState("x") }).game!.seed).toBe("x");
    expect(migrateSnapshot({ nope: 1 })).toEqual({ game: null });
    expect(migrateSnapshot({ game: { version: 99 } })).toEqual({ game: null });
  });
});
