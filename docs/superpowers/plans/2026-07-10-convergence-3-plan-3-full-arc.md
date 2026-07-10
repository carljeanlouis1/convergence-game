# Convergence 3 — Plan 3: The Full Arc

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The complete campaign: eras 2–4 that change the rules, facility building, era-specific dilemmas, AGI + Applied Frontier mega-projects, and all 11 endings with a visible Endings Compass, pyrrhic overlay, and graded epilogues.

**Architecture:** Three new engine modules (`eras`, `facilities`, `frontiers`) plus an `endings` module fed by a per-turn `stats` block; the pipeline gains era transitions and ending evaluation. Save bumps to v3. UI gains a Compass panel, era-transition briefings, build actions in Compute, a Frontiers section in Runs, and full ending screens.

**Tech Stack:** unchanged.

## Global Constraints

- All Plan-1/2 global constraints hold (engine purity, BALANCE tunables, seeded RNG, transparency law, dilemma blocking, deploy `--branch=main`, commit per task on branch `c3-plan-3`, don't push).
- Save version 2 → 3 with migration (backfill `stats`, `builds`, `frontierProjects`, `pendingEraBriefing`); v1 saves chain-migrate v1→v2→v3.
- Endings must be evaluated from the same visible stats the Compass renders — no hidden thresholds except the one deliberately hidden ending (`simulation-revelation`, which the Compass lists as "???").
- 48-turn campaigns must remain deterministic per seed (CI test plays the full arc).

## File Structure

```
lib/engine/types.ts      # MODIFY: GameStats, FacilityBuild, FrontierProject, EndingResult, GameState v3
lib/engine/balance.ts    # MODIFY: eras, builds, frontiers, endings sections
lib/engine/content.ts    # MODIFY: era 2-4 TECHNIQUES, BUILD_OPTIONS, FRONTIER_DEFS, 6 new DILEMMAS, ERA_BRIEFINGS
lib/engine/eras.ts       # NEW: eraForTurn, eraScalars, applyEraTransition
lib/engine/facilities.ts # NEW: startBuild, buildsTurn
lib/engine/frontiers.ts  # NEW: AGI detection, startFrontier, frontiersTurn
lib/engine/endings.ts    # NEW: updateStats, evaluateEndings, trajectory, grade
lib/engine/state.ts      # MODIFY: v3 fields + v3Defaults
lib/engine/turn.ts       # MODIFY: era transition, builds, frontiers, stats, endings in pipeline
lib/engine/rivals.ts     # MODIFY: era scalars on jump size; lib/engine/talent.ts poach chance scalar
lib/store/gameStore.ts   # MODIFY: v3 migration, startBuild/startFrontier actions, endingsSeen meta
components/panels/CompassPanel.tsx    # NEW
components/panels/ComputePanel.tsx    # MODIFY: build section
components/panels/RunsPanel.tsx       # MODIFY: Frontiers section (era 4 + AGI)
components/modals/EraBriefingModal.tsx # NEW
components/shell/GameShell.tsx        # MODIFY: compass nav, era modal, full EndingScreen
tests/engine/{eras,facilities,frontiers,endings,turn-v3}.test.ts, tests/store/migration.test.ts (extend)
```

---

### Task 1: v3 types, balance, stats block, migration

**Interfaces (all later tasks consume exactly these):**

`types.ts` additions:
```ts
export interface GameStats {
  profitStreak: number;      // consecutive turns net >= 0
  topStreak: number;         // consecutive turns ranked #1
  topStreakSpansEra: boolean;// current topStreak crossed an era boundary
  laggingStreak: number;     // consecutive turns overall < endings.laggingFraction of leader (after endings.laggingFromTurn)
  openShare: number;         // accumulates from live open-weights models
  incidents: number;         // total safety incidents fired
  standardsAdopted: boolean; // set by the standards-body dilemma
  agiTurn: number | null;    // first turn a deployed model avg >= frontiers.agiThreshold
}
export interface FacilityBuild { optionId: string; name: string; capacityPF: number; turnsLeft: number; }
export type FrontierId = "robotics" | "biology" | "materials" | "space" | "simulation";
export interface FrontierProject {
  id: FrontierId; name: string; status: "locked" | "available" | "active" | "completed";
  turnsLeft: number; computePerTurn: number; // committed while active
}
export interface BuildOption { id: string; name: string; era: 1|2|3|4; capacityPF: number; costM: number; turns: number; trustDelta: number; note: string; }
export interface EndingResult { id: string; victory: boolean; pyrrhic: boolean; grade: "S"|"A"|"B"|"C"|"D"; }
```
`GameState` gains: `stats: GameStats; builds: FacilityBuild[]; frontierProjects: FrontierProject[]; pendingEraBriefing: 1|2|3|4|null; endingResult: EndingResult | null;` and `version: 1|2|3`.

`BALANCE` additions:
```ts
  eras: {
    startTurns: { 2: 11, 3: 25, 4: 39 },
    scalars: { // multipliers by era index 1-4
      rivalJump:   { 1: 1.0, 2: 1.25, 3: 1.5, 4: 1.8 },
      fastFollow:  { 1: 1.0, 2: 1.15, 3: 1.4, 4: 1.6 },
      poachChance: { 1: 1.0, 2: 1.3, 3: 1.5, 4: 1.5 },
    },
  },
  frontiers: { agiThreshold: 88, projectTurns: 6, projectComputePerTurn: 60, projectCostM: 80,
    payoffRevenue: 30, payoffTrust: 8, transcendenceCount: 3 },
  endings: {
    titanRevenue: 40, titanStreak: 4, titanControl: 50,
    crownStreak: 6,
    standardShare: 60, openSharePerModelPerTurn: 2,
    conscienceTrust: 85, conscienceEval: 40,
    asiCapability: 92, asiTrust: 60, asiEval: 60,
    laggingFraction: 0.45, laggingFromTurn: 24, laggingTurns: 6,
    catastropheIncidents: 3,
    pyrrhicControl: 35, pyrrhicTrust: 35,
    gradeThresholds: { S: 220, A: 160, B: 110, C: 60 }, // score below C = D
  },
```
`state.ts`: `v3Defaults()` → `{ stats: {profitStreak:0, topStreak:0, topStreakSpansEra:false, laggingStreak:0, openShare:0, incidents:0, standardsAdopted:false, agiTurn:null}, builds: [], frontierProjects: structuredClone(FRONTIER_DEFS), pendingEraBriefing: null, endingResult: null }`; `createInitialState` returns `version: 3` spreading v2Defaults + v3Defaults. Migration: v3 pass-through; v2 → spread v3Defaults; v1 → chain through v2 backfill then v3.

- [ ] **Step 1: extend `tests/store/migration.test.ts`** with:
```ts
  it("upgrades v2 saves to v3 with stats backfilled", () => {
    const g = structuredClone(createInitialState("m3")) as unknown as Record<string, unknown>;
    for (const k of ["stats", "builds", "frontierProjects", "pendingEraBriefing", "endingResult"]) delete g[k];
    g.version = 2;
    const out = migrateSnapshot({ game: g });
    expect(out.game!.version).toBe(3);
    expect(out.game!.stats.profitStreak).toBe(0);
    expect(out.game!.frontierProjects).toHaveLength(5);
  });
```
Also update the v1 test's deleted-keys list to include the v3 fields and assert `version === 3` at the end of the chain.
- [ ] **Steps 2–5:** fail → implement (FRONTIER_DEFS arrives in Task 5; for now export it from `content.ts` with 5 entries, all `status: "locked"`, `turnsLeft: 6`, `computePerTurn: 60`) → full suite green (update `state.test.ts` version assertion to 3) → commit `feat(c3): v3 types, stats block, save migration`

---

### Task 2: Era system

**Files:** Create `lib/engine/eras.ts`; modify `content.ts` (era 2–4 TECHNIQUES + ERA_BRIEFINGS), `rivals.ts`, `talent.ts`. Test `tests/engine/eras.test.ts`.

**Interfaces:**
- `eraForTurn(turn: number): 1|2|3|4` from `BALANCE.eras.startTurns`.
- `eraScalar(kind: "rivalJump"|"fastFollow"|"poachChance", era: number): number`.
- `applyEraTransition(state: GameState): GameState` — if `eraForTurn(state.turn) > state.era`: set `era`, set `pendingEraBriefing` to the new era, chronicle (kind "world") with the briefing headline. Called at the top of `advanceTurn` after the clock check.
- `content.ts`: TECHNIQUES gains: era 2 `rlvr` (qualityBonus 9, variance 4, coding/reasoning-weighted) and `moe-architecture` (bonus 6, variance 2, balanced); era 3 `distillation` (bonus 5, variance 0.5) and `agentic-scaffolding` (bonus 8, variance 3, coding 1.2); era 4 `recursive-self-improvement` (bonus 14, variance 7 — and `launchRun` adds +6 incidentRisk when it's in the design: modify `runs.ts`). `ERA_BRIEFINGS: Record<2|3|4, { title: string; body: string }>` — authored copy: era 2 "The Scale-Up Era" (megadeals, safety frameworks arrive), era 3 "The Frontier Wars" (open-weight shocks, regulation, export controls), era 4 "The Convergence" (the AGI era; everything you built was prologue).
- `rivals.ts` jump line becomes `... * eraScalar("rivalJump", state.era)`; `applyFastFollow` decay `* eraScalar("fastFollow", state.era)` (still capped); `talent.ts` poach chance `* eraScalar("poachChance", state.era)`.

- [ ] **Step 1: failing tests**
```ts
import { eraForTurn, eraScalar, applyEraTransition } from "@/lib/engine/eras";
import { createInitialState } from "@/lib/engine/state";
import { TECHNIQUES, ERA_BRIEFINGS } from "@/lib/engine/content";

it("maps turns to eras", () => {
  expect(eraForTurn(1)).toBe(1); expect(eraForTurn(10)).toBe(1);
  expect(eraForTurn(11)).toBe(2); expect(eraForTurn(24)).toBe(2);
  expect(eraForTurn(25)).toBe(3); expect(eraForTurn(39)).toBe(4); expect(eraForTurn(48)).toBe(4);
});
it("transition flips era once and queues the briefing", () => {
  const s = { ...createInitialState("e"), turn: 11 };
  const out = applyEraTransition(s);
  expect(out.era).toBe(2);
  expect(out.pendingEraBriefing).toBe(2);
  expect(applyEraTransition(out).pendingEraBriefing).toBe(2); // idempotent, no double-fire
  expect(ERA_BRIEFINGS[2].title.length).toBeGreaterThan(0);
});
it("later eras are meaner and richer", () => {
  expect(eraScalar("rivalJump", 4)).toBeGreaterThan(eraScalar("rivalJump", 1));
  expect(TECHNIQUES.filter(t => t.era === 2).length).toBeGreaterThanOrEqual(2);
  expect(TECHNIQUES.filter(t => t.era === 4).some(t => t.id === "recursive-self-improvement")).toBe(true);
});
```
- [ ] **Steps 2–5:** fail → implement (+ `runs.ts` RSI incident-risk rider with a test asserting `launchRun` with RSI raises `incidentRisk` by 6) → green → commit `feat(c3): era system — transitions, scalars, era techniques`

---

### Task 3: Facility building

**Files:** Create `lib/engine/facilities.ts`; modify `content.ts` (BUILD_OPTIONS). Test `tests/engine/facilities.test.ts`.

**Interfaces:**
- `BUILD_OPTIONS: BuildOption[]` — era 1 `colo-expansion` (+20 PF, $12M, 2 turns, trust 0, "Rented halls, quick power"); era 2 `regional-dc` (+50, $35M, 3, 0) and `own-power-plant` (+40, $25M, 2, −4, "Gas turbines behind the meter. Fast, loud, unpopular"); era 3 `gigacluster` (+120, $90M, 4, −2); era 4 `orbital-compute` (+250, $200M, 4, +2, "If the grid won't have you, leave the grid").
- `availableBuilds(state): BuildOption[]` — options with `era <= state.era`, excluding ids already built or in progress.
- `startBuild(state, optionId): GameState` — throws `"unknown build"` / `"already building"` / `"insufficient capital"`; deducts cost, applies trustDelta, pushes `FacilityBuild`, chronicle (kind "world").
- `buildsTurn(state): { state: GameState; lines: string[] }` — decrement `turnsLeft`; at 0, append a `Facility { id: "fac-"+optionId, onlineTurn: turn + 1 }` and a line.

- [ ] **Step 1: failing tests**
```ts
it("builds a facility over multiple turns", () => {
  let s = { ...createInitialState("b") };
  s = startBuild(s, "colo-expansion");
  expect(s.capital).toBeCloseTo(120 - 12, 5);
  expect(s.builds).toHaveLength(1);
  expect(() => startBuild(s, "colo-expansion")).toThrow(/already building/);
  s = buildsTurn(s).state;                    // 1 turn left
  const done = buildsTurn({ ...s, turn: s.turn + 1 }).state;
  expect(done.builds).toHaveLength(0);
  expect(done.facilities.some(f => f.id === "fac-colo-expansion")).toBe(true);
});
it("era-gates options and enforces capital", () => {
  const s = createInitialState("b");
  expect(availableBuilds(s).map(o => o.id)).toEqual(["colo-expansion"]);
  expect(availableBuilds({ ...s, era: 2 }).length).toBe(3);
  expect(() => startBuild({ ...s, capital: 5 }, "colo-expansion")).toThrow(/insufficient capital/);
});
```
- [ ] **Steps 2–5:** fail → implement → green → commit `feat(c3): facility building`

---

### Task 4: Era 2–3 dilemma deck (6 new)

**Files:** Modify `content.ts` (append to DILEMMAS). Extend `tests/engine/events.test.ts` (count ≥ 14; every era-2/3 def has era set correctly).

Author these in the established voice, each 2–3 options × 2 weighted outcomes using existing delta keys (plus `standardsAdopted` — extend `DilemmaOptionOutcome.deltas` with optional `standardsAdopted: boolean` and apply it in `resolveDilemma`):
1. `export-control-whiplash` (era 3) — your chip supplier is banned, then unbanned; committed either way. Punishes rigidity.
2. `deepseek-shock` (era 3) — an unranked lab ships a shockingly cheap frontier model; respond with price cuts (capital/morale) or a research sprint (burnout risk via morale/teamStrength).
3. `standards-body-invite` (era 2) — chair the industry safety-standards body: accept (sets `standardsAdopted: true`, −capital, +trust — the gateway to The Conscience) or decline (board +).
4. `gpu-allocation-queue` (era 2) — your next-gen GPU allocation slips a year unless you prepay (capital) or sign an exclusivity clause (control).
5. `agi-doomer-protest` (era 3) — protesters chain themselves to your datacenter gates: engage publicly (+trust −board) or clear them out (−trust +board, incidentRisk).
6. `sovereign-fund-offer` (era 2) — a sovereign wealth fund offers a blank check: take it (+capital, −control, −trust) or leak that you refused (+trust, board −).

- [ ] **Steps 1–5:** extend the count test to ≥ 14 → fail → author → green → commit `feat(c3): era 2-3 dilemma deck`

---

### Task 5: Applied Frontiers

**Files:** Create `lib/engine/frontiers.ts`; modify `content.ts` (FRONTIER_DEFS full copy). Test `tests/engine/frontiers.test.ts`.

**Interfaces:**
- `FRONTIER_DEFS: FrontierProject[]` — robotics "Autonomous Labor", biology "Cures at Scale", materials "Post-Scarcity Materials", space "The Off-World Push", simulation "World Modeling" — all `locked`, `turnsLeft: BALANCE.frontiers.projectTurns`, `computePerTurn: projectComputePerTurn`.
- `checkAgi(state): GameState` — if `stats.agiTurn === null` and best deployed model avg ≥ `agiThreshold`: set `stats.agiTurn`, chronicle "AGI. The models are doing the research now." If era === 4 and agiTurn set: flip `locked → available` on all frontier projects.
- `startFrontier(state, id): GameState` — requires status `available` (`"frontier not available"`), capital ≥ `projectCostM` (`"insufficient capital"`), free PF ≥ `projectComputePerTurn` (`"insufficient free compute"`); sets active, deducts capital. Active frontier compute counts in `committedRunPF` — modify `compute.ts` to add `state.frontierProjects.filter(p => p.status === "active").reduce((a, p) => a + p.computePerTurn, 0)`.
- `frontiersTurn(state): { state: GameState; lines: string[] }` — decrement active projects; on completion: status completed, revenue stream `{ source: "Frontier: "+name, amountPerTurn: payoffRevenue, decayPerTurn: 0 }`, trust +`payoffTrust`, chronicle + line.

- [ ] **Step 1: failing tests**
```ts
const agiModel: Model = { id: "agi", name: "Prometheus-9", createdTurn: 1,
  capability: { coding: 90, reasoning: 90, enterprise: 88, consumer: 86 }, positioning: "api", deployedTurn: 1 };
it("detects AGI once and unlocks frontiers in era 4", () => {
  let s = { ...createInitialState("fr"), era: 4 as const, models: [agiModel] };
  s = checkAgi(s);
  expect(s.stats.agiTurn).toBe(s.turn);
  expect(s.frontierProjects.every(p => p.status === "available")).toBe(true);
  expect(checkAgi(s).stats.agiTurn).toBe(s.turn); // stable
});
it("runs a frontier project to completion and pays off", () => {
  let s = { ...createInitialState("fr"), era: 4 as const, models: [agiModel], capital: 500,
    facilities: [{ id: "big", name: "Big", capacityPF: 200, upkeepPerTurn: 0, onlineTurn: 1 }] };
  s = checkAgi(s);
  s = startFrontier(s, "robotics");
  expect(s.capital).toBeCloseTo(500 - 80, 5);
  for (let i = 0; i < 6; i++) s = frontiersTurn({ ...s, turn: s.turn + 1 }).state;
  expect(s.frontierProjects.find(p => p.id === "robotics")!.status).toBe("completed");
  expect(s.revenueStreams.some(r => r.source.startsWith("Frontier:"))).toBe(true);
});
it("frontier compute is committed compute", () => {
  let s = { ...createInitialState("fr"), era: 4 as const, models: [agiModel], capital: 500,
    facilities: [{ id: "big", name: "Big", capacityPF: 200, upkeepPerTurn: 0, onlineTurn: 1 }] };
  s = startFrontier(checkAgi(s), "space");
  expect(committedRunPF(s)).toBe(60);
});
```
- [ ] **Steps 2–5:** fail → implement → green → commit `feat(c3): applied frontiers — AGI threshold and mega-projects`

---

### Task 6: Stats + endings engine

**Files:** Create `lib/engine/endings.ts`. Test `tests/engine/endings.test.ts`.

**Interfaces:**
- `updateStats(state, netThisTurn: number): GameState` — profitStreak (reset on net<0); topStreak from `leaderboard` #1 (reset otherwise; set `topStreakSpansEra` when a streak was alive across an `eraForTurn` boundary); laggingStreak per BALANCE (player overall < laggingFraction × leader overall, only counted after `laggingFromTurn`, reset when not); `openShare += liveOpenModels * openSharePerModelPerTurn` where liveOpenModels = models with positioning "open-weights". Incidents counter: increment inside `safetyTurn` instead (modify `safety.ts` to `stats.incidents + 1` on incident).
- `evaluateEndings(state): string | null` — priority order: `catastrophe` (incidents ≥ catastropheIncidents) → `irrelevant` (laggingStreak ≥ laggingTurns) → `beneficial-asi` → `transcendence` (completed frontiers ≥ transcendenceCount) → `simulation-revelation` (simulation completed AND evalCapacity ≥ asiEval AND openShare === 0) → `frontier-crown` → `enterprise-titan` → `the-standard` → `the-conscience`. (Ousted/absorbed are set by `fundingTurn` already.) Conditions exactly per BALANCE.endings and the GameStats fields.
- `finalizeEnding(state, endingId): GameState` — sets `ending`, `ended: true`, computes `EndingResult`: `victory` = id in the 7 victory list; `pyrrhic` = victory && (control < pyrrhicControl || trust < pyrrhicTrust); `grade` from `score = capital*0.05 + revenuePerTurn(state) + trust/2 + control/2 + completedFrontiers*20 - stats.incidents*10 + (leaderboard #1 ? 30 : 0)` against gradeThresholds.
- `trajectory(state): Array<{ id: string; label: string; progress: number; pull: string; hidden: boolean }>` — one entry per ending (11 + open-road excluded); progress 0–1 from the same conditions (e.g. titan = min(profitStreak/titanStreak, revenue/titanRevenue, control/titanControl requirements normalized, take the min); `simulation-revelation` renders `hidden: true`, label "???"; defeats show progress toward doom (e.g. absorbed = fireSaleCount/3). `pull` is one sentence naming the binding constraint ("Need 2 more profitable quarters").
- Timeout: in pipeline, `turn > totalTurns` with no ending → `finalizeEnding(state, "open-road")` (not a victory, not pyrrhic, graded).

- [ ] **Step 1: failing tests**
```ts
it("evaluates enterprise-titan from stats", () => {
  let s = { ...createInitialState("en"), control: 60,
    revenueStreams: [{ source: "x", amountPerTurn: 45, decayPerTurn: 0 }] };
  s = { ...s, stats: { ...s.stats, profitStreak: 4 } };
  expect(evaluateEndings(s)).toBe("enterprise-titan");
});
it("catastrophe and irrelevance outrank victories", () => {
  let s = { ...createInitialState("en"), stats: { ...createInitialState("en").stats, profitStreak: 9, incidents: 3 } };
  expect(evaluateEndings(s)).toBe("catastrophe");
});
it("pyrrhic overlay and grades", () => {
  const base = { ...createInitialState("en"), control: 20, trust: 80 };
  const done = finalizeEnding(base, "enterprise-titan");
  expect(done.endingResult!.victory).toBe(true);
  expect(done.endingResult!.pyrrhic).toBe(true);
  expect(["S","A","B","C","D"]).toContain(done.endingResult!.grade);
});
it("trajectory exposes progress and hides the secret", () => {
  const t = trajectory(createInitialState("en"));
  expect(t.length).toBeGreaterThanOrEqual(10);
  expect(t.every(e => e.progress >= 0 && e.progress <= 1)).toBe(true);
  expect(t.find(e => e.id === "simulation-revelation")!.hidden).toBe(true);
  expect(t.find(e => e.id === "enterprise-titan")!.pull.length).toBeGreaterThan(0);
});
it("updateStats tracks streaks", () => {
  let s = createInitialState("en");
  s = updateStats(s, 5); expect(s.stats.profitStreak).toBe(1);
  s = updateStats(s, -1); expect(s.stats.profitStreak).toBe(0);
});
```
- [ ] **Steps 2–5:** fail → implement (+ `safety.ts` increments `stats.incidents`) → green → commit `feat(c3): endings engine, stats, trajectory, grades`

---

### Task 7: Pipeline v3 + full-campaign test

**Files:** Modify `lib/engine/turn.ts`. Test `tests/engine/turn-v3.test.ts`.

Pipeline order becomes: dilemma/ended guards → `applyEraTransition` → fastFollow → finance → runs (+morale) → **buildsTurn** → rivals → talent → safety → **frontiersTurn** (+`checkAgi`) → funding → **updateStats(net)** → **evaluateEndings** (if non-null and `ending` still null → `finalizeEnding`) → debrief (+ "world" lines from builds/frontiers/era) → clock/chronicle-cap/ended → maybeOpenDilemma. Timeout path uses `finalizeEnding(s, "open-road")`.

- [ ] **Step 1: failing tests**
```ts
it("a full 48-turn campaign ends with a graded ending, deterministically", () => {
  const play = () => {
    let s = createInitialState("full-arc");
    for (let i = 0; i < 60 && !s.ended; i++) {
      if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
      if (!s.ended) s = advanceTurn(s);
    }
    return s;
  };
  const a = play();
  expect(a.ended).toBe(true);
  expect(a.ending).not.toBeNull();
  expect(a.endingResult).not.toBeNull();
  expect(a).toEqual(play());
});
it("eras actually transition during a campaign", () => {
  let s = createInitialState("era-check");
  for (let i = 0; i < 12 && !s.ended; i++) {
    if (s.activeDilemma) s = resolveDilemma(s, getDilemmaDef(s.activeDilemma.defId).options[0].id).state;
    s = advanceTurn(s);
  }
  expect(s.era).toBe(2);
  expect(s.chronicle.some(c => c.kind === "world" && /Scale-Up/i.test(c.text))).toBe(true);
});
```
- [ ] **Steps 2–5:** fail → implement → FULL suite green → commit `feat(c3): full-arc turn pipeline`

---

### Task 8: Store, Compass panel, era briefings, builds & frontiers UI, ending screens

**Files:** Create `components/panels/CompassPanel.tsx`, `components/modals/EraBriefingModal.tsx`; modify `gameStore.ts`, `NavRail.tsx` (PanelId + `"compass"`, glyph "◎", short "Goal"), `GameShell.tsx`, `ComputePanel.tsx`, `RunsPanel.tsx`.

**Contracts:**
- Store: actions `build(optionId)`, `startFrontierProject(id)`, `dismissEraBriefing()` (sets `pendingEraBriefing: null` via game mutation); meta: on `endingResult` first appearing, append `{ id, grade, pyrrhic }` to localStorage key `convergence3-meta` (endings gallery); expose `getEndingsSeen(): Array<{id: string; grade: string; pyrrhic: boolean}>`.
- CompassPanel: renders `trajectory(game)` — victory endings first (progress bars, pull sentences), defeats below in red tones, hidden entry as "???" with no pull. This is spec §12's visible trajectory.
- EraBriefingModal: mounts when `pendingEraBriefing !== null`; title/body from `ERA_BRIEFINGS`; single "Begin the era" button → `dismissEraBriefing`. Renders below DilemmaModal in priority (dilemma first if both).
- ComputePanel: "Expand capacity" section — `availableBuilds` cards (name, +PF, cost, duration, note, era tag) with Build buttons (disabled-with-reason), in-progress builds with countdown.
- RunsPanel: when frontiers available/active/completed (any non-locked), an "Applied Frontiers" section: project cards with status, cost/commitment shown before starting, Begin buttons.
- GameShell EndingScreen: full copy for all endings (7 victories incl. secret, 4 defeats, open-road), grade displayed as a big letter, pyrrhic variant note ("— Golden Cage" style subtitle + one-line cost acknowledgment), endings-seen gallery chips on StartScreen.

- [ ] **Step 1: implement all. Step 2: browser-verify:** new game → Compass shows all trajectories at ~0 with pulls; build a colo expansion and watch it come online; force-check era modal by playing to turn 11 (or temporarily seeding a mid-game state via console using engine functions — do NOT hand-edit state shapes). **Step 3: full suite + tsc + commit** `feat(c3): compass, era briefings, builds/frontiers UI, ending screens`

---

### Task 9: Deploy + verify

- [ ] `npm test && npx tsc --noEmit && next build`, deploy `npx wrangler pages deploy out --project-name convergence-3 --branch=main --commit-dirty=true`, verify 200 + title + one chunk + grep a Plan-3 marker string (e.g. "Applied Frontiers") in live chunks. Play several turns on the local preview of the same build. Commit + report.

---

## Self-Review Notes

- **Spec coverage:** eras + transitions (§2) T2/T7/T8; facilities/power gamble (§5) T3; era decks (§10) T4; Applied Frontiers (§11) T5; endings + Compass + pyrrhic + grades (§12) T6/T8; transparency (§16) — Compass pulls + build/frontier costs shown pre-commit. Deferred to Plan 4: AI layer, Chief of Staff/Codex onboarding, start presets from endings (gallery only here), cloud saves, mobile polish, rival two-way levers (undercut/alliances — cut from Plan 3 for scope; noted for Plan 4/backlog).
- **Type consistency:** `stats` fields referenced by `updateStats`/`evaluateEndings`/`trajectory` all defined in Task 1; `FrontierProject.status` values consistent across T5/T8; `pendingEraBriefing` set in T2, consumed in T8; `EndingResult` set in T6, consumed by EndingScreen/meta in T8.
- **Balance sanity:** default campaigns should usually reach turn 48 (open-road) or a defeat; victories require deliberate play. The 48-turn CI test only asserts *an* ending exists, not which.
