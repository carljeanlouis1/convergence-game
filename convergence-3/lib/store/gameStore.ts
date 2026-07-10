import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createInitialState } from "@/lib/engine/state";
import { setAllocation } from "@/lib/engine/compute";
import { launchRun, applyRunDecision } from "@/lib/engine/runs";
import { deployModel } from "@/lib/engine/deploy";
import { advanceTurn } from "@/lib/engine/turn";
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
  newGame: (seed: string) => void;
  endTurn: () => void;
  allocate: (alloc: ComputeAllocation) => void;
  launch: (design: RunDesign) => void;
  decideRun: (runId: string, decision: RunDecisionKind) => void;
  deploy: (modelId: string, positioning: Positioning) => void;
  abandonGame: () => void;
}

export function migrateSnapshot(persisted: unknown): { game: GameState | null } {
  const p = persisted as { game?: GameState } | undefined;
  if (p && p.game && p.game.version === 1) return { game: p.game };
  return { game: null };
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
      newGame: seed => set({ game: createInitialState(seed), lastError: null }),
      endTurn: () => act(set, get, advanceTurn),
      allocate: alloc => act(set, get, g => setAllocation(g, alloc)),
      launch: design => act(set, get, g => launchRun(g, design)),
      decideRun: (runId, decision) => act(set, get, g => applyRunDecision(g, runId, decision)),
      deploy: (modelId, positioning) => act(set, get, g => deployModel(g, modelId, positioning)),
      abandonGame: () => set({ game: null, lastError: null }),
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
