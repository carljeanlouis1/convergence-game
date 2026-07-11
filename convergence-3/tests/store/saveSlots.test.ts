// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { listSlots, saveToSlot, loadSlot, deleteSlot } from "@/lib/store/saveSlots";

describe("save slots", () => {
  beforeEach(() => localStorage.clear());

  it("saves, lists, loads, and deletes across three slots", () => {
    const a = { ...createInitialState("game-a"), turn: 5, capital: 90 };
    const b = { ...createInitialState("game-b"), turn: 20, capital: 300 };
    saveToSlot(1, a);
    saveToSlot(3, b);
    const slots = listSlots();
    expect(slots[0].meta!.seed).toBe("game-a");
    expect(slots[1].meta).toBeNull();
    expect(slots[2].meta!.turnText).toBe("2030 Q4");
    const loaded = loadSlot(1)!;
    expect(loaded.seed).toBe("game-a");
    expect(loaded.turn).toBe(5);
    deleteSlot(1);
    expect(listSlots()[0].meta).toBeNull();
    expect(loadSlot(1)).toBeNull();
  });

  it("migrates old-shape games stored in slots", () => {
    const g = structuredClone(createInitialState("old")) as unknown as Record<string, unknown>;
    for (const k of ["stats", "builds", "frontierProjects", "pendingEraBriefing", "endingResult", "pendingRelease"]) delete g[k];
    g.version = 2;
    localStorage.setItem("convergence3-save-slot-2", JSON.stringify({ meta: { seed: "old" }, game: g }));
    const loaded = loadSlot(2)!;
    expect(loaded.version).toBe(5);
    expect(loaded.stats.profitStreak).toBe(0);
  });

  it("overwriting a slot replaces it", () => {
    saveToSlot(2, { ...createInitialState("first"), turn: 2 });
    saveToSlot(2, { ...createInitialState("second"), turn: 9 });
    expect(loadSlot(2)!.seed).toBe("second");
  });
});
