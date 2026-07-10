# Convergence 3 — Design Spec

**Date:** 2026-07-10
**Status:** Approved direction, pending final user review
**Baseline:** `convergence-game` current `main` (cf33215) — the complete v2 game ("Mission Control" era)

## 1. Vision

Convergence 3 is a complete redesign of Convergence: a turn-based strategy game about running a frontier AI research lab, with XCOM's committed-risk mission structure and Civilization's era progression. The design goal, in the owner's words: **"feels more like running an actual research lab."**

The v2 game simulates a research *portfolio* — bars that fill every turn, freely re-optimizable, with cosmetic rivals. Running a real lab is about **irreversible bets under uncertainty and adversaries**. Convergence 3 rebuilds the game around that.

Four decided pillars:

1. **Grounded start, escalating endgame** — early game is a realistic 2026-era frontier lab sim (training runs, compute deals, poaching wars, safety gates); the late game escalates into the AGI era where the speculative endings live.
2. **Tighter campaign** — ~48 turns (1 turn = 1 quarter, roughly 2026–2038), one run ≈ 2–4 hours, across four eras.
3. **AI-dressed deterministic simulation** — the engine is fully deterministic and seeded; LLMs write the world around it (rival CEO personas, news, cinematics), cost-tiered, with authored offline fallbacks. AI output never affects game state.
4. **Desktop-first mission control, mobile-playable** — designed for a rich desktop command-center experience (in the spirit of the v2 mockups), with a deliberately designed mobile layout, not a squeezed one.

Mechanical spine (decided): **the Training Run loop (A), plus light internal compute politics (from B) and a live rival race board with fast-follow erosion (from C).**

## 2. Era structure

Four eras over ~48 turns. Era transitions change the rules (Civ-style): new GPU generation, new benchmark categories, new event deck, harder rival behavior, new mechanics unlocking.

| Era | Turns (approx) | Theme | What changes |
|---|---|---|---|
| 1. Startup | 1–10 | Garage lab, first model, seed money | Core loop tutorializes; small runs; 2 rivals active |
| 2. Scale-up | 11–24 | Enterprise race, megadeals | Funding megadeals, safety frameworks (capability tiers) arrive, all rivals active, poaching wars begin |
| 3. Frontier | 25–38 | Open-weight shocks, regulation, geopolitics | Fast-follow accelerates, export-control/regulation events, wildcard rival can spawn, ASL-4-tier gates |
| 4. Convergence | 39–48+ | The AGI era | AGI threshold crossable; Applied Frontiers unlock; speculative endings become reachable; run can end early via any ending |

## 3. Core loop (per turn)

1. **Briefing** — AI-dressed intel: world news, rival moves, faction requests, crises. Evolves v2's best screen.
2. **Allocate** — split the compute pool across: active training runs (locked commitments), inference serving (earns revenue), research experiments (feeds technique tree), safety evals (builds eval capacity). Three internal factions — Research, Product, Safety — make claims each turn; consistently starving a faction has morale/attrition consequences (light politics, not a full sim).
3. **Act** — commitment-bearing decisions: design/launch a training run, hire or counter a poach, take a funding deal, start a facility build, launch or sunset a product, respond to a crisis, resolve a dilemma. Most actions bind for multiple turns. **Design law: no free per-turn re-optimization** — reassignments, supplier switches, and posture changes carry costs, cooldowns, or contract terms.
4. **Resolve** — runs advance and hit checkpoints, rivals move on hidden clocks, markets shift and revenue decays, events fire, meters drift.

## 4. The Training Run (the XCOM mission)

**Design phase:** choose base architecture (from your lineage), scale tier (bigger = more compute-turns committed = higher ceiling, higher variance, longer duration), techniques from the unlocked tree (RLHF → DPO → RLVR → era-4 speculative techniques), lead researcher + team (named stars change odds; they can be poached mid-run), and compute-per-turn commitment.

**Execution (3–6 turns):** a hidden quality value evolves per turn, influenced by team quality, technique risk, compute, infrastructure, and seeded RNG. At **checkpoints** (~every 2 turns) the player sees noisy signals — loss-curve shape, early eval samples — and chooses: **push through / inject more compute / pivot recipe (cost + delay) / scrap** (sunk cost). Failed runs are real and must sting; big runs can fail outright.

**Output:** a **Model** with a capability profile across benchmark categories (coding, reasoning, enterprise trust, consumer, open-weights track).

**Deployment gauntlet:**
- **Safety gate:** capability auto-triggers an ASL-style tier; each tier demands eval capacity (built via allocation + safety staffing) before clean deployment. Skipping accrues hidden incident risk.
- **Positioning:** API / enterprise / consumer / open-weights release; pricing.
- **Publish or keep secret:** publishing boosts recruiting + reputation, starts the rival fast-follow clock sooner.

Research "levels" as bars-that-fill are gone; capability is the accumulated result of runs.

## 5. Compute & facilities

- One compute pool, fed by facilities; power/datacenter buildout is a second bottleneck (GPUs can idle waiting on power).
- GPU generations advance with eras; supplier deals are **contracts with terms** (duration, price, lock-in), not free toggles. Buying deep into a generation affects access to the next one.
- Facility builds take multiple turns; the "build own power plant" gambit exists (fast, expensive, political-event risk).
- Circular compute-for-equity megadeals live in Finance (§7).

## 6. Talent

- A small roster of **named star researchers** (reworked from v2's 42-person catalog, portraits carried over) with specialties, quirks, passive bonuses — plus anonymous "team strength" beneath them.
- Stars lead runs and unlock techniques. Rival labs **raid** them with escalating offers ($10M → $100M-class); the player matches, counters with equity (equity retention only works while the lab's trajectory looks good), or lets them walk.
- **Burnout** builds from crunch (sprint postures, back-to-back runs); ignored burnout triggers exodus events. Losing multiple stars at once can **found the wildcard rival**.
- The talent market is honest: no rigged candidate pool. Waiting for the right hire is gameplay.

## 7. Finance & governance

- Revenue = deployed models by segment (API, enterprise contracts, consumer subs); **revenue decays** as fast-followers replicate the capability. No immortal revenue programs; products can and should be sunset.
- **Funding rounds** trade equity + board control for capital; terms track the lab's position (strong lab → good terms; weak lab → down round → vulture terms → acquihire only).
- **Circular megadeals:** hyperscaler invests cash + you commit most of it back as cloud spend — solves compute, transfers leverage; visible as a long-term dependency.
- **Board confidence** is a governance system. Collapse triggers a **coup event**: survivable via staff loyalty (high morale → team threatens to walk → reinstated), survivable-but-scarred (interim-CEO constrained mode), or fatal (Ousted, §9) if morale is also low.
- Burn > runway triggers escalating fire-sale events, not a flat game-over.

## 8. Rivals — the race board

- 5 rivals with archetypes: aggressive scaler (Velocity), safety-first (Prometheus), state-backed (Zhongguancun), open-weights collective (OpenCollective), + a **wildcard slot** spawned by events (ex-employee startup or DeepSeek-style unknown).
- Rivals run simplified versions of the player's systems on **hidden clocks** — training runs, releases, poaching, funding. The player sees releases and a **category leaderboard**, never internals. Surprise leapfrogs are a feature.
- **Two-way interaction:** poach their researchers, undercut pricing, compute alliances, fund the open-weights lab to erode a leader's moat.
- **Fast-follow erosion** is a law of nature: revealed capability is replicated by someone within a few turns at a fraction of cost. Leads are rented.

## 9. Safety, trust, regulation

- ASL-style capability tiers escalate with model capability; each demands eval capacity before clean shipping. Under-evaluated deployments accrue **hidden incident risk** rolled against by events: jailbreak scandal → misuse headline → catastrophe.
- Public trust and regulator posture respond to track record. **Regulation moves** during the campaign (thresholds shift, deadlines slip, export bans reverse) — over-fitting to current rules is punished.
- Safety investment pays off as resilience (blunted crisis severity), unlocked gates, trust, and the path to The Conscience / Beneficial ASI endings.

## 10. Dilemmas & events

- v2's 15 authored dilemmas (the game's soul) are ported and expanded with **era-specific decks** drawn from the research: board coups, export-control whiplash, discovery-misconduct lawsuits, datacenter power crunch, DeepSeek-style disruption shock, poaching-raid retreats.
- Crisis events trigger from thresholds (low governance → coup risk; high capability + low safety → incident risk) with a short mitigation window; ignoring cascades.
- Governance/legal/reputation buffers are resilience meters — they blunt crises rather than prevent them.

## 11. Applied Frontiers (Convergence-era layer)

Once models cross the AGI threshold, the **Applied Frontiers** unlock: robotics, biology/drug discovery, materials, space, simulation — v2's speculative tracks reborn as **deployment mega-projects**. The player points AGI at a domain and funds a moonshot venture with its own multi-turn arc and world-changing payoffs. These power the speculative endings and open the endgame just as the grounded race settles.

## 12. Endings & the Endings Compass

**No hidden if-chains.** A visible trajectory panel shows which ending the run is steering toward and what's pulling it. Endings are goals played toward.

**Grounded victories:**
1. **Enterprise Titan** — sustained profitability + enterprise dominance for consecutive quarters while independent (control > 50%). *(Anthropic-2026 path.)*
2. **The Frontier Crown** — hold overall #1 on the leaderboard across an era transition.
3. **The Standard** — open-weights: your models become the world's substrate (usage share threshold); win influence, not revenue.
4. **The Conscience** — highest industry trust; your safety framework becomes the regulatory standard.

**Convergence-era victories:**
5. **Beneficial ASI** — aligned AGI/ASI with world trust intact. Hardest ending.
6. **Transcendence** — complete enough Applied Frontier mega-projects to transform civilization.
7. **Simulation Revelation** — hidden ending; discovered, not signposted.

**Defeats:**
1. **Absorbed** — out of money and credibility; the only remaining offer is acquihire. (Cash crunches are fundable 2–3 times, each ratcheting equity/board loss.)
2. **Ousted** — coup lost with low morale; fired outright.
3. **Irrelevant** — the death spiral (behind frontier → revenue decays → stars leave → slower runs) rides to the bottom. Hail-mary: open-source everything.
4. **Catastrophe** — incident risk finally lands at high capability: regulatory shutdown, or Catastrophic Misalignment.

**Pyrrhic overlay:** any victory with gutted control or ruined trust becomes its "ugly" variant (e.g., *Enterprise Titan — Golden Cage*). Endings carry a score/grade; ending variety feeds unlockable start presets (meta-progression, carried from v2).

## 13. AI layer (runtime)

- **Deterministic core, decorative AI** — LLM output never affects game state. Fully playable offline via authored fallbacks.
- **Cost-tiered:** cheap/fast models (e.g., Haiku-class / flash-class) for routine news ticker and rival chatter; stronger models for big moments — rival CEO reactions to the player's releases, era-transition cinematics, chief-of-staff quarterly readout. Rival CEOs have persistent personas (stable system prompts + rolling memory of the run's events) so they stay in character all campaign.
- Reuses v2's Cloudflare Pages Functions backend (narrative/scene-image/TTS/cinematic + KV rate limiting + same-origin guard) with per-system prompts updated for the new fiction. BYOK fallback mode retained.
- Scene images / cinematics for era transitions and endings; atlas-memory MCP image generation available at build time for static art assets.

## 14. Platform, UI & architecture

**UI:** Desktop-first "mission control" command center — persistent top status bar (era/turn, capital, runway, compute, trust, board), left rail navigation (Briefing / Runs / Compute / Talent / Finance / Race Board / Safety / Compass), modal layer for dilemmas/crises/debriefs. Mobile gets a deliberately designed stacked layout with the same information architecture.

**Technical decisions (learning from v2's failure modes):**
- **Fresh app** in the same repo (`convergence-3/` alongside `convergence-game/`), deployed as a **new Cloudflare Pages project** — v2 stays live and untouched.
- Same proven stack family: Next.js static export + Pages Functions. (Final framework versions decided at implementation-planning time.)
- **No monolith:** per-screen components; UI state separated from game state.
- **Engine as a pure, seeded, tested library** (`lib/engine/`): `advanceTurn(state, actions, seed) → state`, no React imports, unit-testable, with a **central balance config** (one tunables file replacing v2's magic-number soup).
- **Store:** Zustand with selectors (no whole-store subscriptions), `persist` middleware with explicit partialize (no manual clone-strip lists), **versioned save format** with explicit migrations.
- **Simulation-driven balance testing:** headless bot players run full campaigns in CI to detect dominant strategies and degenerate outcomes.
- Cloud saves carried over from v2 (KV-backed), pointed at the new project.

## 15. Content carried over from v2

- 15 dilemmas (ported, re-fictioned where needed) + staff portraits + researcher catalog (reworked into stars/supporting cast) + rival identities + Pages Functions AI backend + cloud saves. The 64 commercialization programs are retired as a system; their best ideas return as deployment positioning options and Applied Frontier ventures.

## 16. Onboarding & learnability

The player learns by playing — which only works if designed for explicitly:

- **Transparency as design law.** Every commitment shows stakes before it's taken: runs show cost/duration/risk band, deals show what's surrendered, poach offers show retention odds. Quarter debriefs explain *why* every meaningful number moved ("revenue fell — OpenCollective replicated your coding capability"). No formula reverse-engineering required; hidden state (run quality, incident risk) is communicated as qualitative bands, never as invisible mystery.
- **Eras are the tutorial.** Era 1 starts deliberately small (one facility, two rivals, small runs, no megadeals, no safety tiers). Each era's new mechanics get a one-time explanatory briefing moment on first appearance. Full complexity arrives only after each piece has been played for an era.
- **Chief of Staff as diegetic teacher.** The chief-of-staff character flags what needs attention each turn, explains mechanics on first relevance, and can offer a recommended action *with reasoning* (teaching strategy, not just controls). Dismissible; authored offline fallbacks.
- **Codex** — searchable in-game reference of short entries ("How training runs work", "Fast-follow", each ending's requirements). Lookup, not required reading.
- **Pre-End-Turn commitment summary** — a review of everything about to be locked in, so no turn ends with an unnoticed commitment.

Success criterion #1 gains a corollary: a new player completes Era 1 without external help and can explain what a training run is risking.

## 17. Out of scope for v3.0

- Multiplayer of any kind.
- LLM-generated *mechanical* content (dilemma variants, generated candidates) — revisit post-launch.
- Native/desktop packaging; it's a web game.
- Real-money/monetization features.

## 18. Success criteria

1. A full campaign is completable in 2–4 hours with no dead mid-game stretch (every turn contains ≥1 meaningful decision).
2. Training runs produce genuine tension: failed runs happen, abort decisions are real, and players can articulate why they won or lost.
3. No dominant strategy survives the CI bot-player sweep (no single build order wins >60% across seeds).
4. Rival surprise releases and poaching raids are named by playtesters as memorable moments.
5. The game runs and looks deliberate on both a 27" monitor and a phone.
6. Fully playable offline / with AI narration disabled.
