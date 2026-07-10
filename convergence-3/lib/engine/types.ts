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
  kind: "finance" | "run" | "compute" | "world";
  text: string;
}

export interface TurnDebrief {
  turn: number;
  headline: string;
  lines: DebriefLine[];
}

export interface GameState {
  version: 1;
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
}
