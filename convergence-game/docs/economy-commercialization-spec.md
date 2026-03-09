# Convergence Economy and Commercialization Spec

## Product Goals

- Preserve the fantasy of running a frontier AI lab, not a spreadsheet shell.
- Keep the economy legible: payroll, compute, facilities, research, and commercialization should each be visible and explainable.
- Make breakthroughs unlock capabilities first, then markets second.
- Force strategic choices around which market to pursue, because compute, trust, board patience, and geopolitics are all finite.
- Make fundraising solve short-term runway while changing who the lab increasingly works for.

## Core Principles

- Research is not the main early-game burn driver. Payroll and compute should usually dominate.
- Breakthroughs should create future options, not instant maxed-out revenue.
- Late-stage research must pay meaningfully more than early-stage research once it is operationalized.
- Commercialization paths are tailored by track and should feel like believable market plays for that domain.
- Some commercial plays are mutually exclusive because they compete for the same operating model.
- Some commercial plays create higher-order market convergences distinct from research convergences.

## Economy Model

### 1. Baseline Revenue

- Each researched stage contributes a small passive quarterly baseline.
- Passive baseline represents demos, prestige, pilot retainers, and inherited monetization without a deliberate go-to-market push.
- Passive baseline should be around 20-35% of the stage's full commercial potential.
- Passive baseline is enough to keep early tracks useful, but not enough to fully justify frontier burn on its own.

### 2. Active Commercialization Programs

- A commercialization program is a chosen market action that turns unlocked capability into scaled revenue.
- Programs have:
  - `upfrontCost`
  - `setupTurns`
  - `quarterlyRevenue`
  - `quarterlyExpense`
  - `computeDemand`
  - `lane`
  - `trackId`
  - `minLevel`
  - `effects` on trust, fear, board confidence, and government dependence
  - optional track requirements beyond the base track
- A program moves through:
  - `available`
  - `launching`
  - `live`
- While launching, it charges setup cost and sometimes light opex but does not yet pay recurring revenue.
- Once live, it reserves compute each quarter and adds recurring revenue and opex.

### 3. Research Costs

- Research cost is split into:
  - a small per-track operating cost while active
  - a stage complexity factor
  - modest assigned-staff amplification
  - modest compute amplification
- Research cost should be materially reduced from the current build.
- Later wet-lab and hardware-heavy tracks still cost more than software tracks, but should not make the early game collapse.
- Research expense should be inspectable by track in both Research and Finance.

### 4. Commercial Compute Reservation

- Active commercial products can reserve compute away from pure research.
- This creates a real choice:
  - maximize current cash
  - or keep compute pointed at the next breakthrough
- Reserved compute reduces free PFLOPS shown in the header and Research tab.

### 5. Capital Raises

- Capital raises appear as deterministic offers in Finance.
- Offer generation depends on:
  - current funding round
  - runway
  - trust
  - active revenue
  - flagship track maturity
- Accepting a raise gives immediate capital and sometimes compute or legitimacy, but reduces founder control and changes incentive pressure.

## Commercialization Lanes

- Each track can support one active program per lane.
- Lanes are used to prevent "launch everything" behavior.
- Initial lanes:
  - `commercial`
  - `public-sector`
  - `strategic`
  - `frontier`

Not every track uses every lane in the first implementation. The important rule is that similar monetization plays compete with one another.

## Tailored Commercialization Paths

### Foundation Models

- `Enterprise API Stack`
  - lane: `commercial`
  - min level: 1
  - medium setup, high compute demand
  - reliable enterprise revenue
  - raises board confidence
- `Reasoning Desk`
  - lane: `commercial`
  - min level: 2
  - lower compute than API stack
  - monetizes analyst automation and decision-support
  - strong early ROI
- `Agent Operations Suite`
  - lane: `strategic`
  - min level: 3
  - higher revenue, high compute demand
  - raises fear and labor-displacement pressure
- `Sovereign Model Lease`
  - lane: `public-sector`
  - min level: 4
  - large revenue and compute grant
  - lowers trust, increases government dependence
- `ASI Stewardship Accords`
  - lane: `frontier`
  - min level: 6
  - late-game mega revenue
  - strong trust if alignment is high

### Alignment

- `Frontier Assurance Audits`
  - lane: `commercial`
  - min level: 1
  - lower revenue, strong trust
- `Safety Governance Stack`
  - lane: `public-sector`
  - min level: 2
  - moderate revenue
  - increases reliability and EU legitimacy
- `Deployment Control Layer`
  - lane: `strategic`
  - min level: 3
  - middling revenue, better board confidence
- `Verified Alignment Treaty`
  - lane: `frontier`
  - min level: 5
  - late-game legitimacy monetization
  - meaningful beneficial-ASI support

### Simulation Modeling

- `Forecasting SaaS`
  - lane: `commercial`
  - min level: 1
  - cheap to launch, fast cash
- `City Systems Desk`
  - lane: `public-sector`
  - min level: 2
  - medium revenue, trust positive
- `Population Twin Exchange`
  - lane: `commercial`
  - min level: 3
  - higher revenue, stronger fear and ethics pressure
- `Sovereign Scenario Engine`
  - lane: `strategic`
  - min level: 4
  - major revenue, high surveillance risk
- `Civilizational Foresight Bureau`
  - lane: `frontier`
  - min level: 5
  - extreme revenue, very high geopolitical pressure

### Robotics

- `Warehouse Pilot Fleet`
  - lane: `commercial`
  - min level: 1
  - medium setup cost, modest compute
- `Field Logistics Autonomy`
  - lane: `strategic`
  - min level: 2
  - stronger revenue, defense attention
- `Humanoid Labor Contracts`
  - lane: `commercial`
  - min level: 3
  - high revenue, high fear
- `Autonomous Security Response`
  - lane: `public-sector`
  - min level: 4
  - very high revenue, major trust downside
- `Self-Replicating Fabrication Services`
  - lane: `frontier`
  - min level: 5
  - huge industrial upside, very high ethics stakes

### Computational Biology

- `Pharma Discovery Pipeline`
  - lane: `commercial`
  - min level: 1
  - moderate setup, partner-style revenue
- `Clinical Preparedness Network`
  - lane: `public-sector`
  - min level: 2
  - moderate revenue, strong trust
- `Programmable Therapeutics Platform`
  - lane: `commercial`
  - min level: 3
  - large revenue, stronger fear and ethics pressure
- `Biosecurity Screening Grid`
  - lane: `strategic`
  - min level: 4
  - very high state interest, trust mixed
- `Programmable Organism Foundry`
  - lane: `frontier`
  - min level: 5
  - extremely high revenue, high fear

### Advanced Materials

- `Materials Licensing Desk`
  - lane: `commercial`
  - min level: 1
  - efficient high-margin licensing
- `Grid Retrofit Contracts`
  - lane: `public-sector`
  - min level: 2
  - medium revenue, trust positive
- `Superconductor Deployment Program`
  - lane: `strategic`
  - min level: 3
  - major infrastructure revenue
- `Adaptive Manufacturing Platform`
  - lane: `commercial`
  - min level: 4
  - strong recurring industrial revenue
- `Programmable Matter Exchange`
  - lane: `frontier`
  - min level: 5
  - massive margin, board excitement, public unease

### Quantum Computing

- `Quantum Security Retainers`
  - lane: `strategic`
  - min level: 1
  - immediate strategic demand
- `Advantage Compute Access`
  - lane: `commercial`
  - min level: 2
  - high-margin specialized contracts
- `Cryptographic Transition Authority`
  - lane: `public-sector`
  - min level: 3
  - very high revenue, fear and state pressure
- `Quantum Simulation Core`
  - lane: `frontier`
  - min level: 4
  - huge late-game scientific value

### Space Systems

- `Orbital Autonomy Services`
  - lane: `commercial`
  - min level: 1
  - aerospace and satellite revenue
- `Construction Mission Ops`
  - lane: `strategic`
  - min level: 2
  - medium-high revenue, requires operational maturity
- `Autonomous Launch Mesh`
  - lane: `public-sector`
  - min level: 3
  - state-friendly revenue, some control tradeoff
- `Habitat Systems Consortium`
  - lane: `frontier`
  - min level: 5
  - transcendence-path monetization

## Commercial Market Convergences

These are not research breakthroughs. They are business-model convergences created by the commercialization programs you chose.

- `Autonomous Workforce Platform`
  - requires `Agent Operations Suite` + `Humanoid Labor Contracts`
  - recurring revenue spike
  - increases fear and board confidence
- `Strategic Command Grid`
  - requires `Sovereign Model Lease` or `Agent Operations Suite` + `Quantum Security Retainers`
  - strong revenue
  - increases government dependence
- `Pandemic Prevention Grid`
  - requires `Clinical Preparedness Network` + `City Systems Desk` or `Sovereign Scenario Engine`
  - strong revenue and trust
- `Autonomous Factory Stack`
  - requires `Humanoid Labor Contracts` + `Adaptive Manufacturing Platform`
  - strong revenue and board support
- `Orbital Operations Mesh`
  - requires `Construction Mission Ops` + late Foundation frontier program
  - very large revenue and compute strain

## Funding Model

### Metrics

- `founderControl`: starts around 74-82 depending on preset
- `fundingRound`: starts at `Seed`
- `lastFundingTurn`: prevents back-to-back raises

### Offer Types

- `Frontier VC Syndicate`
  - strongest raw cash
  - founder control down
  - board pressure up
- `Mission Trust Fund`
  - less cash
  - trust up
  - control loss is smaller
- `Strategic Compute Partner`
  - cash plus compute capacity
  - some autonomy loss
  - more commercialization pressure
- `National Security Program`
  - large cash
  - large government dependence
  - trust mixed, fear slightly up

### Cadence

- New offer window if:
  - runway below 9 months
  - or at least 8 turns since the last raise
- No IPO in the first implementation slice. IPO stays a follow-on system once commercialization is stable.

## Board and Control Thresholds

- `founderControl >= 70`
  - founder-led
- `55-69`
  - board starts leaning on growth and commercialization
- `40-54`
  - board confidence decays faster during weak quarters
- `< 40`
  - board becomes intolerant of persistent negative net and safety scandals

## UI Surfaces

### Header

- turn / quarter / year
- capital
- quarterly revenue
- quarterly net
- optional founder control tag in Finance, not mandatory in the global header

### Research Tab

- research web only
- selected track card
- research economics card
- commercialization options card
- active programs card
- market convergence preview card
- track stage arc with passive revenue and recommended products

### Briefing Tab

- chief memo
- event feed
- world pulse
- race board
- decision memory

### Finance Tab

- capital / burn / revenue / net / runway
- expense breakdown by category
- research expense by track
- commercialization revenue and expense by program
- founder control / funding round
- live funding offers

### Hiring Tab

- candidates
- pending arrivals
- coverage gaps
- payroll impact

### Facilities Tab

- supplier and energy policy
- active facility projects
- compute gains and operating tradeoffs

## First Implementation Slice

- Rebalance research expenses downward.
- Keep a small passive revenue baseline from unlocked stages.
- Add tailored commercialization options and active programs.
- Reserve compute for live programs.
- Add revenue and expense detail by track and by program.
- Add first deterministic funding offers and founder control.
- Move research web to Research only and event feed to Briefing only.
