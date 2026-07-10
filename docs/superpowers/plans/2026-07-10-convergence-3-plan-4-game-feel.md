# Convergence 3 — Plan 4: Game Feel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Convergence 3 feel like a AAA turn-based game: superlinear model economics with deploy pricing, benchmarks as the visible language of the race (crowns), release-day and checkpoint moments, model identity cards, a full visual pass with generated portraits, and the OpenRouter AI narration layer with Chief-of-Staff onboarding.

**Architecture:** Four phases. A: economy/benchmark engine changes (save v4). B: game-feel UI (release day, benchmark race table, model cards, pricing). C: visual overhaul + static portrait assets (atlas image generation at build time). D: OpenRouter Pages Function + client with authored fallbacks, Chief of Staff, Codex. Engine stays deterministic; AI output remains decorative.

**Tech Stack:** unchanged + Cloudflare Pages Functions (`functions/` dir) for the AI proxy; OpenRouter chat-completions API.

## Global Constraints

- All prior global constraints hold (engine purity, BALANCE tunables, seeded RNG, transparency law, deploy `--branch=main`, branch `c3-plan-4`, commit per task; push only when asked).
- Save version 3 → 4; chain-migrate v1/v2/v3 (persist config version must be bumped to 4 in the same commit as the type change — regression: the Plan-3 live crash).
- AI narration never affects game state; every AI surface has an authored fallback; the game is fully playable with no key and with the toggle off. LLM calls are cost-tiered per spec §13 (A `z-ai/glm-4.7-flash`, B `moonshotai/kimi-k2.5`, C `moonshotai/kimi-k2.6`), server-side key only.
- Economy targets: tier-1 model (avg ≈ 40) ≈ $5M/turn standard pricing; tier-4 (avg ≈ 90) ≈ $39M/turn — superlinear via `(avg/10)^2.5 × 0.16 × 10`.

## File Structure

```
lib/engine/types.ts       # MODIFY: Pricing, RevenueStream.modelId/pricing, Model.lifetimeRevenue/pricing/releaseRank, stats.crowns, pendingRelease
lib/engine/balance.ts     # MODIFY: finance.revenueExponent/Scale, pricing multipliers, crown bonuses
lib/engine/content.ts     # MODIFY: BENCHMARK_NAMES map; CODEX_ENTRIES; CHIEF_LINES fallbacks
lib/engine/deploy.ts      # MODIFY: pricing param, superlinear amount, releaseRank
lib/engine/finance.ts     # MODIFY: crown yield bonus, lifetimeRevenue accrual
lib/engine/rivals.ts      # MODIFY: categoryLeaders(); pricing decay multiplier in applyFastFollow
lib/engine/endings.ts     # MODIFY: crown tracking in updateStats (+ frontier-crown uses stats.crowns)
lib/engine/runs.ts        # MODIFY: set pendingRelease on completion
lib/ai/config.ts          # NEW: tier→model map, token caps, spend cap
lib/ai/client.ts          # NEW: fetchNarrative with cache/caps/fallback
functions/api/narrative.ts # NEW: OpenRouter proxy (Pages Function)
components/modals/ReleaseDayModal.tsx  # NEW
components/modals/DeployModal.tsx      # NEW (pricing chooser, replaces inline buttons)
components/panels/RaceBoardPanel.tsx   # MODIFY: benchmark table + crowns
components/panels/FinancePanel.tsx     # MODIFY: model cards
components/modals/CheckpointModal.tsx  # MODIFY: sparkline
components/panels/BriefingPanel.tsx    # MODIFY: staged reveal, ticker, chief-of-staff
components/shell/*                     # MODIFY: visual pass (Phase C)
public/portraits/*                     # NEW: generated static art
tests/engine/{economy,crowns}.test.ts, tests/store/migration.test.ts (extend)
```

---

## Phase A — Economy & Benchmarks (engine)

### Task 1: v4 types, balance, migration

**Interfaces (consumed by all later tasks):**

`types.ts`:
```ts
export type Pricing = "aggressive" | "standard" | "premium";
// RevenueStream gains: modelId?: string; pricing?: Pricing;
// Model gains: lifetimeRevenue: number; pricing: Pricing | null; releaseRank: number | null;
// GameStats gains: crowns: BenchCategory[];
// GameState gains: pendingRelease: string | null;  // modelId awaiting the Release Day screen
// version: 1|2|3|4
```
`balance.ts` — `finance` section gains:
```ts
    revenueExponent: 2.5, revenueScale: 0.16,
    pricingMultipliers: { aggressive: { revenue: 0.7, decay: 0.6 }, standard: { revenue: 1.0, decay: 1.0 }, premium: { revenue: 1.45, decay: 1.5 } },
    crownYieldBonus: 0.12,     // +12% stream yield per crown the source model holds
    crownBoardDelta: 2,        // board swing on crown gain/loss
```
`state.ts` `v4Defaults()`: `{ pendingRelease: null }` + stats.crowns `[]` (fold into stats default); models arrays start empty so no per-model backfill needed at creation; migration backfills `lifetimeRevenue: 0, pricing: model.positioning ? "standard" : null, releaseRank: null` per model, `crowns: []`, `pendingRelease: null`, stream `pricing: "standard"`. Persist config `version: 4`.
`content.ts`: `export const BENCHMARK_NAMES: Record<BenchCategory, string> = { coding: "CodeEval", reasoning: "GPQA-X", enterprise: "EnterpriseBench", consumer: "ConsumerPref" };`

- [ ] **Step 1: extend migration test** — build a v3 game containing one deployed model + one stream, delete v4 fields, `migrateSnapshot` → assert `version === 4`, `models[0].lifetimeRevenue === 0`, `models[0].pricing === "standard"`, `stats.crowns` is `[]`, `pendingRelease === null`.
- [ ] **Steps 2–5:** fail → implement (types + balance + defaults + migration + persist version 4 + BENCHMARK_NAMES) → full suite green (update `state.test.ts` to version 4) → commit `feat(c3): v4 schema — pricing, crowns, release moments`

### Task 2: Superlinear revenue, pricing, crowns

**Files:** Modify `deploy.ts`, `finance.ts`, `rivals.ts`, `endings.ts`. Test: `tests/engine/economy.test.ts`, `tests/engine/crowns.test.ts`.

**Interfaces:**
- `deploy.ts`: `deployModel(state, modelId, positioning, pricing: Pricing = "standard")` — `amount = Math.pow(avg / 10, BALANCE.finance.revenueExponent) * BALANCE.finance.revenueScale * 10 * positioningMultipliers[positioning] * pricingMultipliers[pricing].revenue` (open-weights: pricing forced "standard", decay stays 0). Stream carries `modelId`, `pricing`. Model gets `pricing`, `releaseRank` = 1 + count of active rivals whose capability avg > model avg.
- `rivals.ts`: `categoryLeaders(state): Record<BenchCategory, { name: string; value: number; isPlayer: boolean }>` — per category, max over active rivals' capability and player *deployed* models. `applyFastFollow` multiplies final decay by `pricingMultipliers[stream.pricing ?? "standard"].decay` (before the cap).
- `finance.ts`: `crownsOf(state, modelId): number` — count of categories where that deployed model IS the categoryLeader value holder; `streamYield(state, stream) = stream.amountPerTurn * (1 + crownYieldBonus * crownsOf(...))` used by `revenuePerTurn`; `applyFinance` adds each stream's yield to its model's `lifetimeRevenue`.
- `endings.ts` `updateStats`: recompute `stats.crowns` = categories where `categoryLeaders(...)[cat].isPlayer`; return also needs no signature change (crown gain/loss board delta applied inside: `boardConfidence ± crownBoardDelta` per gained/lost crown, clamped). `frontier-crown` trajectory/ending may keep using topStreak (unchanged).

- [ ] **Step 1: failing tests**
```ts
// economy.test.ts
it("revenue is superlinear in capability", () => {
  const mk = (avg: number): Model => ({ id: `m${avg}`, name: `M${avg}`, createdTurn: 1,
    capability: { coding: avg, reasoning: avg, enterprise: avg, consumer: avg },
    positioning: null, deployedTurn: null, lifetimeRevenue: 0, pricing: null, releaseRank: null });
  const s = { ...createInitialState("e"), models: [mk(40), mk(90)] };
  const a = deployModel(s, "m40", "api");
  const b = deployModel(a, "m90", "api");
  const small = b.revenueStreams.find(r => r.modelId === "m40")!.amountPerTurn;
  const big = b.revenueStreams.find(r => r.modelId === "m90")!.amountPerTurn;
  expect(small).toBeCloseTo(5.12, 1);
  expect(big).toBeCloseTo(38.9, 1);
  expect(big / small).toBeGreaterThan(7);
});
it("premium pricing earns more but decays faster; aggressive is sticky", () => {
  const s = { ...createInitialState("e"), models: [strongModel] }; // avg 60 helper
  const premium = deployModel(s, strongModel.id, "api", "premium");
  const aggressive = deployModel(s, strongModel.id, "api", "aggressive");
  expect(premium.revenueStreams[0].amountPerTurn).toBeGreaterThan(aggressive.revenueStreams[0].amountPerTurn * 2);
  const pDecay = applyFastFollow(premium).revenueStreams[0].decayPerTurn;
  const aDecay = applyFastFollow(aggressive).revenueStreams[0].decayPerTurn;
  expect(pDecay).toBeGreaterThan(aDecay);
});
// crowns.test.ts
it("a category-leading deployed model holds the crown and boosts yield", () => {
  // player model coding 95 (beats all rivals), others 10 → exactly 1 crown
  // assert categoryLeaders().coding.isPlayer, crownsOf === 1, streamYield = amount * 1.12,
  // updateStats sets stats.crowns = ["coding"], and losing it (rival coding 99) drops board by crownBoardDelta
});
```
(Write the crowns test in full during implementation — assertions as commented.)
- [ ] **Steps 2–5:** fail → implement → full suite green (existing deploy/finance tests updated for the new formula: recompute expected constants) → commit `feat(c3): superlinear economics, deploy pricing, benchmark crowns`

### Task 3: Release moments data

**Files:** Modify `runs.ts` (completion sets `pendingRelease: model.id`), `turn.ts` (crown gain/loss debrief lines from stats diff; "eclipsed" helper), `gameStore.ts` (actions `dismissRelease()`, `deployFromRelease(modelId, positioning, pricing)`). Test: extend `tests/engine/turn-v3.test.ts`.

- `isEclipsed(state, modelId): boolean` (in `rivals.ts`): any active rival capability avg > model avg.
- [ ] Test: complete a run through `advanceTurn` → `pendingRelease` equals the new model id; `dismissRelease` clears it; crown-gain line appears in debrief when a crown is won. Fail → implement → green → commit `feat(c3): release-day pipeline and crown events`

---

## Phase B — Game-feel UI

### Task 4: Deploy modal with pricing + model cards

**Contracts:** DeployModal (from FinancePanel + ReleaseDayModal): positioning picker and pricing picker, each option row shows projected $/turn (exact formula result) and a decay hint ("erodes ~2× faster under pressure"); confirm calls `deploy`/`deployFromRelease`. FinancePanel model list becomes **model cards**: name, tier-styled frame, four benchmark bars labeled with `BENCHMARK_NAMES` + scores, lifetime revenue, `releaseRank` badge ("#1 at launch"), status chip (Frontier / Eclipsed via `isEclipsed`), pricing badge, crown icons. Undeployed cards show "Position this model" opening DeployModal.
- [ ] Implement → browser-verify (train + deploy premium vs aggressive, watch projected numbers match finance panel next turn) → commit `feat(c3): deploy pricing modal and model identity cards`

### Task 5: Benchmark race table + crowns in Race panel

**Contracts:** RaceBoardPanel top section becomes a benchmark table: rows = 4 categories (benchmark names), columns = You + each active rival; cell = score (player = best deployed model per category); leader cell gets a crown glyph (♛) and amber tint; your crown count summarized ("2 crowns held"). Below: existing leaderboard + rival cards + chronicle. Mobile: table scrolls horizontally.
- [ ] Implement → browser-verify → commit `feat(c3): benchmark race table with crowns`

### Task 6: Release Day, checkpoint sparkline, staged debrief

**Contracts:**
- ReleaseDayModal: mounts when `pendingRelease` set (priority below DilemmaModal). Full-screen moment: model name, four benchmark scores animating count-up (CSS/JS ticker), release rank line ("Enters the field at #2 overall"), crown callouts, then two actions: "Position it now" (opens DeployModal inline) / "Shelve for now" (`dismissRelease`).
- CheckpointModal: SVG sparkline of the run's checkpoint history (bands mapped ahead=3, on-track=2, wobbly=1, troubled=0), plus the existing decision buttons.
- BriefingPanel debrief lines: staged reveal (CSS animation stagger ~90ms per line, kind icons: ▲ finance, ⚗ run, ⚑ rival, ✦ talent, ⛨ safety, ◆ funding, ● world).
- [ ] Implement → browser-verify all three moments → commit `feat(c3): release day, checkpoint sparkline, staged debrief`

---

## Phase C — Visual overhaul

### Task 7: AAA visual pass (use the frontend-design skill during execution)

**Contracts (direction, executed with taste):** deepen the design system in `globals.css` — layered surfaces (subtle gradients + inner borders + glow accents per panel kind), a display-serif/mono type pairing already in place gets scale contrast, animated ambient background (fixed canvas/CSS: faint drifting grid + node pulses, GPU-cheap), full-bleed era title cards (era number + epigraph + fade), EndingScreen cinematic treatment (grade stamp animation), consistent iconography, button/hover/focus motion (≤150ms), reduced-motion media query respected. TopBar chips get micro-trend arrows (▲▼ vs last turn — needs `lastDebrief` comparison only, no engine change). Mobile parity checked at 375px.
- [ ] Implement → browser-verify desktop + mobile screenshots → commit `feat(c3): AAA visual pass`

### Task 8: Portraits

Generate static portraits with the atlas MCP `generate_image` (style: painterly sci-fi corporate portrait, consistent palette with the game's amber/ink scheme): 4 rival CEOs (archetype-flavored), the 18 researchers (stars + candidates), 1 chief of staff. Save to `public/portraits/<id>.jpg` (≤60KB each, 256×256). Wire into TalentPanel roster/market cards, RaceBoardPanel rival cards, poach alerts, ReleaseDayModal lead credit, Chief-of-Staff card. Fallback: initial-letter avatar (existing) when a portrait file is missing.
- [ ] Generate + wire → browser-verify → commit `feat(c3): character portraits`

---

## Phase D — AI narration layer + onboarding

### Task 9: OpenRouter proxy + client

**Contracts:**
- `functions/api/narrative.ts` (Pages Function): POST `{ tier: "a"|"b"|"c", system: string, prompt: string }` → checks same-origin (`Origin` header host endsWith request host), reads `env.OPENROUTER_API_KEY` (503 `{configured:false}` if missing), calls `https://openrouter.ai/api/v1/chat/completions` with model from tier map (a: `z-ai/glm-4.7-flash`, b: `moonshotai/kimi-k2.5`, c: `moonshotai/kimi-k2.6`), `max_tokens` {a:160, b:420, c:700}, temperature 0.8, 20s timeout → `{ text }`. GET → `{ configured: boolean }` status probe.
- `lib/ai/config.ts`: the tier map + per-session caps `{ maxCalls: 120, maxPerTurn: 6 }`.
- `lib/ai/client.ts`: `aiStatus(): Promise<boolean>` (cached); `narrate(tier, cacheKey, system, prompt): Promise<string | null>` — localStorage response cache by cacheKey (`c3-ai-<hash>`), session call counter with caps, any error/refusal → null (callers fall back to authored text). Never throws.
- Secret setup is the owner's step: `npx wrangler pages secret put OPENROUTER_API_KEY --project-name convergence-3` — the plan does NOT include the key; without it the game shows authored text only.
- [ ] Vitest for the pure parts (config caps, cache-key hashing); function tested live post-deploy → commit `feat(c3): openrouter narrative proxy and client`

### Task 10: AI surfaces + settings toggle

**Contracts:** A settings row (gear in TopBar): "AI narration — on/off" (default on when status probe says configured), plus credits line. Surfaces, each with authored fallback:
1. **Chief-of-staff briefing** (tier B, 1/turn, cacheKey seed+turn): rewrites the debrief into a 3-sentence in-character morning read, prompt includes top debrief lines + key stats; renders above the line list.
2. **Rival CEO reaction** (tier C, on player release day + crown steals, cacheKey event-hash): persistent persona per rival (system prompt from archetype + name + memory of last 3 chronicle events); one savage/respectful quote rendered in ReleaseDayModal and chronicle.
3. **News ticker** (tier A, 2/turn, batched into ONE call returning JSON array): world-flavor one-liners in the Briefing footer.
All AI text visually marked (subtle ✧ prefix). No AI call during engine resolution — fired after render, updates in place.
- [ ] Implement → verify with key configured (owner adds secret; otherwise verify fallback path renders authored text + toggle hidden) → commit `feat(c3): AI narration surfaces`

### Task 11: Chief of Staff onboarding + Codex

**Contracts:** First campaign: chief-of-staff card sequence on turns 1–3 (authored: turn 1 "design a run", turn 2 "allocate inference/safety", turn 3 "watch the runway"), each dismissible, tracked in localStorage meta (never re-shown after first campaign). "What needs attention" chips each turn (deterministic rules: undeployed model, idle compute > 30%, poach offer live, dilemma open, runway < 9mo) rendered under the briefing headline; clicking a chip navigates to the right panel. Codex: nav footer "?" opens a modal with `CODEX_ENTRIES` (authored: How training runs work · Checkpoints & scrapping · Pricing & fast-follow · Crowns · Safety tiers & incidents · Funding & control · Coups · Eras · Frontiers · Endings — each ≤120 words).
- [ ] Implement → browser-verify → commit `feat(c3): chief of staff onboarding and codex`

### Task 12: Deploy + verify + wrap

- [ ] Full suite + tsc + build; deploy `--branch=main`; verify live (200, fresh campaign, release-day moment, benchmark table, portraits load, AI status probe returns JSON); mobile screenshot; update README section for convergence-3; commit.

---

## Self-Review Notes

- **User feedback coverage:** superlinear tier payoff (T2), pricing/demand lever (T2/T4), model differentiation + history summaries (T4), benchmarks matter + comparison vs rivals (T2/T5), XCOM/Civ moments (T6), AAA visual (T7/T8). Spec §13 AI layer (T9/T10), §16 onboarding (T11).
- **Type consistency:** `Pricing` defined T1, consumed T2/T4; `pendingRelease` set T3, consumed T6; `categoryLeaders`/`crownsOf` defined T2, consumed T5; `narrate` defined T9, consumed T10.
- **Deliberate scope cuts:** no audio this plan; rival two-way levers (alliances/undercuts) remain backlog; cloud saves remain backlog.
