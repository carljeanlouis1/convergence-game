"use client";

import { selectTopBar } from "@/lib/store/selectors";
import type { GameState } from "@/lib/engine/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-1.5 border-r last:border-r-0 shrink-0">
      <span className="micro-label whitespace-nowrap">{label}</span>
      <span
        className="stat-num text-sm font-medium whitespace-nowrap"
        style={tone === "amber" ? { color: "var(--amber)" } : tone === "red" ? { color: "var(--red)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function TopBar({ game }: { game: GameState }) {
  const t = selectTopBar(game);
  const lowRunway = t.runwayText !== "∞" && parseInt(t.runwayText) < 9;
  return (
    <header className="flex items-center border-b bg-[var(--bg-sunken)] sticky top-0 z-30">
      <div className="px-4 py-2 border-r shrink-0 hidden md:block">
        <div className="font-display font-black text-base leading-none tracking-tight">
          CONVERGENCE<span style={{ color: "var(--amber)" }}>_3</span>
        </div>
        <div className="micro-label mt-0.5">frontier lab console</div>
      </div>
      <div className="flex overflow-x-auto">
        <Stat label="Quarter" value={t.turnText} tone="amber" />
        <Stat label="Capital" value={`$${t.capital.toFixed(1)}M`} />
        <Stat label="Runway" value={t.runwayText} tone={lowRunway ? "red" : undefined} />
        <Stat label="Compute" value={t.freePFText} />
        <Stat label="Trust" value={`${Math.round(t.trust)}`} />
        <Stat label="Morale" value={`${Math.round(game.morale)}`} />
        <Stat label="Board" value={`${Math.round(t.board)}`} tone={t.board <= 25 ? "red" : undefined} />
      </div>
    </header>
  );
}
