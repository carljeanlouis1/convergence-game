# Convergence 3 — Plan 1: Engine Core + Playable Era-1 Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable vertical slice of Convergence 3: the pure deterministic engine (seeded RNG, balance config, training-run loop with hidden quality + checkpoints, compute allocation, finance) plus a functional four-panel UI where a player can run Startup-era quarters end to end.

**Architecture:** New Next.js static-export app at `convergence-3/` in the convergence-game repo, deployed as a separate Cloudflare Pages project. All game logic lives in a pure TypeScript library (`lib/engine/`) with zero React imports, driven by a thin Zustand store with versioned persistence. UI is per-panel components — no monolith. Spec: `docs/superpowers/specs/2026-07-10-convergence-3-design.md`.

**Tech Stack:** Next.js 16 (static export) · React 19 · TypeScript (strict) · Zustand 5 (+persist) · Tailwind 4 · Vitest · wrangler (Pages deploy)

## Global Constraints

- Engine purity: nothing under `lib/engine/` may import React, Zustand, or browser APIs, or call `Date.now()` / `Math.random()` — all randomness flows from the seeded RNG; all timestamps come from turn numbers.
- All tunable numbers live in `lib/engine/balance.ts` (`BALANCE`). No magic numbers in engine modules.
- Money is $M (millions USD) everywhere; compute is PF (abstract PFLOPs-units); display formatting happens only in UI.
- Save format carries `version: 1` and loads through `migrateSnapshot()`; never persist without a version.
- Campaign length 48 turns; 1 turn = 1 quarter starting 2026 Q1; this plan implements Era 1 rules only (eras 2–4 in Plan 3).
- Hidden state (run quality) must never be rendered in UI; players see checkpoint signal bands only.
- LLM/AI calls: none in this plan (Plan 4). All narrative strings are authored fallbacks.
- TypeScript `strict: true`; test command is `npx vitest run` from `convergence-3/`.
- Commit after every task; never commit failing tests. Do not push (Hermes shares this repo; owner pushes).

## File Structure

```
convergence-3/
  app/layout.tsx, app/page.tsx, app/globals.css     # Next shell
  lib/engine/rng.ts                                 # seeded RNG utilities
  lib/engine/types.ts                               # all engine types
  lib/engine/balance.ts                             # BALANCE tunables
  lib/engine/content.ts                             # Era-1 authored content (stars, techniques, facilities)
  lib/engine/state.ts                               # createInitialState()
  lib/engine/compute.ts                             # allocation + validation
  lib/engine/runs.ts                                # training-run subsystem
  lib/engine/finance.ts                             # revenue/burn/runway
  lib/engine/deploy.ts                              # model deployment/positioning
  lib/engine/turn.ts                                # advanceTurn pipeline + debrief
  lib/store/gameStore.ts                            # Zustand store, versioned persist
  lib/store/selectors.ts                            # memo selectors
  components/shell/GameShell.tsx, TopBar.tsx, NavRail.tsx
  components/panels/BriefingPanel.tsx, RunsPanel.tsx, ComputePanel.tsx, FinancePanel.tsx
  components/modals/RunDesigner.tsx, CheckpointModal.tsx, EndTurnSummary.tsx, DebriefModal.tsx
  tests/engine/*.test.ts                            # one test file per engine module
  tests/store/gameStore.test.ts
```

---

### Task 1: Scaffold the app

**Files:**
- Create: `convergence-3/` via create-next-app; `convergence-3/vitest.config.ts`; `convergence-3/tests/smoke.test.ts`
- Modify: `convergence-3/next.config.ts`, `convergence-3/tsconfig.json`, `convergence-3/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a building app + running test harness all later tasks rely on.

- [ ] **Step 1: Scaffold**

```bash
cd ~/Projects/convergence-game
npx create-next-app@latest convergence-3 --ts --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --yes
cd convergence-3 && npm install zustand && npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Configure static export**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true } };
export default nextConfig;
```

- [ ] **Step 3: Vitest config + smoke test**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("harness", () => { it("runs", () => expect(1 + 1).toBe(2)); });
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds producing `out/`; 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add convergence-3 && git commit -m "feat(c3): scaffold Convergence 3 app with static export and vitest"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `convergence-3/lib/engine/rng.ts`
- Test: `convergence-3/tests/engine/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` (uniform [0,1))
  - `makeRng(...parts: Array<string | number>): Rng`
  - `rollRange(rng: Rng, min: number, max: number): number` (float)
  - `pick<T>(rng: Rng, items: readonly T[]): T`
  - `gaussian(rng: Rng, mean: number, sd: number): number`

- [ ] **Step 1: Write the failing test**

`tests/engine/rng.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeRng, rollRange, pick, gaussian } from "@/lib/engine/rng";

describe("rng", () => {
  it("is deterministic for identical parts", () => {
    const a = makeRng("seed-1", 7, "runs");
    const b = makeRng("seed-1", 7, "runs");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("differs across salts", () => {
    expect(makeRng("seed-1", 7, "runs")()).not.toBe(makeRng("seed-1", 7, "news")());
  });
  it("stays in [0,1)", () => {
    const r = makeRng("bounds");
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it("rollRange and pick respect bounds", () => {
    const r = makeRng("x");
    for (let i = 0; i < 100; i++) {
      const v = rollRange(r, 5, 9); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(9);
    }
    expect(["a", "b"]).toContain(pick(makeRng("y"), ["a", "b"] as const));
  });
  it("gaussian roughly centers on mean", () => {
    const r = makeRng("g");
    const n = 2000;
    let sum = 0; for (let i = 0; i < n; i++) sum += gaussian(r, 50, 10);
    expect(Math.abs(sum / n - 50)).toBeLessThan(1.5);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/engine/rng.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/engine/rng.ts`:
```ts
export type Rng = () => number;

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): Rng {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(...parts: Array<string | number>): Rng {
  return mulberry32(xmur3(parts.join("::"))());
}

export function rollRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function gaussian(rng: Rng, mean: number, sd: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
```

- [ ] **Step 4: Verify pass** — `npx vitest run tests/engine/rng.test.ts` → 5 passed.
- [ ] **Step 5: Commit** — `git add convergence-3/lib/engine/rng.ts convergence-3/tests/engine/rng.test.ts && git commit -m "feat(c3): seeded deterministic RNG"`

---

### Task 3: Engine types + balance config

**Files:**
- Create: `convergence-3/lib/engine/types.ts`, `convergence-3/lib/engine/balance.ts`
- Test: `convergence-3/tests/engine/balance.test.ts`

**Interfaces:**
- Produces (used by every later task — copy signatures exactly):

`types.ts`:
```ts
export type BenchCategory = "coding" | "reasoning" | "enterprise" | "consumer";
export type RunStatus = "active" | "completed" | "scrapped" | "failed";
export type CheckpointBand = "ahead" | "on-track" | "wobbly" | "troubled";
export type RunDecisionKind = "push" | "boost" | "scrap";
export type Positioning = "api" | "enterprise" | "consumer" | "open-weights";

export interface Star {
  id: string; name: string; specialty: BenchCategory;
  skill: number;          // 1-10
  salaryPerQuarter: number; // $M
  onRunId: string | null;
}

export interface Technique {
  id: string; name: string; era: 1 | 2 | 3 | 4;
  qualityBonus: number;   // added to expected quality
  variance: number;       // added to per-turn noise sd
  categoryWeights: Record<BenchCategory, number>; // capability shaping, ~0.8-1.2
}

export interface Facility {
  id: string; name: string; capacityPF: number; upkeepPerTurn: number; // $M
  onlineTurn: number;     // turn it becomes/became online
}

export interface RunDesign {
  name: string; scaleTier: 1 | 2 | 3 | 4;
  techniqueIds: string[]; leadId: string | null;
}

export interface TrainingRun {
  id: string; name: string; scaleTier: 1 | 2 | 3 | 4;
  techniqueIds: string[]; leadId: string | null;
  computePerTurn: number; turnsTotal: number; turnsElapsed: number;
  spentToDate: number;      // $M cumulative
  hiddenQuality: number;    // 0-100, NEVER shown in UI
  checkpoints: CheckpointReading[];
  status: RunStatus; startedTurn: number;
}

export interface CheckpointReading { turn: number; band: CheckpointBand; note: string; }

export interface Model {
  id: string; name: string; createdTurn: number;
  capability: Record<BenchCategory, number>;   // 0-100 each
  positioning: Positioning | null;             // null = undeployed
  deployedTurn: number | null;
}

export interface ComputeAllocation {
  inference: number; experiments: number; safety: number; // PF; runs are implicit commitments
}

export interface RevenueStream { source: string; amountPerTurn: number; decayPerTurn: number; }

export interface DebriefLine { kind: "finance" | "run" | "compute" | "world"; text: string; }

export interface TurnDebrief { turn: number; headline: string; lines: DebriefLine[]; }

export interface GameState {
  version: 1; seed: string; turn: number; era: 1 | 2 | 3 | 4;
  capital: number;                              // $M
  trust: number; boardConfidence: number; control: number; morale: number; // 0-100
  facilities: Facility[]; allocation: ComputeAllocation;
  stars: Star[]; teamStrength: number;          // 0-100 aggregate
  runs: TrainingRun[]; models: Model[];
  revenueStreams: RevenueStream[];
  lastDebrief: TurnDebrief | null;
  ended: boolean;
}
```

`balance.ts` exports `export const BALANCE = {...} as const` with (exact starting values, tune later):
```ts
export const BALANCE = {
  totalTurns: 48,
  startingCapital: 120,          // $M seed round already closed
  startingComputePF: 40,
  startingTrust: 55, startingBoard: 70, startingControl: 78, startingMorale: 72,
  startingTeamStrength: 30,
  runTiers: {
    1: { computePerTurn: 8,  turns: 3, cap: 45,  costPerPFTurn: 0.32 },
    2: { computePerTurn: 20, turns: 4, cap: 62,  costPerPFTurn: 0.30 },
    3: { computePerTurn: 45, turns: 5, cap: 80,  costPerPFTurn: 0.28 },
    4: { computePerTurn: 90, turns: 6, cap: 100, costPerPFTurn: 0.26 },
  },
  run: {
    baseQuality: 32, leadSkillWeight: 2.2, teamStrengthWeight: 0.28,
    fundedDrift: 2.0, starvedDrift: -6.0, noiseSd: 4.5,
    checkpointEvery: 2, checkpointNoiseSd: 7,
    bands: { ahead: 12, onTrack: 0, wobbly: -10 },  // reading vs expected: >= +12 ahead, >= 0 on-track, >= -10 wobbly, else troubled
    boostQuality: 4.5, boostCostMultiplier: 1.6,    // boost: +compute cost this turn for quality
    failThreshold: 25,                              // completed run below this = failed (no model)
  },
  finance: {
    computeUpkeepPerPF: 0.045,    // $M per PF per turn
    teamCostPerPoint: 0.09,       // $M per teamStrength point per turn
    inferenceRevenuePerPF: 0.5,   // $M per PF allocated to inference, scaled by best deployed capability/100
    positioningMultipliers: { api: 1.0, enterprise: 1.35, consumer: 0.9, "open-weights": 0.15 },
    revenueDecayPerTurn: 0.06,    // flat Era-1 stand-in for fast-follow (rivals arrive in Plan 2)
    runwayFloorBurn: 0.1,
  },
  experiments: { pfPerTechniquePoint: 6 },  // reserved hook; Era-1 techniques are pre-unlocked
} as const;
```

- [ ] **Step 1: Write the failing test**

`tests/engine/balance.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BALANCE } from "@/lib/engine/balance";

describe("balance invariants", () => {
  it("run tiers escalate in commitment and ceiling", () => {
    const t = BALANCE.runTiers;
    expect(t[2].computePerTurn).toBeGreaterThan(t[1].computePerTurn);
    expect(t[4].cap).toBeGreaterThan(t[1].cap);
    expect(t[1].turns).toBeLessThan(t[4].turns);
  });
  it("tier-1 run is affordable at start", () => {
    const t1 = BALANCE.runTiers[1];
    const runCost = t1.computePerTurn * t1.costPerPFTurn * t1.turns;
    expect(runCost).toBeLessThan(BALANCE.startingCapital / 4);
    expect(t1.computePerTurn).toBeLessThan(BALANCE.startingComputePF);
  });
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run tests/engine/balance.test.ts` → FAIL.
- [ ] **Step 3: Create `types.ts` and `balance.ts` exactly as specified above.**
- [ ] **Step 4: Verify pass** — `npx vitest run tests/engine/balance.test.ts` → 2 passed; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): engine types and central balance config"`

---

### Task 4: Era-1 content + initial state factory

**Files:**
- Create: `convergence-3/lib/engine/content.ts`, `convergence-3/lib/engine/state.ts`
- Test: `convergence-3/tests/engine/state.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `balance.ts`, `rng.ts`.
- Produces:
  - `content.ts`: `STARTING_STARS: Star[]` (4 stars), `TECHNIQUES: Technique[]` (Era-1: `rlhf`, `dpo`, `synthetic-data`), `STARTING_FACILITIES: Facility[]` (1 facility, 40 PF)
  - `state.ts`: `createInitialState(seed: string): GameState`

- [ ] **Step 1: Write the failing test**

`tests/engine/state.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { BALANCE } from "@/lib/engine/balance";

describe("createInitialState", () => {
  const s = createInitialState("alpha");
  it("matches balance starting values", () => {
    expect(s.capital).toBe(BALANCE.startingCapital);
    expect(s.turn).toBe(1); expect(s.era).toBe(1); expect(s.version).toBe(1);
    expect(s.facilities.reduce((a, f) => a + f.capacityPF, 0)).toBe(BALANCE.startingComputePF);
  });
  it("starts with 4 stars, none assigned", () => {
    expect(s.stars).toHaveLength(4);
    expect(s.stars.every(st => st.onRunId === null)).toBe(true);
  });
  it("starts with no runs, no models, zeroed allocation fits capacity", () => {
    expect(s.runs).toEqual([]); expect(s.models).toEqual([]);
    const alloc = s.allocation.inference + s.allocation.experiments + s.allocation.safety;
    expect(alloc).toBeLessThanOrEqual(BALANCE.startingComputePF);
  });
  it("is deterministic and JSON-safe", () => {
    expect(createInitialState("alpha")).toEqual(s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 2: Verify failure.** — `npx vitest run tests/engine/state.test.ts` → FAIL.
- [ ] **Step 3: Implement content + factory**

`content.ts` (authored, complete):
```ts
import type { Star, Technique, Facility } from "./types";

export const STARTING_STARS: Star[] = [
  { id: "star-imara", name: "Dr. Imara Osei",   specialty: "reasoning",  skill: 7, salaryPerQuarter: 0.9, onRunId: null },
  { id: "star-jonas", name: "Jonas Feld",       specialty: "coding",     skill: 6, salaryPerQuarter: 0.7, onRunId: null },
  { id: "star-mei",   name: "Mei-Lin Zhang",    specialty: "enterprise", skill: 5, salaryPerQuarter: 0.55, onRunId: null },
  { id: "star-rafa",  name: "Rafael Duarte",    specialty: "consumer",   skill: 5, salaryPerQuarter: 0.5, onRunId: null },
];

export const TECHNIQUES: Technique[] = [
  { id: "rlhf", name: "RLHF", era: 1, qualityBonus: 3, variance: 0,
    categoryWeights: { coding: 1.0, reasoning: 1.0, enterprise: 1.05, consumer: 1.1 } },
  { id: "dpo", name: "DPO", era: 1, qualityBonus: 4, variance: 1.0,
    categoryWeights: { coding: 1.05, reasoning: 1.05, enterprise: 1.0, consumer: 1.0 } },
  { id: "synthetic-data", name: "Synthetic Data Pipeline", era: 1, qualityBonus: 6, variance: 2.5,
    categoryWeights: { coding: 1.15, reasoning: 1.1, enterprise: 0.95, consumer: 0.9 } },
];

export const STARTING_FACILITIES: Facility[] = [
  { id: "fac-hq", name: "HQ Cluster", capacityPF: 40, upkeepPerTurn: 0, onlineTurn: 1 },
  // upkeepPerTurn 0: upkeep is computed from capacity via BALANCE.finance.computeUpkeepPerPF; field reserved for Plan-2 leased facilities
];
```

`state.ts`:
```ts
import { BALANCE } from "./balance";
import { STARTING_STARS, STARTING_FACILITIES } from "./content";
import type { GameState } from "./types";

export function createInitialState(seed: string): GameState {
  return {
    version: 1, seed, turn: 1, era: 1,
    capital: BALANCE.startingCapital,
    trust: BALANCE.startingTrust, boardConfidence: BALANCE.startingBoard,
    control: BALANCE.startingControl, morale: BALANCE.startingMorale,
    facilities: structuredClone(STARTING_FACILITIES),
    allocation: { inference: 0, experiments: 0, safety: 0 },
    stars: structuredClone(STARTING_STARS),
    teamStrength: BALANCE.startingTeamStrength,
    runs: [], models: [], revenueStreams: [],
    lastDebrief: null, ended: false,
  };
}
```

- [ ] **Step 4: Verify pass** — 4 passed.
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): era-1 content and initial state factory"`

---

### Task 5: Compute allocation

**Files:**
- Create: `convergence-3/lib/engine/compute.ts`
- Test: `convergence-3/tests/engine/compute.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ComputeAllocation`, `BALANCE`.
- Produces:
  - `totalCapacityPF(state: GameState): number` (sum of facilities online at `state.turn`)
  - `committedRunPF(state: GameState): number` (sum of `computePerTurn` for active runs)
  - `freePF(state: GameState): number` (capacity − run commitments − allocation)
  - `setAllocation(state: GameState, alloc: ComputeAllocation): GameState` — returns NEW state (no mutation); throws `Error("allocation exceeds free compute")` if runs+alloc > capacity; negative fields throw `Error("allocation negative")`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { totalCapacityPF, committedRunPF, freePF, setAllocation } from "@/lib/engine/compute";

describe("compute allocation", () => {
  it("reports starting capacity and zero commitments", () => {
    const s = createInitialState("c");
    expect(totalCapacityPF(s)).toBe(40);
    expect(committedRunPF(s)).toBe(0);
    expect(freePF(s)).toBe(40);
  });
  it("accepts a valid allocation immutably", () => {
    const s = createInitialState("c");
    const next = setAllocation(s, { inference: 10, experiments: 6, safety: 4 });
    expect(next.allocation.inference).toBe(10);
    expect(s.allocation.inference).toBe(0);           // original untouched
    expect(freePF(next)).toBe(20);
  });
  it("rejects over-allocation and negatives", () => {
    const s = createInitialState("c");
    expect(() => setAllocation(s, { inference: 41, experiments: 0, safety: 0 })).toThrow(/exceeds/);
    expect(() => setAllocation(s, { inference: -1, experiments: 0, safety: 0 })).toThrow(/negative/);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
import type { ComputeAllocation, GameState } from "./types";

export function totalCapacityPF(state: GameState): number {
  return state.facilities.filter(f => f.onlineTurn <= state.turn).reduce((a, f) => a + f.capacityPF, 0);
}
export function committedRunPF(state: GameState): number {
  return state.runs.filter(r => r.status === "active").reduce((a, r) => a + r.computePerTurn, 0);
}
export function allocatedPF(a: ComputeAllocation): number {
  return a.inference + a.experiments + a.safety;
}
export function freePF(state: GameState): number {
  return totalCapacityPF(state) - committedRunPF(state) - allocatedPF(state.allocation);
}
export function setAllocation(state: GameState, alloc: ComputeAllocation): GameState {
  if (alloc.inference < 0 || alloc.experiments < 0 || alloc.safety < 0) throw new Error("allocation negative");
  if (committedRunPF(state) + allocatedPF(alloc) > totalCapacityPF(state)) throw new Error("allocation exceeds free compute");
  return { ...state, allocation: { ...alloc } };
}
```

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): compute allocation with capacity validation"`

---

### Task 6: Run design + launch

**Files:**
- Create: `convergence-3/lib/engine/runs.ts` (first half)
- Test: `convergence-3/tests/engine/runs-design.test.ts`

**Interfaces:**
- Consumes: `compute.ts` (`freePF`), `content.ts` (`TECHNIQUES`), `rng.ts`, `BALANCE`.
- Produces:
  - `expectedQuality(design: RunDesign, state: GameState): number` — `BALANCE.run.baseQuality + leadSkill*leadSkillWeight + teamStrength*teamStrengthWeight + Σ technique.qualityBonus`, capped at tier `cap`.
  - `riskBand(design: RunDesign): "low" | "medium" | "high"` — total technique `variance` 0–1 low, ≤3 medium, else high.
  - `launchRun(state: GameState, design: RunDesign): GameState` — validates: compute headroom ≥ tier `computePerTurn` (throws `Error("insufficient free compute")`), lead not already on a run (throws `Error("lead already committed")`), technique ids exist and are era-unlocked (throws `Error("unknown or locked technique")`). Creates a `TrainingRun` with `hiddenQuality = expectedQuality + gaussian(rng, 0, BALANCE.run.noiseSd*1.5)` using `makeRng(seed, turn, "run-launch", runId)`, marks the lead's `onRunId`, id `run-<turn>-<n>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun, expectedQuality, riskBand } from "@/lib/engine/runs";
import { committedRunPF } from "@/lib/engine/compute";

const design = { name: "Nimbus-1", scaleTier: 1 as const, techniqueIds: ["rlhf"], leadId: "star-imara" };

describe("run design + launch", () => {
  it("computes expected quality from lead, team, techniques", () => {
    const s = createInitialState("r");
    // 32 base + 7*2.2 + 30*0.28 + 3 = 58.8, tier-1 cap 45 → 45
    expect(expectedQuality(design, s)).toBeCloseTo(45, 5);
  });
  it("classifies risk from technique variance", () => {
    expect(riskBand(design)).toBe("low");
    expect(riskBand({ ...design, techniqueIds: ["synthetic-data", "dpo"] })).toBe("high");
  });
  it("launches a run: commits compute, locks the lead", () => {
    const s = launchRun(createInitialState("r"), design);
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].status).toBe("active");
    expect(committedRunPF(s)).toBe(8);
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBe(s.runs[0].id);
    expect(s.runs[0].hiddenQuality).toBeGreaterThan(20);
  });
  it("rejects double-committing a lead and over-compute", () => {
    const s = launchRun(createInitialState("r"), design);
    expect(() => launchRun(s, { ...design, name: "Nimbus-2" })).toThrow(/lead already committed/);
    const big = { name: "Goliath", scaleTier: 4 as const, techniqueIds: ["rlhf"], leadId: null };
    expect(() => launchRun(s, big)).toThrow(/insufficient free compute/);
  });
  it("is deterministic per seed", () => {
    const a = launchRun(createInitialState("same"), design).runs[0].hiddenQuality;
    const b = launchRun(createInitialState("same"), design).runs[0].hiddenQuality;
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** (in `runs.ts`)

```ts
import { BALANCE } from "./balance";
import { TECHNIQUES } from "./content";
import { freePF } from "./compute";
import { gaussian, makeRng } from "./rng";
import type { GameState, RunDesign, TrainingRun, Technique } from "./types";

export function resolveTechniques(ids: string[], era: number): Technique[] {
  return ids.map(id => {
    const t = TECHNIQUES.find(t => t.id === id);
    if (!t || t.era > era) throw new Error("unknown or locked technique");
    return t;
  });
}

export function expectedQuality(design: RunDesign, state: GameState): number {
  const tier = BALANCE.runTiers[design.scaleTier];
  const lead = state.stars.find(s => s.id === design.leadId);
  const techs = resolveTechniques(design.techniqueIds, state.era);
  const raw = BALANCE.run.baseQuality
    + (lead ? lead.skill * BALANCE.run.leadSkillWeight : 0)
    + state.teamStrength * BALANCE.run.teamStrengthWeight
    + techs.reduce((a, t) => a + t.qualityBonus, 0);
  return Math.min(raw, tier.cap);
}

export function riskBand(design: RunDesign): "low" | "medium" | "high" {
  const v = design.techniqueIds
    .map(id => TECHNIQUES.find(t => t.id === id)?.variance ?? 0)
    .reduce((a, b) => a + b, 0);
  return v <= 1 ? "low" : v <= 3 ? "medium" : "high";
}

export function launchRun(state: GameState, design: RunDesign): GameState {
  const tier = BALANCE.runTiers[design.scaleTier];
  resolveTechniques(design.techniqueIds, state.era);
  if (design.leadId) {
    const lead = state.stars.find(s => s.id === design.leadId);
    if (!lead) throw new Error("unknown or locked technique" /* unknown lead treated as config error */);
    if (lead.onRunId) throw new Error("lead already committed");
  }
  if (freePF(state) < tier.computePerTurn) throw new Error("insufficient free compute");
  const id = `run-${state.turn}-${state.runs.length + 1}`;
  const rng = makeRng(state.seed, state.turn, "run-launch", id);
  const run: TrainingRun = {
    id, name: design.name, scaleTier: design.scaleTier,
    techniqueIds: [...design.techniqueIds], leadId: design.leadId,
    computePerTurn: tier.computePerTurn, turnsTotal: tier.turns, turnsElapsed: 0,
    spentToDate: 0,
    hiddenQuality: Math.max(5, expectedQuality(design, state) + gaussian(rng, 0, BALANCE.run.noiseSd * 1.5)),
    checkpoints: [], status: "active", startedTurn: state.turn,
  };
  return {
    ...state,
    runs: [...state.runs, run],
    stars: state.stars.map(s => (s.id === design.leadId ? { ...s, onRunId: id } : s)),
  };
}
```

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): training run design and launch"`

---

### Task 7: Run advance — hidden quality drift, checkpoints, completion

**Files:**
- Modify: `convergence-3/lib/engine/runs.ts` (append)
- Test: `convergence-3/tests/engine/runs-advance.test.ts`

**Interfaces:**
- Consumes: Task 6 exports; `gaussian`, `makeRng`.
- Produces:
  - `advanceRuns(state: GameState): GameState` — for each active run: `turnsElapsed++`; `spentToDate += computePerTurn * tier.costPerPFTurn`; drift `hiddenQuality` by `BALANCE.run.fundedDrift` (+ per-technique variance noise via `gaussian(rng,0,noiseSd + Σvariance)`); on checkpoint turns (`turnsElapsed % checkpointEvery === 0` and not final) append a `CheckpointReading`; when `turnsElapsed >= turnsTotal` complete: below `failThreshold` → status `failed`; otherwise status `completed` + a `Model` appended (capability per category = `clamp(hiddenQuality * categoryWeightProduct, 0, 100)`, weights multiplied across the run's techniques), and the lead's `onRunId` cleared. RNG: `makeRng(seed, turn, "run-advance", run.id)`.
  - `checkpointBand(reading: number, expected: number): CheckpointBand` using `BALANCE.run.bands` (delta = reading − expected: ≥12 "ahead", ≥0 "on-track", ≥−10 "wobbly", else "troubled").
  - `applyRunDecision(state: GameState, runId: string, decision: RunDecisionKind): GameState` — `scrap`: status "scrapped", free lead; `boost`: `hiddenQuality += boostQuality` once per checkpoint, costs `computePerTurn * costPerPFTurn * (boostCostMultiplier - 1)` extra capital immediately (throws `Error("insufficient capital")` if unaffordable); `push`: no-op acknowledgment (clears `pendingDecision` UI state only — engine treats it as default).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun, advanceRuns, applyRunDecision, checkpointBand } from "@/lib/engine/runs";

const design = { name: "Nimbus-1", scaleTier: 1 as const, techniqueIds: ["rlhf"], leadId: "star-imara" };

function stateWithRun(seed: string) { return launchRun(createInitialState(seed), design); }

describe("run advance", () => {
  it("accrues elapsed turns and spend deterministically", () => {
    const s1 = advanceRuns(stateWithRun("adv"));
    expect(s1.runs[0].turnsElapsed).toBe(1);
    expect(s1.runs[0].spentToDate).toBeCloseTo(8 * 0.32, 5);
    expect(advanceRuns(stateWithRun("adv")).runs[0].hiddenQuality).toBe(s1.runs[0].hiddenQuality);
  });
  it("emits a checkpoint at the cadence, with band not raw quality", () => {
    let s = stateWithRun("cp");
    s = advanceRuns(s); s = advanceRuns(s);
    expect(s.runs[0].checkpoints).toHaveLength(1);
    expect(["ahead", "on-track", "wobbly", "troubled"]).toContain(s.runs[0].checkpoints[0].band);
  });
  it("completes a tier-1 run after 3 turns and mints a model", () => {
    let s = stateWithRun("done");
    for (let i = 0; i < 3; i++) s = advanceRuns(s);
    expect(s.runs[0].status).toBe("completed");
    expect(s.models).toHaveLength(1);
    const cap = s.models[0].capability;
    for (const k of ["coding", "reasoning", "enterprise", "consumer"] as const) {
      expect(cap[k]).toBeGreaterThan(0); expect(cap[k]).toBeLessThanOrEqual(100);
    }
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBeNull();
  });
  it("scrap frees the lead and halts the run", () => {
    let s = stateWithRun("scrap");
    s = applyRunDecision(s, s.runs[0].id, "scrap");
    expect(s.runs[0].status).toBe("scrapped");
    expect(s.stars.find(st => st.id === "star-imara")!.onRunId).toBeNull();
    expect(advanceRuns(s).runs[0].turnsElapsed).toBe(0); // scrapped runs don't advance
  });
  it("boost raises quality and charges capital", () => {
    let s = stateWithRun("boost");
    const before = { q: s.runs[0].hiddenQuality, c: s.capital };
    s = applyRunDecision(s, s.runs[0].id, "boost");
    expect(s.runs[0].hiddenQuality).toBeCloseTo(before.q + 4.5, 5);
    expect(s.capital).toBeLessThan(before.c);
  });
  it("bands classify against expected", () => {
    expect(checkpointBand(60, 45)).toBe("ahead");
    expect(checkpointBand(46, 45)).toBe("on-track");
    expect(checkpointBand(40, 45)).toBe("wobbly");
    expect(checkpointBand(30, 45)).toBe("troubled");
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** — append to `runs.ts`:

```ts
import type { CheckpointBand, Model, RunDecisionKind } from "./types"; // merge into existing import

export function checkpointBand(reading: number, expected: number): CheckpointBand {
  const d = reading - expected;
  const b = BALANCE.run.bands;
  if (d >= b.ahead) return "ahead";
  if (d >= b.onTrack) return "on-track";
  if (d >= b.wobbly) return "wobbly";
  return "troubled";
}

const BAND_NOTES: Record<CheckpointBand, string> = {
  ahead: "Loss curve is beating projections. The team is quietly excited.",
  "on-track": "Metrics tracking the plan. No surprises in the eval samples.",
  wobbly: "Some instability in the curve. Could be noise. Could not be.",
  troubled: "Evals are coming back soft. The room has gone quiet.",
};

export function advanceRuns(state: GameState): GameState {
  let models = state.models;
  let stars = state.stars;
  const runs = state.runs.map(run => {
    if (run.status !== "active") return run;
    const tier = BALANCE.runTiers[run.scaleTier];
    const techs = resolveTechniques(run.techniqueIds, state.era);
    const rng = makeRng(state.seed, state.turn, "run-advance", run.id);
    const varianceSd = BALANCE.run.noiseSd + techs.reduce((a, t) => a + t.variance, 0);
    const turnsElapsed = run.turnsElapsed + 1;
    let quality = run.hiddenQuality + BALANCE.run.fundedDrift + gaussian(rng, 0, varianceSd);
    quality = Math.max(0, Math.min(quality, tier.cap + 8));
    const next: TrainingRun = {
      ...run, turnsElapsed, hiddenQuality: quality,
      spentToDate: run.spentToDate + run.computePerTurn * tier.costPerPFTurn,
    };
    if (turnsElapsed >= run.turnsTotal) {
      next.status = quality < BALANCE.run.failThreshold ? "failed" : "completed";
      stars = stars.map(s => (s.onRunId === run.id ? { ...s, onRunId: null } : s));
      if (next.status === "completed") {
        const capability = { coding: 0, reasoning: 0, enterprise: 0, consumer: 0 };
        for (const k of Object.keys(capability) as (keyof typeof capability)[]) {
          const w = techs.reduce((a, t) => a * t.categoryWeights[k], 1);
          capability[k] = Math.max(0, Math.min(100, quality * w));
        }
        const model: Model = {
          id: `model-${run.id}`, name: run.name, createdTurn: state.turn,
          capability, positioning: null, deployedTurn: null,
        };
        models = [...models, model];
      }
    } else if (turnsElapsed % BALANCE.run.checkpointEvery === 0) {
      const reading = quality + gaussian(rng, 0, BALANCE.run.checkpointNoiseSd);
      const expected = BALANCE.run.baseQuality + 14; // display anchor; exact expectation recomputed in UI via expectedQuality
      const band = checkpointBand(reading, expected);
      next.checkpoints = [...run.checkpoints, { turn: state.turn, band, note: BAND_NOTES[band] }];
    }
    return next;
  });
  return { ...state, runs, models, stars };
}

export function applyRunDecision(state: GameState, runId: string, decision: RunDecisionKind): GameState {
  const run = state.runs.find(r => r.id === runId);
  if (!run || run.status !== "active") return state;
  if (decision === "push") return state;
  if (decision === "scrap") {
    return {
      ...state,
      runs: state.runs.map(r => (r.id === runId ? { ...r, status: "scrapped" as const } : r)),
      stars: state.stars.map(s => (s.onRunId === runId ? { ...s, onRunId: null } : s)),
    };
  }
  // boost
  const tier = BALANCE.runTiers[run.scaleTier];
  const cost = run.computePerTurn * tier.costPerPFTurn * (BALANCE.run.boostCostMultiplier - 1);
  if (state.capital < cost) throw new Error("insufficient capital");
  return {
    ...state, capital: state.capital - cost,
    runs: state.runs.map(r => (r.id === runId ? { ...r, hiddenQuality: r.hiddenQuality + BALANCE.run.boostQuality } : r)),
  };
}
```

Note for implementer: the `expected` anchor inside `advanceRuns` intentionally uses a fixed display anchor rather than recomputing `expectedQuality` (the design object is gone post-launch). Store `expectedAtLaunch` if you prefer — then add it to `TrainingRun` and set it in `launchRun`; tests only require band membership.

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): run advancement, checkpoints, completion, decisions"`

---

### Task 8: Finance

**Files:**
- Create: `convergence-3/lib/engine/finance.ts`
- Test: `convergence-3/tests/engine/finance.test.ts`

**Interfaces:**
- Consumes: `compute.ts`, `BALANCE`, `GameState`.
- Produces:
  - `payrollPerTurn(state): number` — Σ star salaries + `teamStrength * teamCostPerPoint`.
  - `computeUpkeepPerTurn(state): number` — `totalCapacityPF * computeUpkeepPerPF`.
  - `runSpendPerTurn(state): number` — Σ active runs `computePerTurn * tier.costPerPFTurn`.
  - `revenuePerTurn(state): number` — Σ `revenueStreams.amountPerTurn` + inference revenue (`allocation.inference * inferenceRevenuePerPF * bestDeployedCapabilityAvg/100`, 0 if no deployed model).
  - `burnPerTurn(state): number` — payroll + upkeep + run spend.
  - `runwayMonths(state): number` — `capital / max((burn − revenue)/3, runwayFloorBurn)`; `Infinity` if revenue ≥ burn.
  - `applyFinance(state): { state: GameState; net: number }` — applies `capital += revenue − burn`, decays each revenue stream by its `decayPerTurn`, drops streams below 0.05.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { payrollPerTurn, computeUpkeepPerTurn, burnPerTurn, revenuePerTurn, runwayMonths, applyFinance } from "@/lib/engine/finance";

describe("finance", () => {
  const s = createInitialState("f");
  it("computes payroll from stars + team", () => {
    // 0.9+0.7+0.55+0.5 + 30*0.09 = 5.35
    expect(payrollPerTurn(s)).toBeCloseTo(5.35, 5);
  });
  it("computes upkeep from capacity", () => {
    expect(computeUpkeepPerTurn(s)).toBeCloseTo(40 * 0.045, 5);
  });
  it("no deployed model → inference allocation earns nothing", () => {
    const alloc = { ...s, allocation: { inference: 20, experiments: 0, safety: 0 } };
    expect(revenuePerTurn(alloc)).toBe(0);
  });
  it("applyFinance nets capital and decays streams", () => {
    const withStream = { ...s, revenueStreams: [{ source: "api", amountPerTurn: 10, decayPerTurn: 0.5 }] };
    const { state: next, net } = applyFinance(withStream);
    expect(net).toBeCloseTo(10 - burnPerTurn(s), 5);
    expect(next.capital).toBeCloseTo(s.capital + net, 5);
    expect(next.revenueStreams[0].amountPerTurn).toBeCloseTo(5, 5);
  });
  it("runway is finite when burning, infinite when profitable", () => {
    expect(runwayMonths(s)).toBeGreaterThan(0);
    expect(runwayMonths(s)).toBeLessThan(200);
    const rich = { ...s, revenueStreams: [{ source: "api", amountPerTurn: 999, decayPerTurn: 0 }] };
    expect(runwayMonths(rich)).toBe(Infinity);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
import { BALANCE } from "./balance";
import { totalCapacityPF } from "./compute";
import type { GameState } from "./types";

export function payrollPerTurn(state: GameState): number {
  return state.stars.reduce((a, s) => a + s.salaryPerQuarter, 0)
    + state.teamStrength * BALANCE.finance.teamCostPerPoint;
}
export function computeUpkeepPerTurn(state: GameState): number {
  return totalCapacityPF(state) * BALANCE.finance.computeUpkeepPerPF;
}
export function runSpendPerTurn(state: GameState): number {
  return state.runs.filter(r => r.status === "active")
    .reduce((a, r) => a + r.computePerTurn * BALANCE.runTiers[r.scaleTier].costPerPFTurn, 0);
}
function bestDeployedCapabilityAvg(state: GameState): number {
  const deployed = state.models.filter(m => m.positioning !== null);
  if (!deployed.length) return 0;
  return Math.max(...deployed.map(m =>
    (m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer) / 4));
}
export function revenuePerTurn(state: GameState): number {
  const streams = state.revenueStreams.reduce((a, r) => a + r.amountPerTurn, 0);
  const inference = state.allocation.inference * BALANCE.finance.inferenceRevenuePerPF
    * (bestDeployedCapabilityAvg(state) / 100);
  return streams + inference;
}
export function burnPerTurn(state: GameState): number {
  return payrollPerTurn(state) + computeUpkeepPerTurn(state) + runSpendPerTurn(state);
}
export function runwayMonths(state: GameState): number {
  const net = burnPerTurn(state) - revenuePerTurn(state);
  if (net <= 0) return Infinity;
  return state.capital / Math.max(net / 3, BALANCE.finance.runwayFloorBurn);
}
export function applyFinance(state: GameState): { state: GameState; net: number } {
  const net = revenuePerTurn(state) - burnPerTurn(state);
  const revenueStreams = state.revenueStreams
    .map(r => ({ ...r, amountPerTurn: r.amountPerTurn * (1 - r.decayPerTurn) }))
    .filter(r => r.amountPerTurn >= 0.05);
  return { state: { ...state, capital: state.capital + net, revenueStreams }, net };
}
```

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): finance — payroll, upkeep, revenue, runway"`

---

### Task 9: Model deployment

**Files:**
- Create: `convergence-3/lib/engine/deploy.ts`
- Test: `convergence-3/tests/engine/deploy.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `BALANCE`.
- Produces:
  - `deployModel(state: GameState, modelId: string, positioning: Positioning): GameState` — throws `Error("model not found")` / `Error("model already deployed")`. Sets `positioning`/`deployedTurn` and appends a `RevenueStream`: `source: model.name`, `amountPerTurn = avgCapability/10 * positioningMultipliers[positioning]`, `decayPerTurn = BALANCE.finance.revenueDecayPerTurn` (open-weights: decay 0 — tiny but durable, reputation effects arrive in Plans 2–3).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { deployModel } from "@/lib/engine/deploy";
import type { Model } from "@/lib/engine/types";

const model: Model = {
  id: "model-x", name: "Nimbus-1", createdTurn: 3,
  capability: { coding: 40, reasoning: 40, enterprise: 60, consumer: 20 },
  positioning: null, deployedTurn: null,
};

describe("deployModel", () => {
  it("positions a model and opens a revenue stream", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "enterprise");
    expect(s.models[0].positioning).toBe("enterprise");
    // avg 40 → 4 base × 1.35 = 5.4
    expect(s.revenueStreams[0].amountPerTurn).toBeCloseTo(5.4, 5);
    expect(s.revenueStreams[0].decayPerTurn).toBeCloseTo(0.06, 5);
  });
  it("open-weights earns little but does not decay", () => {
    const s = deployModel({ ...createInitialState("d"), models: [model] }, "model-x", "open-weights");
    expect(s.revenueStreams[0].amountPerTurn).toBeCloseTo(0.6, 5);
    expect(s.revenueStreams[0].decayPerTurn).toBe(0);
  });
  it("rejects unknown and double deploys", () => {
    const s = { ...createInitialState("d"), models: [model] };
    expect(() => deployModel(s, "nope", "api")).toThrow(/not found/);
    const once = deployModel(s, "model-x", "api");
    expect(() => deployModel(once, "model-x", "api")).toThrow(/already deployed/);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
import { BALANCE } from "./balance";
import type { GameState, Positioning } from "./types";

export function deployModel(state: GameState, modelId: string, positioning: Positioning): GameState {
  const model = state.models.find(m => m.id === modelId);
  if (!model) throw new Error("model not found");
  if (model.positioning) throw new Error("model already deployed");
  const avg = (model.capability.coding + model.capability.reasoning
    + model.capability.enterprise + model.capability.consumer) / 4;
  const amount = (avg / 10) * BALANCE.finance.positioningMultipliers[positioning];
  return {
    ...state,
    models: state.models.map(m => (m.id === modelId ? { ...m, positioning, deployedTurn: state.turn } : m)),
    revenueStreams: [...state.revenueStreams, {
      source: model.name, amountPerTurn: amount,
      decayPerTurn: positioning === "open-weights" ? 0 : BALANCE.finance.revenueDecayPerTurn,
    }],
  };
}
```

- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): model deployment and revenue streams"`

---

### Task 10: advanceTurn pipeline + debrief

**Files:**
- Create: `convergence-3/lib/engine/turn.ts`
- Test: `convergence-3/tests/engine/turn.test.ts`

**Interfaces:**
- Consumes: `advanceRuns`, `applyFinance`, `revenuePerTurn`, `burnPerTurn`, `runwayMonths`, `BALANCE`.
- Produces:
  - `advanceTurn(state: GameState): GameState` — fixed pipeline: (1) `applyFinance`; (2) `advanceRuns`; (3) build `TurnDebrief` explaining what changed (net cashflow line, run events: checkpoint/completed/failed lines, runway warning below 9 months); (4) `turn++`; (5) `ended = turn > BALANCE.totalTurns`. Throws `Error("game ended")` if called on an ended state.
  - `turnLabel(turn: number): string` — `"2026 Q1"` for turn 1, quarterly thereafter.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/lib/engine/state";
import { launchRun } from "@/lib/engine/runs";
import { advanceTurn, turnLabel } from "@/lib/engine/turn";

describe("advanceTurn", () => {
  it("advances the clock and applies burn", () => {
    const s0 = createInitialState("t");
    const s1 = advanceTurn(s0);
    expect(s1.turn).toBe(2);
    expect(s1.capital).toBeLessThan(s0.capital);      // pure burn at start
    expect(s1.lastDebrief!.turn).toBe(1);
    expect(s1.lastDebrief!.lines.some(l => l.kind === "finance")).toBe(true);
  });
  it("carries runs through the pipeline to completion", () => {
    let s = launchRun(createInitialState("t2"), { name: "N", scaleTier: 1, techniqueIds: ["rlhf"], leadId: null });
    for (let i = 0; i < 3; i++) s = advanceTurn(s);
    expect(["completed", "failed"]).toContain(s.runs[0].status);
    if (s.runs[0].status === "completed") expect(s.models).toHaveLength(1);
    expect(s.lastDebrief!.lines.some(l => l.kind === "run")).toBe(true);
  });
  it("is deterministic end-to-end", () => {
    const play = () => {
      let s = launchRun(createInitialState("det"), { name: "N", scaleTier: 1, techniqueIds: ["dpo"], leadId: "star-jonas" });
      for (let i = 0; i < 6; i++) s = advanceTurn(s);
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
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
import { BALANCE } from "./balance";
import { applyFinance, revenuePerTurn, burnPerTurn, runwayMonths } from "./finance";
import { advanceRuns } from "./runs";
import type { DebriefLine, GameState, TurnDebrief } from "./types";

export function turnLabel(turn: number): string {
  return `${2026 + Math.floor((turn - 1) / 4)} Q${((turn - 1) % 4) + 1}`;
}

export function advanceTurn(state: GameState): GameState {
  if (state.ended) throw new Error("game ended");
  const lines: DebriefLine[] = [];
  const revenue = revenuePerTurn(state);
  const burn = burnPerTurn(state);
  const runsBefore = state.runs;

  const fin = applyFinance(state);
  let s = advanceRuns(fin.state);

  lines.push({
    kind: "finance",
    text: `Net ${fin.net >= 0 ? "+" : ""}$${fin.net.toFixed(1)}M (revenue $${revenue.toFixed(1)}M, burn $${burn.toFixed(1)}M).`,
  });
  for (const run of s.runs) {
    const before = runsBefore.find(r => r.id === run.id);
    if (!before || before.status !== "active") continue;
    if (run.status === "completed") lines.push({ kind: "run", text: `${run.name} finished training — model ready to position.` });
    else if (run.status === "failed") lines.push({ kind: "run", text: `${run.name} failed. $${run.spentToDate.toFixed(1)}M spent for nothing shippable.` });
    else if (run.checkpoints.length > before.checkpoints.length) {
      const cp = run.checkpoints[run.checkpoints.length - 1];
      lines.push({ kind: "run", text: `${run.name} checkpoint: ${cp.band}. ${cp.note}` });
    }
  }
  const runway = runwayMonths(s);
  if (runway < 9) lines.push({ kind: "finance", text: `Runway ${runway.toFixed(1)} months. The board is watching.` });

  const debrief: TurnDebrief = {
    turn: state.turn,
    headline: `${turnLabel(state.turn)} closed.`,
    lines,
  };
  const nextTurn = state.turn + 1;
  return { ...s, turn: nextTurn, lastDebrief: debrief, ended: nextTurn > BALANCE.totalTurns };
}
```

- [ ] **Step 4: Verify pass; also run the full suite** — `npm test` → all green.
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): advanceTurn pipeline with debrief"`

---

### Task 11: Store with versioned persistence

**Files:**
- Create: `convergence-3/lib/store/gameStore.ts`, `convergence-3/lib/store/selectors.ts`
- Test: `convergence-3/tests/store/gameStore.test.ts`

**Interfaces:**
- Consumes: all engine modules.
- Produces:
  - `useGameStore` — Zustand store: `{ game: GameState | null }` plus actions `newGame(seed: string)`, `endTurn()`, `allocate(alloc: ComputeAllocation)`, `launch(design: RunDesign)`, `decideRun(runId: string, decision: RunDecisionKind)`, `deploy(modelId: string, positioning: Positioning)`, `abandonGame()`. Every action delegates to the pure engine function and replaces `game`; engine throws surface as `lastError: string | null` on the store (cleared on next successful action) — actions never throw to React.
  - `migrateSnapshot(persisted: unknown): { game: GameState | null }` — returns `{ game: null }` for missing/other-version payloads (v1 is the first version; later versions add real migrations).
  - `selectors.ts`: `selectTopBar(s)` → `{ turnText, capital, runwayText, freePFText, trust, board }`; `selectActiveRuns(s)`; `selectUndeployedModels(s)`.
  - Persist config: `name: "convergence3-save"`, `version: 1`, `partialize: (s) => ({ game: s.game })`, `migrate: migrateSnapshot`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, migrateSnapshot } from "@/lib/store/gameStore";

describe("game store", () => {
  beforeEach(() => useGameStore.getState().abandonGame());

  it("starts a new deterministic game", () => {
    useGameStore.getState().newGame("store-seed");
    expect(useGameStore.getState().game!.turn).toBe(1);
  });
  it("endTurn advances and records debrief", () => {
    useGameStore.getState().newGame("store-seed");
    useGameStore.getState().endTurn();
    const g = useGameStore.getState().game!;
    expect(g.turn).toBe(2); expect(g.lastDebrief).not.toBeNull();
  });
  it("captures engine errors instead of throwing", () => {
    useGameStore.getState().newGame("store-seed");
    useGameStore.getState().allocate({ inference: 999, experiments: 0, safety: 0 });
    expect(useGameStore.getState().lastError).toMatch(/exceeds/);
    expect(useGameStore.getState().game!.allocation.inference).toBe(0); // unchanged
  });
  it("migrates unknown snapshots to null", () => {
    expect(migrateSnapshot({ whatever: true })).toEqual({ game: null });
    expect(migrateSnapshot(undefined)).toEqual({ game: null });
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

`gameStore.ts`:
```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createInitialState } from "@/lib/engine/state";
import { setAllocation } from "@/lib/engine/compute";
import { launchRun, applyRunDecision } from "@/lib/engine/runs";
import { deployModel } from "@/lib/engine/deploy";
import { advanceTurn } from "@/lib/engine/turn";
import type { ComputeAllocation, GameState, Positioning, RunDecisionKind, RunDesign } from "@/lib/engine/types";

interface GameStore {
  game: GameState | null;
  lastError: string | null;
  newGame: (seed: string) => void;
  endTurn: () => void;
  allocate: (alloc: ComputeAllocation) => void;
  launch: (design: RunDesign) => void;
  decideRun: (runId: string, decision: RunDecisionKind) => void;
  deploy: (modelId: string, positioning: Positioning) => void;
  abandonGame: () => void;
}

export function migrateSnapshot(persisted: unknown): { game: GameState | null } {
  const p = persisted as { game?: GameState } | undefined;
  if (p && p.game && p.game.version === 1) return { game: p.game };
  return { game: null };
}

function act(set: (p: Partial<GameStore>) => void, get: () => GameStore, fn: (g: GameState) => GameState) {
  const game = get().game;
  if (!game) return;
  try { set({ game: fn(game), lastError: null }); }
  catch (e) { set({ lastError: e instanceof Error ? e.message : String(e) }); }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null, lastError: null,
      newGame: seed => set({ game: createInitialState(seed), lastError: null }),
      endTurn: () => act(set, get, advanceTurn),
      allocate: alloc => act(set, get, g => setAllocation(g, alloc)),
      launch: design => act(set, get, g => launchRun(g, design)),
      decideRun: (runId, decision) => act(set, get, g => applyRunDecision(g, runId, decision)),
      deploy: (modelId, positioning) => act(set, get, g => deployModel(g, modelId, positioning)),
      abandonGame: () => set({ game: null, lastError: null }),
    }),
    {
      name: "convergence3-save", version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ game: s.game }),
      migrate: migrateSnapshot,
    },
  ),
);
```

Note: vitest runs in node — `localStorage` is absent. `createJSONStorage` tolerates a missing storage (persist becomes a no-op) so the tests above run unmodified; if the installed zustand version warns, set `environment: "jsdom"` for `tests/store/**` via a `// @vitest-environment jsdom` pragma at the top of the test file (and `npm i -D jsdom`).

`selectors.ts`:
```ts
import { freePF } from "@/lib/engine/compute";
import { runwayMonths } from "@/lib/engine/finance";
import { turnLabel } from "@/lib/engine/turn";
import type { GameState } from "@/lib/engine/types";

export const selectTopBar = (g: GameState) => ({
  turnText: turnLabel(g.turn),
  capital: g.capital,
  runwayText: runwayMonths(g) === Infinity ? "∞" : `${runwayMonths(g).toFixed(0)}mo`,
  freePFText: `${freePF(g).toFixed(0)} PF free`,
  trust: g.trust, board: g.boardConfidence,
});
export const selectActiveRuns = (g: GameState) => g.runs.filter(r => r.status === "active");
export const selectUndeployedModels = (g: GameState) => g.models.filter(m => m.positioning === null);
```

- [ ] **Step 4: Verify pass** — `npm test` all green.
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): zustand store with versioned persistence and selectors"`

---

### Task 12: UI shell — TopBar, NavRail, GameShell, new-game screen

**Files:**
- Create: `components/shell/GameShell.tsx`, `components/shell/TopBar.tsx`, `components/shell/NavRail.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `selectTopBar`.
- Produces: `GameShell` renders: no game → start screen (`data-testid="start-screen"`, seed input + "Found the Lab" button calling `newGame`); active game → `TopBar` + `NavRail` (panels: `briefing | runs | compute | finance`, local `useState<PanelId>`) + the active panel + a fixed End Turn button (`data-testid="end-turn"`). `lastError` renders as a dismissible toast (`data-testid="error-toast"`).

This task is visual — no unit test; verification is via the preview browser.

- [ ] **Step 1: Implement the three components + page wiring.** `TopBar` shows turnText / capital (`$${capital.toFixed(1)}M`) / runwayText / freePFText / trust / board as labeled stat chips. `NavRail` is a vertical button list, active panel highlighted. `GameShell` is `"use client"`; panels stubbed as `<div data-testid="panel-{id}">` placeholders (filled in Tasks 13–15).
- [ ] **Step 2: Verify in browser.** Add `.claude/launch.json` config named `convergence-3` (`npm`, `["run","dev"]`, port 3000, cwd `convergence-3`). Start preview → snapshot shows start screen; found a lab; snapshot shows TopBar with `2026 Q1`, `$120.0M`; click End Turn; TopBar shows `2026 Q2` and lower capital.
- [ ] **Step 3: Commit** — `git commit -m "feat(c3): game shell, top bar, nav rail, start screen"`

---

### Task 13: Runs panel + run designer + checkpoint decisions

**Files:**
- Create: `components/panels/RunsPanel.tsx`, `components/modals/RunDesigner.tsx`, `components/modals/CheckpointModal.tsx`

**Interfaces:**
- Consumes: `selectActiveRuns`, `expectedQuality`, `riskBand`, store actions `launch`, `decideRun`; `TECHNIQUES`, `BALANCE.runTiers`.
- Produces: RunsPanel lists active runs (name, tier, turns elapsed/total, compute committed, spend to date, latest checkpoint band as a colored chip — NEVER hiddenQuality) + completed/failed history. "Design Training Run" opens RunDesigner: name input, tier picker showing computePerTurn/turns/cost-per-turn from BALANCE, technique multi-select, lead picker (only stars with `onRunId === null`), live preview of `expectedQuality` (shown as "projected capability band", mapped: <35 "modest", <55 "competitive", <75 "frontier", else "landmark") and `riskBand`, disabled-with-reason launch button when validation would throw (insufficient compute / lead busy). A run whose latest checkpoint is `wobbly`/`troubled` shows Push / Boost (with cost) / Scrap buttons calling `decideRun`.

- [ ] **Step 1: Implement the three components.** Wire into GameShell's `runs` panel slot.
- [ ] **Step 2: Browser verification.** Design a tier-1 run with RLHF + a lead → launch → TopBar free PF drops by 8; End Turn twice → checkpoint chip appears; complete the run → it moves to history and a model appears (deployment UI lands in Task 15, store already holds it).
- [ ] **Step 3: Commit** — `git commit -m "feat(c3): runs panel, run designer, checkpoint decisions"`

---

### Task 14: Compute panel

**Files:**
- Create: `components/panels/ComputePanel.tsx`

**Interfaces:**
- Consumes: `totalCapacityPF`, `committedRunPF`, `freePF`, store `allocate`; `selectActiveRuns`.
- Produces: a stacked capacity bar (run commitments locked/hatched, then inference / experiments / safety as adjustable segments, free as empty) + three number steppers bound to a local draft allocation, an Apply button calling `allocate` (validation errors surface via the existing toast), and a line-item list of facilities. Locked run segments display which run holds them.

- [ ] **Step 1: Implement.** Draft state local (`useState<ComputeAllocation>` initialized from store; reset on game change via `useEffect` on `game.turn`).
- [ ] **Step 2: Browser verification.** Allocate 10 PF to inference → apply → TopBar free PF updates; attempt to over-allocate → toast appears, allocation unchanged.
- [ ] **Step 3: Commit** — `git commit -m "feat(c3): compute allocation panel"`

---

### Task 15: Finance + briefing panels, deployment, end-turn flow

**Files:**
- Create: `components/panels/FinancePanel.tsx`, `components/panels/BriefingPanel.tsx`, `components/modals/EndTurnSummary.tsx`, `components/modals/DebriefModal.tsx`

**Interfaces:**
- Consumes: finance functions, `selectUndeployedModels`, store `deploy`, `endTurn`; `lastDebrief`.
- Produces:
  - FinancePanel: revenue/burn breakdown table (payroll, compute upkeep, run spend / each revenue stream with its decay), runway callout, and an "Undeployed models" section — each model shows its four capability scores and four positioning buttons with the projected `amountPerTurn` for each (transparency law: show the revenue math before committing).
  - BriefingPanel: renders `lastDebrief` (headline + lines grouped by kind) or a first-turn welcome; authored static copy, no LLM.
  - EndTurnSummary (the commitment summary from spec §16): intercepts the End Turn button — lists active run commitments, current allocation, net cashflow projection (`revenuePerTurn − burnPerTurn`), and any undeployed models as a nudge; Confirm calls `endTurn`, opens DebriefModal with the new `lastDebrief`.
- [ ] **Step 1: Implement all four.** Wire End Turn → EndTurnSummary → DebriefModal chain in GameShell.
- [ ] **Step 2: Browser verification (full slice loop).** Play 8 turns in the preview browser: launch a run, allocate inference, complete the run, deploy the model as enterprise, watch revenue appear in FinancePanel and decay over subsequent turns, confirm debriefs narrate each event. Screenshot for the record.
- [ ] **Step 3: Commit** — `git commit -m "feat(c3): finance/briefing panels, deployment, end-turn flow"`

---

### Task 16: Deploy to Cloudflare Pages

**Files:**
- Create: `convergence-3/wrangler.toml`
- Modify: `convergence-3/package.json` (add `"deploy": "next build && wrangler pages deploy out --project-name convergence-3"`)

**Interfaces:**
- Consumes: the built `out/` static export.
- Produces: a live `convergence-3.pages.dev` URL.

- [ ] **Step 1: Create the Pages project and deploy.** Follow the `cloudflare-deploy-verify` skill: `npx wrangler pages project create convergence-3 --production-branch main` then `npm run deploy`.
- [ ] **Step 2: Verify live.** `curl -s -o /dev/null -w "%{http_code}" https://convergence-3.pages.dev/` → `200`, then load the URL in the preview browser and complete one full turn. A deploy is done only when the live endpoint proves it.
- [ ] **Step 3: Commit** — `git commit -m "feat(c3): cloudflare pages deploy config"`

---

## Self-Review Notes

- **Spec coverage (Plan-1 scope):** core loop steps 2–4 (§3) ✔ tasks 5–10/15; training run lifecycle (§4) ✔ tasks 6–7; finance basics (§7 revenue decay stand-in) ✔ tasks 8–9; transparency law (§16) ✔ tasks 13/15 (projected bands, revenue math, commitment summary); engine purity/balance-config/versioned saves (§14) ✔ tasks 2–3/11. Deliberately deferred: rivals/talent-market/safety/events → Plan 2; eras/endings → Plan 3; AI layer/onboarding/art → Plan 4. Briefing step 1 of the loop ships as debrief-driven static copy until Plan 4.
- **Type consistency:** `RunDecisionKind` = `"push" | "boost" | "scrap"` used in tasks 7/11/13; `ComputeAllocation` fields `inference/experiments/safety` in tasks 3/5/11/14; `Positioning` values match `positioningMultipliers` keys in tasks 3/9/15.
- **Known intentional simplifications (Era-1 stand-ins, replaced in later plans):** flat `revenueDecayPerTurn` (→ rival-driven fast-follow, Plan 2); `allocation.safety`/`experiments` accepted but inert (→ safety tiers + technique unlocks, Plan 2/3); `checkpoint expected` display anchor (see Task 7 note).
