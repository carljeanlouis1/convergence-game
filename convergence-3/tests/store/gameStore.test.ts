// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, migrateSnapshot } from "@/lib/store/gameStore";

describe("game store", () => {
  beforeEach(() => useGameStore.getState().abandonGame());

  it("starts a new deterministic game", () => {
    useGameStore.getState().newGame("store-seed");
    expect(useGameStore.getState().game!.turn).toBe(1);
  });
  it("endTurn advances and records debrief", () => {
    useGameStore.getState().newGame("store-seed");
    useGameStore.getState().endTurn();
    const g = useGameStore.getState().game!;
    expect(g.turn).toBe(2);
    expect(g.lastDebrief).not.toBeNull();
  });
  it("captures engine errors instead of throwing", () => {
    useGameStore.getState().newGame("store-seed");
    useGameStore.getState().allocate({ inference: 999, experiments: 0, safety: 0 });
    expect(useGameStore.getState().lastError).toMatch(/exceeds/);
    expect(useGameStore.getState().game!.allocation.inference).toBe(0); // unchanged
  });
  it("clears lastError on the next successful action", () => {
    useGameStore.getState().newGame("store-seed");
    useGameStore.getState().allocate({ inference: 999, experiments: 0, safety: 0 });
    useGameStore.getState().allocate({ inference: 5, experiments: 0, safety: 0 });
    expect(useGameStore.getState().lastError).toBeNull();
    expect(useGameStore.getState().game!.allocation.inference).toBe(5);
  });
  it("resolving a dilemma through the store records outcome text", async () => {
    useGameStore.getState().newGame("store-v2");
    for (let i = 0; i < 8 && !useGameStore.getState().game!.activeDilemma; i++) {
      useGameStore.getState().endTurn();
    }
    const g = useGameStore.getState().game!;
    expect(g.activeDilemma).not.toBeNull();
    useGameStore.getState().endTurn(); // blocked
    expect(useGameStore.getState().lastError).toMatch(/resolve the dilemma/);
    const { getDilemmaDef } = await import("@/lib/engine/events");
    const def = getDilemmaDef(g.activeDilemma!.defId);
    useGameStore.getState().resolveActiveDilemma(def.options[0].id);
    expect(useGameStore.getState().lastOutcome!.length).toBeGreaterThan(0);
    expect(useGameStore.getState().game!.activeDilemma).toBeNull();
  });
  it("migrates unknown snapshots to null", () => {
    expect(migrateSnapshot({ whatever: true })).toEqual({ game: null });
    expect(migrateSnapshot(undefined)).toEqual({ game: null });
  });
});
