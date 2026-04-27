import {
  BUILD_OPTIONS,
  COMMERCIALIZATION_CONVERGENCES,
  COMMERCIALIZATION_DEFINITIONS,
  COMMERCIALIZATION_GRAPH_RULES,
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
  CommercializationDefinition,
  CommercializationProgram,
  DecisionLogEntry,
  DilemmaOption,
  DilemmaResolutionMetric,
  EndingResult,
  ExpenseBreakdown,
  FacilityProject,
  FacilityState,
  FundingOffer,
  FundingRoundId,
  GameFlags,
  GovernmentId,
  GameSnapshot,
  GameState,
  Researcher,
  RevenueStream,
  RivalId,
  SaveSlotId,
  StartPresetId,
  TrackId,
  TrackPostureId,
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

export const getTrackLevelCount = (trackId: TrackId) => trackById(trackId).levels.length;

export const getTrackStageAtIndex = (trackId: TrackId, index: number) =>
  trackById(trackId).levels[index] ?? null;

const currentStageForTrack = (trackId: TrackId, level: number) => getTrackStageAtIndex(trackId, level);

export const TRACK_POSTURES: Record<
  TrackPostureId,
  {
    id: TrackPostureId;
    label: string;
    summary: string;
    progressMultiplier: number;
    expenseMultiplier: number;
    trustDelta: number;
    fearDelta: number;
    boardDelta: number;
  }
> = {
  safe: {
    id: "safe",
    label: "Safe",
    summary: "Slower and more defensible. Lowers heat while preserving credibility.",
    progressMultiplier: 0.92,
    expenseMultiplier: 0.96,
    trustDelta: 0.08,
    fearDelta: -0.1,
    boardDelta: 0.02,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    summary: "Default lab tempo. No unusual political or operating pressure.",
    progressMultiplier: 1,
    expenseMultiplier: 1,
    trustDelta: 0,
    fearDelta: 0,
    boardDelta: 0,
  },
  sprint: {
    id: "sprint",
    label: "Sprint",
    summary: "Faster, more expensive, and more visible. Raises heat if overused.",
    progressMultiplier: 1.18,
    expenseMultiplier: 1.12,
    trustDelta: -0.06,
    fearDelta: 0.16,
    boardDelta: -0.04,
  },
};

export const formatCurrency = (value: number) => {
  const absolute = Math.abs(value);
  const prefix = value < 0 ? "-$" : "$";

  if (absolute >= 1000) {
    return `${prefix}${(absolute / 1000).toFixed(1)}B`;
  }

  return `${prefix}${absolute.toFixed(absolute >= 100 ? 0 : 1)}M`;
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
    const cumulativeChanceStart = threshold;
    threshold += option.chance;
    if (roll <= threshold + 1e-9) {
      return {
        option,
        roll,
        cumulativeChanceStart,
        cumulativeChanceEnd: threshold,
      };
    }
  }

  const fallback = options[options.length - 1];
  return {
    option: fallback,
    roll,
    cumulativeChanceStart: Math.max(0, 1 - fallback.chance),
    cumulativeChanceEnd: 1,
  };
};

const computeTrackThreshold = (trackId: TrackId, level: number) =>
  currentStageForTrack(trackId, level)?.researchCost ?? 0;

export const canResearcherSupportTrack = (employee: Researcher, trackId: TrackId) =>
  Boolean(
    employee.generalist ||
      employee.primaryTrack === trackId ||
      employee.secondaryTrack === trackId,
  );

const COMMERCIALIZATION_ROLE_KEYWORDS = Array.from(
  new Set([
    ...COMMERCIALIZATION_DEFINITIONS.flatMap((definition) => definition.requiredRoleKeywords ?? []),
    ...Object.values(COMMERCIALIZATION_GRAPH_RULES).flatMap((rule) => rule.requiredRoleKeywords ?? []),
  ]),
);

const ROLE_KEYWORD_ALIASES: Record<string, string[]> = {
  alignment: ["alignment", "interpretability", "safety"],
  autonomy: ["autonomy", "autonomous", "agent", "robot"],
  biolog: ["biolog", "biotech", "clinical", "pharma", "therapeutic"],
  biosecurity: ["biosecurity", "biosafety", "public health", "preparedness"],
  climate: ["climate", "grid", "energy systems"],
  economist: ["economist", "economics", "market", "forecast"],
  energy: ["energy", "data center", "datacenter", "grid"],
  field: ["field", "operator", "operations", "deployment"],
  materials: ["material", "metamaterial", "manufacturing", "chemistry"],
  orbital: ["orbital", "launch", "mission operations", "space"],
  platform: ["platform", "infrastructure", "systems engineer", "stack", "developer platform"],
  policy: ["policy", "counsel", "governance", "regulator", "public sector"],
  product: ["product", "monetization", "go-to-market", "commercial", "customer", "enterprise", "market", "sold", "buyer", "revenue"],
  quantum: ["quantum"],
  robotics: ["robotic", "robotics", "embodied"],
  satellite: ["satellite", "ground network", "remote sensing"],
  security: ["security", "cryptographic", "cryptography", "red team", "red-team"],
  trust: ["trust", "safety", "red team", "red-team", "assurance"],
};

export const canResearcherCoverCommercializationRole = (employee: Researcher, keyword: string) => {
  const loweredKeyword = keyword.toLowerCase();
  const aliases = ROLE_KEYWORD_ALIASES[loweredKeyword] ?? [loweredKeyword];
  const profile = `${employee.role} ${employee.traits.join(" ")} ${employee.bio}`.toLowerCase();

  return aliases.some((alias) => profile.includes(alias));
};

export const getResearcherCommercializationRoles = (employee: Researcher) =>
  COMMERCIALIZATION_ROLE_KEYWORDS.filter((keyword) =>
    canResearcherCoverCommercializationRole(employee, keyword),
  );

const cloneResearcher = (researcher: Researcher): Researcher => ({ ...researcher });

const defaultExpenses = (): ExpenseBreakdown => ({
  payroll: 0,
  compute: 0,
  facilities: 0,
  research: 0,
  commercialization: 0,
  expansion: 0,
});

const defaultOpenAISettings = (): GameState["openAISettings"] => ({
  enabled: false,
  apiKey: "",
  voice: "marin",
  autoPlay: false,
});

const supplierTrackModifiers: Record<string, Partial<Record<TrackId, number>>> = {
  NVIDIA: {
    foundation: 0.14,
    robotics: 0.08,
    biology: 0.05,
  },
  AMD: {
    robotics: 0.05,
    materials: 0.06,
    simulation: 0.04,
  },
  "Google TPU": {
    foundation: 0.1,
    simulation: 0.16,
    alignment: 0.06,
    quantum: -0.05,
    robotics: -0.04,
  },
  "Custom ASIC": {
    foundation: 0.18,
    quantum: 0.12,
    simulation: 0.08,
    alignment: -0.04,
    robotics: -0.06,
    biology: -0.04,
  },
};

const energyTrackModifiers: Record<string, Partial<Record<TrackId, number>>> = {
  grid: {},
  solar: {
    alignment: 0.05,
    simulation: 0.04,
    foundation: -0.04,
  },
  nuclear: {
    foundation: 0.06,
    quantum: 0.08,
    robotics: 0.04,
  },
  geothermal: {
    simulation: 0.08,
    materials: 0.06,
    foundation: 0.03,
  },
};

const trackRevenueNames: Record<TrackId, { name: string; source: string; summary: string }> = {
  foundation: {
    name: "Model API Contracts",
    source: "Commercial",
    summary: "Inference subscriptions and enterprise reasoning pilots.",
  },
  alignment: {
    name: "Safety Assurance Work",
    source: "Trust",
    summary: "Audits, evaluations, and assurance work that improves legitimacy.",
  },
  simulation: {
    name: "Forecasting Platform",
    source: "Commercial",
    summary: "Prediction retainers sold into markets, logistics, and planning teams.",
  },
  robotics: {
    name: "Automation Pilots",
    source: "Industrial",
    summary: "Paid deployments for warehouses, field ops, and manufacturing trials.",
  },
  biology: {
    name: "Drug Discovery Partnerships",
    source: "Biotech",
    summary: "Discovery collaborations with pharma and hospital partners.",
  },
  materials: {
    name: "Materials Licensing",
    source: "Industrial",
    summary: "Licensing revenue from compounds, manufacturing methods, and prototypes.",
  },
  quantum: {
    name: "Quantum Security Retainers",
    source: "Strategic",
    summary: "Cryptography and simulation retainers for security-sensitive buyers.",
  },
  space: {
    name: "Autonomy Flight Contracts",
    source: "Aerospace",
    summary: "Autonomous navigation and orbital systems pilots.",
  },
};

const facilityBuildTimes: Record<string, number> = {
  "dc-virginia": 2,
  "dc-doha": 2,
  "dc-helsinki": 3,
  "dc-bengaluru": 2,
};

const frontierFacilityTemplates: Array<{
  slug: string;
  name: string;
  region: string;
  buildCost: number;
  upkeep: number;
  computeDelta: number;
  trustDelta: number;
  riskDelta: number;
}> = [
  {
    slug: "phoenix",
    name: "Desert Inference Yard",
    region: "Phoenix",
    buildCost: 6.8,
    upkeep: 0.44,
    computeDelta: 54,
    trustDelta: 1,
    riskDelta: 0,
  },
  {
    slug: "singapore",
    name: "Maritime Model Hub",
    region: "Singapore",
    buildCost: 7.2,
    upkeep: 0.47,
    computeDelta: 58,
    trustDelta: 2,
    riskDelta: 1,
  },
  {
    slug: "reykjavik",
    name: "North Atlantic Cooling Stack",
    region: "Reykjavik",
    buildCost: 7.4,
    upkeep: 0.42,
    computeDelta: 56,
    trustDelta: 3,
    riskDelta: -1,
  },
];

const initialRetainerAmounts: Record<StartPresetId, number> = {
  founder: 1.1,
  government: 2.1,
  "open-source": 0.7,
  corporate: 1.8,
  underground: 0.6,
  "second-chance": 1.5,
};

const trackUnlockHints: Record<TrackId, string> = {
  foundation: "Already unlocked at game start.",
  alignment: "Already unlocked at game start.",
  simulation: "Already unlocked at game start.",
  robotics: "Hire a roboticist or autonomy operator to unlock Robotics.",
  biology: "Hire a computational biologist or biosecurity specialist to unlock Biology.",
  materials: "Hire a materials scientist or data-center strategist to unlock Materials.",
  quantum: "Hire a quantum specialist to unlock Quantum.",
  space: "Hire an orbital systems or satellite autonomy lead to unlock Space.",
};

const fundingRoundOrder: FundingRoundId[] = ["seed", "series-a", "series-b", "series-c", "series-d"];
const fundingRoundLabel: Record<FundingRoundId, string> = {
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  "series-c": "Series C",
  "series-d": "Series D",
};

const createInitialTracks = (): Record<TrackId, TrackState> =>
  TRACK_DEFINITIONS.reduce(
    (accumulator, definition) => {
      accumulator[definition.id] = {
        id: definition.id,
        level: 0,
        progress: 0,
        compute: definition.starter ? (definition.id === "foundation" ? 44 : 28) : 0,
        unlocked: definition.starter,
        posture: "balanced",
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

const ceoTitleForPreset = (preset: StartPresetId) => {
  switch (preset) {
    case "founder":
      return "Founder-CEO";
    case "government":
      return "Lab Director";
    case "open-source":
      return "Founding Steward";
    case "corporate":
      return "Division CEO";
    case "underground":
      return "Founder-Operator";
    case "second-chance":
      return "Recovery CEO";
    default:
      return "CEO";
  }
};

const baseFlags = (preset: StartPresetId): GameFlags => ({
  governmentDependence: START_PRESETS[preset].modifier.governmentDependence,
  ethicsDebt: 0,
  safetyCulture: 0,
  openness: START_PRESETS[preset].modifier.openness,
  crisisCount: 0,
  founderControl:
    preset === "government"
      ? 62
      : preset === "corporate"
        ? 58
        : preset === "open-source"
          ? 78
          : preset === "underground"
            ? 84
            : preset === "second-chance"
              ? 68
              : 76,
  fundingRound: "seed",
  lastFundingTurn: -99,
  lastWorldTags: [],
});

export const buildCandidatePool = (
  seed: number,
  turn: number,
  currentEmployees: Researcher[],
): Candidate[] => {
  const employedIds = new Set(currentEmployees.map((employee) => employee.id));
  const rng = makeTurnRng(seed, turn, "candidates");
  const availableCatalog = shuffle(
    RESEARCHER_CATALOG.filter((researcher) => !employedIds.has(researcher.id)),
    rng,
  );
  const staffCoverage = currentEmployees.reduce((accumulator, employee) => {
    const tracks = new Set<TrackId>([employee.primaryTrack]);
    if (employee.secondaryTrack) {
      tracks.add(employee.secondaryTrack);
    }

    tracks.forEach((trackId) => {
      accumulator[trackId] = (accumulator[trackId] ?? 0) + 1;
    });

    return accumulator;
  }, {} as Partial<Record<TrackId, number>>);
  const undercoveredTracks = (TRACK_DEFINITIONS.map((track) => track.id) as TrackId[]).sort(
    (left, right) => (staffCoverage[left] ?? 0) - (staffCoverage[right] ?? 0),
  );
  const guaranteedChoices: Researcher[] = [];
  const seenIds = new Set<string>();
  const addGuaranteedChoice = (candidate: Researcher | undefined) => {
    if (!candidate || seenIds.has(candidate.id)) {
      return;
    }

    guaranteedChoices.push(candidate);
    seenIds.add(candidate.id);
  };

  undercoveredTracks.forEach((trackId) => {
    const candidate = availableCatalog.find(
      (researcher) =>
        !seenIds.has(researcher.id) &&
        (researcher.primaryTrack === trackId || researcher.secondaryTrack === trackId),
    );

    addGuaranteedChoice(candidate);
  });

  const keywordCoverage = (keyword: string) =>
    currentEmployees.filter((employee) => canResearcherCoverCommercializationRole(employee, keyword)).length;
  const prioritizedRoleKeywords = [...COMMERCIALIZATION_ROLE_KEYWORDS].sort(
    (left, right) => keywordCoverage(left) - keywordCoverage(right),
  );

  prioritizedRoleKeywords.forEach((keyword) => {
    const candidate = availableCatalog.find(
      (researcher) => !seenIds.has(researcher.id) && canResearcherCoverCommercializationRole(researcher, keyword),
    );

    addGuaranteedChoice(candidate);
  });

  const generalists = availableCatalog.filter(
    (researcher) => researcher.generalist && !seenIds.has(researcher.id),
  );
  generalists.slice(0, 3).forEach(addGuaranteedChoice);

  const overflowChoices = availableCatalog.filter((researcher) => !seenIds.has(researcher.id));
  const choices = [...guaranteedChoices, ...overflowChoices].slice(0, 14);
  const rivalIds: RivalId[] = ["velocity", "prometheus", "zhongguancun", "opencollective"];

  return choices.map((researcher) => {
    const contestedBy = rng() > 0.48 ? rivalIds[Math.floor(rng() * rivalIds.length)] : null;

    return {
      ...cloneResearcher(researcher),
      contestedBy,
      ask: contestedBy
        ? "Has another lab circling this quarter and wants a decisive offer."
        : researcher.research >= 8
          ? "Wants autonomy, a named charter, and budget protection."
          : researcher.execution >= 8
            ? "Wants operational influence and a real team to build with."
            : "Wants stability, scope, and visible leadership support.",
    };
  });
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
      revenue: initialRetainerAmounts[preset],
      burn: 3.4,
      runwayMonths: 16,
      computeCapacity: preset === "second-chance" ? 128 : 100,
      trust: presetData.modifier.trust,
      fear: presetData.modifier.fear,
      boardConfidence: presetData.modifier.board,
      reputation: 48,
      wealth: 4.2,
      expenses: defaultExpenses(),
    },
    ceo: {
      name: "Alex Mercer",
      title: ceoTitleForPreset(preset),
      fired: false,
    },
    supplier: SUPPLIER_CONTRACTS[1],
    energyPolicy: ENERGY_POLICIES[0],
    tracks: createInitialTracks(),
    employees: staff,
    pendingHires: [],
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
    commercializationPrograms: [],
    usedDilemmas: [],
    activeDilemma: null,
    activeDilemmaSource: null,
    lastDilemmaResolution: null,
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
    revenueStreams: [],
    decisionLog: [],
    openAISettings: defaultOpenAISettings(),
  };

  recalculateState(state);
  return state;
};

export const normalizeGameState = (input: GameState): GameState => {
  const state = structuredClone(input) as GameState;

  state.resources = {
    ...state.resources,
    expenses: state.resources.expenses ?? defaultExpenses(),
  };
  state.aiSettings = state.aiSettings ?? {
    enabled: false,
    apiKey: "",
    cache: {},
  };
  state.pendingHires = state.pendingHires ?? [];
  state.revenueStreams = state.revenueStreams ?? [];
  state.decisionLog = state.decisionLog ?? [];
  state.commercializationPrograms = state.commercializationPrograms ?? [];
  state.lastDilemmaResolution = state.lastDilemmaResolution ?? null;
  state.openAISettings = state.openAISettings ?? defaultOpenAISettings();
  state.flags = {
    ...baseFlags(state.preset),
    ...state.flags,
    lastWorldTags: state.flags?.lastWorldTags ?? [],
  };
  state.feed = state.feed ?? [];
  state.facilities = state.facilities ?? [];
  state.tracks = Object.fromEntries(
    (Object.keys(state.tracks ?? createInitialTracks()) as TrackId[]).map((trackId) => {
      const fallback = createInitialTracks()[trackId];
      const track = state.tracks?.[trackId] ?? fallback;

      return [
        trackId,
        {
          ...fallback,
          ...track,
          posture: track.posture ?? "balanced",
        },
      ];
    }),
  ) as Record<TrackId, TrackState>;
  state.projects =
    state.projects?.map((project) => ({
      ...project,
      totalTurns: project.totalTurns ?? facilityBuildTimes[project.id] ?? 2,
    })) ?? [];
  state.activeDilemmaSource = state.activeDilemmaSource ?? state.activeDilemma?.brief ?? null;
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

const normalizeAssignments = (state: GameState) => {
  state.employees = state.employees.map((employee) => {
    if (!employee.assignedTrack) {
      return employee;
    }

    if (
      !state.tracks[employee.assignedTrack].unlocked ||
      !canResearcherSupportTrack(employee, employee.assignedTrack)
    ) {
      return {
        ...employee,
        assignedTrack: null,
      };
    }

    return employee;
  });
};

const hasSpecialistOnStaff = (state: GameState, specialistTrack: TrackId) =>
  state.employees.some(
    (employee) =>
      employee.primaryTrack === specialistTrack || employee.secondaryTrack === specialistTrack,
  );

const missingStageSpecialists = (state: GameState, trackId: TrackId, level: number) => {
  const stage = currentStageForTrack(trackId, level);
  if (!stage?.requiredSpecialists?.length) {
    return [] as TrackId[];
  }

  return stage.requiredSpecialists.filter((requiredTrack) => !hasSpecialistOnStaff(state, requiredTrack));
};

const researcherContribution = (
  employee: Researcher,
  trackId: TrackId,
  state: GameState,
) => {
  if (!canResearcherSupportTrack(employee, trackId)) {
    return 0;
  }

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

const totalAllocatedCompute = (state: GameState) =>
  (Object.keys(state.tracks) as TrackId[]).reduce((sum, trackId) => sum + state.tracks[trackId].compute, 0);

const getCommercializationDefinitionById = (definitionId: string) =>
  COMMERCIALIZATION_DEFINITIONS.find((definition) => definition.id === definitionId) ?? null;

const getCommercializationDefinition = (definitionId: string) => {
  const definition = getCommercializationDefinitionById(definitionId);
  if (!definition) return null;

  const graphRule = COMMERCIALIZATION_GRAPH_RULES[definitionId];

  return {
    ...definition,
    tier: definition.tier ?? graphRule?.tier ?? (Math.min(Math.ceil(definition.minLevel / 2), 3) as 1 | 2 | 3),
    prerequisitePrograms: definition.prerequisitePrograms ?? graphRule?.prerequisitePrograms ?? [],
    requiredRoleKeywords: definition.requiredRoleKeywords ?? graphRule?.requiredRoleKeywords ?? [],
  };
};

const hasRoleCoverage = (state: GameState, trackId: TrackId, keyword: string) =>
  state.employees.some(
    (employee) =>
      canResearcherSupportTrack(employee, trackId) &&
      canResearcherCoverCommercializationRole(employee, keyword),
  );

const missingCommercializationRoles = (state: GameState, trackId: TrackId, keywords: string[]) =>
  keywords.filter((keyword) => !hasRoleCoverage(state, trackId, keyword));

const getReservedCommercialCompute = (state: GameState) =>
  state.commercializationPrograms.reduce(
    (sum, program) => sum + program.computeDemand,
    0,
  );

const getAvailableResearchCompute = (state: GameState, rawCapacity: number) =>
  Math.max(rawCapacity - getReservedCommercialCompute(state), 0);

export const getCommercializationComputeHeadroom = (state: GameState) =>
  Math.max(
    state.resources.computeCapacity - getReservedCommercialCompute(state) - totalAllocatedCompute(state),
    0,
  );

const nextFundingRound = (round: FundingRoundId): FundingRoundId =>
  fundingRoundOrder[Math.min(fundingRoundOrder.indexOf(round) + 1, fundingRoundOrder.length - 1)] ??
  fundingRoundOrder[fundingRoundOrder.length - 1];

const stagePassiveRevenue = (trackId: TrackId, level: number) => {
  if (level <= 0) return 0;

  return Number(
    trackById(trackId)
      .levels.slice(0, level)
      .reduce((sum, stage) => sum + stage.revenueLift, 0)
      .toFixed(2),
  );
};

const energyUtilizationMultiplier = (state: GameState) => {
  const utilization = totalAllocatedCompute(state) / Math.max(state.resources.computeCapacity, 1);

  switch (state.energyPolicy.id) {
    case "solar":
      return utilization > 0.72 ? 0.88 : 0.98;
    case "nuclear":
      return utilization > 0.82 ? 1.08 : 1.04;
    case "geothermal":
      return utilization > 0.8 ? 1.03 : 1.01;
    default:
      return utilization > 0.9 ? 0.96 : 1;
  }
};

const trackResearchCost = (trackId: TrackId, track: TrackState, assignedCount: number) => {
  if (!track.unlocked || (assignedCount === 0 && track.compute === 0)) {
    return 0;
  }

  const activeStage = currentStageForTrack(trackId, track.level);
  const posture = TRACK_POSTURES[track.posture ?? "balanced"];

  const wetLabPremium =
    trackId === "biology" || trackId === "robotics" || trackId === "materials" || trackId === "quantum"
      ? 0.1
      : trackId === "space"
        ? 0.08
        : 0.04;
  const stagePressure = activeStage
    ? activeStage.recommendedCompute / 560 + activeStage.researchCost / 2600
    : 0.03;

  return (
    0.03 +
    track.level * 0.028 +
    assignedCount * 0.035 +
    (track.compute / 100) * 0.09 +
    wetLabPremium +
    stagePressure
  ) * posture.expenseMultiplier;
};

export const getFacilityBuildTime = (state: GameState, facilityId: string) => {
  const baseTurns = facilityBuildTimes[facilityId] ?? 2;
  const supplierDelay = state.supplier.vendor === "Custom ASIC" ? 1 : 0;
  const energyDelay =
    state.energyPolicy.id === "nuclear" ? 1 : state.energyPolicy.id === "solar" && facilityId !== "dc-helsinki" ? 1 : 0;

  return baseTurns + supplierDelay + energyDelay;
};

const generatedExpansionCount = (state: GameState) =>
  [...state.facilities, ...state.projects].filter((facility) => facility.id.startsWith("frontier-")).length;

const generateDynamicBuildOptions = (state: GameState): FacilityState[] => {
  if (state.turn < 12) {
    return [];
  }

  const cycle = Math.floor(generatedExpansionCount(state) / frontierFacilityTemplates.length) + 1;
  const scale = Math.max(0, Math.floor((state.turn - 1) / 16) + cycle - 1);

  return frontierFacilityTemplates.map((template, index) => ({
    id: `frontier-${cycle}-${template.slug}`,
    name: cycle === 1 ? template.name : `${template.name} Mk ${cycle}`,
    region: template.region,
    online: false,
    buildCost: Number((template.buildCost + scale * 0.65 + index * 0.18).toFixed(2)),
    upkeep: Number((template.upkeep + scale * 0.03).toFixed(2)),
    computeDelta: template.computeDelta + scale * 8 + index * 3,
    trustDelta: template.trustDelta + (scale >= 2 && template.trustDelta > 0 ? 1 : 0),
    riskDelta: template.riskDelta + (scale >= 2 && template.riskDelta >= 0 ? 1 : 0),
  }));
};

export const getTrackForecast = (state: GameState, trackId: TrackId) => {
  const track = state.tracks[trackId];
  const maxLevel = getTrackLevelCount(trackId);
  const activeStage = currentStageForTrack(trackId, track.level);
  const target = computeTrackThreshold(trackId, track.level);
  const specialistGaps = missingStageSpecialists(state, trackId, track.level);
  const assigned = state.employees.filter((employee) => employee.assignedTrack === trackId);
  const contributors = assigned
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      contribution: Number(researcherContribution(employee, trackId, state).toFixed(1)),
      focus:
        employee.primaryTrack === trackId ? "Lead" : employee.secondaryTrack === trackId ? "Support" : "Generalist",
    }))
    .sort((left, right) => right.contribution - left.contribution);
  const staffCoverage =
    assigned.length === 0 ? 0.32 : assigned.length === 1 ? 0.74 : assigned.length === 2 ? 0.92 : 1.04 + (assigned.length - 3) * 0.04;
  const supplierBonus = 1 + (supplierTrackModifiers[state.supplier.vendor][trackId] ?? 0);
  const energyBonus = 1 + (energyTrackModifiers[state.energyPolicy.id][trackId] ?? 0);
  const computeReadiness = activeStage
    ? clamp(track.compute / Math.max(activeStage.recommendedCompute, 1), 0.4, 1.2)
    : 1;
  const computeFactor =
    (track.compute / 7.4) *
    state.supplier.computeMultiplier *
    supplierBonus *
    energyBonus *
    energyUtilizationMultiplier(state) *
    (trackId === "foundation" ? 1.04 : 1) *
    computeReadiness;
  const teamFactor =
    contributors.reduce((sum, contributor) => sum + contributor.contribution, 0) *
    0.34 *
    staffCoverage *
    Math.max(0.72, computeReadiness);
  const synergy = trackSynergy(trackId, state) * 0.95;
  const governancePenalty =
    trackId === "foundation" || trackId === "quantum"
      ? Math.max(0, (state.resources.fear - state.resources.trust) * 0.08)
      : 0;
  const staffingPenalty = assigned.length === 0 ? 6 : assigned.length === 1 ? 2.6 : 0;
  const posture = TRACK_POSTURES[track.posture ?? "balanced"];
  const baseProgressPerTurn = Math.max(0, computeFactor + teamFactor + synergy - governancePenalty - staffingPenalty);
  const progressPerTurn = specialistGaps.length
    ? 0
    : baseProgressPerTurn * posture.progressMultiplier;
  const remaining = Math.max(0, target - track.progress);
  const turnsToLevel =
    !track.unlocked || track.level >= maxLevel || progressPerTurn <= 0 ? null : Math.ceil(remaining / progressPerTurn);
  const blockedReason = !track.unlocked
    ? trackUnlockHints[trackId]
    : specialistGaps.length
      ? `Needs ${specialistGaps.map((requiredTrack) => trackById(requiredTrack).shortName).join(" + ")} specialists on payroll before this stage can move.`
      : assigned.length === 0
        ? "Assign eligible staff to start this stage moving like XCOM research."
        : null;

  return {
    trackId,
    target,
    currentProgress: Number(track.progress.toFixed(1)),
    progressPercent: target > 0 ? Math.min(100, (track.progress / target) * 100) : 100,
    progressPerTurn: Number(progressPerTurn.toFixed(1)),
    turnsToLevel,
    assignedCount: assigned.length,
    contributors,
    projectName: track.level >= maxLevel ? "Completed" : activeStage?.name ?? "Completed",
    completedStage:
      track.level <= 0 ? "No completed stage yet." : trackById(trackId).levels[Math.max(0, track.level - 1)].name,
    unlockHint: trackUnlockHints[trackId],
    blockedReason,
    recommendedCompute: activeStage?.recommendedCompute ?? 0,
    researchCost: activeStage?.researchCost ?? 0,
    activeTechnology: activeStage?.technology ?? null,
    specialistGaps,
    computeReadiness: Number(computeReadiness.toFixed(2)),
    posture: posture.id,
    postureLabel: posture.label,
    postureSummary: posture.summary,
    baseProgressPerTurn: Number(baseProgressPerTurn.toFixed(1)),
    postureProgressDelta: Number((progressPerTurn - baseProgressPerTurn).toFixed(1)),
  };
};

const generateTrackProgress = (trackId: TrackId, state: GameState, track: TrackState) => {
  if (!track.unlocked) {
    return 0;
  }

  return getTrackForecast(state, trackId).progressPerTurn;
};

const applyResearch = (state: GameState) => {
  const breakthroughs: string[] = [];
  const nextTracks = structuredClone(state.tracks);

  (Object.keys(nextTracks) as TrackId[]).forEach((trackId) => {
    const next = nextTracks[trackId];
    const maxLevel = getTrackLevelCount(trackId);
    if (!next.unlocked || next.level >= maxLevel) {
      return;
    }

    next.progress += generateTrackProgress(trackId, state, next);

    while (next.level < maxLevel && next.progress >= computeTrackThreshold(trackId, next.level)) {
      next.progress -= computeTrackThreshold(trackId, next.level);
      next.level += 1;
      breakthroughs.push(
        `${trackById(trackId).name} reached L${next.level}: ${trackById(trackId).levels[next.level - 1].name}.`,
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

const resolveContestedTalentMarket = (state: GameState, worldEvents: string[]) => {
  const rng = makeTurnRng(state.seed, state.turn, "talent-contest");
  const contestedCandidates = shuffle(
    state.candidates.filter((candidate) => candidate.contestedBy),
    rng,
  )
    .filter(() => rng() > 0.56)
    .slice(0, 2);

  return contestedCandidates.map((candidate, index) => {
    const rivalId = candidate.contestedBy!;
    const rival = state.rivals[rivalId];
    const capabilityGain = 0.45 + (candidate.research + candidate.execution) / 28;
    const safetyGain =
      candidate.ethics >= 8 ? 0.55 : candidate.ethics <= 4 ? -0.35 : 0.1;
    const move = `${rival.name} signed ${candidate.name}, strengthening ${trackById(candidate.primaryTrack).shortName}.`;

    rival.capability = clamp(rival.capability + capabilityGain, 0, 100);
    rival.safety = clamp(rival.safety + safetyGain, 0, 100);
    rival.recentMove = move;
    rival.decisionHistory = [move, ...rival.decisionHistory].slice(0, 4);
    worldEvents.push(move);

    return {
      id: `talent-contest-${state.turn}-${index}`,
      turn: state.turn,
      title: `${candidate.name} joined ${rival.name}`,
      body: `${candidate.role} was contested in the market and accepted a rival offer. Contested candidates can disappear when the quarter ends.`,
      severity: "warning" as const,
      kind: "rival" as const,
    };
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
  const strongestForecast = getTrackForecast(state, strongestTrack.id);
  const topExpense = Object.entries(state.resources.expenses).sort((left, right) => right[1] - left[1])[0];
  const topRevenue = [...state.revenueStreams].sort((left, right) => right.amount - left.amount)[0];
  const researchLine =
    strongestForecast.turnsToLevel === null
      ? `${strongestTrack.label} is online and waiting for more people or compute.`
      : `${strongestTrack.label} is pushing toward ${strongestForecast.projectName} with an ETA of ${strongestForecast.turnsToLevel} quarter${strongestForecast.turnsToLevel === 1 ? "" : "s"}.`;

  return {
    headline:
      breakthroughs.length > 0
        ? `${strongestTrack.label} is now your pacing system.`
        : net >= 0
          ? "The lab is buying itself time."
          : "Momentum is real. Runway remains the sharper fact.",
    briefing:
      [
        `${rivals[0].name} remains the benchmark threat while ${researchLine}`,
        `Finance check: ${formatCurrency(state.resources.revenue)} in quarterly revenue versus ${formatCurrency(state.resources.burn)} in expenses. ` +
          `${topRevenue ? `${topRevenue.name} is your largest stream.` : "You are still living mostly on seed capital."} ` +
          `${topExpense ? `${topExpense[0]} is your biggest expense line.` : ""}`,
        `${net >= 0 ? "Runway is stabilizing." : "Runway is still eroding faster than we like."} ` +
          `${worldEvents[0] ? `Immediate concern: ${worldEvents[0]}.` : "No acute geopolitical shock this quarter."}`,
      ].join("\n\n"),
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

const onboardPendingHires = (state: GameState, worldEvents: string[]) => {
  if (state.pendingHires.length === 0) {
    return;
  }

  const arrivals = state.pendingHires.map((hire) => ({
    ...hire,
    assignedTrack: null,
  }));

  state.employees = [...state.employees, ...arrivals];
  state.pendingHires = [];
  worldEvents.push(
    `${arrivals.map((hire) => hire.name).join(", ")} arrive and are ready for assignment this quarter.`,
  );
  state.feed = [
    ...arrivals.map((hire) => ({
      id: `arrival-${state.turn}-${hire.id}`,
      turn: state.turn,
      title: `${hire.name} arrives on site`,
      body: `${hire.role} is now available for staffing decisions.`,
      severity: "info" as const,
      kind: "system" as const,
    })),
    ...state.feed,
  ].slice(0, 30);
};

const applyMorale = (employees: Researcher[], delta: number) =>
  employees.map((employee) => ({
    ...employee,
    morale: clamp(employee.morale + delta, 35, 95),
  }));

const averageMorale = (state: GameState) =>
  state.employees.reduce((sum, employee) => sum + employee.morale, 0) /
  Math.max(state.employees.length, 1);

const DILEMMA_RESULT_METRICS: Array<{
  id: string;
  label: string;
  format: DilemmaResolutionMetric["format"];
  read: (state: GameState) => number;
}> = [
  { id: "capital", label: "Capital", format: "currency", read: (state) => state.resources.capital },
  { id: "runway", label: "Runway", format: "number", read: (state) => state.resources.runwayMonths },
  { id: "trust", label: "Public Trust", format: "number", read: (state) => state.resources.trust },
  { id: "fear", label: "Public Fear", format: "number", read: (state) => state.resources.fear },
  { id: "board", label: "Board Confidence", format: "number", read: (state) => state.resources.boardConfidence },
  { id: "reputation", label: "Reputation", format: "number", read: (state) => state.resources.reputation },
  { id: "compute", label: "Compute Capacity", format: "compute", read: (state) => state.resources.computeCapacity },
  { id: "gov-dependence", label: "Gov Dependence", format: "number", read: (state) => state.flags.governmentDependence },
  { id: "ethics-debt", label: "Ethics Debt", format: "number", read: (state) => state.flags.ethicsDebt },
  { id: "safety-culture", label: "Safety Culture", format: "number", read: (state) => state.flags.safetyCulture },
  { id: "openness", label: "Openness", format: "number", read: (state) => state.flags.openness },
  { id: "morale", label: "Team Morale", format: "number", read: averageMorale },
];

const captureDilemmaMetricValues = (state: GameState) =>
  Object.fromEntries(DILEMMA_RESULT_METRICS.map((metric) => [metric.id, metric.read(state)]));

const buildDilemmaMetrics = (
  before: Record<string, number>,
  afterState: GameState,
): DilemmaResolutionMetric[] =>
  DILEMMA_RESULT_METRICS.map((metric) => {
    const beforeValue = before[metric.id] ?? metric.read(afterState);
    const afterValue = metric.read(afterState);

    return {
      id: metric.id,
      label: metric.label,
      before: Number(beforeValue.toFixed(2)),
      after: Number(afterValue.toFixed(2)),
      delta: Number((afterValue - beforeValue).toFixed(2)),
      format: metric.format,
    };
  }).filter((metric) => Math.abs(metric.delta) >= 0.01);

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
  const beforeMetrics = captureDilemmaMetricValues(state);
  const {
    option: outcome,
    roll,
    cumulativeChanceStart,
    cumulativeChanceEnd,
  } = rollFromOptions(rng, option.outcomes);
  const impactParts: string[] = [];
  const dilemmaTitle = state.activeDilemma?.title ?? "Dilemma resolved";
  const dilemmaSource = state.activeDilemma?.source ?? "Command";

  if (outcome.effects.capital) impactParts.push(`${outcome.effects.capital > 0 ? "+" : ""}${formatCurrency(outcome.effects.capital)} capital`);
  if (outcome.effects.trust) impactParts.push(`${outcome.effects.trust > 0 ? "+" : ""}${Math.round(outcome.effects.trust)} trust`);
  if (outcome.effects.fear) impactParts.push(`${outcome.effects.fear > 0 ? "+" : ""}${Math.round(outcome.effects.fear)} fear`);
  if (outcome.effects.board) impactParts.push(`${outcome.effects.board > 0 ? "+" : ""}${Math.round(outcome.effects.board)} board`);
  if (outcome.effects.compute) impactParts.push(`${outcome.effects.compute > 0 ? "+" : ""}${Math.round(outcome.effects.compute)} PFLOPS`);
  if (outcome.effects.governmentDependence)
    impactParts.push(
      `${outcome.effects.governmentDependence > 0 ? "+" : ""}${Math.round(outcome.effects.governmentDependence)} government dependence`,
    );
  if (outcome.effects.ethicsDebt)
    impactParts.push(`${outcome.effects.ethicsDebt > 0 ? "+" : ""}${Math.round(outcome.effects.ethicsDebt)} ethics debt`);

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
  if (state.activeDilemma) {
    const entry: DecisionLogEntry = {
      id: `decision-${state.turn}-${option.id}`,
      turn: state.turn,
      title: state.activeDilemma.title,
      choice: option.label,
      outcome: outcome.label,
      impact: impactParts.length ? impactParts.join(", ") : "Narrative impact only.",
    };
    state.decisionLog = [entry, ...state.decisionLog].slice(0, 18);
  }
  state.feed = [
    {
      id: `dilemma-${state.turn}-${option.id}`,
      turn: state.turn,
      title: dilemmaTitle,
      body: outcome.narrative,
      severity: "warning" as const,
      kind: "dilemma" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  state.activeDilemmaSource = outcome.narrative;
  state.activeDilemma = null;
  recalculateState(state);
  const metrics = buildDilemmaMetrics(beforeMetrics, state);
  state.lastDilemmaResolution = {
    id: `dilemma-result-${state.turn}-${option.id}`,
    turn: state.turn,
    title: dilemmaTitle,
    source: dilemmaSource,
    optionLabel: option.label,
    optionSummary: option.summary,
    outcomeLabel: outcome.label,
    outcomeNarrative: outcome.narrative,
    outcomeChance: outcome.chance,
    roll,
    cumulativeChanceStart,
    cumulativeChanceEnd,
    metrics,
    impact: impactParts.length ? impactParts.join(", ") : "Narrative impact only.",
  };
};

export const dismissDilemmaResolution = (state: GameState) => {
  state.lastDilemmaResolution = null;
};

const applyQuarterlyBoardPressure = (state: GameState) => {
  const net = state.resources.revenue - state.resources.burn;
  const controlPressure = state.flags.founderControl < 55 ? (55 - state.flags.founderControl) * 0.08 : 0;
  const runwayPressure = state.resources.runwayMonths < 8 ? (8 - state.resources.runwayMonths) * 0.55 : 0;
  const fearPressure = state.resources.fear > 65 ? (state.resources.fear - 65) * 0.03 : 0;
  const netRelief = net >= 0 ? 0.45 : -Math.min(Math.abs(net) * 0.18, 2.8);
  state.resources.boardConfidence = clamp(
    state.resources.boardConfidence - controlPressure - runwayPressure - fearPressure + netRelief,
    0,
    100,
  );
};

const advanceCommercialPrograms = (state: GameState, worldEvents: string[]) => {
  const nextPrograms: CommercializationProgram[] = [];

  state.commercializationPrograms.forEach((program) => {
    if (program.status === "live") {
      nextPrograms.push(program);
      return;
    }

    const turnsRemaining = program.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      nextPrograms.push({
        ...program,
        status: "live",
        turnsRemaining: 0,
      });
      worldEvents.push(`${program.name} goes live`);
      state.feed = [
        {
          id: `commercial-live-${state.turn}-${program.id}`,
          turn: state.turn,
          title: `${program.name} goes live`,
          body: `${program.name} is now an active business line, adding recurring revenue and reserving compute each quarter.`,
          severity: "info" as const,
          kind: "system" as const,
        },
        ...state.feed,
      ].slice(0, 30);
      return;
    }

    nextPrograms.push({
      ...program,
      turnsRemaining,
    });
  });

  state.commercializationPrograms = nextPrograms;
};

export const launchCommercializationProgram = (state: GameState, definitionId: string) => {
  const definition = getCommercializationDefinition(definitionId);
  if (!definition) return;

  const option = getCommercializationOptions(state, definition.trackId).find(
    (entry) => entry.id === definitionId,
  );
  if (!option || option.blockedReason) return;

  state.resources.capital -= definition.upfrontCost;
  state.resources.trust = clamp(state.resources.trust + (definition.effects.trust ?? 0), 0, 100);
  state.resources.fear = clamp(state.resources.fear + (definition.effects.fear ?? 0), 0, 100);
  state.resources.boardConfidence = clamp(
    state.resources.boardConfidence + (definition.effects.board ?? 0),
    0,
    100,
  );
  state.resources.reputation = clamp(
    state.resources.reputation + (definition.effects.reputation ?? 0),
    0,
    100,
  );
  state.flags.governmentDependence += definition.effects.governmentDependence ?? 0;
  state.flags.safetyCulture += definition.effects.safetyCulture ?? 0;
  state.flags.ethicsDebt += definition.effects.ethicsDebt ?? 0;

  state.commercializationPrograms = [
    {
      id: `${definition.id}-${state.turn}`,
      definitionId: definition.id,
      trackId: definition.trackId,
      lane: definition.lane,
      name: definition.name,
      source: definition.source,
      summary: definition.summary,
      status: definition.setupTurns > 0 ? "launching" : "live",
      turnsRemaining: definition.setupTurns,
      quarterlyRevenue: definition.quarterlyRevenue,
      quarterlyExpense: definition.quarterlyExpense,
      computeDemand: definition.computeDemand,
      startedTurn: state.turn,
    },
    ...state.commercializationPrograms,
  ];
  state.feed = [
    {
      id: `commercial-launch-${state.turn}-${definition.id}`,
      turn: state.turn,
      title: `${definition.name} authorized`,
      body: `${definition.summary} Launch cost ${formatCurrency(definition.upfrontCost)}. Delivery in ${definition.setupTurns} quarter${definition.setupTurns === 1 ? "" : "s"}.`,
      severity: "info" as const,
      kind: "system" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  recalculateState(state);
};

export const acceptFundingOffer = (state: GameState, offerId: string) => {
  const offer = getFundingOffers(state).find((entry) => entry.id === offerId);
  if (!offer) return;

  state.resources.capital += offer.capital;
  state.resources.trust = clamp(state.resources.trust + offer.trustDelta, 0, 100);
  state.resources.fear = clamp(state.resources.fear + offer.fearDelta, 0, 100);
  state.resources.boardConfidence = clamp(state.resources.boardConfidence + offer.boardDelta, 0, 100);
  state.flags.governmentDependence += offer.governmentDependenceDelta;
  state.flags.founderControl = clamp(state.flags.founderControl - offer.founderControlLoss, 0, 100);
  state.flags.fundingRound = offer.round;
  state.flags.lastFundingTurn = state.turn;

  if (offer.computeGrant) {
    state.facilities = [
      {
        id: `capital-${offer.id}-${state.turn}`,
        name: `${offer.name} Hosted Capacity`,
        region: "Partner Cloud",
        online: true,
        buildCost: 0,
        upkeep: 0.06 * Math.max(1, offer.computeGrant / 12),
        computeDelta: offer.computeGrant,
        trustDelta: offer.id === "mission-trust" ? 1 : 0,
        riskDelta: offer.id === "national-security" ? 1 : 0,
      },
      ...state.facilities,
    ];
  }

  state.feed = [
    {
      id: `funding-${state.turn}-${offer.id}`,
      turn: state.turn,
      title: `${offer.name} closed`,
      body: `${offer.summary} ${formatCurrency(offer.capital)} added to the treasury. Founder control now ${Math.round(state.flags.founderControl)}.`,
      severity: "warning" as const,
      kind: "system" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  recalculateState(state);
};

export const getTrackRevenueAtLevel = (trackId: TrackId, level: number) =>
  Number(stagePassiveRevenue(trackId, level).toFixed(2));

export const getTrackRevenueBreakdown = (trackId: TrackId) => {
  const metadata = trackRevenueNames[trackId];

  return trackById(trackId).levels.map((stage, index) => {
    const level = index + 1;
    const cumulativeRevenue = getTrackRevenueAtLevel(trackId, level);
    const priorRevenue = level > 1 ? getTrackRevenueAtLevel(trackId, level - 1) : 0;

    return {
      level,
      stageName: stage.name,
      technology: stage.technology,
      source: metadata.source,
      summary: stage.summary,
      stageRevenue: Number((cumulativeRevenue - priorRevenue).toFixed(2)),
      cumulativeRevenue,
      revenuePrograms: stage.revenuePrograms,
      unlocks: stage.unlocks,
      researchCost: stage.researchCost,
      recommendedCompute: stage.recommendedCompute,
      requiredSpecialists: stage.requiredSpecialists ?? [],
    };
  });
};

const programMatchesRequirements = (state: GameState, definition: CommercializationDefinition) =>
  Object.entries(definition.requiredTracks ?? {}).every(
    ([trackId, level]) => state.tracks[trackId as TrackId].level >= (level ?? 0),
  );

export const getActiveCommercializationPrograms = (state: GameState, trackId?: TrackId) =>
  state.commercializationPrograms
    .filter((program) => (!trackId || program.trackId === trackId))
    .sort((left, right) => right.quarterlyRevenue - left.quarterlyRevenue);

export const getCommercializationOptions = (state: GameState, trackId?: TrackId) =>
  COMMERCIALIZATION_DEFINITIONS.filter((definition) => (!trackId || definition.trackId === trackId))
    .map((rawDefinition) => {
      const definition = getCommercializationDefinition(rawDefinition.id)!;
      const currentTrack = state.tracks[definition.trackId];
      const existingProgram = state.commercializationPrograms.find(
        (program) => program.definitionId === definition.id,
      );
      const availableCommercialCompute = getCommercializationComputeHeadroom(state);
      const missingServiceCompute = existingProgram
        ? 0
        : Math.max(definition.computeDemand - availableCommercialCompute, 0);
      const prerequisitePrograms = definition.prerequisitePrograms ?? [];
      const inactivePrerequisites = prerequisitePrograms
        .filter((prerequisiteId) =>
          !state.commercializationPrograms.some(
            (program) => program.definitionId === prerequisiteId && program.status === "live",
          ),
        )
        .map((prerequisiteId) => getCommercializationDefinition(prerequisiteId)?.name ?? prerequisiteId);
      const missingRequirements = Object.entries(definition.requiredTracks ?? {})
        .filter(([requiredTrackId, requiredLevel]) => {
          const track = state.tracks[requiredTrackId as TrackId];
          return track.level < (requiredLevel ?? 0);
        })
        .map(([requiredTrackId, requiredLevel]) => `${trackById(requiredTrackId as TrackId).name} L${requiredLevel}`);
      const missingRoles = missingCommercializationRoles(
        state,
        definition.trackId,
        definition.requiredRoleKeywords ?? [],
      );

      let blockedReason: string | null = null;
      if (!currentTrack.unlocked) {
        blockedReason = trackUnlockHints[definition.trackId];
      } else if (currentTrack.level < definition.minLevel) {
        blockedReason = `${trackById(definition.trackId).name} must reach L${definition.minLevel}.`;
      } else if (!programMatchesRequirements(state, definition)) {
        blockedReason = `Also requires ${missingRequirements.join(", ")}.`;
      } else if (inactivePrerequisites.length) {
        blockedReason = `Requires live predecessor program${inactivePrerequisites.length > 1 ? "s" : ""}: ${inactivePrerequisites.join(", ")}.`;
      } else if (missingRoles.length) {
        blockedReason = `Need ${missingRoles.join(", ")}-capable talent who can support ${trackById(definition.trackId).name}. Commercial programs use roster coverage, not separate product assignments.`;
      } else if (existingProgram) {
        blockedReason = existingProgram.status === "live" ? "Already live." : "Currently launching.";
      } else if (missingServiceCompute > 0) {
        blockedReason = `Need ${missingServiceCompute} uncommitted PFLOPS to serve this product. Free compute from research or build capacity.`;
      } else if (state.resources.capital < definition.upfrontCost) {
        blockedReason = `Need ${formatCurrency(definition.upfrontCost)} capital to launch.`;
      }

      return {
        ...definition,
        blockedReason,
        available: !blockedReason,
        netRevenue: Number((definition.quarterlyRevenue - definition.quarterlyExpense).toFixed(2)),
        missingPrerequisitePrograms: inactivePrerequisites,
        missingTrackRequirements: missingRequirements,
        missingRoleKeywords: missingRoles,
        availableCommercialCompute,
        missingServiceCompute,
        computeBlocked: missingServiceCompute > 0,
        reservedComputeAfterLaunch:
          getReservedCommercialCompute(state) + (existingProgram ? 0 : definition.computeDemand),
        existingStatus: existingProgram?.status ?? null,
        isLive: existingProgram?.status === "live",
        isLaunching: existingProgram?.status === "launching",
      };
    })
    .sort((left, right) => left.tier - right.tier || right.minLevel - left.minLevel || right.quarterlyRevenue - left.quarterlyRevenue);

export const getActiveCommercializationConvergences = (state: GameState) => {
  const liveProgramIds = new Set(
    state.commercializationPrograms
      .filter((program) => program.status === "live")
      .map((program) => program.definitionId),
  );

  return COMMERCIALIZATION_CONVERGENCES.filter((definition) =>
    definition.requiredPrograms.every((requiredProgramId) => liveProgramIds.has(requiredProgramId)),
  );
};

export const getResearchExpenseBreakdown = (state: GameState) =>
  (Object.keys(state.tracks) as TrackId[])
    .map((trackId) => {
      const track = state.tracks[trackId];
      const assignedCount = state.employees.filter((employee) => employee.assignedTrack === trackId).length;
      return {
        trackId,
        name: trackById(trackId).name,
        amount: Number(trackResearchCost(trackId, track, assignedCount).toFixed(2)),
        assignedCount,
        compute: track.compute,
        projectName: getTrackForecast(state, trackId).projectName,
        posture: track.posture ?? "balanced",
        postureLabel: TRACK_POSTURES[track.posture ?? "balanced"].label,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);

export const getCommercializationExpenseBreakdown = (state: GameState) =>
  state.commercializationPrograms
    .map((program) => ({
      id: program.id,
      name: program.name,
      trackId: program.trackId,
      amount: Number(
        (
          program.status === "live"
            ? program.quarterlyExpense
            : Math.max(0.12, program.quarterlyExpense * 0.45)
        ).toFixed(2),
      ),
      computeDemand: program.computeDemand,
      status: program.status,
      source: program.source,
    }))
    .sort((left, right) => right.amount - left.amount);

export const getFundingOffers = (state: GameState): FundingOffer[] => {
  const turnsSinceRaise = state.turn - state.flags.lastFundingTurn;
  const raiseWindowOpen =
    state.resources.runwayMonths <= 9 ||
    (state.turn >= 8 && turnsSinceRaise >= 8) ||
    (state.turn >= 12 && state.turn % 8 === 0);

  if (!raiseWindowOpen || turnsSinceRaise < 4) {
    return [];
  }

  const round = nextFundingRound(state.flags.fundingRound);
  const roundIndex = fundingRoundOrder.indexOf(round) + 1;
  const capability =
    state.tracks.foundation.level +
    state.tracks.simulation.level +
    state.tracks.alignment.level +
    state.tracks.robotics.level +
    state.tracks.biology.level +
    state.tracks.materials.level +
    state.tracks.quantum.level +
    state.tracks.space.level;
  const capitalBase = 6 + roundIndex * 3.8 + capability * 0.32 + state.resources.revenue * 0.45;

  return [
    {
      id: "frontier-vc",
      name: `Frontier VC Syndicate ${fundingRoundLabel[round]}`,
      summary: "Maximum cash, faster growth expectations, more board leverage.",
      capital: Number((capitalBase * 1.18).toFixed(1)),
      founderControlLoss: 8 + roundIndex,
      boardDelta: 4,
      trustDelta: -1,
      fearDelta: 0,
      governmentDependenceDelta: 0,
      round,
      cooldown: 8,
    },
    {
      id: "mission-trust",
      name: `${fundingRoundLabel[round]} Mission Trust Fund`,
      summary: "Lower dilution and stronger legitimacy, but a smaller check.",
      capital: Number((capitalBase * 0.78).toFixed(1)),
      founderControlLoss: 5 + roundIndex,
      boardDelta: 1,
      trustDelta: 4,
      fearDelta: -1,
      governmentDependenceDelta: 0,
      round,
      cooldown: 8,
    },
    {
      id: "compute-partner",
      name: `${fundingRoundLabel[round]} Strategic Compute Partner`,
      summary: "Cash plus hosted capacity, with pressure to commercialize more aggressively.",
      capital: Number((capitalBase * 0.96).toFixed(1)),
      founderControlLoss: 7 + roundIndex,
      boardDelta: 3,
      trustDelta: -1,
      fearDelta: 1,
      governmentDependenceDelta: 1,
      computeGrant: 12 + roundIndex * 6,
      round,
      cooldown: 8,
    },
    {
      id: "national-security",
      name: `${fundingRoundLabel[round]} National Security Program`,
      summary: "Large strategic check with strings, scrutiny, and tighter state entanglement.",
      capital: Number((capitalBase * 1.08).toFixed(1)),
      founderControlLoss: 6 + roundIndex,
      boardDelta: 2,
      trustDelta: -2,
      fearDelta: 2,
      governmentDependenceDelta: 3,
      round,
      cooldown: 8,
    },
  ];
};

export const getCommercializationReservedCompute = (state: GameState) =>
  getReservedCommercialCompute(state);

export const getResearchComputeCapacity = (state: GameState) => {
  const facilityCapacity = computeCapacityFromFacilities(state.facilities);
  const rawCapacity = facilityCapacity || state.resources.computeCapacity;
  return getAvailableResearchCompute(state, rawCapacity);
};

const convergenceRevenue: Record<string, { amount: number; source: string; summary: string }> = {
  "predictive-market-stack": {
    amount: 3.6,
    source: "Platform",
    summary: "Enterprise buyers pay for forecasts that feel unfairly good.",
  },
  "programmable-medicine": {
    amount: 4.4,
    source: "Biotech",
    summary: "Clinical and pharma partners line up for programmable medicine access.",
  },
  "self-replicating-fab": {
    amount: 3.9,
    source: "Industrial",
    summary: "Manufacturing partners pay to get ahead of the new production curve.",
  },
  "cryptographic-supremacy": {
    amount: 3.1,
    source: "Strategic",
    summary: "Security-sensitive customers pay for lead time and insight.",
  },
  "autonomous-spaceyards": {
    amount: 4.2,
    source: "Aerospace",
    summary: "Launch and orbital contractors buy into autonomous construction capability.",
  },
  "orbital-command-mesh": {
    amount: 7.4,
    source: "Orbital",
    summary: "Autonomous orbital command and logistics becomes a premium systems business almost overnight.",
  },
  "asi-fabrication-loop": {
    amount: 6.8,
    source: "Industrial",
    summary: "The ASI-directed fabrication loop compounds capacity, margin, and bargaining power every quarter.",
  },
};

const deriveRevenueStreams = (state: GameState): RevenueStream[] => {
  const streams: RevenueStream[] = [
    {
      id: `retainer-${state.preset}`,
      name: state.preset === "government" ? "Federal Anchor Contract" : "Existing Operating Retainer",
      amount: initialRetainerAmounts[state.preset],
      source: state.preset === "government" ? "Government" : "Bridge",
      summary:
        state.preset === "government"
          ? "A starting government contract keeps the lab alive and watched."
          : "Early retainers and inherited commitments keep the lights on.",
    },
  ];

  (Object.keys(state.tracks) as TrackId[]).forEach((trackId) => {
    const level = state.tracks[trackId].level;
    if (level <= 0) {
      return;
    }

    const metadata = trackRevenueNames[trackId];
    streams.push({
      id: `track-passive-${trackId}`,
      name: `${metadata.name} Baseline`,
      amount: Number(stagePassiveRevenue(trackId, level).toFixed(2)),
      source: metadata.source,
      summary: `${metadata.summary} Passive retainers and pilot work unlocked through ${trackById(trackId).levels[level - 1].name}.`,
      trackId,
    });
  });

  state.commercializationPrograms
    .filter((program) => program.status === "live")
    .forEach((program) => {
      streams.push({
        id: `program-${program.id}`,
        name: program.name,
        amount: program.quarterlyRevenue,
        source: program.source,
        summary: `${program.summary} Live commercialization program.`,
        trackId: program.trackId,
        programId: program.id,
        lane: program.lane,
      });
    });

  state.convergences.forEach((convergence) => {
    const revenue = convergenceRevenue[convergence.id];
    if (!revenue) {
      return;
    }

    streams.push({
      id: `convergence-${convergence.id}`,
      name: convergence.name,
      amount: revenue.amount,
      source: revenue.source,
      summary: revenue.summary,
    });
  });

  getActiveCommercializationConvergences(state).forEach((convergence) => {
    streams.push({
      id: `market-${convergence.id}`,
      name: convergence.name,
      amount: convergence.revenue,
      source: "Market Convergence",
      summary: convergence.description,
    });
  });

  if (state.flags.governmentDependence > 0) {
    streams.push({
      id: "dependence-contracts",
      name: "Directed Government Work",
      amount: Number((state.flags.governmentDependence * 0.55).toFixed(2)),
      source: "Government",
      summary: "State-aligned work extends runway and tightens outside control.",
    });
  }

  return streams.sort((left, right) => right.amount - left.amount);
};

const deriveExpenses = (state: GameState, computeCapacity: number): ExpenseBreakdown => {
  const payroll = salaryBurn(state.employees);
  const facilities = facilityBurn(state.facilities);
  const expansion = projectBurn(state.projects);
  const compute = computeUpkeep(
    computeCapacity,
    state.supplier.upkeepMultiplier,
    state.energyPolicy.upkeepMultiplier,
  );
  const research = getResearchExpenseBreakdown(state).reduce((sum, entry) => sum + entry.amount, 0);
  const commercialization =
    getCommercializationExpenseBreakdown(state).reduce((sum, entry) => sum + entry.amount, 0) +
    getActiveCommercializationConvergences(state).reduce((sum, entry) => sum + entry.expense, 0);

  return {
    payroll: Number(payroll.toFixed(2)),
    facilities: Number(facilities.toFixed(2)),
    expansion: Number(expansion.toFixed(2)),
    compute: Number(compute.toFixed(2)),
    research: Number(research.toFixed(2)),
    commercialization: Number(commercialization.toFixed(2)),
  };
};

export const describeGovernmentRelation = (relation: number) => {
  if (relation >= 75) return "Strategic partner";
  if (relation >= 60) return "Constructive";
  if (relation >= 45) return "Transactional";
  if (relation >= 30) return "Wary";
  return "Hostile";
};

const updateGovernments = (state: GameState) => {
  const trackLevels = state.tracks;
  const supplierHeat = state.supplier.riskDelta;
  const cleanEnergyBonus = state.energyPolicy.id === "solar" || state.energyPolicy.id === "geothermal" ? 1.2 : 0;
  const facilityRegions = new Set(state.facilities.map((facility) => facility.region));

  const drifts: Record<GovernmentId, number> = {
    us:
      0.4 +
      trackLevels.foundation.level * 0.35 +
      trackLevels.quantum.level * 0.28 +
      (facilityRegions.has("Virginia") ? 1.2 : 0) -
      state.flags.openness * 0.2,
    eu:
      0.2 +
      trackLevels.alignment.level * 0.5 +
      cleanEnergyBonus +
      state.resources.trust * 0.015 -
      state.resources.fear * 0.012,
    china:
      0.15 +
      trackLevels.materials.level * 0.32 +
      (state.supplier.vendor === "Custom ASIC" ? 0.4 : 0) -
      state.resources.trust * 0.01,
    india:
      0.18 +
      trackLevels.simulation.level * 0.24 +
      (facilityRegions.has("Bengaluru") ? 1.4 : 0) +
      state.flags.openness * 0.18,
    gulf:
      0.12 +
      trackLevels.foundation.level * 0.2 +
      (facilityRegions.has("Doha") ? 1.8 : 0) +
      (state.energyPolicy.id === "nuclear" ? 0.35 : 0),
  };

  (Object.keys(state.governments) as GovernmentId[]).forEach((governmentId) => {
    const government = state.governments[governmentId];
    const fearPenalty = state.resources.fear * 0.035;
    const trustLift = state.resources.trust * 0.025;
    const dependenceEffect = governmentId === "us" ? state.flags.governmentDependence * 0.45 : 0;
    const delta = drifts[governmentId] + trustLift - fearPenalty + dependenceEffect - supplierHeat * 0.12;
    government.relation = clamp(GOVERNMENT_START[governmentId].relation + delta, 5, 95);
  });
};

const researchPostureDrift = (state: GameState) =>
  (Object.keys(state.tracks) as TrackId[]).reduce(
    (drift, trackId) => {
      const track = state.tracks[trackId];
      const assignedCount = state.employees.filter((employee) => employee.assignedTrack === trackId).length;
      const active = track.unlocked && (assignedCount > 0 || track.compute > 0);

      if (!active) {
        return drift;
      }

      const posture = TRACK_POSTURES[track.posture ?? "balanced"];
      const intensity = Math.min(1, 0.35 + assignedCount * 0.18 + Math.min(track.compute, 80) / 180);

      return {
        trust: drift.trust + posture.trustDelta * intensity,
        fear: drift.fear + posture.fearDelta * intensity,
        board: drift.board + posture.boardDelta * intensity,
      };
    },
    { trust: 0, fear: 0, board: 0 },
  );

export const recalculateState = (state: GameState) => {
  ensureUnlocks(state);
  normalizeAssignments(state);

  const facilityCapacity = computeCapacityFromFacilities(state.facilities);
  const computeCapacity = facilityCapacity || state.resources.computeCapacity;
  const researchCapacity = getAvailableResearchCompute(state, computeCapacity);
  const revenueStreams = deriveRevenueStreams(state);
  const revenue = revenueStreams.reduce((sum, stream) => sum + stream.amount, 0);
  const expenses = deriveExpenses(state, computeCapacity);
  const burn = Object.values(expenses).reduce((sum, value) => sum + value, 0);
  const monthlyNetBurn = Math.max((burn - revenue) / 3, 0.08);

  state.resources.computeCapacity = computeCapacity;
  state.resources.expenses = expenses;
  state.resources.revenue = Number(revenue.toFixed(2));
  state.resources.burn = Number(burn.toFixed(2));
  state.resources.runwayMonths = Number((state.resources.capital / monthlyNetBurn).toFixed(1));
  state.revenueStreams = revenueStreams;
  updateGovernments(state);

  const totalAllocated = totalAllocatedCompute(state);

  if (totalAllocated > researchCapacity && totalAllocated > 0) {
    const ratio = researchCapacity / totalAllocated;
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

  if (state.tracks.foundation.level >= 6 && state.tracks.alignment.level >= 5 && state.resources.trust >= 58) {
    return {
      id: "beneficial-asi",
      title: "Beneficial ASI",
      summary: "Capability and alignment converged before panic or capture could freeze the field.",
      epilogue:
        "Your lab becomes the spine of a careful transition. Energy grids stabilize, drug timelines collapse, and the world remembers this era as the one time power and restraint matured together.",
      unlocks: ["government", "second-chance"],
    };
  }

  if (state.tracks.foundation.level >= 6 && state.tracks.alignment.level <= 1) {
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
  advanceCommercialPrograms(state, worldEvents);
  const breakthroughs = applyResearch(state);
  const triggeredConvergences = triggerConvergences(state);
  updateRivals(state, worldEvents);
  const talentMarketNews = resolveContestedTalentMarket(state, worldEvents);
  const worldNews = buildWorldNews(state);
  worldEvents.push(...worldNews.map((item) => item.title));
  const postureDrift = researchPostureDrift(state);
  state.resources.trust = clamp(
    state.resources.trust +
      state.energyPolicy.trustDelta * 0.18 +
      computeTrustFromFacilities(state.facilities) * 0.12 -
      Math.max(0, state.flags.ethicsDebt) * 0.1 +
      postureDrift.trust,
    0,
    100,
  );
  state.resources.fear = clamp(
    state.resources.fear +
      Math.max(0, state.tracks.foundation.level - state.tracks.alignment.level) * 0.28 +
      computeRiskFromFacilities(state.facilities) * 0.14 +
      (worldNews.some((item) => item.severity === "critical") ? 1.2 : 0) +
      postureDrift.fear,
    0,
    100,
  );
  state.resources.boardConfidence = clamp(state.resources.boardConfidence + postureDrift.board, 0, 100);
  recalculateState(state);
  applyQuarterlyBoardPressure(state);
  recalculateState(state);

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
    ...talentMarketNews,
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
  state.turn = nextTurn;
  state.year = nextLabel.year;
  state.quarterIndex = nextLabel.quarterIndex;
  onboardPendingHires(state, worldEvents);
  state.candidates = buildCandidatePool(state.seed, nextTurn, state.employees);
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
  const freeCompute = Math.max(getResearchComputeCapacity(state) - totalAllocated, 0);
  const next = state.tracks[trackId];
  const change = delta > 0 ? Math.min(delta, freeCompute) : Math.max(delta, -next.compute);

  next.compute = Math.max(0, next.compute + change);
  recalculateState(state);
};

export const setResearchPosture = (state: GameState, trackId: TrackId, posture: TrackPostureId) => {
  if (!state.tracks[trackId]?.unlocked) {
    return;
  }

  state.tracks[trackId].posture = posture;
  recalculateState(state);
};

export const assignResearcher = (state: GameState, researcherId: string, trackId: TrackId | null) => {
  const employee = state.employees.find((entry) => entry.id === researcherId);
  if (!employee) {
    return;
  }

  if (trackId && (!state.tracks[trackId].unlocked || !canResearcherSupportTrack(employee, trackId))) {
    return;
  }

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
  state.pendingHires = [...state.pendingHires, { ...hire, assignedTrack: null }];
  state.candidates = state.candidates.filter((entry) => entry.id !== candidateId);
  state.feed = [
    {
      id: `hire-${state.turn}-${candidate.id}`,
      turn: state.turn,
      title: `${candidate.name} signed with the lab`,
      body: `${candidate.role} accepted from ${candidate.location}. Arrival and payroll begin next quarter. ${candidate.ask}`,
      severity: "info" as const,
      kind: "system" as const,
    },
    ...state.feed,
  ].slice(0, 30);
  recalculateState(state);
};

export const buildFacility = (state: GameState, facilityId: string) => {
  const option = availableBuildOptions(state).find((facility) => facility.id === facilityId);
  if (!option) return;
  if (state.resources.capital < option.buildCost || state.projects.some((project) => project.id === option.id)) {
    return;
  }

  state.resources.capital -= option.buildCost;
  const totalTurns = getFacilityBuildTime(state, option.id);
  state.projects = [
    {
      id: option.id,
      name: option.name,
      region: option.region,
      turnsRemaining: totalTurns,
      totalTurns,
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
      body: `Construction begins in ${option.region}. Delivery expected in ${totalTurns} quarter${totalTurns === 1 ? "" : "s"}.`,
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

export const setOpenAISettings = (
  state: GameState,
  enabled: boolean,
  apiKey: string,
  autoPlay: boolean,
) => {
  state.openAISettings = {
    ...state.openAISettings,
    enabled,
    apiKey,
    autoPlay,
    voice: "marin",
  };
};

export const setAICacheEntry = (state: GameState, key: string, value: string) => {
  state.aiSettings.cache = { ...state.aiSettings.cache, [key]: value };
};

export const snapshotState = (state: GameState): GameSnapshot => ({
  savedAt: new Date().toISOString(),
  state,
});

export const snapshotStateForCloud = (state: GameState): GameSnapshot => {
  const sanitized = structuredClone(state);
  sanitized.aiSettings = {
    ...sanitized.aiSettings,
    enabled: false,
    apiKey: "",
    cache: {},
  };
  sanitized.openAISettings = {
    ...sanitized.openAISettings,
    enabled: false,
    apiKey: "",
  };
  sanitized.slotSummaries = [];

  return snapshotState(sanitized);
};

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
  [
    ...BUILD_OPTIONS,
    ...(BUILD_OPTIONS.every(
      (option) =>
        state.projects.some((project) => project.id === option.id) ||
        state.facilities.some((facility) => facility.id === option.id),
    )
      ? generateDynamicBuildOptions(state)
      : []),
  ].filter(
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
