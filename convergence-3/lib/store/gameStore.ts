import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createInitialState, v2Defaults, v3Defaults } from "@/lib/engine/state";
import { setAllocation } from "@/lib/engine/compute";
import { launchRun, applyRunDecision } from "@/lib/engine/runs";
import { deployModel } from "@/lib/engine/deploy";
import { advanceTurn } from "@/lib/engine/turn";
import { hireCandidate, respondToPoach } from "@/lib/engine/talent";
import { acceptFunding } from "@/lib/engine/funding";
import { resolveDilemma } from "@/lib/engine/events";
import { startBuild } from "@/lib/engine/facilities";
import { startFrontier } from "@/lib/engine/frontiers";
import type { FrontierId } from "@/lib/engine/types";
import type {
  ComputeAllocation,
  GameState,
  Positioning,
  RunDecisionKind,
  RunDesign,
} from "@/lib/engine/types";

interface GameStore {
  game: GameState | null;
  lastError: string | null;
  lastOutcome: string | null;
  newGame: (seed: string) => void;
  endTurn: () => void;
  allocate: (alloc: ComputeAllocation) => void;
  launch: (design: RunDesign) => void;
  decideRun: (runId: string, decision: RunDecisionKind) => void;
  deploy: (modelId: string, positioning: Positioning) => void;
  hire: (candidateId: string) => void;
  respondPoach: (starId: string, response: "match" | "equity" | "decline") => void;
  acceptOffer: (offerId: string) => void;
  resolveActiveDilemma: (optionId: string) => void;
  clearOutcome: () => void;
  build: (optionId: string) => void;
  startFrontierProject: (id: FrontierId) => void;
  dismissEraBriefing: () => void;
  abandonGame: () => void;
}

const META_KEY = "convergence3-meta";

export function getEndingsSeen(): Array<{ id: string; grade: string; pyrrhic: boolean }> {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function recordEnding(result: { id: string; grade: string; pyrrhic: boolean }): void {
  if (typeof window === "undefined") return;
  const seen = getEndingsSeen();
  if (!seen.some(e => e.id === result.id && e.grade === result.grade)) {
    localStorage.setItem(META_KEY, JSON.stringify([...seen, result]));
  }
}

function backfill(g: GameState, defaults: Partial<GameState>): GameState {
  return {
    ...g,
    ...Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, (g as unknown as Record<string, unknown>)[k] ?? v]),
    ),
  } as GameState;
}

export function migrateSnapshot(persisted: unknown): { game: GameState | null } {
  const p = persisted as { game?: GameState } | undefined;
  if (!p || !p.game) return { game: null };
  let g = p.game;
  if (g.version !== 1 && g.version !== 2 && g.version !== 3) return { game: null };
  if (g.version === 1) {
    g = backfill({ ...g, version: 2, stars: g.stars.map(s => ({ ...s, burnout: s.burnout ?? 0 })) }, v2Defaults());
  }
  if (g.version === 2) {
    g = backfill({ ...g, version: 3 }, v3Defaults());
  }
  return { game: g };
}

function act(
  set: (p: Partial<GameStore>) => void,
  get: () => GameStore,
  fn: (g: GameState) => GameState,
) {
  const game = get().game;
  if (!game) return;
  try {
    set({ game: fn(game), lastError: null });
  } catch (e) {
    set({ lastError: e instanceof Error ? e.message : String(e) });
  }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      lastError: null,
      lastOutcome: null,
      newGame: seed => set({ game: createInitialState(seed), lastError: null, lastOutcome: null }),
      endTurn: () => act(set, get, advanceTurn),
      allocate: alloc => act(set, get, g => setAllocation(g, alloc)),
      launch: design => act(set, get, g => launchRun(g, design)),
      decideRun: (runId, decision) => act(set, get, g => applyRunDecision(g, runId, decision)),
      deploy: (modelId, positioning) => act(set, get, g => deployModel(g, modelId, positioning)),
      hire: candidateId => act(set, get, g => hireCandidate(g, candidateId)),
      respondPoach: (starId, response) => act(set, get, g => respondToPoach(g, starId, response)),
      acceptOffer: offerId => act(set, get, g => acceptFunding(g, offerId)),
      resolveActiveDilemma: optionId => {
        const game = get().game;
        if (!game) return;
        try {
          const { state, outcomeText } = resolveDilemma(game, optionId);
          set({ game: state, lastError: null, lastOutcome: outcomeText });
        } catch (e) {
          set({ lastError: e instanceof Error ? e.message : String(e) });
        }
      },
      clearOutcome: () => set({ lastOutcome: null }),
      build: optionId => act(set, get, g => startBuild(g, optionId)),
      startFrontierProject: id => act(set, get, g => startFrontier(g, id)),
      dismissEraBriefing: () => act(set, get, g => ({ ...g, pendingEraBriefing: null })),
      abandonGame: () => set({ game: null, lastError: null, lastOutcome: null }),
    }),
    {
      name: "convergence3-save",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ game: s.game }),
      migrate: migrateSnapshot,
    },
  ),
);
