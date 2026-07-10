import { BALANCE } from "./balance";
import { freePF } from "./compute";
import { bestDeployedAvg } from "./rivals";
import type { FrontierId, GameState } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function checkAgi(state: GameState): GameState {
  let s = state;
  if (s.stats.agiTurn === null && bestDeployedAvg(s) >= BALANCE.frontiers.agiThreshold) {
    s = {
      ...s,
      stats: { ...s.stats, agiTurn: s.turn },
      chronicle: [
        ...s.chronicle,
        { turn: s.turn, kind: "world", text: "AGI. The models are doing the research now." },
      ],
    };
  }
  if (s.era === 4 && s.stats.agiTurn !== null && s.frontierProjects.some(p => p.status === "locked")) {
    s = {
      ...s,
      frontierProjects: s.frontierProjects.map(p => (p.status === "locked" ? { ...p, status: "available" as const } : p)),
    };
  }
  return s;
}

export function startFrontier(state: GameState, id: FrontierId): GameState {
  const project = state.frontierProjects.find(p => p.id === id);
  if (!project || project.status !== "available") throw new Error("frontier not available");
  if (state.capital < BALANCE.frontiers.projectCostM) throw new Error("insufficient capital");
  if (freePF(state) < project.computePerTurn) throw new Error("insufficient free compute");
  return {
    ...state,
    capital: state.capital - BALANCE.frontiers.projectCostM,
    frontierProjects: state.frontierProjects.map(p => (p.id === id ? { ...p, status: "active" as const } : p)),
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "world", text: `${project.name} begins — pointing AGI at a domain and holding on.` },
    ],
  };
}

export function frontiersTurn(state: GameState): { state: GameState; lines: string[] } {
  const lines: string[] = [];
  let revenueStreams = state.revenueStreams;
  let trust = state.trust;
  let chronicle = state.chronicle;
  const frontierProjects = state.frontierProjects.map(p => {
    if (p.status !== "active") return p;
    const turnsLeft = p.turnsLeft - 1;
    if (turnsLeft > 0) return { ...p, turnsLeft };
    revenueStreams = [
      ...revenueStreams,
      { source: `Frontier: ${p.name}`, amountPerTurn: BALANCE.frontiers.payoffRevenue, decayPerTurn: 0 },
    ];
    trust = clamp(trust + BALANCE.frontiers.payoffTrust);
    chronicle = [
      ...chronicle,
      { turn: state.turn, kind: "world" as const, text: `${p.name} is real. The world is different now.` },
    ];
    lines.push(`${p.name} completed — the payoff is civilizational (and $${BALANCE.frontiers.payoffRevenue}M/qtr).`);
    return { ...p, turnsLeft: 0, status: "completed" as const };
  });
  return { state: { ...state, frontierProjects, revenueStreams, trust, chronicle }, lines };
}
