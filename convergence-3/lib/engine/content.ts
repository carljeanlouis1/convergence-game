import type { Star, Technique, Facility, Rival, Candidate } from "./types";

export const STARTING_STARS: Star[] = [
  { id: "star-imara", name: "Dr. Imara Osei", specialty: "reasoning", skill: 7, salaryPerQuarter: 0.9, onRunId: null, burnout: 0 },
  { id: "star-jonas", name: "Jonas Feld", specialty: "coding", skill: 6, salaryPerQuarter: 0.7, onRunId: null, burnout: 0 },
  { id: "star-mei", name: "Mei-Lin Zhang", specialty: "enterprise", skill: 5, salaryPerQuarter: 0.55, onRunId: null, burnout: 0 },
  { id: "star-rafa", name: "Rafael Duarte", specialty: "consumer", skill: 5, salaryPerQuarter: 0.5, onRunId: null, burnout: 0 },
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
  // field reserved for leased facilities with contract premiums
  { id: "fac-hq", name: "HQ Cluster", capacityPF: 40, upkeepPerTurn: 0, onlineTurn: 1 },
];

export const RIVALS: Rival[] = [
  {
    id: "velocity", name: "Velocity Systems", archetype: "scaler", aggression: 9,
    capability: { coding: 42, reasoning: 38, enterprise: 33, consumer: 40 },
    runFinishTurn: null, lastRelease: null, active: true,
  },
  {
    id: "prometheus", name: "Prometheus Institute", archetype: "safety", aggression: 5,
    capability: { coding: 34, reasoning: 44, enterprise: 36, consumer: 28 },
    runFinishTurn: null, lastRelease: null, active: true,
  },
  {
    id: "zhongguancun", name: "Zhongguancun Frontier", archetype: "state", aggression: 7,
    capability: { coding: 40, reasoning: 36, enterprise: 30, consumer: 44 },
    runFinishTurn: null, lastRelease: null, active: true,
  },
  {
    id: "opencollective", name: "OpenCollective", archetype: "open", aggression: 6,
    capability: { coding: 38, reasoning: 32, enterprise: 26, consumer: 36 },
    runFinishTurn: null, lastRelease: null, active: true,
  },
  {
    id: "wildcard", name: "(unfounded)", archetype: "wildcard", aggression: 8,
    capability: { coding: 30, reasoning: 30, enterprise: 30, consumer: 30 },
    runFinishTurn: null, lastRelease: null, active: false,
  },
];

export const CANDIDATE_POOL: Candidate[] = [
  { id: "cand-noor", name: "Tessa Noor", specialty: "coding", skill: 7, salaryPerQuarter: 1.1, signingBonus: 5, exitTurn: 0 },
  { id: "cand-vale", name: "Marcus Vale", specialty: "enterprise", skill: 6, salaryPerQuarter: 0.85, signingBonus: 3, exitTurn: 0 },
  { id: "cand-wei", name: "Li Wei", specialty: "reasoning", skill: 8, salaryPerQuarter: 1.4, signingBonus: 8, exitTurn: 0 },
  { id: "cand-ortega", name: "Camila Ortega", specialty: "consumer", skill: 5, salaryPerQuarter: 0.6, signingBonus: 2, exitTurn: 0 },
  { id: "cand-mbaye", name: "Darius Mbaye", specialty: "coding", skill: 6, salaryPerQuarter: 0.8, signingBonus: 3.5, exitTurn: 0 },
  { id: "cand-larsen", name: "Ida Larsen", specialty: "reasoning", skill: 5, salaryPerQuarter: 0.55, signingBonus: 1.5, exitTurn: 0 },
  { id: "cand-tan", name: "Keiko Tan", specialty: "enterprise", skill: 7, salaryPerQuarter: 1.0, signingBonus: 4.5, exitTurn: 0 },
  { id: "cand-sato", name: "Rafael Sato", specialty: "consumer", skill: 6, salaryPerQuarter: 0.75, signingBonus: 2.5, exitTurn: 0 },
  { id: "cand-haddad", name: "Sofia Haddad", specialty: "coding", skill: 9, salaryPerQuarter: 1.8, signingBonus: 12, exitTurn: 0 },
  { id: "cand-park", name: "Owen Park", specialty: "reasoning", skill: 4, salaryPerQuarter: 0.45, signingBonus: 1, exitTurn: 0 },
  { id: "cand-njeri", name: "Laila Njeri", specialty: "enterprise", skill: 5, salaryPerQuarter: 0.6, signingBonus: 1.8, exitTurn: 0 },
  { id: "cand-aronov", name: "Viktor Aronov", specialty: "coding", skill: 8, salaryPerQuarter: 1.5, signingBonus: 9, exitTurn: 0 },
  { id: "cand-oduro", name: "Grace Oduro", specialty: "consumer", skill: 7, salaryPerQuarter: 0.95, signingBonus: 4, exitTurn: 0 },
  { id: "cand-kim", name: "Nora Kim", specialty: "reasoning", skill: 6, salaryPerQuarter: 0.85, signingBonus: 3, exitTurn: 0 },
];
