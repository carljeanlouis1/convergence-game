import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { advanceTurn } from "@/lib/engine/turn";
import { resolveDilemma, getDilemmaDef } from "@/lib/engine/events";

describe("advanceTurn v2", () => {
  it("blocks on an active dilemma", () => {
    let s = createInitialState("v2");
    for (let i = 0; i < 8 && !s.activeDilemma; i++) s = advanceTurn(s);
    expect(s.activeDilemma).not.toBeNull();
    expect(() => advanceTurn(s)).toThrow(/resolve the dilemma/);
    const def = getDilemmaDef(s.activeDilemma!.defId);
    s = resolveDilemma(s, def.options[0].id).state;
    expect(() => advanceTurn(s)).not.toThrow();
  });
  it("a 20-turn campaign is deterministic and alive", () => {
    const play = () => {
      let s = createInitialState("campaign");
      for (let i = 0; i < 20; i++) {
        if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
        if (s.ended) break;
        s = advanceTurn(s);
      }
      return s;
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
    expect(a.chronicle.some(c => c.kind === "rival")).toBe(true); // rivals released something in 20 turns
    expect(a.rivals.filter(r => r.active).length).toBeGreaterThanOrEqual(4);
  });
  it("ending states stop the game", () => {
    const s = { ...createInitialState("end"), boardConfidence: 5, morale: 10 };
    const out = advanceTurn(s);
    expect(out.ending).toBe("ousted");
    expect(out.ended).toBe(true);
    expect(() => advanceTurn(out)).toThrow(/game ended/);
  });
  it("chronicle stays capped", () => {
    let s = createInitialState("cap");
    s = { ...s, chronicle: Array.from({ length: 80 }, (_, i) => ({ turn: 1, kind: "world" as const, text: `x${i}` })) };
    const out = advanceTurn(s);
    expect(out.chronicle.length).toBeLessThanOrEqual(60);
  });
});
