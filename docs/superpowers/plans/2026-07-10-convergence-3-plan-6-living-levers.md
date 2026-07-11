# Convergence 3 — Plan 6: Living Levers

> Execution plan. Branch `c3-plan-6`. Engine-pure, BALANCE-tunable, tests green before merge, deploy `--branch=main`, push after merge.

**Goal:** Make every compute slider matter, make model strengths pay off after training, make talent shape models, and let the player keep investing in compute.

### 1. Research experiments is a real lever (save v5)
- `researchMomentum: number` on GameState (v5 migration, backfill 0).
- `BALANCE.experiments = { momentumPerPF, momentumDecay, momentumQualityWeight, momentumCap }` (replaces the dead `pfPerTechniquePoint`).
- `research.ts: researchTurn(state)` — momentum = clamp(momentum·(1−decay) + allocation.experiments·momentumPerPF, 0, cap); emits a line when experiments > 0.
- `expectedQuality` adds `researchMomentum · momentumQualityWeight` (still capped at tier ceiling).
- Pipeline calls `researchTurn` alongside safety.

### 2. Model strengths persist & pay off
- `BALANCE.finance.positioningWeights` — each positioning weights the benchmarks it cares about (weights sum to 1, so a balanced model ≈ its average → keeps existing balance/AGI tests valid).
- `positionedScore(capability, positioning)`, `projectedRevenue(capability, positioning, pricing)` (weighted, superlinear), `bestFitPositioning(capability)`.
- Revenue is baked at deploy from the positioned score, so a matched model earns more permanently. `positioningMultipliers` softened since the score now carries differentiation.

### 3. Talent shapes the model
- `BALANCE.talent.specialtyCapabilityBonus` — the lead's specialty adds to that benchmark in the produced model. Hire enterprise specialist → they lead → enterprise-strong model → deploy enterprise → crown.

### 4. Keep buying compute
- Facilities repeatable: `availableBuilds` stops filtering built ids; `buildCost(state, option)` escalates by `repeatCostMultiplier^existingCount`. One build in progress at a time (pacing). Unique facility ids per lineage.

### 5. Visibility (transparency law)
- ComputePanel shows each slider's concrete projected effect + escalated build cost + repeatable builds + research momentum.
- ModelCard / DeployModal show best-fit positioning; RunDesigner shows lead specialty bonus + momentum.

### 6. Verify + ship
- Full suite + tsc + build; browser sanity; deploy `--branch=main`; verify live; merge; push. Update deploy/facilities tests to the new (relative, not magic-constant) assertions; add research + v5 migration tests.
