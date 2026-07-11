"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { totalCapacityPF, committedRunPF, allocatedPF } from "@/lib/engine/compute";
import { availableBuilds, buildCost, builtCount } from "@/lib/engine/facilities";
import { capabilityTier, requiredEvalFor, riskBandLabel } from "@/lib/engine/safety";
import { modelAvg } from "@/lib/engine/deploy";
import { BALANCE } from "@/lib/engine/balance";
import { selectActiveRuns } from "@/lib/store/selectors";
import type { ComputeAllocation, GameState } from "@/lib/engine/types";

const F = BALANCE.finance;
const EX = BALANCE.experiments;
const SF = BALANCE.safety;

function bestDeployedAvg(game: GameState): number {
  const deployed = game.models.filter(m => m.positioning !== null);
  return deployed.length ? Math.max(...deployed.map(m => modelAvg(m.capability))) : 0;
}

/** The concrete, live effect of each allocation slice — transparency law. */
function effectFor(key: keyof ComputeAllocation, pf: number, game: GameState): { text: string; color: string } {
  if (key === "inference") {
    const bestAvg = bestDeployedAvg(game);
    if (bestAvg === 0) return { text: "deploy a model to earn from inference", color: "var(--ink-faint)" };
    const rev = pf * F.inferenceRevenuePerPF * (bestAvg / 100);
    return { text: `+$${rev.toFixed(1)}M/qtr serving revenue`, color: "var(--green)" };
  }
  if (key === "experiments") {
    const nextMomentum = Math.min(EX.momentumCap, game.researchMomentum * (1 - EX.momentumDecay) + pf * EX.momentumPerPF);
    const bonus = nextMomentum * EX.momentumQualityWeight;
    return { text: `momentum → ${nextMomentum.toFixed(0)} · +${bonus.toFixed(0)} quality on your next run`, color: "var(--amber)" };
  }
  // safety
  const nextEval = game.evalCapacity * (1 - SF.evalDecay) + pf * SF.evalPerSafetyPF;
  const tier = capabilityTier(game);
  const need = requiredEvalFor(tier);
  const cleared = nextEval >= need;
  return {
    text: `eval capacity → ${nextEval.toFixed(0)} · ${cleared ? `Tier ${tier} clear` : `Tier ${tier} needs ${need}`}`,
    color: cleared ? "#7ab8f5" : "var(--orange)",
  };
}

const SEGMENTS: Array<{ key: keyof ComputeAllocation; label: string; color: string }> = [
  { key: "inference", label: "Inference serving", color: "var(--green)" },
  { key: "experiments", label: "Research experiments", color: "var(--amber)" },
  { key: "safety", label: "Safety evals", color: "#7ab8f5" },
];

export function ComputePanel({ game }: { game: GameState }) {
  const allocate = useGameStore(s => s.allocate);
  const build = useGameStore(s => s.build);
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
  const building = game.builds.length > 0;

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
              background: "repeating-linear-gradient(45deg, var(--ink-faint) 0 4px, transparent 4px 8px)",
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
        <p className="micro-label">locked: {runs.map(r => `${r.name} (${r.computePerTurn} PF)`).join(" · ")}</p>
      )}

      <div className="panel-card divide-y">
        {SEGMENTS.map(seg => {
          const eff = effectFor(seg.key, draft[seg.key], game);
          return (
            <div key={seg.key} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: seg.color }}>{seg.label}</div>
                <div className="micro-label mt-0.5" style={{ color: eff.color }}>{eff.text}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn px-2.5" onClick={() => setDraft({ ...draft, [seg.key]: Math.max(0, draft[seg.key] - 2) })}>
                  −
                </button>
                <span className="stat-num w-14 text-center text-sm">{draft[seg.key]} PF</span>
                <button className="btn px-2.5" onClick={() => setDraft({ ...draft, [seg.key]: draft[seg.key] + 2 })}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: over ? "var(--red)" : "var(--ink-faint)" }}>
          {over ? `over capacity by ${(draftTotal - capacity).toFixed(0)} PF` : dirty ? "unapplied changes" : "allocation applied"}
        </span>
        <button className="btn btn-primary" disabled={over || !dirty} onClick={() => allocate(draft)} data-testid="apply-allocation">
          Apply allocation
        </button>
      </div>

      <div className="panel-card p-4 flex flex-wrap gap-x-8 gap-y-2" style={{ background: "var(--bg-sunken)" }}>
        <div>
          <span className="micro-label block">research momentum</span>
          <span className="font-display font-bold stat-num" style={{ color: "var(--amber)" }}>
            {game.researchMomentum.toFixed(0)}
          </span>
        </div>
        <div>
          <span className="micro-label block">eval capacity</span>
          <span className="font-display font-bold stat-num">{game.evalCapacity.toFixed(0)}</span>
        </div>
        <div>
          <span className="micro-label block">tier {capabilityTier(game)} requires</span>
          <span className="font-display font-bold stat-num">{requiredEvalFor(capabilityTier(game))}</span>
        </div>
        <div>
          <span className="micro-label block">incident risk</span>
          <span
            className="font-display font-bold"
            style={{
              color:
                riskBandLabel(game) === "low" ? "var(--green)" : riskBandLabel(game) === "elevated" ? "var(--orange)" : "var(--red)",
            }}
          >
            {riskBandLabel(game)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label">facilities</h2>
        <div className="panel-card divide-y">
          {game.facilities.map(f => (
            <div key={f.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span>{f.name}</span>
              <span className="stat-num micro-label">
                {f.capacityPF.toFixed(0)} PF · {f.onlineTurn <= game.turn ? "online" : "coming online"}
              </span>
            </div>
          ))}
          {game.builds.map(b => (
            <div key={b.optionId} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span style={{ color: "var(--amber)" }}>{b.name}</span>
              <span className="stat-num micro-label" style={{ color: "var(--amber)" }}>
                +{b.capacityPF} PF in {b.turnsLeft} qtr{b.turnsLeft === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label" style={{ color: "var(--amber)" }}>
          expand capacity {building && "· one build at a time — a facility is under construction"}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {availableBuilds(game).map(o => {
            const cost = buildCost(game, o);
            const owned = builtCount(game, o.id);
            const affordable = game.capital >= cost;
            return (
              <div key={o.id} className="panel-card p-4 space-y-2">
                <div>
                  <h3 className="font-display font-bold">
                    {o.name}
                    {owned > 0 && <span className="micro-label ml-2">· owned {owned}</span>}
                  </h3>
                  <p className="micro-label mt-0.5">
                    +{o.capacityPF} PF · ${cost}M · {o.turns} qtrs
                    {o.trustDelta !== 0 && ` · trust ${o.trustDelta > 0 ? "+" : ""}${o.trustDelta}`}
                    {owned > 0 && " · price rises each time"}
                  </p>
                </div>
                <p className="text-xs italic" style={{ color: "var(--ink-faint)" }}>{o.note}</p>
                <button className="btn" disabled={!affordable || building} onClick={() => build(o.id)}>
                  {building ? "Build in progress" : affordable ? "Break ground" : "Can't afford"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
