import type { Star, Technique, Facility, Rival, Candidate, DilemmaDef } from "./types";

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

export const DILEMMAS: DilemmaDef[] = [
  {
    id: "pentagon-proposal",
    era: 1,
    title: "The Pentagon Proposal",
    body:
      "A defense agency wants your model for logistics and intelligence analysis. The contract is enormous, the work is classified, and half your team found out before you did. The other half is drafting a petition.",
    options: [
      {
        id: "sign",
        label: "Sign the contract",
        note: "≈ +$40M now. Trust and morale will pay for it.",
        outcomes: [
          { chance: 0.7, text: "The money lands quietly. The petition dies. The unease doesn't.", deltas: { capital: 40, trust: -8, morale: -10 } },
          { chance: 0.3, text: "It leaks the same week. 'AI LAB ARMS THE PENTAGON' writes itself.", deltas: { capital: 40, trust: -16, morale: -14, boardConfidence: 4 } },
        ],
      },
      {
        id: "decline",
        label: "Decline publicly",
        note: "No money. The team will remember you chose them.",
        outcomes: [
          { chance: 0.8, text: "The team rallies. Recruiters start mentioning your name in a good way.", deltas: { morale: 12, trust: 6, boardConfidence: -6 } },
          { chance: 0.2, text: "The board calls it 'leaving nine figures on principle.' They're not wrong.", deltas: { morale: 10, trust: 4, boardConfidence: -12 } },
        ],
      },
      {
        id: "carve",
        label: "Negotiate a narrow carve-out",
        note: "Smaller check, defensive-only uses, everyone slightly unhappy.",
        outcomes: [
          { chance: 0.6, text: "Logistics-only, audited quarterly. Nobody protests. Nobody celebrates.", deltas: { capital: 18, trust: -3, morale: -3 } },
          { chance: 0.4, text: "The carve-out holds until a subcontractor tests the boundary. Cleanup is expensive.", deltas: { capital: 18, trust: -8, incidentRisk: 6 } },
        ],
      },
    ],
  },
  {
    id: "poach-retaliation",
    era: 1,
    title: "An Eye for an Eye",
    body:
      "Velocity Systems just gutted a rival's infra team with nine-figure packages, and their own post-training lead quietly asked your recruiter to lunch. Raiding back feels good. It also starts a war you might not win.",
    options: [
      {
        id: "raid",
        label: "Make the counter-raid",
        note: "≈ -$15M in packages; your rivals learn you bite back.",
        outcomes: [
          { chance: 0.6, text: "You land their post-training lead. Velocity's next release slips a quarter.", deltas: { capital: -15, teamStrength: 5, morale: 6 } },
          { chance: 0.4, text: "They match, keep their lead, and now your own stars know their market price.", deltas: { capital: -15, morale: -4 } },
        ],
      },
      {
        id: "fortify",
        label: "Spend it on your own people instead",
        note: "≈ -$10M in retention grants. Nobody leaves this year.",
        outcomes: [
          { chance: 0.85, text: "Quiet raises, vesting cliffs smoothed. The lunch invitations stop getting answered.", deltas: { capital: -10, morale: 10 } },
          { chance: 0.15, text: "It reads as fear. One recruiter forwards your retention memo to a journalist.", deltas: { capital: -10, morale: 4, trust: -4 } },
        ],
      },
    ],
  },
  {
    id: "open-source-petition",
    era: 1,
    title: "The Open Letter, Internal Edition",
    body:
      "Forty researchers signed a memo asking you to open-weight last quarter's model. 'We didn't join a SaaS company.' Your enterprise customers, who pay for exclusivity, have opinions too.",
    options: [
      {
        id: "release",
        label: "Open-weight it",
        note: "Revenue takes a permanent haircut; the mission crowd loves you.",
        outcomes: [
          { chance: 0.75, text: "The release trends for a week. Three great researchers apply citing it.", deltas: { morale: 14, trust: 8, capital: -8 } },
          { chance: 0.25, text: "A fine-tune of your own weights undercuts your API within a month.", deltas: { morale: 10, trust: 5, capital: -18 } },
        ],
      },
      {
        id: "refuse",
        label: "Hold the line",
        note: "The business survives; some idealism doesn't.",
        outcomes: [
          { chance: 0.7, text: "Grumbling, then quiet. The direct deposits continue.", deltas: { morale: -8, boardConfidence: 6 } },
          { chance: 0.3, text: "Two signatories resign with a pointed Medium post.", deltas: { morale: -12, teamStrength: -3, boardConfidence: 6 } },
        ],
      },
      {
        id: "partial",
        label: "Release the previous generation instead",
        note: "A peace offering: old weights, new goodwill.",
        outcomes: [
          { chance: 0.8, text: "Honor mostly satisfied. The community builds on it; nobody churns.", deltas: { morale: 6, trust: 5 } },
          { chance: 0.2, text: "'Openness theater,' says the memo's author, publicly.", deltas: { morale: -2, trust: 2 } },
        ],
      },
    ],
  },
  {
    id: "benchmark-contamination",
    era: 1,
    title: "The Contaminated Benchmark",
    body:
      "An intern found chunks of a headline eval set inside your pretraining data. Your last release's benchmark scores — the ones in the fundraising deck — are inflated. Nobody outside the lab knows.",
    options: [
      {
        id: "disclose",
        label: "Disclose and re-run everything",
        note: "Public correction, real numbers, a rough quarter with the board.",
        outcomes: [
          { chance: 0.7, text: "The correction stings, then becomes a case study in doing it right.", deltas: { trust: 10, boardConfidence: -10 } },
          { chance: 0.3, text: "A rival's marketing team frames it as fraud-adjacent for a full news cycle.", deltas: { trust: 4, boardConfidence: -14, morale: -4 } },
        ],
      },
      {
        id: "bury",
        label: "Fix the pipeline quietly",
        note: "No headlines today. A landmine in the data forever.",
        outcomes: [
          { chance: 0.6, text: "The next model is cleanly trained. The old scores stay on the website.", deltas: { incidentRisk: 8 } },
          { chance: 0.4, text: "The intern's Slack message is one screenshot away from the press. It gets there.", deltas: { trust: -18, boardConfidence: -8, incidentRisk: 4 } },
        ],
      },
    ],
  },
  {
    id: "power-crunch",
    era: 1,
    title: "The Grid Says No",
    body:
      "The utility is curtailing your datacenter's allocation for the summer — heat waves and a governor with an election. Your active training runs need every megawatt you no longer have.",
    options: [
      {
        id: "premium",
        label: "Buy merchant power at any price",
        note: "≈ -$20M. The runs never notice.",
        outcomes: [
          { chance: 0.8, text: "Diesel bridges and spot-market power. Ugly, loud, effective.", deltas: { capital: -20 } },
          { chance: 0.2, text: "It works, and a photo of the generator farm goes modestly viral.", deltas: { capital: -20, trust: -6 } },
        ],
      },
      {
        id: "throttle",
        label: "Throttle the cluster at peak hours",
        note: "Free, but the team works nights and the schedule slips.",
        outcomes: [
          { chance: 0.65, text: "Runs stretch, tempers fray, nothing breaks.", deltas: { morale: -8, teamStrength: -2 } },
          { chance: 0.35, text: "A checkpoint corrupts during a brownout. Weeks of work, gone.", deltas: { morale: -12, teamStrength: -3, capital: -6 } },
        ],
      },
    ],
  },
  {
    id: "viral-jailbreak-close-call",
    era: 1,
    title: "The One That Didn't Ship",
    body:
      "Two days before launch, a red-teamer finds a jailbreak that walks your new model into genuinely dangerous territory in four prompts. Marketing has already sent the embargoed press kit.",
    options: [
      {
        id: "delay",
        label: "Pull the launch",
        note: "Public delay, private relief. The board hates surprises.",
        outcomes: [
          { chance: 0.8, text: "Three weeks late, properly patched. The red-teamer gets a bonus and a bigger team.", deltas: { boardConfidence: -8, trust: 8, morale: 4 } },
          { chance: 0.2, text: "A rival ships the same week you were supposed to. The delay reads as weakness.", deltas: { boardConfidence: -12, trust: 6 } },
        ],
      },
      {
        id: "patch",
        label: "Hotfix quietly and ship on time",
        note: "The patch covers the known exploit. Known is doing a lot of work.",
        outcomes: [
          { chance: 0.55, text: "Launch lands. The exploit class stays quiet. You got away with it.", deltas: { boardConfidence: 5, incidentRisk: 8 } },
          { chance: 0.45, text: "A variant of the exploit surfaces on launch day+3, with receipts.", deltas: { trust: -10, incidentRisk: 12 } },
        ],
      },
    ],
  },
  {
    id: "acquihire-feeler",
    era: 1,
    title: "A Very Friendly Coffee",
    body:
      "A hyperscaler's corp-dev lead 'happens to be in town.' The number floated over coffee would make everyone rich and your lab a division. The board would like you to at least hear them out.",
    options: [
      {
        id: "entertain",
        label: "Take the meetings",
        note: "Optionality for the board; a signal — to everyone — that you might sell.",
        outcomes: [
          { chance: 0.6, text: "Diligence drags on. The board enjoys the leverage. The team notices the lawyers.", deltas: { boardConfidence: 10, control: -4, morale: -6 } },
          { chance: 0.4, text: "The feeler leaks. Recruiters circle your unsettled staff for a month.", deltas: { boardConfidence: 8, control: -4, morale: -10 } },
        ],
      },
      {
        id: "refuse",
        label: "Decline before dessert",
        note: "Mission clarity, board friction.",
        outcomes: [
          { chance: 0.75, text: "'We're not for sale' becomes the all-hands applause line of the year.", deltas: { morale: 10, boardConfidence: -8 } },
          { chance: 0.25, text: "Two directors wanted that option open. They start counting your mistakes.", deltas: { morale: 8, boardConfidence: -12 } },
        ],
      },
    ],
  },
  {
    id: "whistleblower-memo",
    era: 1,
    title: "The Memo",
    body:
      "An internal memo — 'Safety corners we cut this year, a list' — is in a reporter's inbox. It's accurate. The reporter wants comment by Friday.",
    options: [
      {
        id: "own-it",
        label: "Get ahead of it",
        note: "≈ -$8M in remediation you announce yourself. Painful, credible.",
        outcomes: [
          { chance: 0.75, text: "You publish the list with fixes attached. The story becomes the response.", deltas: { capital: -8, trust: 9, morale: 5, boardConfidence: -4 } },
          { chance: 0.25, text: "The follow-up asks why it took a leak. Fair.", deltas: { capital: -8, trust: 3, boardConfidence: -6 } },
        ],
      },
      {
        id: "lawyer-up",
        label: "Deny, delay, litigate",
        note: "Maybe it dies. Maybe you become the story.",
        outcomes: [
          { chance: 0.5, text: "The story runs thin without confirmation and fades.", deltas: { boardConfidence: 6, morale: -6, trust: -4 } },
          { chance: 0.5, text: "The full memo publishes, annotated with your denial.", deltas: { trust: -15, morale: -10, boardConfidence: -6, incidentRisk: 6 } },
        ],
      },
    ],
  },
];
