import { describe, it, expect } from "vitest";
import { eraForTurn, eraScalar, applyEraTransition } from "@/lib/engine/eras";
import { createInitialState } from "@/lib/engine/state";
import { launchRun } from "@/lib/engine/runs";
import { TECHNIQUES, ERA_BRIEFINGS } from "@/lib/engine/content";

describe("eras", () => {
  it("maps turns to eras", () => {
    expect(eraForTurn(1)).toBe(1);
    expect(eraForTurn(10)).toBe(1);
    expect(eraForTurn(11)).toBe(2);
    expect(eraForTurn(24)).toBe(2);
    expect(eraForTurn(25)).toBe(3);
    expect(eraForTurn(39)).toBe(4);
    expect(eraForTurn(48)).toBe(4);
  });
  it("transition flips era once and queues the briefing", () => {
    const s = { ...createInitialState("e"), turn: 11 };
    const out = applyEraTransition(s);
    expect(out.era).toBe(2);
    expect(out.pendingEraBriefing).toBe(2);
    expect(applyEraTransition(out).pendingEraBriefing).toBe(2); // idempotent, no double-fire
    expect(ERA_BRIEFINGS[2].title.length).toBeGreaterThan(0);
    expect(out.chronicle.some(c => c.kind === "world")).toBe(true);
  });
  it("later eras are meaner and richer", () => {
    expect(eraScalar("rivalJump", 4)).toBeGreaterThan(eraScalar("rivalJump", 1));
    expect(eraScalar("poachChance", 3)).toBeGreaterThan(1);
    expect(TECHNIQUES.filter(t => t.era === 2).length).toBeGreaterThanOrEqual(2);
    expect(TECHNIQUES.filter(t => t.era === 3).length).toBeGreaterThanOrEqual(2);
    expect(TECHNIQUES.filter(t => t.era === 4).some(t => t.id === "recursive-self-improvement")).toBe(true);
  });
  it("recursive self-improvement runs carry incident risk", () => {
    const s = {
      ...createInitialState("e"),
      era: 4 as const,
      facilities: [{ id: "big", name: "Big", capacityPF: 200, upkeepPerTurn: 0, onlineTurn: 1 }],
    };
    const out = launchRun(s, { name: "Basilisk", scaleTier: 2, techniqueIds: ["recursive-self-improvement"], leadId: null });
    expect(out.incidentRisk).toBeCloseTo(s.incidentRisk + 6, 5);
  });
});
