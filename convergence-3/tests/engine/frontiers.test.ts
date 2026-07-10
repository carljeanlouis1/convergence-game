import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { checkAgi, startFrontier, frontiersTurn } from "@/lib/engine/frontiers";
import { committedRunPF } from "@/lib/engine/compute";
import type { GameState, Model } from "@/lib/engine/types";

const agiModel: Model = {
  id: "agi",
  name: "Prometheus-9",
  createdTurn: 1,
  capability: { coding: 90, reasoning: 90, enterprise: 88, consumer: 86 },
  positioning: "api",
  deployedTurn: 1,
};

function era4State(seed: string): GameState {
  return {
    ...createInitialState(seed),
    era: 4,
    models: [agiModel],
    capital: 500,
    facilities: [{ id: "big", name: "Big", capacityPF: 200, upkeepPerTurn: 0, onlineTurn: 1 }],
  };
}

describe("applied frontiers", () => {
  it("detects AGI once and unlocks frontiers in era 4", () => {
    let s = era4State("fr");
    s = checkAgi(s);
    expect(s.stats.agiTurn).toBe(s.turn);
    expect(s.frontierProjects.every(p => p.status === "available")).toBe(true);
    expect(checkAgi(s).stats.agiTurn).toBe(s.turn); // stable
  });
  it("does not unlock outside era 4 even with AGI-level models", () => {
    let s: GameState = { ...era4State("fr"), era: 3 };
    s = checkAgi(s);
    expect(s.stats.agiTurn).not.toBeNull(); // AGI is AGI
    expect(s.frontierProjects.every(p => p.status === "locked")).toBe(true); // but frontiers wait for era 4
  });
  it("runs a frontier project to completion and pays off", () => {
    let s = checkAgi(era4State("fr"));
    s = startFrontier(s, "robotics");
    expect(s.capital).toBeCloseTo(500 - 80, 5);
    for (let i = 0; i < 6; i++) s = frontiersTurn({ ...s, turn: s.turn + 1 }).state;
    expect(s.frontierProjects.find(p => p.id === "robotics")!.status).toBe("completed");
    expect(s.revenueStreams.some(r => r.source.startsWith("Frontier:"))).toBe(true);
  });
  it("frontier compute is committed compute", () => {
    let s = checkAgi(era4State("fr"));
    s = startFrontier(s, "space");
    expect(committedRunPF(s)).toBe(60);
  });
  it("guards availability, capital, and compute", () => {
    const locked = era4State("fr"); // no checkAgi yet
    expect(() => startFrontier(locked, "robotics")).toThrow(/not available/);
    const s = checkAgi(era4State("fr"));
    expect(() => startFrontier({ ...s, capital: 10 }, "robotics")).toThrow(/insufficient capital/);
    expect(() =>
      startFrontier({ ...s, facilities: [{ id: "tiny", name: "T", capacityPF: 30, upkeepPerTurn: 0, onlineTurn: 1 }] }, "robotics"),
    ).toThrow(/insufficient free compute/);
  });
});
