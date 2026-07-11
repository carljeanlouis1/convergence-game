import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createInitialState, v2Defaults, v3Defaults, v4Defaults } from "@/lib/engine/state";
import { setAllocation } from "@/lib/engine/compute";
import { launchRun, applyRunDecision } from "@/lib/engine/runs";
import { deployModel } from "@/lib/engine/deploy";
import { advanceTurn } from "@/lib/engine/turn";
import { hireCandidate, respondToPoach } from "@/lib/engine/talent";
import { acceptFunding, openRound } from "@/lib/engine/funding";
import { resolveDilemma } from "@/lib/engine/events";
import { startBuild } from "@/lib/engine/facilities";
import { startFrontier } from "@/lib/engine/frontiers";
import type { FrontierId } from "@/lib/engine/types";
import type {
  ComputeAllocation,
  GameState,
  Positioning,
  Pricing,
  RunDecisionKind,
  RunDesign,
} from "@/lib/engine/types";

interface GameStore {
  game: GameState | null;
  lastError: string | null;
  lastOutcome: string | null;
  inMenu: boolean;
  newGame: (seed: string) => void;
  endTurn: () => void;
  allocate: (alloc: ComputeAllocation) => void;
  launch: (design: RunDesign) => void;
  decideRun: (runId: string, decision: RunDecisionKind) => void;
  deploy: (modelId: string, positioning: Positioning, pricing?: Pricing) => void;
  dismissRelease: () => void;
  hire: (candidateId: string) => void;
  respondPoach: (starId: string, response: "match" | "equity" | "decline") => void;
  acceptOffer: (offerId: string) => void;
  raiseRound: () => void;
  toMenu: () => void;
  continueGame: () => void;
  setActiveGame: (game: GameState) => void;
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
  if (g.version !== 1 && g.version !== 2 && g.version !== 3 && g.version !== 4) return { game: null };
  if (g.version === 1) {
    g = backfill({ ...g, version: 2, stars: g.stars.map(s => ({ ...s, burnout: s.burnout ?? 0 })) }, v2Defaults());
  }
  if (g.version === 2) {
    g = backfill({ ...g, version: 3 }, v3Defaults());
  }
  if (g.version === 3) {
    g = backfill(
      {
        ...g,
        version: 4,
        stats: { ...g.stats, crowns: g.stats.crowns ?? [] },
        models: g.models.map(m => ({
          ...m,
          lifetimeRevenue: m.lifetimeRevenue ?? 0,
          pricing: m.pricing ?? (m.positioning ? "standard" : null),
          releaseRank: m.releaseRank ?? null,
        })),
        revenueStreams: g.revenueStreams.map(r => ({ ...r, pricing: r.pricing ?? "standard" })),
      },
      v4Defaults(),
    );
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
      inMenu: false,
      newGame: seed => set({ game: createInitialState(seed), lastError: null, lastOutcome: null, inMenu: false }),
      toMenu: () => set({ inMenu: true }),
      continueGame: () => set({ inMenu: false }),
      setActiveGame: game => set({ game, lastError: null, lastOutcome: null, inMenu: false }),
      endTurn: () => act(set, get, advanceTurn),
      allocate: alloc => act(set, get, g => setAllocation(g, alloc)),
      launch: design => act(set, get, g => launchRun(g, design)),
      decideRun: (runId, decision) => act(set, get, g => applyRunDecision(g, runId, decision)),
      deploy: (modelId, positioning, pricing) =>
        act(set, get, g => ({
          ...deployModel(g, modelId, positioning, pricing),
          pendingRelease: g.pendingRelease === modelId ? null : g.pendingRelease,
        })),
      dismissRelease: () => act(set, get, g => ({ ...g, pendingRelease: null })),
      hire: candidateId => act(set, get, g => hireCandidate(g, candidateId)),
      respondPoach: (starId, response) => act(set, get, g => respondToPoach(g, starId, response)),
      acceptOffer: offerId => act(set, get, g => acceptFunding(g, offerId)),
      raiseRound: () => act(set, get, openRound),
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
      abandonGame: () => set({ game: null, lastError: null, lastOutcome: null, inMenu: false }),
    }),
    {
      name: "convergence3-save",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ game: s.game }),
      migrate: migrateSnapshot,
      // Defense in depth: migrate regardless of the wrapper version. Saves written when the
      // persist version lagged the game version (v1 wrapper, v2/v3 game) skip `migrate`
      // because the versions match — this guarantees the game shape is current anyway.
      merge: (persisted, current) => ({ ...current, ...migrateSnapshot(persisted) }),
    },
  ),
);
