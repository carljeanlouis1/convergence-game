"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { TopBar } from "./TopBar";
import { NavRail, type PanelId } from "./NavRail";
import { BriefingPanel } from "@/components/panels/BriefingPanel";
import { RunsPanel } from "@/components/panels/RunsPanel";
import { ComputePanel } from "@/components/panels/ComputePanel";
import { FinancePanel } from "@/components/panels/FinancePanel";
import { EndTurnSummary } from "@/components/modals/EndTurnSummary";
import { DebriefModal } from "@/components/modals/DebriefModal";

function StartScreen() {
  const newGame = useGameStore(s => s.newGame);
  const [seed, setSeed] = useState("");
  return (
    <main
      data-testid="start-screen"
      className="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 text-center"
    >
      <div className="rise-in">
        <p className="micro-label mb-3">a frontier lab survival strategy game</p>
        <h1 className="font-display font-black text-5xl md:text-7xl tracking-tighter leading-none">
          CONVERGENCE<span style={{ color: "var(--amber)" }}>_3</span>
        </h1>
        <p className="mt-4 max-w-md mx-auto text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          $120M in seed money. 40 petaflops. Four researchers. Twelve years to the singularity — yours, or somebody
          else&apos;s.
        </p>
      </div>
      <div className="rise-in flex flex-col items-center gap-3" style={{ animationDelay: "140ms" }}>
        <input
          value={seed}
          onChange={e => setSeed(e.target.value)}
          placeholder="world seed (optional)"
          className="bg-[var(--bg-sunken)] border rounded px-3 py-2 text-sm text-center outline-none focus:border-[var(--amber)] w-64"
        />
        <button
          className="btn btn-primary px-8 py-3 text-sm"
          data-testid="found-lab"
          onClick={() => newGame(seed.trim() || `lab-${Math.random().toString(36).slice(2, 10)}`)}
        >
          Found the lab
        </button>
      </div>
    </main>
  );
}

export function GameShell() {
  const game = useGameStore(s => s.game);
  const lastError = useGameStore(s => s.lastError);
  const endTurn = useGameStore(s => s.endTurn);
  const [panel, setPanel] = useState<PanelId>("briefing");
  const [confirming, setConfirming] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (lastError) {
      setErrorVisible(true);
      const t = setTimeout(() => setErrorVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [lastError]);

  if (!mounted) return null;
  if (!game) return <StartScreen />;

  const confirmEndTurn = () => {
    setConfirming(false);
    endTurn();
    setDebriefOpen(true);
    setPanel("briefing");
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar game={game} />
      <div className="flex flex-1">
        <NavRail active={panel} onChange={setPanel} />
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6">
          {panel === "briefing" && <BriefingPanel game={game} />}
          {panel === "runs" && <RunsPanel game={game} />}
          {panel === "compute" && <ComputePanel game={game} />}
          {panel === "finance" && <FinancePanel game={game} />}
        </main>
      </div>

      {!game.ended && (
        <button
          className="btn btn-primary fixed bottom-16 md:bottom-6 right-4 md:right-6 z-30 px-6 py-3 shadow-lg"
          data-testid="end-turn"
          onClick={() => setConfirming(true)}
        >
          End turn ▸
        </button>
      )}

      {confirming && <EndTurnSummary game={game} onConfirm={confirmEndTurn} onCancel={() => setConfirming(false)} />}
      {debriefOpen && game.lastDebrief && (
        <DebriefModal debrief={game.lastDebrief} onClose={() => setDebriefOpen(false)} />
      )}

      {errorVisible && lastError && (
        <div
          data-testid="error-toast"
          className="fixed top-16 right-4 z-50 panel-card px-4 py-3 text-sm rise-in"
          style={{ borderColor: "var(--red)", color: "var(--red)" }}
          onClick={() => setErrorVisible(false)}
        >
          {lastError}
        </div>
      )}
    </div>
  );
}
