import { BALANCE } from "./balance";
import { eraScalar } from "./eras";
import { gaussian, makeRng, rollRange } from "./rng";
import type { BenchCategory, GameState, Rival } from "./types";

const CATEGORIES: BenchCategory[] = ["coding", "reasoning", "enterprise", "consumer"];

function avg(cap: Record<BenchCategory, number>): number {
  return (cap.coding + cap.reasoning + cap.enterprise + cap.consumer) / 4;
}

export function bestDeployedAvg(state: GameState): number {
  const deployed = state.models.filter(m => m.positioning !== null);
  if (!deployed.length) return 0;
  return Math.max(...deployed.map(m => avg(m.capability)));
}

export function advanceRivals(state: GameState): { state: GameState; releases: string[] } {
  const B = BALANCE.rivals;
  const releases: string[] = [];
  const chronicle = [...state.chronicle];
  const rivals = state.rivals.map(rival => {
    if (!rival.active) return rival;
    const rng = makeRng(state.seed, state.turn, "rival", rival.id);
    if (rival.runFinishTurn === null) {
      return {
        ...rival,
        runFinishTurn: state.turn + Math.floor(rollRange(rng, B.runDurationMin, B.runDurationMax + 1)),
      };
    }
    if (rival.runFinishTurn > state.turn) return rival;
    // release: jump 1-2 categories, biased toward the strongest
    const sorted = [...CATEGORIES].sort((a, b) => rival.capability[b] - rival.capability[a]);
    const jumpCount = rng() < 0.5 ? 1 : 2;
    const capability = { ...rival.capability };
    const jumped: BenchCategory[] = [];
    for (let i = 0; i < jumpCount; i++) {
      const cat = sorted[i];
      const jump =
        (B.jumpBase + rival.aggression * B.jumpAggressionWeight) * eraScalar("rivalJump", state.era) +
        gaussian(rng, 0, B.jumpNoiseSd);
      capability[cat] = Math.max(0, Math.min(100, capability[cat] + Math.max(1, jump)));
      jumped.push(cat);
    }
    const headline = `${rival.name} ships a new model — ${jumped.join(" and ")} capability jumps.`;
    releases.push(headline);
    chronicle.push({ turn: state.turn, kind: "rival", text: headline });
    return { ...rival, capability, runFinishTurn: null, lastRelease: headline };
  });
  return { state: { ...state, rivals, chronicle }, releases };
}

export function leaderboard(
  state: GameState,
): Array<{ id: string; name: string; overall: number; isPlayer: boolean }> {
  const entries = [
    { id: "player", name: "Your Lab", overall: bestDeployedAvg(state), isPlayer: true },
    ...state.rivals
      .filter(r => r.active)
      .map(r => ({ id: r.id, name: r.name, overall: avg(r.capability), isPlayer: false })),
  ];
  return entries.sort((a, b) => b.overall - a.overall);
}

export function categoryLeaders(
  state: GameState,
): Record<BenchCategory, { name: string; value: number; isPlayer: boolean; modelId: string | null }> {
  const result = {} as Record<BenchCategory, { name: string; value: number; isPlayer: boolean; modelId: string | null }>;
  const deployed = state.models.filter(m => m.positioning !== null);
  for (const cat of CATEGORIES) {
    let best = { name: "—", value: 0, isPlayer: false, modelId: null as string | null };
    for (const r of state.rivals) {
      if (r.active && r.capability[cat] > best.value) {
        best = { name: r.name, value: r.capability[cat], isPlayer: false, modelId: null };
      }
    }
    for (const m of deployed) {
      if (m.capability[cat] > best.value) {
        best = { name: m.name, value: m.capability[cat], isPlayer: true, modelId: m.id };
      }
    }
    result[cat] = best;
  }
  return result;
}

export function isEclipsed(state: GameState, modelId: string): boolean {
  const model = state.models.find(m => m.id === modelId);
  if (!model) return false;
  const mAvg = avg(model.capability);
  return state.rivals.some(r => r.active && avg(r.capability) > mAvg);
}

export function applyFastFollow(state: GameState): GameState {
  const B = BALANCE.rivals;
  const revenueStreams = state.revenueStreams.map(stream => {
    if (stream.decayPerTurn === 0) return stream; // open-weights: permanent
    const model = state.models.find(m => m.name === stream.source);
    if (!model) return stream;
    const modelAvg = avg(model.capability);
    const pressure = state.rivals.filter(
      r => r.active && avg(r.capability) >= modelAvg * B.fastFollowThreshold,
    ).length;
    const pricingDecayMult = BALANCE.finance.pricingMultipliers[stream.pricing ?? "standard"].decay;
    return {
      ...stream,
      decayPerTurn:
        Math.min(
          (B.fastFollowBaseDecay + pressure * B.fastFollowPerRival) * eraScalar("fastFollow", state.era),
          B.fastFollowCap,
        ) * pricingDecayMult,
    };
  });
  return { ...state, revenueStreams };
}

export function spawnWildcard(state: GameState, foundedBy: string): GameState {
  const firstName = foundedBy.split(" ").slice(-2).join(" ");
  const name = `${firstName}'s New Lab`;
  const rivals = state.rivals.map(r =>
    r.archetype === "wildcard" && !r.active ? { ...r, active: true, name } : r,
  );
  const changed = rivals.some((r, i) => r !== state.rivals[i]);
  if (!changed) return state;
  return {
    ...state,
    rivals,
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "rival", text: `${name} announces itself — founded by your former researchers.` },
    ],
  };
}
