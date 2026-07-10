"use client";

import { useGameStore } from "@/lib/store/gameStore";
import { selectRoster } from "@/lib/store/selectors";
import { BALANCE } from "@/lib/engine/balance";
import type { GameState } from "@/lib/engine/types";

const BURNOUT_COLOR = { fresh: "var(--green)", strained: "var(--orange)", critical: "var(--red)" };

export function TalentPanel({ game }: { game: GameState }) {
  const hire = useGameStore(s => s.hire);
  const respondPoach = useGameStore(s => s.respondPoach);
  const roster = selectRoster(game);
  const offers = game.poachOffers.filter(o => o.expiresTurn !== -1);

  return (
    <div className="rise-in space-y-5">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">Talent</h1>
        <p className="micro-label mt-1">a few people matter a lot · everyone is poachable</p>
      </div>

      {offers.map(o => {
        const star = game.stars.find(s => s.id === o.starId);
        const rival = game.rivals.find(r => r.id === o.rivalId);
        if (!star || !rival) return null;
        const matchCost = o.packageM * BALANCE.talent.matchCostFactor;
        return (
          <div key={o.starId} className="panel-card p-4 space-y-3 pulse-amber" style={{ borderColor: "var(--orange)" }}>
            <p className="text-sm">
              <span style={{ color: "var(--orange)" }}>Poaching raid:</span> {rival.name} offered{" "}
              <span className="stat-num font-bold">${o.packageM.toFixed(0)}M</span> for{" "}
              <span className="font-bold">{star.name}</span>. Expires{" "}
              {o.expiresTurn - game.turn <= 0 ? "this quarter" : `in ${o.expiresTurn - game.turn} quarter(s)`}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => respondPoach(o.starId, "match")}>
                Match — ${matchCost.toFixed(1)}M + raise
              </button>
              <button className="btn" onClick={() => respondPoach(o.starId, "equity")}>
                Counter with equity — {BALANCE.talent.equityControlCost} control
              </button>
              <button className="btn btn-danger" onClick={() => respondPoach(o.starId, "decline")}>
                Let them walk
              </button>
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        <h2 className="micro-label">roster · morale {game.morale}/100</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {roster.map(s => (
            <div key={s.id} className="panel-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold">{s.name}</h3>
                  <p className="micro-label mt-0.5">
                    {s.specialty} · skill {s.skill} · ${s.salaryPerQuarter.toFixed(2)}M/qtr
                  </p>
                </div>
                {s.leadingRun && (
                  <span className="micro-label border rounded px-2 py-0.5" style={{ color: "var(--amber)", borderColor: "var(--amber)" }}>
                    leading {s.leadingRun}
                  </span>
                )}
              </div>
              <div>
                <div className="flex justify-between micro-label mb-1">
                  <span>burnout</span>
                  <span style={{ color: BURNOUT_COLOR[s.burnoutBand] }}>{s.burnoutBand}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${s.burnout}%`, background: BURNOUT_COLOR[s.burnoutBand] }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label">the market</h2>
        {game.market.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Nobody good is looking right now. The market moves every quarter.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {game.market.map(c => {
            const affordable = game.capital >= c.signingBonus;
            return (
              <div key={c.id} className="panel-card p-4 space-y-2">
                <div>
                  <h3 className="font-display font-bold">{c.name}</h3>
                  <p className="micro-label mt-0.5">
                    {c.specialty} · skill {c.skill} · asks ${c.salaryPerQuarter.toFixed(2)}M/qtr
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="stat-num text-xs" style={{ color: "var(--ink-dim)" }}>
                    signing bonus ${c.signingBonus.toFixed(1)}M
                  </span>
                  <button className="btn" disabled={!affordable} onClick={() => hire(c.id)}>
                    {affordable ? "Hire" : "Can't afford"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
