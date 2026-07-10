# Convergence 3 — Plan 5: Depth & Agency

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** Player-initiated fundraising, a hard governance floor (Figurehead defeat), deeper technique tree with benchmark hints and era discoverability, AGI-reachability proven by a bot campaign in CI, chief-of-staff context memory, and surfacing for the existing compute-buildout system.

**Architecture:** Small engine additions (funding action, ending, techniques, control floor) on the existing v4 schema — no migration needed. UX changes in RunDesigner/Finance/TopBar/ChiefOfStaff. Same constraints as Plans 1–4 (branch `c3-plan-5`, engine purity, BALANCE tunables, tests green before merge, deploy `--branch=main`, push after merge).

### Task 1: Player-initiated funding round
- `funding.ts`: `openRound(state): GameState` — throws `"a round is already open"` (offers exist), `"too soon since the last raise"` (turn − lastRaiseTurn < BALANCE.funding.playerRaiseCooldown = 4); otherwise generates the same three offers as `fundingTurn` (extract shared `generateOffers(state)` helper). Balance adds `playerRaiseCooldown: 4`.
- Store action `raiseRound()`; Finance panel: "Raise a round" button in the header area with disabled-with-reason states; when offers open, existing term sheets render.
- Test: openRound produces 3 offers; cooldown and already-open guards throw.

### Task 2: Governance floor — Figurehead
- `endings.ts`: in `evaluateEndings`, after catastrophe/irrelevant: `control <= BALANCE.endings.figureheadControl (15)` → `"figurehead"` (defeat, not victory). Trajectory entry ("Losing the company", progress = (35 − control)/20 clamped or similar). Ending copy in GameShell: "FIGUREHEAD — You still have the title...". Test: control 10 → figurehead; control 40 → not.
- TopBar gains a Control chip (red ≤ 25) + trend arrow.

### Task 3: Technique depth + AGI reachability
- content.ts adds: era-2 `long-context` (bonus 5, variance 1, enterprise 1.15); era-3 `multimodal-fusion` (bonus 7, variance 2.5, consumer 1.2, reasoning 1.05); era-4 `self-play-economies` (bonus 11, variance 5, enterprise 1.15, reasoning 1.1). 11 total.
- Bot-campaign test (`tests/engine/agi-reachability.test.ts`): deterministic scripted bot (seed "agi-bot") plays 48 turns: hires affordable candidates, builds every affordable facility, keeps one max-affordable-tier run going with best lead + best-bonus unlocked techniques, deploys every model api/standard, resolves dilemmas with option[0], allocates spare compute to inference/safety 70/30. Assert: reaches era 4, and best deployed avg ≥ 80 (AGI-adjacent) — proves the tree supports the climb.

### Task 4: Discoverability
- RunDesigner: technique buttons show benchmark hints (`+coding +reasoning` from categoryWeights > 1.05) and locked future techniques render disabled with "era N" tags.
- ChiefOfStaff `attentionChips`: add "compute crunch" chip (freePF/total < 0.15 and an affordable build exists) → compute panel.

### Task 5: Chief-of-staff memory
- ChiefOfStaff prompt gains: last 6 chronicle entries ("recent history"), control value, crowns held, era. System prompt notes she remembers the campaign.

### Task 6: Verify, deploy, merge, push
- Full suite + tsc + build; browser sanity pass; deploy `--branch=main`; verify live; merge to main; push.
