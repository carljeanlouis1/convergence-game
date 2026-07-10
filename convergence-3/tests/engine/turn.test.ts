import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun } from "@/lib/engine/runs";
import { advanceTurn, turnLabel } from "@/lib/engine/turn";
import type { RunDesign } from "@/lib/engine/types";

describe("advanceTurn", () => {
  it("advances the clock and applies burn", () => {
    const s0 = createInitialState("t");
    const s1 = advanceTurn(s0);
    expect(s1.turn).toBe(2);
    expect(s1.capital).toBeLessThan(s0.capital); // pure burn at start
    expect(s1.lastDebrief!.turn).toBe(1);
    expect(s1.lastDebrief!.lines.some(l => l.kind === "finance")).toBe(true);
  });
  it("carries runs through the pipeline to completion", () => {
    const design: RunDesign = { name: "N", scaleTier: 1, techniqueIds: ["rlhf"], leadId: null };
    let s = launchRun(createInitialState("t2"), design);
    for (let i = 0; i < 3; i++) s = advanceTurn(s);
    expect(["completed", "failed"]).toContain(s.runs[0].status);
    if (s.runs[0].status === "completed") expect(s.models).toHaveLength(1);
    expect(s.lastDebrief!.lines.some(l => l.kind === "run")).toBe(true);
  });
  it("is deterministic end-to-end", async () => {
    const { resolveDilemma, getDilemmaDef } = await import("@/lib/engine/events");
    const play = () => {
      const design: RunDesign = { name: "N", scaleTier: 1, techniqueIds: ["dpo"], leadId: "star-jonas" };
      let s = launchRun(createInitialState("det"), design);
      for (let i = 0; i < 6; i++) {
        if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
        s = advanceTurn(s);
      }
      return s;
    };
    expect(play()).toEqual(play());
  });
  it("labels turns and ends the game", () => {
    expect(turnLabel(1)).toBe("2026 Q1");
    expect(turnLabel(5)).toBe("2027 Q1");
    let s = { ...createInitialState("end"), turn: 48 };
    s = advanceTurn(s);
    expect(s.ended).toBe(true);
    expect(() => advanceTurn(s)).toThrow(/game ended/);
  });
});
