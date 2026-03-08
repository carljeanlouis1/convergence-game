export type TrackId =
  | "foundation"
  | "alignment"
  | "robotics"
  | "biology"
  | "materials"
  | "quantum"
  | "space"
  | "simulation";

export type RivalId =
  | "prometheus"
  | "velocity"
  | "zhongguancun"
  | "opencollective";

export type GovernmentId = "us" | "eu" | "china" | "india" | "gulf";

export type SaveSlotId = 1 | 2 | 3;
export type CloudSaveSlotId = SaveSlotId | "autosave";

export type StartPresetId =
  | "founder"
  | "government"
  | "open-source"
  | "corporate"
  | "underground"
  | "second-chance";

export type EndingId =
  | "beneficial-asi"
  | "catastrophic-misalignment"
  | "regulatory-capture"
  | "irrelevance"
  | "corporate-dystopia"
  | "transcendence"
  | "simulation-revelation"
  | "open-future";

export type PanelId =
  | "track"
  | "briefing"
  | "finance"
  | "hiring"
  | "facilities"
  | "dilemmas"
  | "settings";

export type NarrativeSystemId =
  | "world-news"
  | "rival-labs"
  | "discovery"
  | "dilemma-writer"
  | "chief-of-staff";

export interface TrackDefinition {
  id: TrackId;
  name: string;
  shortName: string;
  accent: string;
  description: string;
  levels: TrackStageDefinition[];
  position: {
    x: number;
    y: number;
  };
  starter: boolean;
}

export interface TrackStageDefinition {
  name: string;
  technology: string;
  summary: string;
  revenueLift: number;
  revenuePrograms: string[];
  unlocks: string[];
  researchCost: number;
  recommendedCompute: number;
  requiredSpecialists?: TrackId[];
}

export interface TrackState {
  id: TrackId;
  level: number;
  progress: number;
  compute: number;
  unlocked: boolean;
}

export interface Researcher {
  id: string;
  name: string;
  role: string;
  primaryTrack: TrackId;
  secondaryTrack?: TrackId;
  generalist?: boolean;
  research: number;
  execution: number;
  leadership: number;
  ethics: number;
  morale: number;
  salary: number;
  signingBonus: number;
  location: string;
  traits: string[];
  bio: string;
  assignedTrack: TrackId | null;
}

export interface Candidate extends Researcher {
  contestedBy: RivalId | null;
  ask: string;
}

export interface FacilityProject {
  id: string;
  name: string;
  region: string;
  turnsRemaining: number;
  totalTurns: number;
  buildCost: number;
  upkeep: number;
  computeDelta: number;
  trustDelta: number;
  riskDelta: number;
}

export interface FacilityState {
  id: string;
  name: string;
  region: string;
  online: boolean;
  buildCost: number;
  upkeep: number;
  computeDelta: number;
  trustDelta: number;
  riskDelta: number;
}

export interface SupplierContract {
  vendor: "NVIDIA" | "AMD" | "Google TPU" | "Custom ASIC";
  computeMultiplier: number;
  upkeepMultiplier: number;
  trustDelta: number;
  riskDelta: number;
  summary: string;
}

export interface EnergyPolicy {
  id: "grid" | "solar" | "nuclear" | "geothermal";
  name: string;
  upkeepMultiplier: number;
  trustDelta: number;
  riskDelta: number;
  summary: string;
}

export interface RivalState {
  id: RivalId;
  name: string;
  baseCity: string;
  persona: string;
  capability: number;
  safety: number;
  goodwill: number;
  focus: TrackId;
  recentMove: string;
  decisionHistory: string[];
}

export interface GovernmentState {
  id: GovernmentId;
  name: string;
  shortName: string;
  relation: number;
  agenda: string;
}

export interface NewsItem {
  id: string;
  turn: number;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  kind: "briefing" | "world" | "research" | "rival" | "dilemma" | "system";
}

export interface ConvergenceDefinition {
  id: string;
  name: string;
  description: string;
  requirements: Partial<Record<TrackId, number>>;
  reward: {
    capital?: number;
    trust?: number;
    fear?: number;
    compute?: number;
    board?: number;
  };
}

export interface TriggeredConvergence {
  id: string;
  turn: number;
  name: string;
  description: string;
}

export interface DilemmaOutcome {
  id: string;
  label: string;
  chance: number;
  effects: {
    capital?: number;
    trust?: number;
    fear?: number;
    board?: number;
    reputation?: number;
    governmentDependence?: number;
    ethicsDebt?: number;
    safetyCulture?: number;
    morale?: number;
    compute?: number;
    openness?: number;
    crisisCount?: number;
  };
  narrative: string;
}

export interface DilemmaOption {
  id: string;
  label: string;
  summary: string;
  outcomes: DilemmaOutcome[];
}

export interface DilemmaDefinition {
  id: string;
  minTurn: number;
  maxTurn?: number;
  title: string;
  source: string;
  brief: string;
  trigger: {
    fearAtLeast?: number;
    trustAtMost?: number;
    trustAtLeast?: number;
    capitalAtMost?: number;
    foundationAtLeast?: number;
    alignmentAtMost?: number;
    alignmentAtLeast?: number;
    governmentDependenceAtLeast?: number;
    ethicsDebtAtLeast?: number;
    simulationAtLeast?: number;
    roboticsAtLeast?: number;
    biologyAtLeast?: number;
    quantumAtLeast?: number;
    requiresWorldTag?: string;
  };
  options: DilemmaOption[];
}

export interface ResolutionSummary {
  turn: number;
  year: number;
  quarter: string;
  headline: string;
  briefing: string;
  breakthroughs: string[];
  worldEvents: string[];
  financeDelta: number;
}

export interface EndingResult {
  id: EndingId;
  title: string;
  summary: string;
  epilogue: string;
  unlocks: StartPresetId[];
}

export interface GameFlags {
  governmentDependence: number;
  ethicsDebt: number;
  safetyCulture: number;
  openness: number;
  crisisCount: number;
  lastWorldTags: string[];
}

export interface ExpenseBreakdown {
  payroll: number;
  compute: number;
  facilities: number;
  research: number;
  expansion: number;
}

export interface RevenueStream {
  id: string;
  name: string;
  amount: number;
  source: string;
  summary: string;
}

export interface ResourcesState {
  capital: number;
  revenue: number;
  burn: number;
  runwayMonths: number;
  computeCapacity: number;
  trust: number;
  fear: number;
  boardConfidence: number;
  reputation: number;
  wealth: number;
  expenses: ExpenseBreakdown;
}

export interface CEOState {
  name: string;
  title: string;
  fired: boolean;
}

export interface AISettings {
  enabled: boolean;
  apiKey: string;
  cache: Record<string, string>;
}

export interface OpenAISettings {
  enabled: boolean;
  apiKey: string;
  voice: "nova";
  autoPlay: boolean;
}

export interface DecisionLogEntry {
  id: string;
  turn: number;
  title: string;
  choice: string;
  outcome: string;
  impact: string;
}

export interface SaveSummary {
  slot: SaveSlotId;
  title: string;
  subtitle: string;
  updatedAt: string;
}

export interface CloudSaveSummary {
  slot: CloudSaveSlotId;
  title: string;
  subtitle: string;
  updatedAt: string;
}

export interface CloudCredentials {
  commanderId: string;
  authToken: string;
}

export interface MetaProgression {
  unlockedStarts: StartPresetId[];
  completedEndings: EndingId[];
}

export interface GameState {
  seed: number;
  mode: "menu" | "playing" | "ended";
  preset: StartPresetId;
  turn: number;
  year: number;
  quarterIndex: number;
  panel: PanelId;
  selectedTrack: TrackId;
  resources: ResourcesState;
  ceo: CEOState;
  supplier: SupplierContract;
  energyPolicy: EnergyPolicy;
  tracks: Record<TrackId, TrackState>;
  employees: Researcher[];
  pendingHires: Researcher[];
  candidates: Candidate[];
  facilities: FacilityState[];
  projects: FacilityProject[];
  governments: Record<GovernmentId, GovernmentState>;
  rivals: Record<RivalId, RivalState>;
  feed: NewsItem[];
  convergences: TriggeredConvergence[];
  usedDilemmas: string[];
  activeDilemma: DilemmaDefinition | null;
  activeDilemmaSource: string | null;
  resolution: ResolutionSummary | null;
  flags: GameFlags;
  tutorialStep: number;
  aiSettings: AISettings;
  meta: MetaProgression;
  slotSummaries: SaveSummary[];
  ending: EndingResult | null;
  revenueStreams: RevenueStream[];
  decisionLog: DecisionLogEntry[];
  openAISettings: OpenAISettings;
}

export interface GameSnapshot {
  savedAt: string;
  state: GameState;
}

export interface CloudSaveRecord {
  summary: CloudSaveSummary;
  snapshot: GameSnapshot;
}
