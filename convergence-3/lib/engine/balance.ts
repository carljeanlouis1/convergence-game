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
    positioningMultipliers: { api: 1.0, enterprise: 1.35, consumer: 0.9, "open-weights": 0.15 },
    revenueDecayPerTurn: 0.06, // flat Era-1 stand-in for fast-follow (rivals arrive in Plan 2)
    runwayFloorBurn: 0.1,
  },
  experiments: { pfPerTechniquePoint: 6 }, // reserved hook; Era-1 techniques are pre-unlocked
} as const;
