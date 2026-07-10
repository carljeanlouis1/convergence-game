# Convergence 3 — Plan 2: The Living World

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Era-1 slice into a living race: 5 rival labs on hidden clocks with a category leaderboard and fast-follow erosion, an honest talent market with poaching raids and burnout, funding rounds with control costs and coup/fire-sale governance, safety tiers with incident risk, and an authored dilemma system.

**Architecture:** Five new pure engine modules (`rivals`, `talent`, `funding`, `safety`, `events`) slot into the existing `advanceTurn` pipeline in a fixed order; the flat revenue decay from Plan 1 is replaced by rival-driven fast-follow. Save format bumps to version 2 with a real migration. UI grows two panels (Race, Talent), a blocking dilemma modal, and funding/safety surfaces.

**Tech Stack:** unchanged — Next.js 16 static export · TypeScript strict · Zustand 5 · Vitest · wrangler.

## Global Constraints

- All Plan-1 global constraints hold (engine purity, BALANCE-only tunables, $M/PF units, seeded RNG only, no LLM calls, `npx vitest run` from `convergence-3/`).
- Save version bumps 1 → 2; `migrateSnapshot` must upgrade v1 saves by backfilling new fields — never discard a v1 game.
- Transparency law: hidden state (rival clocks, incident risk) surfaces as qualitative bands/feeds, never raw numbers; every offer shows its full terms before acceptance.
- An active dilemma blocks `advanceTurn` (engine throws `"resolve the dilemma first"`); the UI must make resolution unavoidable, not skippable.
- Deploy at the end with `npx wrangler pages deploy out --project-name convergence-3 --branch=main` (production branch gotcha per cloudflare-deploy-verify).
- Do not push; commit per task on branch `c3-plan-2`.

## File Structure

```
lib/engine/types.ts        # MODIFY: Rival, Candidate, PoachOffer, FundingOffer, dilemma + chronicle types, GameState v2
lib/engine/balance.ts      # MODIFY: rivals/talent/funding/safety/events sections
lib/engine/content.ts      # MODIFY: RIVALS, CANDIDATE_POOL, DILEMMAS exports appended
lib/engine/rivals.ts       # NEW: advanceRivals, leaderboard, applyFastFollow, spawnWildcard
lib/engine/talent.ts       # NEW: market churn, hire, poach offers/responses, burnout/morale, departures
lib/engine/funding.ts      # NEW: offer generation, acceptFunding, board drift, coup, fire-sale chain
lib/engine/safety.ts       # NEW: capability tiers, eval capacity, deployment risk band, incident roll
lib/engine/events.ts       # NEW: dilemma trigger selection + resolution rolls
lib/engine/state.ts        # MODIFY: v2 initial fields
lib/engine/turn.ts         # MODIFY: full pipeline ordering + new debrief lines
lib/store/gameStore.ts     # MODIFY: version 2 + migration + new actions
lib/store/selectors.ts     # MODIFY: leaderboard/talent/alert selectors
components/shell/NavRail.tsx        # MODIFY: 6 panels
components/shell/GameShell.tsx      # MODIFY: new panels, DilemmaModal mount, end-turn guard UX
components/panels/RaceBoardPanel.tsx  # NEW
components/panels/TalentPanel.tsx     # NEW
components/panels/FinancePanel.tsx    # MODIFY: funding offers section
components/panels/ComputePanel.tsx    # MODIFY: safety readout on the safety segment
components/modals/DilemmaModal.tsx    # NEW
tests/engine/{rivals,talent,funding,safety,events,turn-v2}.test.ts  # NEW
tests/store/migration.test.ts         # NEW
```

---

### Task 1: Types v2, balance sections, migration

**Files:**
- Modify: `lib/engine/types.ts`, `lib/engine/balance.ts`, `lib/engine/state.ts`, `lib/store/gameStore.ts`
- Test: `tests/store/migration.test.ts`

**Interfaces (produced — every later task consumes these exactly):**

Append to `types.ts`:
```ts
export type RivalArchetype = "scaler" | "safety" | "state" | "open" | "wildcard";

export interface Rival {
  id: string; name: string; archetype: RivalArchetype;
  aggression: number;            // 1-10, drives run cadence + jump size
  capability: Record<BenchCategory, number>;
  runFinishTurn: number | null;  // hidden clock; UI never shows this
  lastRelease: string | null;    // headline of most recent release
  active: boolean;               // wildcard slot starts inactive
}

export interface Candidate {
  id: string; name: string; specialty: BenchCategory; skill: number;
  salaryPerQuarter: number; signingBonus: number; exitTurn: number; // leaves market after
}

export interface PoachOffer { starId: string; rivalId: string; packageM: number; expiresTurn: number; }

export type FundingKind = "vc" | "strategic" | "mission";
export interface FundingOffer {
  id: string; kind: FundingKind; amountM: number; controlCost: number;
  boardDelta: number; trustDelta: number; computeGrantPF: number; expiresTurn: number;
}

export interface DilemmaOptionOutcome {
  chance: number;                 // weights within an option, sum need not be 1
  text: string;
  deltas: Partial<{ capital: number; trust: number; boardConfidence: number; control: number; morale: number; incidentRisk: number; teamStrength: number }>;
}
export interface DilemmaOption { id: string; label: string; note: string; outcomes: DilemmaOptionOutcome[]; }
export interface DilemmaDef {
  id: string; era: 1 | 2 | 3 | 4; title: string; body: string;
  options: DilemmaOption[];
  trigger?: (state: GameState) => boolean;   // optional extra gate beyond era
}
export interface ActiveDilemma { defId: string; openedTurn: number; }
export interface ChronicleEntry { turn: number; kind: "rival" | "talent" | "funding" | "safety" | "dilemma" | "world"; text: string; }
```
`DebriefLine["kind"]` union widens to `"finance" | "run" | "compute" | "world" | "rival" | "talent" | "safety" | "funding"`.

`GameState` gains (all required):
```ts
  rivals: Rival[]; market: Candidate[]; poachOffers: PoachOffer[];
  fundingOffers: FundingOffer[]; lastRaiseTurn: number; fundingRound: number;
  evalCapacity: number; incidentRisk: number; fireSaleCount: number;
  activeDilemma: ActiveDilemma | null; usedDilemmas: string[];
  chronicle: ChronicleEntry[]; ending: string | null;
```
`Star` gains `burnout: number` (0-100). `version` becomes `1 | 2` in the type; new states are created at `2`.

Append to `BALANCE`:
```ts
  rivals: {
    runDurationMin: 3, runDurationMax: 6,
    jumpBase: 4, jumpAggressionWeight: 0.9, jumpNoiseSd: 3,
    fastFollowBaseDecay: 0.03, fastFollowPerRival: 0.03, fastFollowCap: 0.16,
    fastFollowThreshold: 0.9,   // rival avg >= model avg * this → applies pressure
    wildcardCapabilityStart: 30,
  },
  talent: {
    marketSize: 4, marketChurnChance: 0.3, candidateExitAfter: 4,
    poachBaseChance: 0.1, poachAggressionWeight: 0.015, poachExpiry: 2,
    poachPackageBase: 8, poachPackageSkillWeight: 3,
    matchCostFactor: 0.6,       // match = package * this, paid once
    equityControlCost: 1.5,     // counter-with-equity control cost
    declineMoraleHit: 8, departRivalCapGain: 2,
    burnoutPerRunTurn: 8, burnoutRecovery: 6, burnoutExodusThreshold: 90, exodusChance: 0.5,
    hireTeamStrength: 3, departTeamStrength: 3,
    runFailMorale: 6, runCompleteMorale: 5,
    wildcardSpawnDepartures: 3, // cumulative star departures that activate the wildcard rival
  },
  funding: {
    offerRunwayTrigger: 12, offerCadence: 10, offerExpiry: 3,
    valuationCapWeight: 1.6, valuationRevenueWeight: 9, valuationTrustWeight: 0.4,
    vc:       { amountFactor: 0.22, controlCost: 8,  boardDelta: 5,  trustDelta: 0,  computeGrantPF: 0 },
    strategic:{ amountFactor: 0.32, controlCost: 12, boardDelta: 3,  trustDelta: -3, computeGrantPF: 20 },
    mission:  { amountFactor: 0.15, controlCost: 4,  boardDelta: 0,  trustDelta: 5,  computeGrantPF: 0 },
    boardNetPositive: 3, boardTop2Bonus: 2, boardLowRunway: -4, boardVeryLowRunway: -3, boardIncident: -5,
    coupThreshold: 20, coupSurviveMorale: 60, coupInterimMorale: 40,
    coupSurviveBoardReset: 45, coupSurviveControlCost: 5, interimRunTierCap: 2, interimTurns: 6,
    fireSaleFacilityFraction: 0.25, fireSaleCapitalRecovery: 0.55, fireSaleDownRoundControl: 20,
  },
  safety: {
    tierThresholds: { t1: 40, t2: 55, t3: 70 },   // max deployed-model avg capability
    requiredEval: { t0: 0, t1: 10, t2: 25, t3: 50 },
    evalPerSafetyPF: 0.5, evalDecay: 0.1,
    riskPerEvalGap: 0.4, incidentChancePerRisk: 0.01,
    incidentTrustHit: 12, incidentBoardHit: 8, incidentRevenueHit: 0.3, incidentRiskRelief: 0.5,
    safetyTrustDriftPerPF: 0.05,
  },
  events: { cadence: 2 },   // dilemmas may open on turns divisible by this
```

`state.ts` — `createInitialState` returns `version: 2` plus: `rivals: structuredClone(RIVALS)`, `market: initialMarket(seed)` (first `marketSize` entries of the candidate pool with `exitTurn = 1 + candidateExitAfter`), `poachOffers: []`, `fundingOffers: []`, `lastRaiseTurn: 0`, `fundingRound: 0`, `evalCapacity: 0`, `incidentRisk: 0`, `fireSaleCount: 0`, `activeDilemma: null`, `usedDilemmas: []`, `chronicle: []`, `ending: null`; every starting star gets `burnout: 0`.

`gameStore.ts` — persist `version: 2`; `migrateSnapshot` upgrades v1: spreads the v1 game and fills every new field with the same defaults (wildcard rival included, `version: 2`), stars mapped to add `burnout: 0`. Unknown/other shapes still → `{ game: null }`.

- [ ] **Step 1: Write the failing migration test**

`tests/store/migration.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { migrateSnapshot } from "@/lib/store/gameStore";
import { createInitialState } from "@/lib/engine/state";

function v1Game() {
  const g = structuredClone(createInitialState("mig")) as Record<string, unknown>;
  // strip every v2 field to simulate a Plan-1 save
  for (const k of ["rivals","market","poachOffers","fundingOffers","lastRaiseTurn","fundingRound",
    "evalCapacity","incidentRisk","fireSaleCount","activeDilemma","usedDilemmas","chronicle","ending"]) delete g[k];
  g.version = 1;
  (g.stars as Array<Record<string, unknown>>).forEach(s => delete s.burnout);
  return g;
}

describe("v1 → v2 migration", () => {
  it("upgrades a v1 save with backfilled fields", () => {
    const out = migrateSnapshot({ game: v1Game() });
    expect(out.game).not.toBeNull();
    expect(out.game!.version).toBe(2);
    expect(out.game!.rivals.length).toBeGreaterThanOrEqual(5);
    expect(out.game!.market.length).toBeGreaterThan(0);
    expect(out.game!.stars.every(s => s.burnout === 0)).toBe(true);
    expect(out.game!.ending).toBeNull();
  });
  it("keeps v2 saves and rejects garbage", () => {
    expect(migrateSnapshot({ game: createInitialState("x") }).game!.seed).toBe("x");
    expect(migrateSnapshot({ nope: 1 })).toEqual({ game: null });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/store/migration.test.ts` → FAIL.
- [ ] **Step 3: Implement** types + balance + state fields + migration exactly as specified in Interfaces. Content for `RIVALS`/`CANDIDATE_POOL` arrives in Tasks 2/4 — for this task add them to `content.ts` as minimal valid arrays (5 rivals incl. inactive wildcard, 8 candidates) so state builds; Tasks 2/4 flesh out stats.
- [ ] **Step 4: Full suite green + tsc clean** — existing 45 tests must still pass (they construct states via factories, so new required fields flow through `createInitialState`).
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): v2 types, balance, save migration"`

---

### Task 2: Rivals — hidden clocks, releases, leaderboard

**Files:**
- Create: `lib/engine/rivals.ts`
- Modify: `lib/engine/content.ts` (full `RIVALS`)
- Test: `tests/engine/rivals.test.ts`

**Interfaces:**
- Consumes: `makeRng/gaussian/rollRange/pick`, `BALANCE.rivals`, types from Task 1.
- Produces:
  - `RIVALS: Rival[]` in content.ts — Velocity Systems (scaler, aggression 9), Prometheus Institute (safety, 5), Zhongguancun Frontier (state, 7), OpenCollective (open, 6), and `wildcard` (inactive, aggression 8, capability all `wildcardCapabilityStart`). Starting capabilities in the 30–45 range, each rival strongest in a different category.
  - `advanceRivals(state: GameState): { state: GameState; releases: string[] }` — for each active rival: if `runFinishTurn === null`, schedule one at `turn + int(rollRange(rng, runDurationMin, runDurationMax+1))`; if `runFinishTurn <= turn`, release: pick 1–2 categories (strongest-biased), jump each by `jumpBase + aggression*jumpAggressionWeight + gaussian(0, jumpNoiseSd)` (clamp 0–100), set `lastRelease` to a headline like `"Velocity Systems ships Velocity-4 — coding capability jumps"`, clear the clock, and append the headline to `releases` and `state.chronicle` (kind "rival"). RNG: `makeRng(seed, turn, "rival", rival.id)`.
  - `leaderboard(state: GameState): Array<{ id: string; name: string; overall: number; isPlayer: boolean }>` — player overall = best deployed model avg (0 if none); rivals = capability avg; sorted desc.
  - `applyFastFollow(state: GameState): GameState` — for each revenue stream with `decayPerTurn > 0` (open-weights streams keep 0): find its model by `stream.source === model.name`; pressure = count of active rivals with capability avg ≥ model avg × `fastFollowThreshold`; set `decayPerTurn = min(fastFollowBaseDecay + pressure * fastFollowPerRival, fastFollowCap)`.
  - `spawnWildcard(state: GameState, foundedBy: string): GameState` — activates the wildcard rival, names it `"${foundedBy}'s New Lab"` → set `name`, `active: true`, chronicle entry (kind "rival").

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { advanceRivals, leaderboard, applyFastFollow, spawnWildcard } from "@/lib/engine/rivals";
import { BALANCE } from "@/lib/engine/balance";
import type { Model } from "@/lib/engine/types";

const model: Model = { id: "m", name: "Nimbus", createdTurn: 1,
  capability: { coding: 50, reasoning: 50, enterprise: 50, consumer: 50 }, positioning: "api", deployedTurn: 1 };

describe("rivals", () => {
  it("schedules hidden clocks deterministically, then releases", () => {
    let s = createInitialState("rv");
    s = advanceRivals(s).state;
    expect(s.rivals.filter(r => r.active).every(r => r.runFinishTurn !== null)).toBe(true);
    // fast-forward to the earliest clock and confirm a release fires
    const first = Math.min(...s.rivals.filter(r => r.active).map(r => r.runFinishTurn!));
    let cur = { ...s, turn: first };
    const { state: after, releases } = advanceRivals(cur);
    expect(releases.length).toBeGreaterThan(0);
    expect(after.chronicle.some(c => c.kind === "rival")).toBe(true);
  });
  it("ranks the leaderboard with the player", () => {
    const s = { ...createInitialState("rv"), models: [model] };
    const lb = leaderboard(s);
    expect(lb.find(e => e.isPlayer)!.overall).toBe(50);
    expect(lb).toHaveLength(1 + s.rivals.filter(r => r.active).length);
    expect(lb[0].overall).toBeGreaterThanOrEqual(lb[lb.length - 1].overall);
  });
  it("fast-follow scales decay with rival pressure and spares open-weights", () => {
    const base = createInitialState("rv");
    const strongRivals = base.rivals.map(r => ({ ...r, capability: { coding: 60, reasoning: 60, enterprise: 60, consumer: 60 } }));
    const s = { ...base, rivals: strongRivals, models: [model],
      revenueStreams: [{ source: "Nimbus", amountPerTurn: 5, decayPerTurn: 0.06 }, { source: "Nimbus-OW", amountPerTurn: 1, decayPerTurn: 0 }] };
    const out = applyFastFollow(s);
    expect(out.revenueStreams[0].decayPerTurn).toBeCloseTo(BALANCE.rivals.fastFollowCap, 5);
    expect(out.revenueStreams[1].decayPerTurn).toBe(0);
  });
  it("spawns the wildcard", () => {
    const s = spawnWildcard(createInitialState("rv"), "Dr. Imara Osei");
    const w = s.rivals.find(r => r.archetype === "wildcard")!;
    expect(w.active).toBe(true);
    expect(w.name).toContain("Imara");
  });
});
```

- [ ] **Step 2: verify failure. Step 3: implement per Interfaces. Step 4: suite green. Step 5: commit** `feat(c3): rival labs — hidden clocks, releases, leaderboard, fast-follow`

---

### Task 3: Talent — market, hiring, poaching, burnout

**Files:**
- Create: `lib/engine/talent.ts`
- Modify: `lib/engine/content.ts` (full `CANDIDATE_POOL`: 14 authored candidates, varied specialties/skill 4–9, salaries 0.4–1.6, bonuses 1–12)
- Test: `tests/engine/talent.test.ts`

**Interfaces:**
- Produces:
  - `hireCandidate(state, candidateId): GameState` — throws `"candidate gone"` if absent, `"insufficient capital"` if `capital < signingBonus`. Adds star (`burnout: 0, onRunId: null`), removes from market, `capital -= signingBonus`, `teamStrength += hireTeamStrength` (cap 100), chronicle (kind "talent").
  - `respondToPoach(state, starId, response: "match" | "equity" | "decline"): GameState` — offer must exist (`"no active offer"`). match: `capital -= offer.packageM * matchCostFactor` (guard `"insufficient capital"`), star salary += 20%. equity: `control -= equityControlCost`. decline: star removed next `talentTurn` (mark via `offer.expiresTurn = -1` sentinel meaning "accepted by star"). All: offer removed (decline keeps sentinel), chronicle.
  - `talentTurn(state): { state: GameState; lines: string[] }` — in order: (1) departures: stars with a `-1`-sentinel offer leave — remove star, `teamStrength -= departTeamStrength`, rival gains `departRivalCapGain` in star's specialty, `morale -= declineMoraleHit`, count cumulative departures in `chronicle` and if they reach `wildcardSpawnDepartures` and wildcard inactive → `spawnWildcard(state, lastDeparter.name)`; (2) burnout drift: `+burnoutPerRunTurn` if on a run else `-burnoutRecovery` (clamp 0–100); stars over `burnoutExodusThreshold` roll `exodusChance` → leave (same departure effects); (3) expire stale poach offers; (4) generate ≤1 new poach offer: chance `poachBaseChance + topRival.aggression * poachAggressionWeight`, target = random star (poachable if no active offer), package = `poachPackageBase + skill * poachPackageSkillWeight`, from a random active rival; (5) market churn: drop candidates past `exitTurn`, then with `marketChurnChance` add next unused candidate from `CANDIDATE_POOL` until `marketSize`. RNG: `makeRng(seed, turn, "talent")`. Every event emits a line.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { hireCandidate, respondToPoach, talentTurn } from "@/lib/engine/talent";
import { BALANCE } from "@/lib/engine/balance";

describe("talent", () => {
  it("hires from the market for the signing bonus", () => {
    const s = createInitialState("t");
    const c = s.market[0];
    const out = hireCandidate(s, c.id);
    expect(out.stars.some(st => st.id === c.id)).toBe(true);
    expect(out.capital).toBeCloseTo(s.capital - c.signingBonus, 5);
    expect(out.market.some(m => m.id === c.id)).toBe(false);
    expect(() => hireCandidate(out, c.id)).toThrow(/candidate gone/);
  });
  it("match retains the star at a price; equity costs control; decline loses them", () => {
    let s = createInitialState("t");
    s = { ...s, poachOffers: [{ starId: "star-imara", rivalId: "velocity", packageM: 20, expiresTurn: 99 }] };
    const matched = respondToPoach(s, "star-imara", "match");
    expect(matched.capital).toBeCloseTo(s.capital - 20 * BALANCE.talent.matchCostFactor, 5);
    expect(matched.poachOffers).toHaveLength(0);
    const equity = respondToPoach(s, "star-imara", "equity");
    expect(equity.control).toBeCloseTo(s.control - BALANCE.talent.equityControlCost, 5);
    const declined = respondToPoach(s, "star-imara", "decline");
    const after = talentTurn(declined).state;
    expect(after.stars.some(st => st.id === "star-imara")).toBe(false);
    expect(after.rivals.find(r => r.id === "velocity")!.capability.reasoning)
      .toBeGreaterThan(s.rivals.find(r => r.id === "velocity")!.capability.reasoning);
  });
  it("burnout climbs on runs, recovers off them, exodus past threshold is possible", () => {
    let s = createInitialState("t");
    s = { ...s, stars: s.stars.map(st => st.id === "star-imara" ? { ...st, onRunId: "run-x", burnout: 40 } : st) };
    const after = talentTurn(s).state;
    expect(after.stars.find(st => st.id === "star-imara")!.burnout).toBe(40 + BALANCE.talent.burnoutPerRunTurn);
    // determinism
    expect(talentTurn(s).state).toEqual(after);
  });
  it("market churns but never exceeds marketSize", () => {
    let s = createInitialState("t");
    for (let i = 0; i < 6; i++) { s = { ...s, turn: s.turn + 1 }; s = talentTurn(s).state; }
    expect(s.market.length).toBeLessThanOrEqual(BALANCE.talent.marketSize);
  });
});
```

- [ ] **Steps 2–5:** verify fail → implement → suite green → commit `feat(c3): talent market, poaching raids, burnout`

---

### Task 4: Funding, governance, fire-sale

**Files:**
- Create: `lib/engine/funding.ts`
- Test: `tests/engine/funding.test.ts`

**Interfaces:**
- Produces:
  - `valuation(state): number` — `totalCapability*valuationCapWeight + revenuePerTurn*valuationRevenueWeight + trust*valuationTrustWeight` where totalCapability = sum of best deployed model's categories (0 if none).
  - `acceptFunding(state, offerId): GameState` — applies `amountM/controlCost/boardDelta/trustDelta`; `computeGrantPF > 0` adds facility `{ id: "fac-grant-<turn>", name: "Partner compute grant", capacityPF: grant, upkeepPerTurn: 0, onlineTurn: turn + 1 }`; sets `lastRaiseTurn = turn`, `fundingRound++`, clears all offers, chronicle (kind "funding"). Throws `"no such offer"`.
  - `fundingTurn(state): { state: GameState; lines: string[] }` — (1) expire offers; (2) generate: if none open and (`runwayMonths < offerRunwayTrigger` or `turn - lastRaiseTurn >= offerCadence`), create all three kinds — `amountM = valuation * kind.amountFactor * (0.75 if fireSaleCount > 0 else 1)`, terms from BALANCE, `expiresTurn = turn + offerExpiry`; (3) board drift: `+boardNetPositive` if net ≥ 0, `+boardTop2Bonus` if player in leaderboard top 2, `boardLowRunway` if runway < 9, additional `boardVeryLowRunway` if < 6 (clamp 0–100); (4) coup check: board ≤ `coupThreshold` → morale ≥ `coupSurviveMorale`: survive (board = `coupSurviveBoardReset`, `control -= coupSurviveControlCost`, line "the team threatened to walk — you stay"); morale ≥ `coupInterimMorale`: interim (set `interimUntilTurn = turn + interimTurns` — add this optional field to GameState in this task, `number | null`, default null, migration backfills null; board = 40); else `ending = "ousted"`, `ended = true`; (5) fire-sale chain when `capital < 0`: 1st — sell `fireSaleFacilityFraction` of largest facility's PF, `capital += soldPF * fireSaleCapitalRecovery`; 2nd — forced down round `capital += valuation*0.1`, `control -= fireSaleDownRoundControl`; 3rd — `ending = "absorbed"`, `ended = true`. Each fires once per crossing (increment `fireSaleCount`). Every branch emits a line + chronicle.
  - `launchRun` gains an interim guard (modify `runs.ts`): if `state.interimUntilTurn && turn < interimUntilTurn && design.scaleTier > BALANCE.funding.interimRunTierCap` throw `"the interim board won't approve a run this large"`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { valuation, acceptFunding, fundingTurn } from "@/lib/engine/funding";

describe("funding & governance", () => {
  it("opens three offers when runway is short, terms visible", () => {
    let s = { ...createInitialState("f"), capital: 20 };   // short runway
    const { state } = fundingTurn(s);
    expect(state.fundingOffers).toHaveLength(3);
    expect(new Set(state.fundingOffers.map(o => o.kind))).toEqual(new Set(["vc", "strategic", "mission"]));
    expect(state.fundingOffers.every(o => o.amountM > 0)).toBe(true);
  });
  it("accepting strategic money grants compute next turn and costs control", () => {
    let s = { ...createInitialState("f"), capital: 20 };
    s = fundingTurn(s).state;
    const strat = s.fundingOffers.find(o => o.kind === "strategic")!;
    const out = acceptFunding(s, strat.id);
    expect(out.capital).toBeCloseTo(20 + strat.amountM, 5);
    expect(out.control).toBeCloseTo(s.control - strat.controlCost, 5);
    expect(out.facilities.some(f => f.name.includes("Partner"))).toBe(true);
    expect(out.fundingOffers).toHaveLength(0);
    expect(out.fundingRound).toBe(1);
  });
  it("coup: high morale survives, low morale is ousted", () => {
    const base = { ...createInitialState("f"), boardConfidence: 10 };
    const survived = fundingTurn({ ...base, morale: 80 }).state;
    expect(survived.ending).toBeNull();
    expect(survived.boardConfidence).toBe(45);
    const ousted = fundingTurn({ ...base, morale: 20 }).state;
    expect(ousted.ending).toBe("ousted");
    expect(ousted.ended).toBe(true);
  });
  it("fire-sale chain: facility sale → down round → absorbed", () => {
    let s = { ...createInitialState("f"), capital: -5 };
    s = fundingTurn(s).state;
    expect(s.fireSaleCount).toBe(1);
    expect(s.facilities[0].capacityPF).toBeLessThan(40);
    s = fundingTurn({ ...s, capital: -5 }).state;
    expect(s.fireSaleCount).toBe(2);
    s = fundingTurn({ ...s, capital: -5 }).state;
    expect(s.ending).toBe("absorbed");
  });
});
```

- [ ] **Steps 2–5:** fail → implement (including the `interimUntilTurn` field + migration backfill + `launchRun` guard with its own small test in `tests/engine/funding.test.ts`) → green → commit `feat(c3): funding rounds, board governance, coup, fire-sale chain`

---

### Task 5: Safety — tiers, eval capacity, incidents

**Files:**
- Create: `lib/engine/safety.ts`
- Test: `tests/engine/safety.test.ts`

**Interfaces:**
- Produces:
  - `capabilityTier(state): 0 | 1 | 2 | 3` from max deployed-model avg vs `tierThresholds`.
  - `requiredEvalFor(tier): number` from `requiredEval`.
  - `deployRiskBand(state, modelId): "clear" | "elevated" | "severe"` — gap = required(tier the model WOULD create) − evalCapacity: ≤0 clear, ≤15 elevated, else severe. (FinancePanel shows this beside positioning buttons — transparency law.)
  - `recordDeploymentRisk(state, modelId): GameState` — `incidentRisk += max(0, gap) * riskPerEvalGap` (call from `deployModel` — modify `deploy.ts` to apply it).
  - `safetyTurn(state): { state: GameState; lines: string[] }` — evalCapacity = `evalCapacity*(1-evalDecay) + allocation.safety*evalPerSafetyPF`; trust drifts `+allocation.safety*safetyTrustDriftPerPF` (clamp 100); incident roll: `makeRng(seed, turn, "safety")() < incidentRisk*incidentChancePerRisk` → trust −`incidentTrustHit`, board −`incidentBoardHit`, all revenue streams ×(1−`incidentRevenueHit`), `incidentRisk *= incidentRiskRelief`, line + chronicle "A jailbreak of <newest model> is everywhere…".
  - `riskBandLabel(state): "low" | "elevated" | "severe"` — overall incidentRisk <10 / <30 / else, for the TopBar-adjacent readout.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { capabilityTier, deployRiskBand, safetyTurn, riskBandLabel } from "@/lib/engine/safety";
import { deployModel } from "@/lib/engine/deploy";
import type { Model } from "@/lib/engine/types";

const strong: Model = { id: "m", name: "Titan", createdTurn: 1,
  capability: { coding: 60, reasoning: 60, enterprise: 60, consumer: 60 }, positioning: null, deployedTurn: null };

describe("safety", () => {
  it("tiers follow deployed capability", () => {
    const s = createInitialState("s");
    expect(capabilityTier(s)).toBe(0);
    const deployed = deployModel({ ...s, models: [strong] }, "m", "api");
    expect(capabilityTier(deployed)).toBe(2);   // avg 60 ≥ t2 55, < t3 70
  });
  it("deploying past your eval capacity accrues incident risk", () => {
    const s = { ...createInitialState("s"), models: [strong], evalCapacity: 0 };
    expect(deployRiskBand(s, "m")).toBe("severe");
    const out = deployModel(s, "m", "api");
    expect(out.incidentRisk).toBeGreaterThan(0);
  });
  it("safety allocation builds capacity; incident fires deterministically per seed", () => {
    let s = { ...createInitialState("s"), allocation: { inference: 0, experiments: 0, safety: 10 } };
    s = safetyTurn(s).state;
    expect(s.evalCapacity).toBeCloseTo(5, 5);
    const risky = { ...s, incidentRisk: 100 };   // guaranteed roll (100 * 0.01 = 1.0)
    const { state: hit, lines } = safetyTurn(risky);
    expect(hit.trust).toBeLessThan(risky.trust);
    expect(lines.some(l => /jailbreak|incident/i.test(l))).toBe(true);
    expect(riskBandLabel(risky)).toBe("severe");
  });
});
```

- [ ] **Steps 2–5:** fail → implement (+ `deploy.ts` calls `recordDeploymentRisk`) → green → commit `feat(c3): safety tiers, eval capacity, incident risk`

---

### Task 6: Dilemmas — authored deck + trigger/resolve engine

**Files:**
- Create: `lib/engine/events.ts`
- Modify: `lib/engine/content.ts` (append `DILEMMAS: DilemmaDef[]`)
- Test: `tests/engine/events.test.ts`

**Content — author these 8 era-1/2 dilemmas in full** (id · trigger gist · 2–3 options each with 2 weighted outcomes touching the deltas type; write them with the v2 game's voice — specific, morally uncomfortable, consequences that cut both ways):
1. `pentagon-proposal` — defense contract: big capital vs trust/morale.
2. `poach-retaliation` — rival raided you; retaliate (capital, rival relations) vs take the high road (morale).
3. `open-source-petition` — your researchers demand an open release: morale vs control/revenue.
4. `benchmark-contamination` — you discover your eval set leaked into training data: disclose (trust up, board down) vs bury it (incidentRisk up).
5. `power-crunch` — the grid operator cuts your allocation: pay premium (capital) vs throttle runs (teamStrength/morale).
6. `viral-jailbreak-close-call` — a researcher finds a catastrophic jailbreak pre-launch: delay (board down, trust up) vs patch quietly (incidentRisk).
7. `acquihire-feeler` — a hyperscaler floats a soft acquisition: entertain it (board up, control down) vs refuse loudly (morale up, board down).
8. `whistleblower-memo` — an internal memo about safety corners leaks: get ahead of it (trust, capital cost) vs lawyer up (trust down, board up).

**Interfaces:**
- Produces:
  - `maybeOpenDilemma(state): GameState` — only when `turn % BALANCE.events.cadence === 0`, `turn > 2`, `activeDilemma === null`, `ending === null`; eligible = era ≤ state.era, not in `usedDilemmas`, `trigger?.(state) !== false`; pick first of seeded shuffle (`makeRng(seed, turn, "dilemma")`); set `activeDilemma`.
  - `resolveDilemma(state, optionId): { state: GameState; outcomeText: string }` — throws `"no active dilemma"` / `"unknown option"`; weighted-roll an outcome (`makeRng(seed, turn, "dilemma-resolve", defId, optionId)`), apply `deltas` (clamped: trust/board/control/morale 0–100), push defId to `usedDilemmas`, clear `activeDilemma`, chronicle (kind "dilemma").
  - `getDilemmaDef(id): DilemmaDef` — throws on unknown.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { maybeOpenDilemma, resolveDilemma, getDilemmaDef } from "@/lib/engine/events";
import { DILEMMAS } from "@/lib/engine/content";

describe("dilemmas", () => {
  it("has 8 era-appropriate defs with valid weights", () => {
    expect(DILEMMAS.length).toBeGreaterThanOrEqual(8);
    for (const d of DILEMMAS) {
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      for (const o of d.options) expect(o.outcomes.reduce((a, x) => a + x.chance, 0)).toBeGreaterThan(0);
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
    // same seed+turn → same pick (determinism)
    expect(maybeOpenDilemma({ ...createInitialState("d"), turn: 4 }).activeDilemma!.defId).toBe(def.id);
    // odd turn → nothing opens
    expect(maybeOpenDilemma({ ...createInitialState("d"), turn: 5 }).activeDilemma).toBeNull();
  });
});
```

- [ ] **Steps 2–5:** fail → implement + author all 8 dilemmas → green → commit `feat(c3): authored dilemma deck and trigger engine`

---

### Task 7: Pipeline integration

**Files:**
- Modify: `lib/engine/turn.ts`
- Test: `tests/engine/turn-v2.test.ts`

**Interfaces:**
- `advanceTurn` new order: (0) throw `"resolve the dilemma first"` if `activeDilemma`; throw `"game ended"` if `ended`; (1) `applyFastFollow`; (2) `applyFinance`; (3) `advanceRuns` (+ morale: `runCompleteMorale`/`runFailMorale` applied on completions/failures — read run status diffs, clamp morale); (4) `advanceRivals`; (5) `talentTurn`; (6) `safetyTurn`; (7) `fundingTurn`; (8) increment turn; (9) `maybeOpenDilemma` (runs on the NEW turn number); (10) debrief assembled from every stage's lines with correct kinds; (11) `ended = ended || turn > totalTurns || ending !== null`. Chronicle capped at last 60 entries.

- [ ] **Step 1: Failing tests**

```ts
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
    const a = play(); const b = play();
    expect(a).toEqual(b);
    expect(a.chronicle.some(c => c.kind === "rival")).toBe(true);   // rivals released something in 20 turns
    expect(a.rivals.filter(r => r.active).length).toBeGreaterThanOrEqual(4);
  });
  it("ending states stop the game", () => {
    const s = { ...createInitialState("end"), boardConfidence: 5, morale: 10 };
    const out = advanceTurn(s);
    expect(out.ending).toBe("ousted");
    expect(() => advanceTurn(out)).toThrow(/game ended/);
  });
});
```

- [ ] **Steps 2–5:** fail → implement → FULL suite green (all Plan-1 tests too; update any that asserted the old debrief) → commit `feat(c3): living-world turn pipeline`

---

### Task 8: Store actions + selectors

**Files:**
- Modify: `lib/store/gameStore.ts`, `lib/store/selectors.ts`
- Test: extend `tests/store/gameStore.test.ts`

**Interfaces:**
- Store adds: `hire(candidateId)`, `respondPoach(starId, response)`, `acceptOffer(offerId)`, `resolveActiveDilemma(optionId)` — all via the existing `act()` wrapper. `resolveActiveDilemma` stores the outcome text in new store field `lastOutcome: string | null` (UI shows it in the dilemma modal after the roll; cleared on next action).
- Selectors add: `selectLeaderboard(g)` (re-export from rivals), `selectAlerts(g)` → `{ poachCount, offerCount, dilemmaOpen, undeployedCount }` for nav badges, `selectRoster(g)` → stars with `burnoutBand: "fresh" | "strained" | "critical"` (<40 / <75 / else).

- [ ] **Step 1: Failing tests** (append to gameStore.test.ts)

```ts
  it("resolving a dilemma through the store records outcome text", () => {
    useGameStore.getState().newGame("store-v2");
    for (let i = 0; i < 8 && !useGameStore.getState().game!.activeDilemma; i++) useGameStore.getState().endTurn();
    const g = useGameStore.getState().game!;
    expect(g.activeDilemma).not.toBeNull();
    useGameStore.getState().endTurn();   // blocked
    expect(useGameStore.getState().lastError).toMatch(/resolve the dilemma/);
    const { getDilemmaDef } = await import("@/lib/engine/events");
    const def = getDilemmaDef(g.activeDilemma!.defId);
    useGameStore.getState().resolveActiveDilemma(def.options[0].id);
    expect(useGameStore.getState().lastOutcome!.length).toBeGreaterThan(0);
    expect(useGameStore.getState().game!.activeDilemma).toBeNull();
  });
```
(make the enclosing test `async`.)

- [ ] **Steps 2–5:** fail → implement → green → commit `feat(c3): store actions for the living world`

---

### Task 9: UI — Race Board + Talent panels, nav badges

**Files:**
- Create: `components/panels/RaceBoardPanel.tsx`, `components/panels/TalentPanel.tsx`
- Modify: `components/shell/NavRail.tsx` (PanelId gains `"talent" | "race"`; order: briefing, runs, compute, talent, race, finance; badge dot when `selectAlerts` count > 0 for talent/finance/briefing), `components/shell/GameShell.tsx` (render new panels)

**Contracts:**
- RaceBoardPanel: leaderboard table (rank, lab, overall, player row amber-highlighted), rival cards (name, archetype label, `lastRelease` or "quiet lately", strongest category) — never show `runFinishTurn` or exact capabilities, show capability as bands (`dominant/strong/credible/trailing` per 70/55/40 thresholds); chronicle feed (last 12, newest first, kind-colored).
- TalentPanel: roster cards (name, specialty, skill, salary, burnout bar colored by `burnoutBand`, "leading <run name>" badge); poach alerts at top (rival, package, expiry, three response buttons with costs printed: "Match — $X.XM", "Counter with equity — 1.5 control", "Let them walk"); market cards (skill/specialty/ask/bonus + Hire button disabled-with-reason when unaffordable).
- Mobile: both panels stack; nav becomes 6 tabs (keep labels short: BRIEF, RUNS, COMP, TEAM, RACE, FIN on <md).

- [ ] **Step 1: implement. Step 2: browser-verify** — new game → Talent shows 4 starting stars + market; Race shows 4 active rivals; end turns until a rival release appears in Race chronicle + debrief. **Step 3: commit** `feat(c3): race board and talent panels`

---

### Task 10: UI — dilemma modal, funding offers, safety surfacing

**Files:**
- Create: `components/modals/DilemmaModal.tsx`
- Modify: `components/shell/GameShell.tsx`, `components/panels/FinancePanel.tsx`, `components/panels/ComputePanel.tsx`, `components/shell/TopBar.tsx`

**Contracts:**
- DilemmaModal: mounts automatically whenever `game.activeDilemma` is set (GameShell), not closable; title/body from def; option buttons show `label` + `note` (note must state the trade, e.g. "≈ +$30M, trust will suffer"); after choosing, shows `lastOutcome` text with a "Continue" button. End Turn button visually disabled with tooltip "Resolve the dilemma first" while open.
- FinancePanel: "Open term sheets" section when `fundingOffers.length > 0` — each offer card prints ALL terms (amount, control cost, board/trust deltas, compute grant, expiry) + Accept button; fire-sale/coup chronicle warnings surface here too.
- ComputePanel safety row: shows `evalCapacity` (0-dp), current tier requirement, and `riskBandLabel` colored (low green / elevated orange / severe red).
- FinancePanel deployment buttons: append `deployRiskBand` chip per model ("clear" green / "elevated" orange / "severe" red) so shipping under-evaluated is a visible, deliberate act.
- TopBar: swap the Trust chip label row to include morale — chips become: Quarter, Capital, Runway, Compute, Trust, Morale, Board (7).

- [ ] **Step 1: implement. Step 2: browser-verify the full loop** — play until a dilemma opens: End Turn blocked, resolve it, see outcome text; short runway → term sheets appear with full terms; deploy an under-evaluated strong model → severe chip visible and incident risk climbs in Compute panel. **Step 3: full suite + tsc + commit** `feat(c3): dilemma modal, term sheets, safety surfacing`

---

### Task 11: Deploy + verify live

- [ ] **Step 1:** `cd ~/Projects/convergence-game/convergence-3 && npm test && npx tsc --noEmit && npx wrangler pages deploy out --project-name convergence-3 --branch=main --commit-dirty=true` after `next build`.
- [ ] **Step 2:** verify per cloudflare-deploy-verify: 200 on `/`, title `Convergence 3`, one `/_next/static/chunks/*.js` → 200. Load in preview browser (localhost same build) and play 10+ turns.
- [ ] **Step 3:** commit any remaining changes; report.

---

## Self-Review Notes

- **Spec coverage:** rivals/leaderboard/fast-follow (§8) T2; talent/poach/burnout/wildcard (§6) T3; funding/megadeal/coup/fire-sale (§7) T4; safety tiers/incidents (§9) T5; dilemmas (§10) T6; integration T7; transparency surfacing (§16) T9–10. Deferred to Plan 3: eras 2–4, Applied Frontiers, full Endings Compass (only `ousted`/`absorbed` minimal endings here — spec §12 defeats 1–2). Deferred to Plan 4: AI dressing of all these feeds.
- **Type consistency check:** `respondToPoach(state, starId, response)` matches store `respondPoach`; `FundingOffer.id` consumed by `acceptFunding(state, offerId)`; `DilemmaOption.id` consumed by `resolveDilemma(state, optionId)`; `interimUntilTurn?: number | null` added in T4 and backfilled in migration (update T1's migration list when implementing T4).
- **Known simplifications:** poach offers cap at 1/turn; rival pricing/undercutting and compute alliances (spec §8 two-way levers) deferred to Plan 3 alongside eras — poaching THEIR stars needs rival rosters, same deferral.
