"use client";

import { trajectory } from "@/lib/engine/endings";
import type { GameState } from "@/lib/engine/types";

export function CompassPanel({ game }: { game: GameState }) {
  const entries = trajectory(game);
  const victories = entries.filter(e => e.victory);
  const defeats = entries.filter(e => !e.victory);

  return (
    <div className="rise-in space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">The Compass</h1>
        <p className="micro-label mt-1">every ending is visible · you steer toward one on purpose</p>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label" style={{ color: "var(--green)" }}>ways to win</h2>
        <div className="panel-card divide-y">
          {victories.map(e => (
            <div key={e.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm">{e.label}</span>
                <span className="stat-num micro-label">{e.hidden ? "" : `${(e.progress * 100).toFixed(0)}%`}</span>
              </div>
              {e.hidden ? (
                <p className="micro-label italic">Some endings are found, not planned.</p>
              ) : (
                <>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
                    <div className="h-full" style={{ width: `${e.progress * 100}%`, background: "var(--green)" }} />
                  </div>
                  <p className="micro-label">{e.pull}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="micro-label" style={{ color: "var(--red)" }}>ways to lose</h2>
        <div className="panel-card divide-y">
          {defeats.map(e => (
            <div key={e.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm">{e.label}</span>
                <span className="stat-num micro-label" style={e.progress > 0.5 ? { color: "var(--red)" } : undefined}>
                  {(e.progress * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
                <div className="h-full" style={{ width: `${e.progress * 100}%`, background: "var(--red)" }} />
              </div>
              <p className="micro-label">{e.pull}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
