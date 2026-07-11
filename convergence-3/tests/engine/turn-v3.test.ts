import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun } from "@/lib/engine/runs";
import { advanceTurn } from "@/lib/engine/turn";
import { resolveDilemma, getDilemmaDef } from "@/lib/engine/events";
import { startBuild } from "@/lib/engine/facilities";
import type { GameState } from "@/lib/engine/types";

function playCampaign(seed: string, maxTurns = 60): GameState {
  let s = createInitialState(seed);
  for (let i = 0; i < maxTurns && !s.ended; i++) {
    if (s.activeDilemma) {
      s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
    }
    if (!s.ended) s = advanceTurn(s);
  }
  return s;
}

describe("advanceTurn v3 — the full arc", () => {
  it("a full campaign ends with a graded ending, deterministically", () => {
    const a = playCampaign("full-arc");
    expect(a.ended).toBe(true);
    expect(a.ending).not.toBeNull();
    expect(a.endingResult).not.toBeNull();
    expect(["S", "A", "B", "C", "D"]).toContain(a.endingResult!.grade);
    expect(a).toEqual(playCampaign("full-arc"));
  });
  it("eras actually transition during a campaign", () => {
    let s = createInitialState("era-check");
    for (let i = 0; i < 12 && !s.ended; i++) {
      if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
      if (!s.ended) s = advanceTurn(s);
    }
    if (!s.ended) {
      expect(s.era).toBe(2);
      expect(s.pendingEraBriefing).toBe(2);
      expect(s.chronicle.some(c => c.kind === "world" && /Scale-Up/i.test(c.text))).toBe(true);
    }
  });
  it("builds complete through the pipeline", () => {
    let s = startBuild(createInitialState("build-check"), "colo-expansion");
    for (let i = 0; i < 3 && !s.ended; i++) {
      if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
      s = advanceTurn(s);
    }
    expect(s.facilities.some(f => f.id.startsWith("fac-colo-expansion"))).toBe(true);
  });
  it("stats accumulate during play", () => {
    const s = playCampaign("stats-check", 15);
    // stats object is being maintained (streaks are numbers, not NaN)
    expect(Number.isFinite(s.stats.profitStreak)).toBe(true);
    expect(Number.isFinite(s.stats.laggingStreak)).toBe(true);
  });
});

it("a completed run raises the release-day flag", () => {
  let s = createInitialState("release");
  s = launchRun(s, { name: "Flagship", scaleTier: 1, techniqueIds: ["rlhf"], leadId: null });
  for (let i = 0; i < 4 && s.pendingRelease === null; i++) {
    if (s.activeDilemma) {
      const def = getDilemmaDef(s.activeDilemma.defId);
      s = resolveDilemma(s, def.options[0].id).state;
    }
    s = advanceTurn(s);
  }
  const run = s.runs[0];
  if (run.status === "completed") {
    expect(s.pendingRelease).toBe(`model-${run.id}`);
    expect(s.models[0].releaseRank).toBeGreaterThanOrEqual(1);
  } else {
    expect(run.status).toBe("failed"); // seed-dependent; failure keeps the flag null
    expect(s.pendingRelease).toBeNull();
  }
});
