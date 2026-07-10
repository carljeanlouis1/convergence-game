"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { selectActiveRuns } from "@/lib/store/selectors";
import type { GameState, TrainingRun } from "@/lib/engine/types";
import { BALANCE } from "@/lib/engine/balance";
import { RunDesigner } from "@/components/modals/RunDesigner";
import { freePF } from "@/lib/engine/compute";

function BandChip({ band }: { band: TrainingRun["checkpoints"][number]["band"] }) {
  return (
    <span className={`band-${band} text-xs uppercase tracking-widest border rounded px-2 py-0.5`} style={{ borderColor: "currentcolor" }}>
      {band}
    </span>
  );
}

const BAND_Y: Record<TrainingRun["checkpoints"][number]["band"], number> = {
  ahead: 3,
  "on-track": 8,
  wobbly: 14,
  troubled: 19,
};

function LossSparkline({ run }: { run: TrainingRun }) {
  if (run.checkpoints.length === 0) return null;
  const pts = run.checkpoints.map((cp, i) => ({
    x: 6 + (i * 108) / Math.max(1, run.checkpoints.length - 1 || 1),
    y: BAND_Y[cp.band],
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];
  const worried = run.checkpoints[run.checkpoints.length - 1].band;
  const color = worried === "troubled" ? "var(--red)" : worried === "wobbly" ? "var(--orange)" : "var(--green)";
  return (
    <svg viewBox="0 0 120 22" className="w-28 h-5 shrink-0" aria-label="checkpoint trend">
      <line x1="0" y1="8" x2="120" y2="8" stroke="var(--border)" strokeDasharray="2 3" strokeWidth="0.75" />
      {pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="1.5" />}
      <circle cx={last.x} cy={last.y} r="2.2" fill={color} />
    </svg>
  );
}

function RunCard({ run }: { run: TrainingRun }) {
  const decideRun = useGameStore(s => s.decideRun);
  const latest = run.checkpoints[run.checkpoints.length - 1];
  const needsCall = latest && (latest.band === "wobbly" || latest.band === "troubled");
  const tier = BALANCE.runTiers[run.scaleTier];
  const boostCost = run.computePerTurn * tier.costPerPFTurn * (BALANCE.run.boostCostMultiplier - 1);
  return (
    <div className="panel-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base">{run.name}</h3>
          <p className="micro-label mt-0.5">
            tier {run.scaleTier} · quarter {run.turnsElapsed}/{run.turnsTotal} · {run.computePerTurn} PF committed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LossSparkline run={run} />
          {latest ? <BandChip band={latest.band} /> : <span className="micro-label">no checkpoint yet</span>}
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${(run.turnsElapsed / run.turnsTotal) * 100}%`,
            background: needsCall ? "var(--orange)" : "var(--amber)",
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="micro-label stat-num">${run.spentToDate.toFixed(1)}M spent to date</span>
        {latest && <span className="text-xs italic" style={{ color: "var(--ink-faint)" }}>{latest.note}</span>}
      </div>
      {needsCall && (
        <div className="flex gap-2 pt-1 border-t">
          <button className="btn" onClick={() => decideRun(run.id, "push")}>
            Push through
          </button>
          <button className="btn" onClick={() => decideRun(run.id, "boost")}>
            Boost (+${boostCost.toFixed(1)}M)
          </button>
          <button className="btn btn-danger" onClick={() => decideRun(run.id, "scrap")}>
            Scrap
          </button>
        </div>
      )}
    </div>
  );
}

export function RunsPanel({ game }: { game: GameState }) {
  const [designing, setDesigning] = useState(false);
  const startFrontierProject = useGameStore(s => s.startFrontierProject);
  const active = selectActiveRuns(game);
  const history = game.runs.filter(r => r.status !== "active");
  const frontiers = game.frontierProjects.filter(p => p.status !== "locked");
  return (
    <div className="rise-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight">Training Runs</h1>
          <p className="micro-label mt-1">commit compute · sweat the checkpoints · ship or scrap</p>
        </div>
        <button className="btn btn-primary" data-testid="design-run" onClick={() => setDesigning(true)}>
          Design run
        </button>
      </div>

      {active.length === 0 && (
        <div className="panel-card p-5 text-sm" style={{ color: "var(--ink-dim)" }}>
          No active runs. The cluster is idle — and idle compute is money burning without a bet on the table.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {active.map(r => (
          <RunCard key={r.id} run={r} />
        ))}
      </div>

      {frontiers.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label" style={{ color: "var(--amber)" }}>
            applied frontiers — point the AGI at a domain
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {frontiers.map(p => (
              <div key={p.id} className="panel-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold">{p.name}</h3>
                  <span
                    className="micro-label uppercase"
                    style={{
                      color:
                        p.status === "completed" ? "var(--green)" : p.status === "active" ? "var(--amber)" : "var(--ink-dim)",
                    }}
                  >
                    {p.status === "active" ? `${p.turnsLeft} qtrs left` : p.status}
                  </span>
                </div>
                {p.status === "available" && (
                  <>
                    <p className="micro-label">
                      $80M upfront · {p.computePerTurn} PF committed · 6 quarters
                    </p>
                    <button
                      className="btn"
                      disabled={game.capital < 80 || freePF(game) < p.computePerTurn}
                      onClick={() => startFrontierProject(p.id)}
                    >
                      {game.capital < 80 ? "Can't afford" : freePF(game) < p.computePerTurn ? "Not enough compute" : "Begin"}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="micro-label">history</h2>
          <div className="panel-card divide-y">
            {history.map(r => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span
                  className="stat-num text-xs uppercase tracking-widest"
                  style={{
                    color:
                      r.status === "completed" ? "var(--green)" : r.status === "failed" ? "var(--red)" : "var(--ink-faint)",
                  }}
                >
                  {r.status} · ${r.spentToDate.toFixed(1)}M
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {designing && <RunDesigner game={game} onClose={() => setDesigning(false)} />}
    </div>
  );
}
