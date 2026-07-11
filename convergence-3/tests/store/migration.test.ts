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
    expect(out.game!.version).toBe(6);
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
    expect(out.game!.version).toBe(6);
    expect(out.game!.stats.profitStreak).toBe(0);
    expect(out.game!.frontierProjects).toHaveLength(5);
  });
  it("hydrates an old localStorage snapshot without crashing (production bug repro)", async () => {
    // Simulates a save written by the Plan-1/2 deploys: persist wrapper version 1, old game shape.
    localStorage.setItem("convergence3-save", JSON.stringify({ state: { game: v1Game() }, version: 1 }));
    const { useGameStore } = await import("@/lib/store/gameStore");
    await useGameStore.persist.rehydrate();
    const g = useGameStore.getState().game;
    expect(g).not.toBeNull();
    expect(g!.version).toBe(6);
    expect(Array.isArray(g!.poachOffers)).toBe(true); // selectAlerts calls .filter on this
    expect(Array.isArray(g!.frontierProjects)).toBe(true); // RunsPanel calls .filter on this
    expect(g!.stats.profitStreak).toBe(0);
  });
  it("keeps v3 saves and rejects garbage", () => {
    expect(migrateSnapshot({ game: createInitialState("x") }).game!.seed).toBe("x");
    expect(migrateSnapshot({ nope: 1 })).toEqual({ game: null });
    expect(migrateSnapshot({ game: { version: 99 } })).toEqual({ game: null });
  });
});

describe("v5 → v6 migration", () => {
  it("backfills retiredTurn and researcher affinities", () => {
    const g = structuredClone(createInitialState("m6")) as unknown as Record<string, unknown>;
    (g.models as unknown[]) = [
      { id: "mm", name: "M", createdTurn: 1, capability: { coding: 50, reasoning: 50, enterprise: 50, consumer: 50 }, positioning: "api", deployedTurn: 2, lifetimeRevenue: 0, pricing: "standard", releaseRank: null },
    ];
    (g.stars as Array<Record<string, unknown>>).forEach(s => delete s.affinity);
    (g.market as Array<Record<string, unknown>>).forEach(c => delete c.affinity);
    g.version = 5;
    const out = migrateSnapshot({ game: g });
    expect(out.game!.version).toBe(6);
    expect(out.game!.models[0].retiredTurn).toBeNull();
    const imara = out.game!.stars.find(s => s.id === "star-imara");
    expect(imara!.affinity).toBe("rlvr");
  });
});

describe("v4 → v5 migration", () => {
  it("backfills research momentum", () => {
    const g = structuredClone(createInitialState("m5")) as unknown as Record<string, unknown>;
    delete g.researchMomentum;
    g.version = 4;
    const out = migrateSnapshot({ game: g });
    expect(out.game!.version).toBe(6);
    expect(out.game!.researchMomentum).toBe(0);
  });
});

describe("v3 → v4 migration", () => {
  it("backfills pricing, crowns, and release fields", () => {
    const g = structuredClone(createInitialState("m4")) as unknown as Record<string, unknown>;
    g.models = [
      {
        id: "m", name: "Old", createdTurn: 2,
        capability: { coding: 50, reasoning: 50, enterprise: 50, consumer: 50 },
        positioning: "api", deployedTurn: 3,
      },
    ];
    g.revenueStreams = [{ source: "Old", amountPerTurn: 5, decayPerTurn: 0.06 }];
    delete g.pendingRelease;
    delete (g.stats as Record<string, unknown>).crowns;
    g.version = 3;
    const out = migrateSnapshot({ game: g });
    expect(out.game!.version).toBe(6);
    expect(out.game!.models[0].lifetimeRevenue).toBe(0);
    expect(out.game!.models[0].pricing).toBe("standard");
    expect(out.game!.models[0].releaseRank).toBeNull();
    expect(out.game!.revenueStreams[0].pricing).toBe("standard");
    expect(out.game!.stats.crowns).toEqual([]);
    expect(out.game!.pendingRelease).toBeNull();
  });
});
