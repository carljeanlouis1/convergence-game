// Central balance config. Every tunable number in the engine lives here.
export const BALANCE = {
  totalTurns: 48,
  startingCapital: 120, // $M, seed round already closed
  startingComputePF: 40,
  startingTrust: 55,
  startingBoard: 70,
  startingControl: 78,
  startingMorale: 72,
  startingTeamStrength: 30,
  runTiers: {
    1: { computePerTurn: 8, turns: 3, cap: 45, costPerPFTurn: 0.32 },
    2: { computePerTurn: 20, turns: 4, cap: 62, costPerPFTurn: 0.3 },
    3: { computePerTurn: 45, turns: 5, cap: 80, costPerPFTurn: 0.28 },
    4: { computePerTurn: 90, turns: 6, cap: 100, costPerPFTurn: 0.26 },
  },
  run: {
    baseQuality: 32,
    leadSkillWeight: 2.2,
    teamStrengthWeight: 0.28,
    fundedDrift: 2.0,
    starvedDrift: -6.0, // reserved: compute crunch events (Plan 2)
    noiseSd: 4.5,
    checkpointEvery: 2,
    checkpointNoiseSd: 7,
    // reading vs expected: >= +12 ahead, >= 0 on-track, >= -10 wobbly, else troubled
    bands: { ahead: 12, onTrack: 0, wobbly: -10 },
    boostQuality: 4.5,
    boostCostMultiplier: 1.6, // boost charges (multiplier - 1) x one turn of run spend
    failThreshold: 25, // completed run below this quality = failed (no model)
  },
  finance: {
    computeUpkeepPerPF: 0.045, // $M per PF per turn
    teamCostPerPoint: 0.09, // $M per teamStrength point per turn
    inferenceRevenuePerPF: 0.5, // $M per PF, scaled by best deployed capability/100
    positioningMultipliers: { api: 1.0, enterprise: 1.15, consumer: 0.95, "open-weights": 0.15 },
    // Each market weights the benchmarks it actually buys. Weights sum to 1, so a balanced
    // model earns ~its average — but a specialized model earns more in its matching market.
    positioningWeights: {
      api: { coding: 0.5, reasoning: 0.5, enterprise: 0, consumer: 0 },
      enterprise: { coding: 0, reasoning: 0.3, enterprise: 0.7, consumer: 0 },
      consumer: { coding: 0.2, reasoning: 0.1, enterprise: 0, consumer: 0.7 },
      "open-weights": { coding: 0.25, reasoning: 0.25, enterprise: 0.25, consumer: 0.25 },
    },
    revenueDecayPerTurn: 0.06, // baseline decay before fast-follow repricing
    revenueExponent: 2.5, // superlinear capability→revenue: the frontier takes most of the market
    revenueScale: 0.16,
    pricingMultipliers: {
      aggressive: { revenue: 0.7, decay: 0.6 },
      standard: { revenue: 1.0, decay: 1.0 },
      premium: { revenue: 1.45, decay: 1.5 },
    },
    crownYieldBonus: 0.12, // +12% stream yield per crown the source model holds
    crownBoardDelta: 2, // board swing on crown gain/loss
    runwayFloorBurn: 0.1,
  },
  experiments: {
    momentumPerPF: 0.35, // research momentum gained per PF allocated to experiments
    momentumDecay: 0.12, // momentum bleeds off each quarter if you stop investing
    momentumQualityWeight: 0.6, // momentum × this is added to a new run's expected quality
    momentumCap: 30,
  },
  facilities: {
    repeatCostMultiplier: 1.6, // each additional facility of the same kind costs this much more
  },
  rivals: {
    runDurationMin: 3,
    runDurationMax: 6,
    jumpBase: 4,
    jumpAggressionWeight: 0.9,
    jumpNoiseSd: 3,
    fastFollowBaseDecay: 0.03,
    fastFollowPerRival: 0.03,
    fastFollowCap: 0.16,
    fastFollowThreshold: 0.9, // rival avg >= model avg * this → applies pressure
    wildcardCapabilityStart: 30,
  },
  talent: {
    marketSize: 4,
    marketChurnChance: 0.3,
    candidateExitAfter: 4,
    poachBaseChance: 0.1,
    poachAggressionWeight: 0.015,
    poachExpiry: 2,
    poachPackageBase: 8,
    poachPackageSkillWeight: 3,
    matchCostFactor: 0.6, // match = package * this, paid once
    equityControlCost: 1.5,
    declineMoraleHit: 8,
    departRivalCapGain: 2,
    burnoutPerRunTurn: 8,
    burnoutRecovery: 6,
    burnoutExodusThreshold: 90,
    exodusChance: 0.5,
    hireTeamStrength: 3,
    departTeamStrength: 3,
    runFailMorale: 6,
    runCompleteMorale: 5,
    wildcardSpawnDepartures: 3, // cumulative star departures that activate the wildcard rival
    specialtyCapabilityBonus: 8, // the lead's specialty adds this to that benchmark in the model they finish
  },
  funding: {
    offerRunwayTrigger: 12,
    offerCadence: 10,
    offerExpiry: 3,
    playerRaiseCooldown: 4,
    valuationCapWeight: 1.6,
    valuationRevenueWeight: 9,
    valuationTrustWeight: 0.4,
    vc: { amountFactor: 0.22, controlCost: 8, boardDelta: 5, trustDelta: 0, computeGrantPF: 0 },
    strategic: { amountFactor: 0.32, controlCost: 12, boardDelta: 3, trustDelta: -3, computeGrantPF: 20 },
    mission: { amountFactor: 0.15, controlCost: 4, boardDelta: 0, trustDelta: 5, computeGrantPF: 0 },
    boardNetPositive: 3,
    boardTop2Bonus: 2,
    boardLowRunway: -4,
    boardVeryLowRunway: -3,
    boardIncident: -5,
    coupThreshold: 20,
    coupSurviveMorale: 60,
    coupInterimMorale: 40,
    coupSurviveBoardReset: 45,
    coupSurviveControlCost: 5,
    interimRunTierCap: 2,
    interimTurns: 6,
    fireSaleFacilityFraction: 0.25,
    fireSaleCapitalRecovery: 0.55,
    fireSaleDownRoundControl: 20,
  },
  safety: {
    tierThresholds: { t1: 40, t2: 55, t3: 70 }, // max deployed-model avg capability
    requiredEval: { t0: 0, t1: 10, t2: 25, t3: 50 },
    evalPerSafetyPF: 0.5,
    evalDecay: 0.1,
    riskPerEvalGap: 0.4,
    incidentChancePerRisk: 0.01,
    incidentTrustHit: 12,
    incidentBoardHit: 8,
    incidentRevenueHit: 0.3,
    incidentRiskRelief: 0.5,
    safetyTrustDriftPerPF: 0.05,
  },
  events: { cadence: 2 }, // dilemmas may open on turns divisible by this
  eras: {
    startTurns: { 2: 11, 3: 25, 4: 39 },
    scalars: {
      rivalJump: { 1: 1.0, 2: 1.25, 3: 1.5, 4: 1.8 },
      fastFollow: { 1: 1.0, 2: 1.15, 3: 1.4, 4: 1.6 },
      poachChance: { 1: 1.0, 2: 1.3, 3: 1.5, 4: 1.5 },
    },
  },
  frontiers: {
    agiThreshold: 88,
    projectTurns: 6,
    projectComputePerTurn: 60,
    projectCostM: 80,
    payoffRevenue: 30,
    payoffTrust: 8,
    transcendenceCount: 3,
  },
  endings: {
    titanRevenue: 40,
    titanStreak: 4,
    titanControl: 50,
    crownStreak: 6,
    crownMinCapability: 70, // the streak only counts with a genuinely frontier model
    standardShare: 60,
    openSharePerModelPerTurn: 2,
    conscienceTrust: 85,
    conscienceEval: 40,
    asiCapability: 92,
    asiTrust: 60,
    asiEval: 60,
    laggingFraction: 0.45,
    laggingFromTurn: 24,
    laggingTurns: 6,
    catastropheIncidents: 3,
    figureheadControl: 15, // control at or below this = the board runs your lab
    pyrrhicControl: 35,
    pyrrhicTrust: 35,
    gradeThresholds: { S: 220, A: 160, B: 110, C: 60 }, // below C = D
  },
} as const;
