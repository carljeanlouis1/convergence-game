"use client";

import { useGameStore } from "@/lib/store/gameStore";
import {
  payrollPerTurn,
  computeUpkeepPerTurn,
  runSpendPerTurn,
  revenuePerTurn,
  burnPerTurn,
  runwayMonths,
} from "@/lib/engine/finance";
import { projectedDeployRevenue } from "@/lib/engine/deploy";
import { selectUndeployedModels } from "@/lib/store/selectors";
import type { GameState, Positioning } from "@/lib/engine/types";

const POSITIONINGS: Array<{ id: Positioning; label: string; note: string }> = [
  { id: "api", label: "API", note: "steady, decays to fast-follow" },
  { id: "enterprise", label: "Enterprise", note: "highest revenue, decays" },
  { id: "consumer", label: "Consumer", note: "modest, decays" },
  { id: "open-weights", label: "Open weights", note: "tiny but permanent" },
];

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between text-sm">
      <span style={{ color: "var(--ink-dim)" }}>{label}</span>
      <span className="stat-num" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

export function FinancePanel({ game }: { game: GameState }) {
  const deploy = useGameStore(s => s.deploy);
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
                value={`$${r.amountPerTurn.toFixed(1)}M`}
                tone="var(--green)"
              />
            ))}
          </div>
        </div>
      </div>

      {undeployed.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label" style={{ color: "var(--amber)" }}>
            undeployed models — position them
          </h2>
          {undeployed.map(m => {
            const avg =
              (m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer) / 4;
            return (
              <div key={m.id} className="panel-card p-4 space-y-3 pulse-amber">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold">{m.name}</h3>
                  <span className="micro-label stat-num">
                    cod {m.capability.coding.toFixed(0)} · rsn {m.capability.reasoning.toFixed(0)} · ent{" "}
                    {m.capability.enterprise.toFixed(0)} · con {m.capability.consumer.toFixed(0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {POSITIONINGS.map(p => (
                    <button key={p.id} className="btn text-left normal-case tracking-normal p-2.5" onClick={() => deploy(m.id, p.id)}>
                      <span className="block font-bold uppercase text-xs tracking-widest">{p.label}</span>
                      <span className="block stat-num mt-1" style={{ color: "var(--green)" }}>
                        +${projectedDeployRevenue(avg, p.id).toFixed(1)}M/qtr
                      </span>
                      <span className="block micro-label mt-0.5">{p.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
