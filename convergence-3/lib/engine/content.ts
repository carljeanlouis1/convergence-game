import type { Star, Technique, Facility } from "./types";

export const STARTING_STARS: Star[] = [
  { id: "star-imara", name: "Dr. Imara Osei", specialty: "reasoning", skill: 7, salaryPerQuarter: 0.9, onRunId: null },
  { id: "star-jonas", name: "Jonas Feld", specialty: "coding", skill: 6, salaryPerQuarter: 0.7, onRunId: null },
  { id: "star-mei", name: "Mei-Lin Zhang", specialty: "enterprise", skill: 5, salaryPerQuarter: 0.55, onRunId: null },
  { id: "star-rafa", name: "Rafael Duarte", specialty: "consumer", skill: 5, salaryPerQuarter: 0.5, onRunId: null },
];

export const TECHNIQUES: Technique[] = [
  {
    id: "rlhf",
    name: "RLHF",
    era: 1,
    qualityBonus: 3,
    variance: 0,
    categoryWeights: { coding: 1.0, reasoning: 1.0, enterprise: 1.05, consumer: 1.1 },
  },
  {
    id: "dpo",
    name: "DPO",
    era: 1,
    qualityBonus: 4,
    variance: 1.0,
    categoryWeights: { coding: 1.05, reasoning: 1.05, enterprise: 1.0, consumer: 1.0 },
  },
  {
    id: "synthetic-data",
    name: "Synthetic Data Pipeline",
    era: 1,
    qualityBonus: 6,
    variance: 2.5,
    categoryWeights: { coding: 1.15, reasoning: 1.1, enterprise: 0.95, consumer: 0.9 },
  },
];

export const STARTING_FACILITIES: Facility[] = [
  // upkeepPerTurn 0: upkeep is computed from capacity via BALANCE.finance.computeUpkeepPerPF;
  // field reserved for Plan-2 leased facilities with contract premiums
  { id: "fac-hq", name: "HQ Cluster", capacityPF: 40, upkeepPerTurn: 0, onlineTurn: 1 },
];
