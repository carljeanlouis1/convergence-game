"use client";

import { Modal } from "./Modal";
import { useGameStore } from "@/lib/store/gameStore";
import { getDilemmaDef } from "@/lib/engine/events";
import type { GameState } from "@/lib/engine/types";

export function DilemmaModal({ game }: { game: GameState }) {
  const resolveActiveDilemma = useGameStore(s => s.resolveActiveDilemma);
  const lastOutcome = useGameStore(s => s.lastOutcome);
  const clearOutcome = useGameStore(s => s.clearOutcome);

  // outcome view: shown after the roll, closes on continue
  if (lastOutcome) {
    return (
      <Modal title="The consequences">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">{lastOutcome}</p>
          <div className="flex justify-end">
            <button className="btn btn-primary" data-testid="dilemma-continue" onClick={clearOutcome}>
              Continue
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!game.activeDilemma) return null;
  const def = getDilemmaDef(game.activeDilemma.defId);

  return (
    <Modal title={def.title}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          {def.body}
        </p>
        <div className="space-y-2">
          {def.options.map(o => (
            <button
              key={o.id}
              className="btn w-full text-left normal-case tracking-normal p-3"
              data-testid={`dilemma-option-${o.id}`}
              onClick={() => resolveActiveDilemma(o.id)}
            >
              <span className="block font-bold uppercase text-xs tracking-widest">{o.label}</span>
              <span className="block micro-label mt-1 normal-case">{o.note}</span>
            </button>
          ))}
        </div>
        <p className="micro-label">this can&apos;t wait — the quarter doesn&apos;t close until you decide</p>
      </div>
    </Modal>
  );
}
