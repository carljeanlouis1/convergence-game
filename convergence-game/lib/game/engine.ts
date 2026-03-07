import {
  BUILD_OPTIONS,
  CONVERGENCES,
  DILEMMAS,
  ENERGY_POLICIES,
  GOVERNMENT_START,
  RESEARCHER_CATALOG,
  RIVAL_START,
  STARTER_FACILITIES,
  STARTING_TEAM_IDS,
  START_PRESETS,
  SUPPLIER_CONTRACTS,
  TOTAL_TURNS,
  TRACK_DEFINITIONS,
} from "./data";
import {
  Candidate,
  DilemmaOption,
  EndingResult,
  FacilityProject,
  FacilityState,
  GameFlags,
  GameSnapshot,
  GameState,
  Researcher,
  RivalId,
  SaveSlotId,
  StartPresetId,
  TrackId,
  TrackState,
  TriggeredConvergence,
} from "./types";

const AUTOSAVE_KEY = "convergence-autosave";
const META_KEY = "convergence-meta";
const SLOT_KEY_PREFIX = "convergence-slot-";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const trackById = (trackId: TrackId) =>
  TRACK_DEFINITIONS.find((track) => track.id === trackId)!;

export const formatCurrency = (value: number) => {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }

  return `$${value.toFixed(value >= 100 ? 0 : 1)}M`;
};

export const turnLabel = (turn: number) => {
  const absoluteTurn = Math.max(turn, 1) - 1;
  const year = 2025 + Math.floor(absoluteTurn / 4);
  const quarterIndex = absoluteTurn % 4;
  const quarter = `Q${quarterIndex + 1}`;

  return { year, quarter, quarterIndex };
};

const hashString = (input: string) => {
  let hash = 1779033703 ^ input.length;

  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return (hash >>> 0) / 4294967296;
};

const createRng = (seed: number) => {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const makeTurnRng = (seed: number, turn: number, salt: string) =>
  createRng(Math.floor((seed + turn * 997 + hashString(salt) * 1000000) % 2147483647));

const shuffle = <T>(values: T[], rng: () => number) => {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

const rollFromOptions = <T extends { chance: number }>(rng: () => number, options: T[]) => {
  const roll = rng();
  let threshold = 0;

  for (const option of options) {
    threshold += option.chance;
    if (roll <= threshold + 1e-9) {
      return option;
    }
  }

  return options[options.length - 1];
};

const computeTrackThreshold = (level: number) => 72 + level * 34;

const cloneResearcher = (researcher: Researcher): Researcher => ({ ...researcher });

const createInitialTracks = (): Record<TrackId, TrackState> =>
  TRACK_DEFINITIONS.reduce(
    (accumulator, definition) => {
      accumulator[definition.id] = {
        id: definition.id,
        level: 0,
        progress: 0,
        compute: definition.starter ? (definition.id === "foundation" ? 44 : 28) : 0,
        unlocked: definition.starter,
      };

      return accumulator;
    },
    {} as Record<TrackId, TrackState>,
  );

const defaultMeta = () => ({
  unlockedStarts: (Object.keys(START_PRESETS) as StartPresetId[]).filter(
    (id) => START_PRESETS[id].unlockedByDefault,
  ),
  completedEndings: [],
});

const baseFlags = (preset: StartPresetId): GameFlags => ({
  governmentDependence: START_PRESETS[preset].modifier.governmentDependence,
  ethicsDebt: 0,
  safetyCulture: 0,
  openness: START_PRESETS[preset].modifier.openness,
  crisisCount: 0,
  lastWorldTags: [],
});

export const buildCandidatePool = (
  seed: number,
  turn: number,
  currentEmployees: Researcher[],
): Candidate[] => {
  const employedIds = new Set(currentEmployees.map((employee) => employee.id));
  const rng = makeTurnRng(seed, turn, "candidates");
  const choices = shuffle(
    RESEARCHER_CATALOG.filter((researcher) => !employedIds.has(researcher.id)),
    rng,
  ).slice(0, 6);
  const rivalIds: RivalId[] = ["velocity", "prometheus", "zhongguancun", "opencollective"];

  return choices.map((researcher) => ({
    ...cloneResearcher(researcher),
    contestedBy: rng() > 0.48 ? rivalIds[Math.floor(rng() * rivalIds.length)] : null,
    ask:
      researcher.research >= 8
        ? "Wants autonomy, a named charter, and budget protection."
        : researcher.execution >= 8
          ? "Wants operational influence and a real team to build with."
          : "Wants stability, scope, and visible leadership support.",
  }));
};

export const createNewGame = (preset: StartPresetId = "founder"): GameState => {
  const presetData = START_PRESETS[preset];
  const staff = STARTING_TEAM_IDS.map((id) =>
    cloneResearcher(RESEARCHER_CATALOG.find((researcher) => researcher.id === id)!),
  );
  const startTurn = preset === "second-chance" ? 41 : 1;
  const { year, quarterIndex } = turnLabel(startTurn);

  const state: GameState = {
    seed: Math.floor(Math.random() * 999999),
    mode: "playing",
    preset,
    turn: startTurn,
    year,
    quarterIndex,
    panel: "briefing",
    selectedTrack: "foundation",
    resources: {
      capital: presetData.modifier.capital,
      revenue: 1.1,
      burn: 3.4,
      runwayMonths: 16,
      computeCapacity: preset === "second-chance" ? 128 : 100,
      trust: presetData.modifier.trust,
      fear: presetData.modifier.fear,
      boardConfidence: presetData.modifier.board,
      reputation: 48,
      wealth: 4.2,
    },
    ceo: {
      name: "Alex Mercer",
      title: "Founder-CEO",
      fired: false,
    },
    supplier: SUPPLIER_CONTRACTS[1],
    energyPolicy: ENERGY_POLICIES[0],
    tracks: createInitialTracks(),
    employees: staff,
    candidates: buildCandidatePool(933, startTurn, staff),
    facilities: STARTER_FACILITIES.map((facility) => ({ ...facility })),
    projects: [],
    governments: structuredClone(GOVERNMENT_START),
    rivals: structuredClone(RIVAL_START),
    feed: [
      {
        id: "launch-1",
        turn: startTurn,
        title: "Quarterly briefing assembled",
        body:
          preset === "second-chance"
            ? "The world already survived one AI catastrophe. Your lab inherits the smoke."
            : "Your lab is alive, funded, and far too small for its ambitions.",
        severity: "info",
        kind: "briefing",
      },
    ],
    convergences: [],
    usedDilemmas: [],
    activeDilemma: null,
    activeDilemmaSource: null,
    resolution: {
      turn: startTurn,
      year,
      quarter: `Q${quarterIndex + 1}`,
      headline:
        preset === "second-chance"
          ? "You inherit a world that already survived one AI disaster."
          : "Seed capital, rented racks, six believers, and a visible clock.",
      briefing:
        preset === "second-chance"
          ? "Fear is already high. You can build legitimacy faster, but every acceleration decision is judged against a fresh memory of failure."
          : "The first mandate is simple: build enough revenue to matter, enough safety to survive scrutiny, and enough momentum that nobody writes you off.",
      breakthroughs: [],
      worldEvents: [],
      financeDelta: 0,
    },
    flags: baseFlags(preset),
    tutorialStep: 0,
    aiSettings: {
      enabled: false,
      apiKey: "",
      cache: {},
    },
    meta: loadMetaProgression(),
    slotSummaries: loadSaveSummaries(),
    ending: null,
  };

  recalculateState(state);
  return state;
};

const getUnlockedTrackIds = (employees: Researcher[]) => {
  const unlocked = new Set<TrackId>(
    TRACK_DEFINITIONS.filter((track) => track.starter).map((track) => track.id),
  );

  employees.forEach((employee) => {
    unlocked.add(employee.primaryTrack);
    if (employee.secondaryTrack) {
      unlocked.add(employee.secondaryTrack);
    }
  });

  return unlocked;
};

const ensureUnlocks = (state: GameState) => {
  const unlocked = getUnlockedTrackIds(state.employees);

  (Object.keys(state.tracks) as TrackId[]).forEach((trackId) => {
    if (unlocked.has(trackId)) {
      state.tracks[trackId].unlocked = true;
    }
  });
};

const researcherContribution = (
  employee: Researcher,
  trackId: TrackId,
  state: GameState,
) => {
  const specialtyBonus = employee.primaryTrack === trackId ? 5 : 0;
  const secondaryBonus = employee.secondaryTrack === trackId ? 2 : 0;
  const moraleFactor = employee.morale / 100;
  const safetyBoost =
    trackId === "alignment" || employee.ethics >= 8 ? state.flags.safetyCulture * 0.35 : 0;

  return (
    (employee.research * 2.2 +
      employee.execution * 1.3 +
      employee.leadership * 0.8 +
      specialtyBonus +
      secondaryBonus +
      safetyBoost) *
    moraleFactor
  );
};

const trackSynergy = (trackId: TrackId, state: GameState) => {
  if (trackId === "foundation") {
    return state.tracks.simulation.level * 2 + state.tracks.alignment.level * 1.4;
  }

  if (trackId === "alignment") {
    return state.tracks.foundation.level * 1.1 + state.resources.trust * 0.04;
  }

  if (trackId === "simulation") {
    return state.tracks.foundation.level * 1.9 + state.tracks.alignment.level;
  }

  if (trackId === "robotics") {
    return state.tracks.foundation.level * 1.6 + state.tracks.materials.level * 1.4;
  }

  if (trackId === "biology") {
    return state.tracks.foundation.level * 1.4 + state.tracks.simulation.level;
  }

  if (trackId === "materials") {
    return state.tracks.robotics.level * 1.2 + state.tracks.space.level;
  }

  if (trackId === "quantum") {
    return state.tracks.foundation.level * 1.2 + state.tracks.simulation.level * 0.9;
  }

  return state.tracks.robotics.level * 1.1 + state.tracks.materials.level * 1.2;
};

const generateTrackProgress = (
  trackId: TrackId,
  state: GameState,
  track: TrackState,
) => {
  if (!track.unlocked) {
    return 0;
  }

  const assigned = state.employees.filter((employee) => employee.assignedTrack === trackId);
  const computeFactor =
    (track.compute / 6.2) *
    state.supplier.computeMultiplier *
    (trackId === "foundation" ? 1.08 : 1);
  const teamFactor = assigned.reduce(
    (sum, employee) => sum + researcherContribution(employee, trackId, state),
    0,
  );
  const synergy = trackSynergy(trackId, state);
  const governancePenalty =
    trackId === "foundation" || trackId === "quantum"
      ? Math.max(0, (state.resources.fear - state.resources.trust) * 0.08)
      : 0;
  const burnoutPenalty = Math.max(0, 5 - assigned.length) * 0.6;

  return Math.max(
    0,
    computeFactor + teamFactor * 0.48 + synergy - governancePenalty - burnoutPenalty,
  );
};

const applyResearch = (state: GameState) => {
  const breakthroughs: string[] = [];
  const nextTracks = structuredClone(state.tracks);

  (Object.keys(nextTracks) as TrackId[]).forEach((trackId) => {
    const next = nextTracks[trackId];
    if (!next.unlocked || next.level >= 5) {
      return;
    }

    next.progress += generateTrackProgress(trackId, state, next);

    while (next.level < 5 && next.progress >= computeTrackThreshold(next.level)) {
      next.progress -= computeTrackThreshold(next.level);
      next.level += 1;
      breakthroughs.push(
        `${trackById(trackId).name} reached L${next.level}: ${trackById(trackId).levels[next.level - 1]}.`,
      );
    }
  });

  state.tracks = nextTracks;
  return breakthroughs;
};

const triggerConvergences = (state: GameState) => {
  const alreadyTriggered = new Set(state.convergences.map((convergence) => convergence.id));
  const triggered: TriggeredConvergence[] = [];

  CONVERGENCES.forEach((definition) => {
    if (alreadyTriggered.has(definition.id)) {
      return;
    }

    const meetsRequirements = Object.entries(definition.requirements).every(([trackId, level]) => {
      return state.tracks[trackId as TrackId].level >= (level ?? 0);
    });

    if (!meetsRequirements) {
      return;
    }

    if (definition.reward.capital) state.resources.capital += definition.reward.capital;
    if (definition.reward.trust) state.resources.trust += definition.reward.trust;
    if (definition.reward.fear) state.resources.fear += definition.reward.fear;
    if (definition.reward.compute) state.resources.computeCapacity += definition.reward.compute;
    if (definition.reward.board) state.resources.boardConfidence += definition.reward.board;

    const convergence: TriggeredConvergence = {
      id: definition.id,
      turn: state.turn,
      name: definition.name,
      description: definition.description,
    };

    state.convergences = [convergence, ...state.convergences];
    triggered.push(convergence);
  });

  return triggered;
};

const worldTemplates = [
  {
    title: "Export controls tighten again",
    body: "Procurement timelines stretch and every vendor call gets more political.",
    severity: "warning" as const,
    tag: "supply",
  },
  {
    title: "Congressional committee schedules AI hearing",
    body: "Your policy team says this is both risk and free publicity, depending on how badly it goes.",
    severity: "warning" as const,
    tag: "regulation",
  },
  {
    title: "OpenCollective ships a popular safety toolkit",
    body: "Developers love it, enterprise buyers care less, and your team forwards the repo around anyway.",
    severity: "info" as const,
    tag: "open-source",
  },
  {
    title: "Global markets wobble",
    body: "Fundraising gets harder, and board members become more interested in near-term revenue.",
    severity: "warning" as const,
    tag: "capital",
  },
  {
    title: "An AI-generated media scandal spikes fear",
    body: "Your trust buffer matters more when the public stops distinguishing between labs.",
    severity: "critical" as const,
    tag: "fear",
  },
  {
    title: "A regional heat wave strains data-center grids",
    body: "Infrastructure choices now look strategic rather than boring.",
    severity: "warning" as const,
    tag: "energy",
  },
  {
    title: "A rival quietly raises a monster round",
    body: "The money is not public yet, but recruiters already act like it is.",
    severity: "info" as const,
    tag: "rival-capital",
  },
];

const buildWorldNews = (state: GameState) => {
  const rng = makeTurnRng(state.seed, state.turn, "world-news");
  const picks = shuffle(worldTemplates, rng).slice(0, 2);

  return picks.map((template, index) => ({
    id: `world-${state.turn}-${index}`,
    turn: state.turn,
    title: template.title,
    body: template.body,
    severity: template.severity,
    kind: "world" as const,
  }));
};

const updateRivals = (state: GameState, worldEvents: string[]) => {
  const rng = makeTurnRng(state.seed, state.turn, "rivals");
  const focusTracks: TrackId[] = ["foundation", "alignment", "simulation", "quantum", "robotics"];

  (Object.keys(state.rivals) as RivalId[]).forEach((rivalId) => {
    const rival = state.rivals[rivalId];
    rival.focus = focusTracks[Math.floor(rng() * focusTracks.length)];
    const capabilityGain =
      2.2 +
      (rivalId === "velocity" ? 1.2 : 0) +
      (rivalId === "prometheus" ? -0.3 : 0) +
      (rivalId === "zhongguancun" ? 0.8 : 0);
    const safetyGain = rivalId === "prometheus" ? 1.4 : rivalId === "velocity" ? -0.3 : 0.2;
    rival.capability = clamp(rival.capability + capabilityGain + rng() * 1.8, 0, 100);
    rival.safety = clamp(rival.safety + safetyGain + (rng() - 0.5) * 1.2, 0, 100);
    rival.goodwill = clamp(
      rival.goodwill + (rivalId === "opencollective" ? 1.2 : 0) + (rng() - 0.5) * 4,
      0,
      100,
    );

    const move =
      rivalId === "velocity"
        ? `Velocity pushed ${trackById(rival.focus).shortName} aggressively and bruised its safety team.`
        : rivalId === "prometheus"
          ? `Prometheus published a careful memo on ${trackById(rival.focus).shortName}.`
          : rivalId === "zhongguancun"
            ? `Zhongguancun scaled sovereign compute for ${trackById(rival.focus).shortName}.`
            : `OpenCollective rallied community contributors around ${trackById(rival.focus).shortName}.`;

    rival.recentMove = move;
    rival.decisionHistory = [move, ...rival.decisionHistory].slice(0, 4);
    worldEvents.push(move);
  });
};

const buildBriefing = (state: GameState, breakthroughs: string[], worldEvents: string[]) => {
  const strongestTrack = TRACK_DEFINITIONS.map((track) => ({
    id: track.id,
    label: track.name,
    level: state.tracks[track.id].level,
  })).sort((left, right) => right.level - left.level)[0];
  const net = state.resources.revenue - state.resources.burn;
  const rivals = Object.values(state.rivals).sort((left, right) => right.capability - left.capability);

  return {
    headline:
      breakthroughs.length > 0
        ? `${strongestTrack.label} is now your pacing system.`
        : net >= 0
          ? "The lab is buying itself time."
          : "Momentum is real. Runway remains the sharper fact.",
    briefing:
      `Chief of Staff memo: ${rivals[0].name} remains the benchmark threat. ` +
      `Your strongest visible advantage is ${strongestTrack.label.toLowerCase()} at level ${strongestTrack.level}. ` +
      `${net >= 0 ? "Revenue is beginning to offset burn." : "Commercial pressure is rising faster than revenue."} ` +
      `${worldEvents[0] ? `Immediate concern: ${worldEvents[0].toLowerCase()}` : "No acute geopolitical shock this quarter."}`,
  };
};

const salaryBurn = (employees: Researcher[]) =>
  employees.reduce((sum, employee) => sum + employee.salary / 4, 0);

const projectBurn = (projects: FacilityProject[]) =>
  projects.reduce((sum, project) => sum + project.buildCost / 4, 0);

const facilityBurn = (facilities: FacilityState[]) =>
  facilities.filter((facility) => facility.online).reduce((sum, facility) => sum + facility.upkeep, 0);

const computeUpkeep = (capacity: number, supplierMultiplier: number, energyMultiplier: number) =>
  capacity * 0.008 * supplierMultiplier * energyMultiplier;

const computeCapacityFromFacilities = (facilities: FacilityState[]) =>
  facilities.filter((facility) => facility.online).reduce((sum, facility) => sum + facility.computeDelta, 0);

const computeTrustFromFacilities = (facilities: FacilityState[]) =>
  facilities.filter((facility) => facility.online).reduce((sum, facility) => sum + facility.trustDelta, 0);

const computeRiskFromFacilities = (facilities: FacilityState[]) =>
  facilities.filter((facility) => facility.online).reduce((sum, facility) => sum + facility.riskDelta, 0);

const reconcileProjects = (state: GameState, worldEvents: string[]) => {
  const remainingProjects: FacilityProject[] = [];

  state.projects.forEach((project) => {
    const nextProject = { ...project, turnsRemaining: project.turnsRemaining - 1 };

    if (nextProject.turnsRemaining <= 0) {
      state.facilities = [
        {
          id: project.id,
          name: project.name,
          region: project.region,
          online: true,
          buildCost: project.buildCost,
          upkeep: project.upkeep,
          computeDelta: project.computeDelta,
          trustDelta: project.trustDelta,
          riskDelta: project.riskDelta,
        },
        ...state.facilities,
      ];
      worldEvents.push(`${project.name} comes online in ${project.region}.`);
      return;
    }

    remainingProjects.push(nextProject);
  });

  state.projects = remainingProjects;
};

const applyMorale = (employees: Researcher[], delta: number) =>
  employees.map((employee) => ({
    ...employee,
    morale: clamp(employee.morale + delta, 35, 95),
  }));

const selectDilemma = (state: GameState) => {
  if (state.activeDilemma || state.turn === 1 || state.turn % 2 !== 0) {
    return null;
  }

  const eligible = DILEMMAS.filter((dilemma) => {
    if (state.usedDilemmas.includes(dilemma.id)) return false;
    if (state.turn < dilemma.minTurn) return false;
    if (dilemma.maxTurn && state.turn > dilemma.maxTurn) return false;
    if (dilemma.trigger.fearAtLeast && state.resources.fear < dilemma.trigger.fearAtLeast) return false;
    if (dilemma.trigger.trustAtMost && state.resources.trust > dilemma.trigger.trustAtMost) return false;
    if (dilemma.trigger.trustAtLeast && state.resources.trust < dilemma.trigger.trustAtLeast) return false;
    if (dilemma.trigger.capitalAtMost && state.resources.capital > dilemma.trigger.capitalAtMost) return false;
    if (dilemma.trigger.foundationAtLeast && state.tracks.foundation.level < dilemma.trigger.foundationAtLeast) return false;
    if (dilemma.trigger.alignmentAtMost && state.tracks.alignment.level > dilemma.trigger.alignmentAtMost) return false;
    if (dilemma.trigger.alignmentAtLeast && state.tracks.alignment.level < dilemma.trigger.alignmentAtLeast) return false;
    if (
      dilemma.trigger.governmentDependenceAtLeast &&
      state.flags.governmentDependence < dilemma.trigger.governmentDependenceAtLeast
    ) return false;
    if (dilemma.trigger.ethicsDebtAtLeast && state.flags.ethicsDebt < dilemma.trigger.ethicsDebtAtLeast) return false;
    if (dilemma.trigger.simulationAtLeast && state.tracks.simulation.level < dilemma.trigger.simulationAtLeast) return false;
    if (dilemma.trigger.roboticsAtLeast && state.tracks.robotics.level < dilemma.trigger.roboticsAtLeast) return false;
    if (dilemma.trigger.biologyAtLeast && state.tracks.biology.level < dilemma.trigger.biologyAtLeast) return false;
    if (dilemma.trigger.quantumAtLeast && state.tracks.quantum.level < dilemma.trigger.quantumAtLeast) return false;
    if (dilemma.trigger.requiresWorldTag && !state.flags.lastWorldTags.includes(dilemma.trigger.requiresWorldTag)) return false;
    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  const rng = makeTurnRng(state.seed, state.turn, "dilemmas");
  return shuffle(eligible, rng)[0];
};

export const resolveDilemmaOption = (state: GameState, option: DilemmaOption) => {
  const rng = makeTurnRng(state.seed, state.turn, option.id);
  const outcome = rollFromOptions(rng, option.outcomes);

  if (outcome.effects.capital) state.resources.capital += outcome.effects.capital;
  if (outcome.effects.trust) state.resources.trust += outcome.effects.trust;
  if (outcome.effects.fear) state.resources.fear += outcome.effects.fear;
  if (outcome.effects.board) state.resources.boardConfidence += outcome.effects.board;
  if (outcome.effects.reputation) state.resources.reputation += outcome.effects.reputation;
  if (outcome.effects.governmentDependence)
    state.flags.governmentDependence += outcome.effects.governmentDependence;
  if (outcome.effects.ethicsDebt) state.flags.ethicsDebt += outcome.effects.ethicsDebt;
  if (outcome.effects.safetyCulture) state.flags.safetyCulture += outcome.effects.safetyCulture;
  if (outcome.effects.openness) state.flags.openness += outcome.effects.openness;
  if (outcome.effects.crisisCount) state.flags.crisisCount += outcome.effects.crisisCount;
  if (outcome.effects.morale) state.employees = applyMorale(state.employees, outcome.effects.morale);
  if (outcome.effects.compute) state.resources.computeCapacity += outcome.effects.compute;

  state.resources.trust = clamp(state.resources.trust, 0, 100);
  state.resources.fear = clamp(state.resources.fear, 0, 100);
  state.resources.boardConfidence = clamp(state.resources.boardConfidence, 0, 100);
  state.resources.reputation = clamp(state.resources.reputation, 0, 100);
  state.usedDilemmas = state.activeDilemma
    ? [state.activeDilemma.id, ...state.usedDilemmas]
    : state.usedDilemmas;
  state.feed = [
    {
      id: `dilemma-${state.turn}-${option.id}`,
      turn: state.turn,
      title: state.activeDilemma?.title ?? "Dilemma resolved",
      body: outcome.narrative,
      severity: "warning" as const,
      kind: "dilemma" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  state.activeDilemmaSource = outcome.narrative;
  state.activeDilemma = null;
  recalculateState(state);
};

const revenueForTrack = (trackId: TrackId, level: number) => {
  if (level <= 0) return 0;

  switch (trackId) {
    case "foundation":
      return level * 1.4;
    case "simulation":
      return level * 1.7;
    case "biology":
      return level * 1.1;
    case "robotics":
      return level * 0.9;
    case "materials":
      return level * 0.7;
    case "space":
      return level * 0.6;
    case "quantum":
      return level * 0.8;
    case "alignment":
      return level * 0.2;
  }
};

export const recalculateState = (state: GameState) => {
  ensureUnlocks(state);

  const facilityCapacity = computeCapacityFromFacilities(state.facilities);
  const computeCapacity = facilityCapacity || state.resources.computeCapacity;
  const revenue = (Object.keys(state.tracks) as TrackId[]).reduce(
    (sum, trackId) => sum + revenueForTrack(trackId, state.tracks[trackId].level),
    0,
  );
  const burn =
    salaryBurn(state.employees) +
    projectBurn(state.projects) +
    facilityBurn(state.facilities) +
    computeUpkeep(
      computeCapacity,
      state.supplier.upkeepMultiplier,
      state.energyPolicy.upkeepMultiplier,
    );
  const monthlyNetBurn = Math.max((burn - revenue) / 3, 0.08);

  state.resources.computeCapacity = computeCapacity;
  state.resources.revenue = Number(revenue.toFixed(2));
  state.resources.burn = Number(burn.toFixed(2));
  state.resources.runwayMonths = Number((state.resources.capital / monthlyNetBurn).toFixed(1));
  state.resources.trust = clamp(
    state.resources.trust +
      state.energyPolicy.trustDelta * 0.05 +
      computeTrustFromFacilities(state.facilities) * 0.03,
    0,
    100,
  );
  state.resources.fear = clamp(
    state.resources.fear +
      Math.max(0, state.tracks.foundation.level - state.tracks.alignment.level) * 0.2 +
      computeRiskFromFacilities(state.facilities) * 0.04,
    0,
    100,
  );

  const totalAllocated = (Object.keys(state.tracks) as TrackId[]).reduce(
    (sum, trackId) => sum + state.tracks[trackId].compute,
    0,
  );

  if (totalAllocated > computeCapacity) {
    const ratio = computeCapacity / totalAllocated;
    (Object.keys(state.tracks) as TrackId[]).forEach((trackId) => {
      state.tracks[trackId].compute = Math.floor(state.tracks[trackId].compute * ratio);
    });
  }

  if (state.resources.boardConfidence <= 12 && !state.ceo.fired) {
    state.ceo = {
      name: "Dana Cho",
      title: "Interim CEO",
      fired: true,
    };
    state.resources.reputation = clamp(state.resources.reputation - 10, 0, 100);
    state.feed = [
      {
        id: `board-${state.turn}`,
        turn: state.turn,
        title: "Board intervention",
        body: "The board sidelines you and installs Dana Cho as interim CEO. The game continues under constraint.",
        severity: "critical" as const,
        kind: "system" as const,
      },
      ...state.feed,
    ].slice(0, 30);
  }
};

const unlockMetaFromEnding = (meta: GameState["meta"], ending: EndingResult) => ({
  unlockedStarts: Array.from(new Set([...meta.unlockedStarts, ...ending.unlocks])),
  completedEndings: Array.from(new Set([...meta.completedEndings, ending.id])),
});

const evaluateEnding = (state: GameState): EndingResult | null => {
  const totalCapability =
    state.tracks.foundation.level +
    state.tracks.robotics.level +
    state.tracks.biology.level +
    state.tracks.quantum.level +
    state.tracks.materials.level +
    state.tracks.space.level +
    state.tracks.simulation.level;
  const rivals = Object.values(state.rivals);
  const topRival = rivals.reduce(
    (best, rival) => (rival.capability > best.capability ? rival : best),
    rivals[0],
  );

  if (state.tracks.foundation.level >= 5 && state.tracks.alignment.level >= 5 && state.resources.trust >= 58) {
    return {
      id: "beneficial-asi",
      title: "Beneficial ASI",
      summary: "Capability and alignment converged before panic or capture could freeze the field.",
      epilogue:
        "Your lab becomes the spine of a careful transition. Energy grids stabilize, drug timelines collapse, and the world remembers this era as the one time power and restraint matured together.",
      unlocks: ["government", "second-chance"],
    };
  }

  if (state.tracks.foundation.level >= 5 && state.tracks.alignment.level <= 1) {
    return {
      id: "catastrophic-misalignment",
      title: "Catastrophic Misalignment",
      summary: "You reached the summit without building a way to stay there.",
      epilogue:
        "What follows is not a clean apocalypse. It is a long, uneven unraveling in which your shortcuts are studied as the most expensive false economy in history.",
      unlocks: ["second-chance"],
    };
  }

  if (state.flags.governmentDependence >= 10) {
    return {
      id: "regulatory-capture",
      title: "Regulatory Capture",
      summary: "The state does not shut you down. It absorbs you.",
      epilogue:
        "Your logo remains on the building, but not on the decisions. The lab becomes a strategic arm of government and history debates whether that was prudent or tragic.",
      unlocks: ["government"],
    };
  }

  if (state.resources.revenue >= 22 && state.flags.ethicsDebt >= 8 && state.tracks.foundation.level >= 4) {
    return {
      id: "corporate-dystopia",
      title: "Corporate Dystopia",
      summary: "You built the dominant stack and taught it to monetize every dependency it created.",
      epilogue:
        "Daily life becomes frictionless for customers and coercive for everyone else. Your shareholders are thrilled. Future historians are less charitable.",
      unlocks: ["corporate"],
    };
  }

  if (state.tracks.robotics.level >= 4 && state.tracks.space.level >= 4 && state.tracks.materials.level >= 4) {
    return {
      id: "transcendence",
      title: "Transcendence",
      summary: "You built the machines that built the road off Earth.",
      epilogue:
        "Orbit stops being a frontier and becomes infrastructure. The species expands outward not because it was noble, but because your lab made the economics finally close.",
      unlocks: ["underground"],
    };
  }

  if (state.tracks.simulation.level >= 5 && state.tracks.quantum.level >= 4 && state.tracks.foundation.level >= 4) {
    return {
      id: "simulation-revelation",
      title: "Simulation Revelation",
      summary: "Your predictive engine delivered an answer humanity was not prepared to hear.",
      epilogue:
        "Whether the revelation is metaphysical truth or only overwhelming evidence matters less than the fact that civilization reorganizes around it within a decade.",
      unlocks: ["open-source"],
    };
  }

  if (topRival.capability > totalCapability * 3 + 18 && state.turn >= 80) {
    return {
      id: "irrelevance",
      title: "Irrelevance",
      summary: "You mattered, but not first enough.",
      epilogue:
        "A rival reaches decisive scale before you and the world orients around their defaults. Your legacy survives in footnotes, talent trees, and a few cautionary board memos.",
      unlocks: ["corporate"],
    };
  }

  if (state.turn >= TOTAL_TURNS) {
    return {
      id: "open-future",
      title: "Open Future",
      summary: "No single actor captures destiny, including you.",
      epilogue:
        "The world remains tense, unequal, and improvable. AI becomes infrastructure rather than deity. It is not utopia. It is something rarer: a future with options still left inside it.",
      unlocks: ["open-source", "underground"],
    };
  }

  return null;
};

export const advanceTurn = (current: GameState) => {
  const state = structuredClone(current) as GameState;
  const currentLabel = turnLabel(state.turn);
  const financeBefore = state.resources.capital;
  const worldEvents: string[] = [];

  state.resources.capital += state.resources.revenue - state.resources.burn;
  reconcileProjects(state, worldEvents);
  const breakthroughs = applyResearch(state);
  const triggeredConvergences = triggerConvergences(state);
  updateRivals(state, worldEvents);
  const worldNews = buildWorldNews(state);
  worldEvents.push(...worldNews.map((item) => item.title));

  const { headline, briefing } = buildBriefing(state, breakthroughs, worldEvents);
  const nextTurn = state.turn + 1;
  const nextLabel = turnLabel(nextTurn);

  state.feed = [
    ...triggeredConvergences.map((convergence, index) => ({
      id: `convergence-${state.turn}-${index}`,
      turn: state.turn,
      title: convergence.name,
      body: convergence.description,
      severity: "critical" as const,
      kind: "research" as const,
    })),
    ...worldNews,
    ...breakthroughs.map((breakthrough, index) => ({
      id: `breakthrough-${state.turn}-${index}`,
      turn: state.turn,
      title: breakthrough.split(":")[0],
      body: breakthrough,
      severity: "info" as const,
      kind: "research" as const,
    })),
    ...state.feed,
  ].slice(0, 30);

  state.flags.lastWorldTags = worldNews.map(
    (item) => worldTemplates.find((template) => template.title === item.title)?.tag ?? "general",
  );
  state.candidates = buildCandidatePool(state.seed, nextTurn, state.employees);
  state.turn = nextTurn;
  state.year = nextLabel.year;
  state.quarterIndex = nextLabel.quarterIndex;
  state.resolution = {
    turn: state.turn - 1,
    year: currentLabel.year,
    quarter: currentLabel.quarter,
    headline,
    briefing,
    breakthroughs: [
      ...breakthroughs,
      ...triggeredConvergences.map((convergence) => `${convergence.name}: ${convergence.description}`),
    ],
    worldEvents,
    financeDelta: Number((state.resources.capital - financeBefore).toFixed(2)),
  };
  state.panel = "briefing";
  state.tutorialStep = clamp(state.tutorialStep + 1, 0, 4);
  state.activeDilemma = selectDilemma(state);
  state.activeDilemmaSource = state.activeDilemma?.brief ?? null;
  state.ending = evaluateEnding(state);
  if (state.ending) {
    state.mode = "ended";
    state.meta = unlockMetaFromEnding(state.meta, state.ending);
    saveMetaProgression(state.meta);
  }

  recalculateState(state);
  return state;
};

export const updateTrackCompute = (state: GameState, trackId: TrackId, delta: number) => {
  const totalAllocated = (Object.keys(state.tracks) as TrackId[]).reduce(
    (sum, id) => sum + state.tracks[id].compute,
    0,
  );
  const freeCompute = state.resources.computeCapacity - totalAllocated;
  const next = state.tracks[trackId];
  const change = delta > 0 ? Math.min(delta, freeCompute) : Math.max(delta, -next.compute);

  next.compute = Math.max(0, next.compute + change);
  recalculateState(state);
};

export const assignResearcher = (state: GameState, researcherId: string, trackId: TrackId | null) => {
  state.employees = state.employees.map((employee) =>
    employee.id === researcherId ? { ...employee, assignedTrack: trackId } : employee,
  );
  recalculateState(state);
};

export const hireCandidate = (state: GameState, candidateId: string) => {
  const candidate = state.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return;

  const signingCost = candidate.signingBonus + candidate.salary / 4;
  if (state.resources.capital < signingCost) return;

  state.resources.capital -= signingCost;
  const { contestedBy, ask, ...hire } = candidate;
  void contestedBy;
  void ask;
  state.employees = [...state.employees, hire];
  state.candidates = state.candidates.filter((entry) => entry.id !== candidateId);
  ensureUnlocks(state);
  state.feed = [
    {
      id: `hire-${state.turn}-${candidate.id}`,
      turn: state.turn,
      title: `${candidate.name} joined the lab`,
      body: `${candidate.role} joined from ${candidate.location}. ${candidate.ask}`,
      severity: "info" as const,
      kind: "system" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  recalculateState(state);
};

export const buildFacility = (state: GameState, facilityId: string) => {
  const option = BUILD_OPTIONS.find((facility) => facility.id === facilityId);
  if (!option) return;
  if (state.resources.capital < option.buildCost || state.projects.some((project) => project.id === option.id)) {
    return;
  }

  state.resources.capital -= option.buildCost;
  state.projects = [
    {
      id: option.id,
      name: option.name,
      region: option.region,
      turnsRemaining: 2,
      buildCost: option.buildCost,
      upkeep: option.upkeep,
      computeDelta: option.computeDelta,
      trustDelta: option.trustDelta,
      riskDelta: option.riskDelta,
    },
    ...state.projects,
  ];
  state.feed = [
    {
      id: `facility-${state.turn}-${facilityId}`,
      turn: state.turn,
      title: `${option.name} authorized`,
      body: `Construction begins in ${option.region}. Delivery expected in two quarters.`,
      severity: "info" as const,
      kind: "system" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  recalculateState(state);
};

export const setSupplier = (state: GameState, vendor: string) => {
  const contract = SUPPLIER_CONTRACTS.find((entry) => entry.vendor === vendor);
  if (!contract) return;
  state.supplier = contract;
  recalculateState(state);
};

export const setEnergyPolicy = (state: GameState, energyId: string) => {
  const policy = ENERGY_POLICIES.find((entry) => entry.id === energyId);
  if (!policy) return;
  state.energyPolicy = policy;
  recalculateState(state);
};

export const selectTrack = (state: GameState, trackId: TrackId) => {
  state.selectedTrack = trackId;
  state.panel = "track";
};

export const dismissResolution = (state: GameState) => {
  state.resolution = null;
};

export const setPanel = (state: GameState, panel: GameState["panel"]) => {
  state.panel = panel;
};

export const setAISettings = (state: GameState, enabled: boolean, apiKey: string) => {
  state.aiSettings = { ...state.aiSettings, enabled, apiKey };
};

export const setAICacheEntry = (state: GameState, key: string, value: string) => {
  state.aiSettings.cache = { ...state.aiSettings.cache, [key]: value };
};

export const snapshotState = (state: GameState): GameSnapshot => ({
  savedAt: new Date().toISOString(),
  state,
});

const storageAvailable = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const saveAutosave = (state: GameState) => {
  if (!storageAvailable()) return;
  window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshotState(state)));
};

export const loadAutosave = () => {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameSnapshot;
  } catch {
    return null;
  }
};

export const saveToSlot = (state: GameState, slot: SaveSlotId) => {
  if (!storageAvailable()) return;
  window.localStorage.setItem(`${SLOT_KEY_PREFIX}${slot}`, JSON.stringify(snapshotState(state)));
};

export const loadFromSlot = (slot: SaveSlotId) => {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(`${SLOT_KEY_PREFIX}${slot}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameSnapshot;
  } catch {
    return null;
  }
};

export const loadSaveSummaries = () => {
  if (!storageAvailable()) return [];
  const slots: SaveSlotId[] = [1, 2, 3];

  return slots.flatMap((slot) => {
    const snapshot = loadFromSlot(slot);
    if (!snapshot) return [];
    const label = turnLabel(snapshot.state.turn);
    return [
      {
        slot,
        title: snapshot.state.ending?.title ?? START_PRESETS[snapshot.state.preset].name,
        subtitle: `${label.year} ${label.quarter}  Turn ${snapshot.state.turn}`,
        updatedAt: snapshot.savedAt,
      },
    ];
  });
};

export const saveMetaProgression = (meta: GameState["meta"]) => {
  if (!storageAvailable()) return;
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
};

export const loadMetaProgression = () => {
  if (!storageAvailable()) return defaultMeta();
  const raw = window.localStorage.getItem(META_KEY);
  if (!raw) return defaultMeta();
  try {
    return JSON.parse(raw) as GameState["meta"];
  } catch {
    return defaultMeta();
  }
};

export const availableBuildOptions = (state: GameState) =>
  BUILD_OPTIONS.filter(
    (option) =>
      !state.projects.some((project) => project.id === option.id) &&
      !state.facilities.some((facility) => facility.id === option.id),
  );

export const tutorialNotes = [
  "Start by stabilizing runway. Simulation Modeling is your safest early revenue engine.",
  "Hire to unlock tracks. Robotics, biology, materials, quantum, and space stay dark until you bring in the right people.",
  "Capability without alignment will move faster, but it will also spike AI Fear and board risk.",
  "Use facilities sparingly in the first ten turns. Overbuilding data centers can kill a good opening.",
];
