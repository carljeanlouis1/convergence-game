"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import {
  payrollPerTurn,
  computeUpkeepPerTurn,
  runSpendPerTurn,
  revenuePerTurn,
  burnPerTurn,
  runwayMonths,
  streamYield,
} from "@/lib/engine/finance";
import { selectUndeployedModels } from "@/lib/store/selectors";
import { ModelCard } from "@/components/ui/ModelCard";
import { DeployModal } from "@/components/modals/DeployModal";
import type { GameState } from "@/lib/engine/types";

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between text-sm">
      <span style={{ color: "var(--ink-dim)" }}>{label}</span>
      <span className="stat-num" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

export function FinancePanel({ game }: { game: GameState }) {
  const acceptOffer = useGameStore(s => s.acceptOffer);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const deployingModel = deployingId ? game.models.find(m => m.id === deployingId) : null;
  const deployed = game.models.filter(m => m.positioning !== null);
  const revenue = revenuePerTurn(game);
  const burn = burnPerTurn(game);
  const net = revenue - burn;
  const runway = runwayMonths(game);
  const undeployed = selectUndeployedModels(game);

  return (
    <div className="rise-in space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">Finance</h1>
        <p className="micro-label mt-1">quarterly ledger · projected forward</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="panel-card p-4">
          <span className="micro-label block">net / qtr</span>
          <span className="font-display font-black text-xl stat-num" style={{ color: net >= 0 ? "var(--green)" : "var(--red)" }}>
            {net >= 0 ? "+" : ""}${net.toFixed(1)}M
          </span>
        </div>
        <div className="panel-card p-4">
          <span className="micro-label block">capital</span>
          <span className="font-display font-black text-xl stat-num">${game.capital.toFixed(1)}M</span>
        </div>
        <div className="panel-card p-4">
          <span className="micro-label block">runway</span>
          <span
            className="font-display font-black text-xl stat-num"
            style={{ color: runway !== Infinity && runway < 9 ? "var(--red)" : "var(--ink)" }}
          >
            {runway === Infinity ? "∞" : runway > 99 ? "99+mo" : `${runway.toFixed(0)}mo`}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <h2 className="micro-label">burn ${burn.toFixed(1)}M / qtr</h2>
          <div className="panel-card divide-y">
            <Row label="Payroll" value={`$${payrollPerTurn(game).toFixed(1)}M`} />
            <Row label="Compute upkeep" value={`$${computeUpkeepPerTurn(game).toFixed(1)}M`} />
            <Row label="Training runs" value={`$${runSpendPerTurn(game).toFixed(1)}M`} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="micro-label">revenue ${revenue.toFixed(1)}M / qtr</h2>
          <div className="panel-card divide-y">
            {game.revenueStreams.length === 0 && (
              <Row label="No revenue yet" value="ship a model" tone="var(--ink-faint)" />
            )}
            {game.revenueStreams.map((r, i) => (
              <Row
                key={i}
                label={`${r.source}${r.decayPerTurn > 0 ? ` (−${(r.decayPerTurn * 100).toFixed(0)}%/qtr)` : ""}`}
                value={`$${streamYield(game, r).toFixed(1)}M`}
                tone="var(--green)"
              />
            ))}
          </div>
        </div>
      </div>

      {game.fundingOffers.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label" style={{ color: "var(--amber)" }}>
            open term sheets — every term is on the table
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {game.fundingOffers.map(o => (
              <div key={o.id} className="panel-card p-4 space-y-2">
                <h3 className="font-display font-bold uppercase text-xs tracking-widest">{o.kind}</h3>
                <div className="micro-label space-y-1">
                  <div>
                    cash <span className="stat-num" style={{ color: "var(--green)" }}>+${o.amountM.toFixed(0)}M</span>
                  </div>
                  <div>
                    control <span className="stat-num" style={{ color: "var(--red)" }}>−{o.controlCost}</span>
                  </div>
                  <div>board {o.boardDelta >= 0 ? `+${o.boardDelta}` : o.boardDelta} · trust{" "}
                    {o.trustDelta >= 0 ? `+${o.trustDelta}` : o.trustDelta}</div>
                  {o.computeGrantPF > 0 && (
                    <div style={{ color: "var(--amber)" }}>+{o.computeGrantPF} PF partner compute</div>
                  )}
                  <div>expires {o.expiresTurn - game.turn <= 0 ? "this quarter" : `in ${o.expiresTurn - game.turn} qtr(s)`}</div>
                </div>
                <button className="btn btn-primary w-full" onClick={() => acceptOffer(o.id)}>
                  Sign it
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {undeployed.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label" style={{ color: "var(--amber)" }}>
            undeployed models — position them
          </h2>
          {undeployed.map(m => (
            <ModelCard
              key={m.id}
              game={game}
              model={m}
              action={
                <button className="btn btn-primary w-full" onClick={() => setDeployingId(m.id)}>
                  Position this model
                </button>
              }
            />
          ))}
        </div>
      )}

      {deployed.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label">the fleet — every model you ever shipped</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[...deployed].reverse().map(m => (
              <ModelCard key={m.id} game={game} model={m} />
            ))}
          </div>
        </div>
      )}

      {deployingModel && (
        <DeployModal game={game} model={deployingModel} onClose={() => setDeployingId(null)} />
      )}
    </div>
  );
}
