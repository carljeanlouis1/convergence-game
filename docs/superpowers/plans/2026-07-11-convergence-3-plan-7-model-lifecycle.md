# Convergence 3 — Plan 7: The Model Lifecycle

> Execution plan. Branch `c3-plan-7`. Engine-pure, BALANCE-tunable, tests green before merge, deploy `--branch=main`, push after merge. Save bumps v5 → v6.

**Goal:** Deployed models consume serving compute (throttled if under-provisioned); models can be deprecated to reclaim it; runs can build on a base model (families); stars have technique affinities.

### 1. Schema v6 + balance + content
- `Model.retiredTurn: number | null` (migration backfill null).
- `Star.affinity: string | null`, `Candidate.affinity: string | null` (migration backfill via AFFINITY_MAP by id).
- `TrainingRun.baseModelId?: string`; `RunDesign.baseModelId?: string` (optional, no migration).
- `BALANCE.finance.serving = { basePF, perCapPF, volume{api,enterprise,consumer,open-weights}, throttleFloor }`.
- `BALANCE.talent.affinityBonus`; `BALANCE.run.familyInheritFloor`, `familyQualityBonus`.
- content: `AFFINITY_MAP` + assign affinities to ~6 stars/candidates.

### 2. Serving compute (finance)
- `servingDemandFor(model)`: open-weights or retired → 0; else `(basePF + avg·perCapPF)·volume[positioning]`.
- `totalServingDemand(state)`, `servingRatio(state)` = demand 0 ? 1 : clamp(throttleFloor + (1−floor)·min(1, inference/demand), floor, 1).
- `revenuePerTurn`: model-linked stream yields × servingRatio; drop the old inference-bonus term. Frontier streams unthrottled.
- `deprecateModel(state, modelId)`: set retiredTurn, remove its revenue stream, chronicle. Store action `deprecate`.

### 3. Families + affinity (runs)
- `expectedQuality` += affinity bonus (lead.affinity ∈ techniqueIds) += family quality bonus (baseModelId set).
- `launchRun` records baseModelId; completion floors each capability at `base.capability[k]·familyInheritFloor`.

### 4. UI
- ComputePanel inference row: "serving X/Y PF demand · models at Z% revenue".
- ModelCard: retired badge; FinancePanel: Deprecate button on live models; serving-demand line.
- RunDesigner: base-model picker (families), lead affinity hint.

### 5. Bot + tests + ship
- Update AGI bot: provision inference ≈ serving demand, deprecate stale/low-revenue models. Prove the loop stays winnable.
- Tests: serving throttle, deprecate, family inheritance, affinity bonus, v6 migration.
- Suite + tsc + build; browser verify; deploy `--branch=main`; merge; push.
