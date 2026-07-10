"use client";

import { Modal } from "./Modal";
import { useGameStore } from "@/lib/store/gameStore";
import { ERA_BRIEFINGS } from "@/lib/engine/content";
import type { GameState } from "@/lib/engine/types";

export function EraBriefingModal({ game }: { game: GameState }) {
  const dismissEraBriefing = useGameStore(s => s.dismissEraBriefing);
  if (game.pendingEraBriefing === null || game.pendingEraBriefing === 1) return null;
  const briefing = ERA_BRIEFINGS[game.pendingEraBriefing];
  return (
    <Modal title={`Era ${game.pendingEraBriefing} — ${briefing.title}`}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          {briefing.body}
        </p>
        <div className="flex justify-end">
          <button className="btn btn-primary" data-testid="era-continue" onClick={dismissEraBriefing}>
            Begin the era
          </button>
        </div>
      </div>
    </Modal>
  );
}
