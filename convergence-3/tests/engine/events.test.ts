import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { maybeOpenDilemma, resolveDilemma, getDilemmaDef } from "@/lib/engine/events";
import { DILEMMAS } from "@/lib/engine/content";

describe("dilemmas", () => {
  it("has 8 era-appropriate defs with valid weights", () => {
    expect(DILEMMAS.length).toBeGreaterThanOrEqual(8);
    for (const d of DILEMMAS) {
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      for (const o of d.options) {
        expect(o.outcomes.reduce((a, x) => a + x.chance, 0)).toBeGreaterThan(0);
        expect(o.note.length).toBeGreaterThan(0);
      }
    }
  });
  it("opens on cadence turns only, never repeats, resolves with clamped deltas", () => {
    let s = { ...createInitialState("d"), turn: 4 };
    s = maybeOpenDilemma(s);
    expect(s.activeDilemma).not.toBeNull();
    const def = getDilemmaDef(s.activeDilemma!.defId);
    const { state: after, outcomeText } = resolveDilemma(s, def.options[0].id);
    expect(outcomeText.length).toBeGreaterThan(0);
    expect(after.activeDilemma).toBeNull();
    expect(after.usedDilemmas).toContain(def.id);
    expect(after.trust).toBeGreaterThanOrEqual(0);
    expect(after.trust).toBeLessThanOrEqual(100);
    expect(after.chronicle.some(c => c.kind === "dilemma")).toBe(true);
    // same seed+turn → same pick (determinism)
    expect(maybeOpenDilemma({ ...createInitialState("d"), turn: 4 }).activeDilemma!.defId).toBe(def.id);
    // odd turn → nothing opens
    expect(maybeOpenDilemma({ ...createInitialState("d"), turn: 5 }).activeDilemma).toBeNull();
    // used dilemma never reopens
    const reopened = maybeOpenDilemma({ ...after, turn: after.turn + 2, activeDilemma: null });
    expect(reopened.activeDilemma?.defId).not.toBe(def.id);
  });
  it("throws on bad resolutions", () => {
    const s = createInitialState("d");
    expect(() => resolveDilemma(s, "whatever")).toThrow(/no active dilemma/);
    const open = maybeOpenDilemma({ ...s, turn: 4 });
    expect(() => resolveDilemma(open, "not-an-option")).toThrow(/unknown option/);
    expect(() => getDilemmaDef("nope")).toThrow(/unknown dilemma/);
  });
});
