"use client";

import { Modal } from "./Modal";
import { revenuePerTurn, burnPerTurn } from "@/lib/engine/finance";
import { selectActiveRuns, selectUndeployedModels } from "@/lib/store/selectors";
import { turnLabel } from "@/lib/engine/turn";
import type { GameState } from "@/lib/engine/types";

export function EndTurnSummary({
  game,
  onConfirm,
  onCancel,
}: {
  game: GameState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const runs = selectActiveRuns(game);
  const undeployed = selectUndeployedModels(game);
  const net = revenuePerTurn(game) - burnPerTurn(game);
  const a = game.allocation;

  return (
    <Modal title={`Close ${turnLabel(game.turn)}?`} onClose={onCancel}>
      <div className="space-y-4">
        <div className="panel-card divide-y" style={{ background: "var(--bg-sunken)" }}>
          <div className="px-4 py-2.5 flex justify-between text-sm">
            <span style={{ color: "var(--ink-dim)" }}>Projected net</span>
            <span className="stat-num" style={{ color: net >= 0 ? "var(--green)" : "var(--red)" }}>
              {net >= 0 ? "+" : ""}${net.toFixed(1)}M
            </span>
          </div>
          <div className="px-4 py-2.5 flex justify-between text-sm">
            <span style={{ color: "var(--ink-dim)" }}>Committed runs</span>
            <span className="stat-num">
              {runs.length === 0 ? "none" : runs.map(r => `${r.name} (${r.computePerTurn} PF)`).join(", ")}
            </span>
          </div>
          <div className="px-4 py-2.5 flex justify-between text-sm">
            <span style={{ color: "var(--ink-dim)" }}>Allocation</span>
            <span className="stat-num">
              inf {a.inference} · exp {a.experiments} · safety {a.safety} PF
            </span>
          </div>
        </div>

        {undeployed.length > 0 && (
          <p className="text-sm" style={{ color: "var(--orange)" }}>
            ⚠ {undeployed.map(m => m.name).join(", ")} finished training but {undeployed.length === 1 ? "is" : "are"} not
            deployed — sitting on a shelf earning nothing.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Hold on
          </button>
          <button className="btn btn-primary" data-testid="confirm-end-turn" onClick={onConfirm}>
            Close the quarter
          </button>
        </div>
      </div>
    </Modal>
  );
}
