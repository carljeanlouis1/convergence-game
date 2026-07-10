"use client";

import { useRef } from "react";
import { selectTopBar } from "@/lib/store/selectors";
import type { GameState } from "@/lib/engine/types";

function Stat({
  label,
  value,
  tone,
  trend,
}: {
  label: string;
  value: string;
  tone?: "amber" | "red";
  trend?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-1.5 border-r last:border-r-0 shrink-0">
      <span className="micro-label whitespace-nowrap">{label}</span>
      <span
        className="stat-num text-sm font-medium whitespace-nowrap"
        style={tone === "amber" ? { color: "var(--amber)" } : tone === "red" ? { color: "var(--red)" } : undefined}
      >
        {value}
        {trend !== undefined && trend !== 0 && (
          <span
            className="ml-1 text-[9px] align-middle"
            style={{ color: trend > 0 ? "var(--green)" : "var(--red)" }}
          >
            {trend > 0 ? "▲" : "▼"}
          </span>
        )}
      </span>
    </div>
  );
}

export function TopBar({ game }: { game: GameState }) {
  const t = selectTopBar(game);
  const lowRunway = t.runwayText !== "∞" && parseInt(t.runwayText) < 9;
  // last-quarter snapshot for trend arrows (cosmetic, client-only)
  const prevRef = useRef<{ turn: number; capital: number; trust: number; morale: number; board: number } | null>(null);
  const shown = useRef<{ capital: number; trust: number; morale: number; board: number }>({ capital: 0, trust: 0, morale: 0, board: 0 });
  if (prevRef.current === null) {
    prevRef.current = { turn: game.turn, capital: game.capital, trust: game.trust, morale: game.morale, board: game.boardConfidence };
  } else if (prevRef.current.turn !== game.turn) {
    shown.current = {
      capital: game.capital - prevRef.current.capital,
      trust: game.trust - prevRef.current.trust,
      morale: game.morale - prevRef.current.morale,
      board: game.boardConfidence - prevRef.current.board,
    };
    prevRef.current = { turn: game.turn, capital: game.capital, trust: game.trust, morale: game.morale, board: game.boardConfidence };
  }
  const d = shown.current;
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
        <Stat label="Capital" value={`$${t.capital.toFixed(1)}M`} trend={d.capital} />
        <Stat label="Runway" value={t.runwayText} tone={lowRunway ? "red" : undefined} />
        <Stat label="Compute" value={t.freePFText} />
        <Stat label="Trust" value={`${Math.round(t.trust)}`} trend={d.trust} />
        <Stat label="Morale" value={`${Math.round(game.morale)}`} trend={d.morale} />
        <Stat label="Board" value={`${Math.round(t.board)}`} tone={t.board <= 25 ? "red" : undefined} trend={d.board} />
      </div>
    </header>
  );
}
