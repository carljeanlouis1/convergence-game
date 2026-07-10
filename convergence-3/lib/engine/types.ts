export type BenchCategory = "coding" | "reasoning" | "enterprise" | "consumer";
export type RunStatus = "active" | "completed" | "scrapped" | "failed";
export type CheckpointBand = "ahead" | "on-track" | "wobbly" | "troubled";
export type RunDecisionKind = "push" | "boost" | "scrap";
export type Positioning = "api" | "enterprise" | "consumer" | "open-weights";

export interface Star {
  id: string;
  name: string;
  specialty: BenchCategory;
  skill: number; // 1-10
  salaryPerQuarter: number; // $M
  onRunId: string | null;
  burnout: number; // 0-100
}

export interface Technique {
  id: string;
  name: string;
  era: 1 | 2 | 3 | 4;
  qualityBonus: number; // added to expected quality
  variance: number; // added to per-turn noise sd
  categoryWeights: Record<BenchCategory, number>; // capability shaping, ~0.8-1.2
}

export interface Facility {
  id: string;
  name: string;
  capacityPF: number;
  upkeepPerTurn: number; // $M; reserved for Plan-2 leased facilities
  onlineTurn: number;
}

export interface RunDesign {
  name: string;
  scaleTier: 1 | 2 | 3 | 4;
  techniqueIds: string[];
  leadId: string | null;
}

export interface CheckpointReading {
  turn: number;
  band: CheckpointBand;
  note: string;
}

export interface TrainingRun {
  id: string;
  name: string;
  scaleTier: 1 | 2 | 3 | 4;
  techniqueIds: string[];
  leadId: string | null;
  computePerTurn: number;
  turnsTotal: number;
  turnsElapsed: number;
  spentToDate: number; // $M cumulative
  expectedAtLaunch: number; // projected quality at design time (checkpoint anchor)
  hiddenQuality: number; // 0-100, NEVER shown in UI
  checkpoints: CheckpointReading[];
  status: RunStatus;
  startedTurn: number;
}

export interface Model {
  id: string;
  name: string;
  createdTurn: number;
  capability: Record<BenchCategory, number>; // 0-100 each
  positioning: Positioning | null; // null = undeployed
  deployedTurn: number | null;
}

export interface ComputeAllocation {
  inference: number;
  experiments: number;
  safety: number; // PF; active runs are implicit commitments on top
}

export interface RevenueStream {
  source: string;
  amountPerTurn: number;
  decayPerTurn: number;
}

export interface DebriefLine {
  kind: "finance" | "run" | "compute" | "world" | "rival" | "talent" | "safety" | "funding";
  text: string;
}

export type RivalArchetype = "scaler" | "safety" | "state" | "open" | "wildcard";

export interface Rival {
  id: string;
  name: string;
  archetype: RivalArchetype;
  aggression: number; // 1-10, drives run cadence + jump size
  capability: Record<BenchCategory, number>;
  runFinishTurn: number | null; // hidden clock; UI never shows this
  lastRelease: string | null;
  active: boolean; // wildcard slot starts inactive
}

export interface Candidate {
  id: string;
  name: string;
  specialty: BenchCategory;
  skill: number;
  salaryPerQuarter: number;
  signingBonus: number;
  exitTurn: number; // leaves the market after this turn
}

export interface PoachOffer {
  starId: string;
  rivalId: string;
  packageM: number;
  expiresTurn: number; // -1 sentinel: star accepted, departs next talentTurn
}

export type FundingKind = "vc" | "strategic" | "mission";

export interface FundingOffer {
  id: string;
  kind: FundingKind;
  amountM: number;
  controlCost: number;
  boardDelta: number;
  trustDelta: number;
  computeGrantPF: number;
  expiresTurn: number;
}

export interface DilemmaOptionOutcome {
  chance: number; // weight within the option
  text: string;
  deltas: Partial<{
    capital: number;
    trust: number;
    boardConfidence: number;
    control: number;
    morale: number;
    incidentRisk: number;
    teamStrength: number;
    standardsAdopted: boolean;
  }>;
}

export interface DilemmaOption {
  id: string;
  label: string;
  note: string; // states the trade in plain terms
  outcomes: DilemmaOptionOutcome[];
}

export interface DilemmaDef {
  id: string;
  era: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  options: DilemmaOption[];
  trigger?: (state: GameState) => boolean;
}

export interface ActiveDilemma {
  defId: string;
  openedTurn: number;
}

export interface GameStats {
  profitStreak: number; // consecutive turns net >= 0
  topStreak: number; // consecutive turns ranked #1
  topStreakSpansEra: boolean; // current topStreak crossed an era boundary
  laggingStreak: number; // consecutive turns far behind the leader (after endings.laggingFromTurn)
  openShare: number; // accumulates from live open-weights models
  incidents: number; // total safety incidents fired
  standardsAdopted: boolean; // set by the standards-body dilemma
  agiTurn: number | null; // first turn a deployed model avg >= frontiers.agiThreshold
}

export interface FacilityBuild {
  optionId: string;
  name: string;
  capacityPF: number;
  turnsLeft: number;
}

export type FrontierId = "robotics" | "biology" | "materials" | "space" | "simulation";

export interface FrontierProject {
  id: FrontierId;
  name: string;
  status: "locked" | "available" | "active" | "completed";
  turnsLeft: number;
  computePerTurn: number; // committed while active
}

export interface BuildOption {
  id: string;
  name: string;
  era: 1 | 2 | 3 | 4;
  capacityPF: number;
  costM: number;
  turns: number;
  trustDelta: number;
  note: string;
}

export interface EndingResult {
  id: string;
  victory: boolean;
  pyrrhic: boolean;
  grade: "S" | "A" | "B" | "C" | "D";
}

export interface ChronicleEntry {
  turn: number;
  kind: "rival" | "talent" | "funding" | "safety" | "dilemma" | "world";
  text: string;
}

export interface TurnDebrief {
  turn: number;
  headline: string;
  lines: DebriefLine[];
}

export interface GameState {
  version: 1 | 2 | 3;
  seed: string;
  turn: number;
  era: 1 | 2 | 3 | 4;
  capital: number; // $M
  trust: number;
  boardConfidence: number;
  control: number;
  morale: number; // 0-100
  facilities: Facility[];
  allocation: ComputeAllocation;
  stars: Star[];
  teamStrength: number; // 0-100 aggregate
  runs: TrainingRun[];
  models: Model[];
  revenueStreams: RevenueStream[];
  lastDebrief: TurnDebrief | null;
  ended: boolean;
  rivals: Rival[];
  market: Candidate[];
  poachOffers: PoachOffer[];
  fundingOffers: FundingOffer[];
  lastRaiseTurn: number;
  fundingRound: number;
  evalCapacity: number;
  incidentRisk: number;
  fireSaleCount: number;
  activeDilemma: ActiveDilemma | null;
  usedDilemmas: string[];
  chronicle: ChronicleEntry[];
  ending: string | null;
  interimUntilTurn: number | null; // constrained-CEO mode after a survived-but-scarred coup
  stats: GameStats;
  builds: FacilityBuild[];
  frontierProjects: FrontierProject[];
  pendingEraBriefing: 1 | 2 | 3 | 4 | null;
  endingResult: EndingResult | null;
}
