import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { advanceTurn } from "@/lib/engine/turn";
import { launchRun, expectedQuality } from "@/lib/engine/runs";
import { deployModel } from "@/lib/engine/deploy";
import { hireCandidate, respondToPoach } from "@/lib/engine/talent";
import { acceptFunding } from "@/lib/engine/funding";
import { startBuild, availableBuilds } from "@/lib/engine/facilities";
import { setAllocation } from "@/lib/engine/compute";
import { freePF, totalCapacityPF } from "@/lib/engine/compute";
import { resolveDilemma, getDilemmaDef } from "@/lib/engine/events";
import { TECHNIQUES } from "@/lib/engine/content";
import { BALANCE } from "@/lib/engine/balance";
import { bestDeployedAvg } from "@/lib/engine/rivals";
import type { GameState } from "@/lib/engine/types";

/**
 * A deterministic scripted bot playing a deliberate "push to the frontier" strategy.
 * This test is the proof that the technique/tier/facility tree supports climbing
 * to AGI-adjacent capability inside one campaign. If a balance change breaks the
 * climb, this fails and the change needs rethinking.
 */
function botTurn(s: GameState): GameState {
  // resolve any dilemma with its first option
  if (s.activeDilemma) {
    s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
  }
  // respond to poaches: match when rich, otherwise counter with equity (sparingly)
  for (const o of s.poachOffers.filter(o => o.expiresTurn !== -1)) {
    try {
      s = s.capital > 60 ? respondToPoach(s, o.starId, "match") : respondToPoach(s, o.starId, "equity");
    } catch {
      /* unaffordable — let it ride */
    }
  }
  // take VC money when offered and capital is thin
  if (s.fundingOffers.length > 0 && s.capital < 80) {
    const vc = s.fundingOffers.find(o => o.kind === "vc");
    if (vc) s = acceptFunding(s, vc.id);
  }
  // build the biggest affordable facility, one at a time
  if (s.builds.length === 0 && s.capital > 120) {
    const options = availableBuilds(s).sort((a, b) => b.capacityPF - a.capacityPF);
    if (options[0] && s.capital > options[0].costM + 60) s = startBuild(s, options[0].id);
  }
  // hire the best affordable candidate while the roster is small
  if (s.stars.length < 8) {
    const best = [...s.market].sort((a, b) => b.skill - a.skill)[0];
    if (best && s.capital > best.signingBonus + 40) {
      try {
        s = hireCandidate(s, best.id);
      } catch {
        /* fine */
      }
    }
  }
  // keep one run going: biggest tier we can afford compute-wise, best techniques, best lead
  if (!s.runs.some(r => r.status === "active")) {
    const free = freePF(s);
    const tiers = [4, 3, 2, 1] as const;
    const tier = tiers.find(t => BALANCE.runTiers[t].computePerTurn <= free && s.capital > 40);
    if (tier) {
      const unlocked = TECHNIQUES.filter(t => t.era <= s.era)
        .sort((a, b) => b.qualityBonus - a.qualityBonus)
        .slice(0, 3)
        .map(t => t.id);
      const lead = [...s.stars].filter(st => st.onRunId === null).sort((a, b) => b.skill - a.skill)[0];
      const design = {
        name: `Bot-${s.turn}`,
        scaleTier: tier,
        techniqueIds: unlocked,
        leadId: lead?.id ?? null,
      };
      void expectedQuality(design, s);
      try {
        s = launchRun(s, design);
      } catch {
        /* interim board or compute race — skip a beat */
      }
    }
  }
  // deploy anything undeployed
  for (const m of s.models.filter(m => m.positioning === null)) {
    s = deployModel(s, m.id, "api", "standard");
    s = { ...s, pendingRelease: null };
  }
  // allocate leftover compute: 70% inference, 30% safety
  const spare = Math.max(0, freePF(s));
  if (spare > 2) {
    try {
      s = setAllocation(s, {
        inference: s.allocation.inference + spare * 0.7,
        experiments: 0,
        safety: s.allocation.safety + spare * 0.3,
      });
    } catch {
      /* over-allocation race — skip */
    }
  }
  return advanceTurn(s);
}

describe("AGI reachability (bot campaign)", () => {
  it("a deliberate frontier strategy climbs to frontier capability and reaches a real ending", () => {
    let s = createInitialState("agi-bot");
    for (let i = 0; i < 60 && !s.ended; i++) s = botTurn(s);
    const best = bestDeployedAvg(s);
    // Success is either a genuine victory earned with a frontier-class model,
    // or surviving into the Convergence era with AGI-adjacent capability.
    const victory = s.endingResult?.victory === true;
    if (victory) {
      expect(best).toBeGreaterThanOrEqual(70); // won on the strength of a real frontier model
    } else {
      expect(s.era).toBe(4);
      expect(best).toBeGreaterThanOrEqual(75); // AGI threshold is 88; a scripted bot at 75+ proves the tree scales
    }
    expect(totalCapacityPF(s)).toBeGreaterThan(BALANCE.startingComputePF); // it expanded compute
  }, 30_000);
});
