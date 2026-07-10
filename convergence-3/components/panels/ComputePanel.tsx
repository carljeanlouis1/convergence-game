"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { totalCapacityPF, committedRunPF, allocatedPF } from "@/lib/engine/compute";
import { selectActiveRuns } from "@/lib/store/selectors";
import type { ComputeAllocation, GameState } from "@/lib/engine/types";

const SEGMENTS: Array<{ key: keyof ComputeAllocation; label: string; color: string; hint: string }> = [
  { key: "inference", label: "Inference serving", color: "var(--green)", hint: "earns revenue once a model is deployed" },
  { key: "experiments", label: "Research experiments", color: "var(--amber)", hint: "feeds future technique unlocks" },
  { key: "safety", label: "Safety evals", color: "#7ab8f5", hint: "builds eval capacity for capability gates" },
];

export function ComputePanel({ game }: { game: GameState }) {
  const allocate = useGameStore(s => s.allocate);
  const [draft, setDraft] = useState<ComputeAllocation>(game.allocation);
  useEffect(() => setDraft(game.allocation), [game.turn, game.allocation]);

  const capacity = totalCapacityPF(game);
  const committed = committedRunPF(game);
  const draftTotal = committed + allocatedPF(draft);
  const over = draftTotal > capacity;
  const dirty =
    draft.inference !== game.allocation.inference ||
    draft.experiments !== game.allocation.experiments ||
    draft.safety !== game.allocation.safety;
  const runs = selectActiveRuns(game);

  return (
    <div className="rise-in space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">Compute</h1>
        <p className="micro-label mt-1">
          {capacity} PF capacity · {committed} PF locked in runs · {Math.max(0, capacity - draftTotal)} PF free
        </p>
      </div>

      {/* capacity bar */}
      <div className="h-4 rounded overflow-hidden flex border" style={{ background: "var(--bg-sunken)" }}>
        {committed > 0 && (
          <div
            className="h-full shrink-0"
            style={{
              width: `${(committed / capacity) * 100}%`,
              background:
                "repeating-linear-gradient(45deg, var(--ink-faint) 0 4px, transparent 4px 8px)",
            }}
            title={`${committed} PF locked in active runs`}
          />
        )}
        {SEGMENTS.map(seg => (
          <div
            key={seg.key}
            className="h-full shrink-0 transition-all"
            style={{ width: `${(draft[seg.key] / capacity) * 100}%`, background: seg.color, opacity: 0.75 }}
          />
        ))}
      </div>
      {runs.length > 0 && (
        <p className="micro-label">
          locked: {runs.map(r => `${r.name} (${r.computePerTurn} PF)`).join(" · ")}
        </p>
      )}

      <div className="panel-card divide-y">
        {SEGMENTS.map(seg => (
          <div key={seg.key} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ color: seg.color }}>{seg.label}</div>
              <div className="micro-label mt-0.5">{seg.hint}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn px-2.5"
                onClick={() => setDraft({ ...draft, [seg.key]: Math.max(0, draft[seg.key] - 2) })}
              >
                −
              </button>
              <span className="stat-num w-14 text-center text-sm">{draft[seg.key]} PF</span>
              <button
                className="btn px-2.5"
                onClick={() => setDraft({ ...draft, [seg.key]: draft[seg.key] + 2 })}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: over ? "var(--red)" : "var(--ink-faint)" }}>
          {over ? `over capacity by ${(draftTotal - capacity).toFixed(0)} PF` : dirty ? "unapplied changes" : "allocation applied"}
        </span>
        <button className="btn btn-primary" disabled={over || !dirty} onClick={() => allocate(draft)} data-testid="apply-allocation">
          Apply allocation
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label">facilities</h2>
        <div className="panel-card divide-y">
          {game.facilities.map(f => (
            <div key={f.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span>{f.name}</span>
              <span className="stat-num micro-label">{f.capacityPF} PF · online</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
