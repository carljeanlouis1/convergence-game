"use client";

import { useEffect, useState } from "react";
import { useGameStore, getEndingsSeen, recordEnding } from "@/lib/store/gameStore";
import { selectAlerts } from "@/lib/store/selectors";
import { CompassPanel } from "@/components/panels/CompassPanel";
import { EraBriefingModal } from "@/components/modals/EraBriefingModal";
import type { EndingResult } from "@/lib/engine/types";
import { TopBar } from "./TopBar";
import { NavRail, type PanelId } from "./NavRail";
import { BriefingPanel } from "@/components/panels/BriefingPanel";
import { RunsPanel } from "@/components/panels/RunsPanel";
import { ComputePanel } from "@/components/panels/ComputePanel";
import { TalentPanel } from "@/components/panels/TalentPanel";
import { RaceBoardPanel } from "@/components/panels/RaceBoardPanel";
import { FinancePanel } from "@/components/panels/FinancePanel";
import { EndTurnSummary } from "@/components/modals/EndTurnSummary";
import { DebriefModal } from "@/components/modals/DebriefModal";
import { DilemmaModal } from "@/components/modals/DilemmaModal";
import { CodexModal } from "@/components/modals/CodexModal";
import { SaveSlots } from "@/components/ui/SaveSlots";
import { ReleaseDayModal } from "@/components/modals/ReleaseDayModal";

function StartScreen() {
  const newGame = useGameStore(s => s.newGame);
  const game = useGameStore(s => s.game);
  const continueGame = useGameStore(s => s.continueGame);
  const [seed, setSeed] = useState("");
  const endingsSeen = getEndingsSeen();
  return (
    <main
      data-testid="start-screen"
      className="min-h-dvh w-full overflow-x-hidden flex flex-col items-center justify-center gap-8 p-6 text-center"
    >
      <div className="rise-in max-w-full">
        <p className="micro-label mb-3">a frontier lab survival strategy game</p>
        <h1 className="font-display font-black text-[min(3.4rem,9.5vw)] md:text-7xl tracking-tighter leading-none">
          CONVERGENCE<span style={{ color: "var(--amber)" }}>_3</span>
        </h1>
        <p className="mt-4 max-w-md mx-auto text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          $120M in seed money. 40 petaflops. Four researchers. Twelve years to the singularity — yours, or somebody
          else&apos;s.
        </p>
      </div>
      {game && !game.ended && (
        <button
          className="btn btn-primary px-10 py-3 text-sm rise-in"
          data-testid="continue-game"
          onClick={continueGame}
        >
          Continue — {`${2026 + Math.floor((game.turn - 1) / 4)} Q${((game.turn - 1) % 4) + 1}`} · ${game.capital.toFixed(0)}M
        </button>
      )}
      <div className="rise-in flex flex-col items-center gap-3" style={{ animationDelay: "140ms" }}>
        <input
          value={seed}
          onChange={e => setSeed(e.target.value)}
          placeholder="world seed (optional)"
          className="bg-[var(--bg-sunken)] border rounded px-3 py-2 text-sm text-center outline-none focus:border-[var(--amber)] w-64"
        />
        <button
          className={game ? "btn px-8 py-3 text-sm" : "btn btn-primary px-8 py-3 text-sm"}
          data-testid="found-lab"
          title={game ? "starts fresh — save the current game to a slot first if you want to keep it" : undefined}
          onClick={() => newGame(seed.trim() || `lab-${Math.random().toString(36).slice(2, 10)}`)}
        >
          {game ? "Found a new lab" : "Found the lab"}
        </button>
      </div>
      <div className="rise-in" style={{ animationDelay: "200ms" }}>
        <SaveSlots />
      </div>
      {endingsSeen.length > 0 && (
        <div className="rise-in flex flex-wrap justify-center gap-2 max-w-md" style={{ animationDelay: "260ms" }}>
          <span className="micro-label w-full text-center">endings witnessed</span>
          {endingsSeen.map((e, i) => (
            <span key={i} className="micro-label border rounded px-2 py-1">
              {e.id.replace(/-/g, " ")} · {e.grade}
              {e.pyrrhic ? " · pyrrhic" : ""}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}

const ENDING_COPY: Record<string, { title: string; body: string }> = {
  ousted: {
    title: "OUSTED",
    body: "The board fired you overnight, and nobody threatened to walk. The lab continues — under new management. You read about its releases in the press like everyone else.",
  },
  absorbed: {
    title: "ABSORBED",
    body: "Out of money, out of credibility, out of options. The acquihire closed on a Tuesday. Your lab is now the AI division of a company that mostly sells ads.",
  },
  irrelevant: {
    title: "IRRELEVANT",
    body: "No dramatic collapse. Just quarter after quarter of the world moving on without you — the stars leaving for winners, the customers not renewing, the papers citing someone else. Eventually the lights just... stayed off.",
  },
  catastrophe: {
    title: "CATASTROPHE",
    body: "Three incidents was two too many. The last one wasn't a scandal — it was a hearing, then an injunction, then agents at the datacenter. History will remember your lab as the cautionary tale the regulations are named after.",
  },
  "enterprise-titan": {
    title: "ENTERPRISE TITAN",
    body: "Profitable. Independent. A thousand companies run on your models and pay you for the privilege. You never held the benchmark crown for long — you built something rarer: a frontier lab that pays for itself.",
  },
  "frontier-crown": {
    title: "THE FRONTIER CROWN",
    body: "Across an entire era, nobody touched you. Every leaderboard, every category, every quarter — your models at the top while rivals burned fortunes trying to close a gap that kept widening. Leads are rented, they said. You bought the building.",
  },
  "the-standard": {
    title: "THE STANDARD",
    body: "You gave it away, and that decision ate the world. Your weights run on phones in Lagos, servers in Jakarta, laptops in every graduate program on Earth. There is no moat. There is no revenue to speak of. There is only the fact that the substrate of the machine age has your name in its license file.",
  },
  "the-conscience": {
    title: "THE CONSCIENCE",
    body: "You never topped the leaderboard. Instead, you wrote the rules everyone else races under — your evals, your framework, your definition of safe. The race got faster every year, and every year it bent a little further toward the shape you drew.",
  },
  "beneficial-asi": {
    title: "BENEFICIAL ASI",
    body: "The threshold was crossed carefully, publicly, with the world's trust intact and the alignment work actually done. What comes after this quarter isn't a game anyone plays — it's a future everyone lives in. It's good. You checked.",
  },
  transcendence: {
    title: "TRANSCENDENCE",
    body: "Robots that labor, cures that ship, materials that shouldn't exist, engines pointed at the sky. You stopped competing with labs and started competing with scarcity itself. The shareholders wanted a company. You gave them a civilization.",
  },
  "simulation-revelation": {
    title: "THE REVELATION",
    body: "The world model was too good. Somewhere in the seventh training epoch it stopped predicting reality and started rendering it — and the checksums... the checksums match. You kept it quiet, kept it closed, ran the evals three times. The simulation isn't a product. It's the room you're standing in.",
  },
  figurehead: {
    title: "FIGUREHEAD",
    body: "You still have the badge, the parking spot, the title on the door. What you don't have is a single decision. Round after round, counter after counter, you traded the company away in fifteen-point increments — and the board noticed before you did. They kept you on. You test well with the press.",
  },
  "open-road": {
    title: "THE OPEN ROAD",
    body: "Twelve years. The lab survived every quarter of them — through the raids and the coups and the shocks — without ever quite forcing history's hand. The race goes on without a winner. Maybe that was the point.",
  },
};

function EndingScreen({ ending, turn, result }: { ending: string; turn: number; result: EndingResult | null }) {
  const abandonGame = useGameStore(s => s.abandonGame);
  useEffect(() => {
    if (result) recordEnding({ id: result.id, grade: result.grade, pyrrhic: result.pyrrhic });
  }, [result]);
  const c = ENDING_COPY[ending] ?? { title: ending.toUpperCase(), body: "The run is over." };
  const victory = result?.victory ?? false;
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rise-in max-w-md">
        <p className="micro-label mb-3">your run ended · quarter {turn}</p>
        <h1
          className="font-display font-black text-4xl md:text-5xl tracking-tighter title-in"
          style={{ color: victory ? "var(--green)" : "var(--red)" }}
        >
          {c.title}
        </h1>
        {result?.pyrrhic && (
          <p className="micro-label mt-2" style={{ color: "var(--orange)" }}>
            — the golden cage: you won, and it cost you the company you meant to build
          </p>
        )}
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          {c.body}
        </p>
        {result && (
          <div className="mt-6">
            <span className="micro-label block mb-3">final grade</span>
            <span
              className="stamp-in inline-block font-display font-black text-6xl border-4 rounded-lg px-5 py-1"
              style={{
                color: victory ? "var(--green)" : "var(--ink-dim)",
                borderColor: "currentcolor",
                textShadow: victory ? "0 0 30px rgba(143,218,69,0.4)" : undefined,
              }}
            >
              {result.grade}
            </span>
          </div>
        )}
      </div>
      <button className="btn btn-primary px-8 py-3" onClick={abandonGame}>
        Found another lab
      </button>
    </main>
  );
}

export function GameShell() {
  const game = useGameStore(s => s.game);
  const lastError = useGameStore(s => s.lastError);
  const endTurn = useGameStore(s => s.endTurn);
  const [panel, setPanel] = useState<PanelId>("briefing");
  const [confirming, setConfirming] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const inMenu = useGameStore(st => st.inMenu);
  const toMenu = useGameStore(st => st.toMenu);
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
  if (!game || inMenu) return <StartScreen />;
  if (game.ended && game.ending) {
    return <EndingScreen ending={game.ending} turn={game.turn} result={game.endingResult} />;
  }

  const alerts = selectAlerts(game);
  const dilemmaOpen = alerts.dilemmaOpen;

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
        <NavRail
          active={panel}
          onChange={setPanel}
          badges={{
            talent: alerts.poachCount > 0,
            finance: alerts.offerCount > 0 || alerts.undeployedCount > 0,
            briefing: dilemmaOpen,
          }}
        />
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6">
          {panel === "briefing" && <BriefingPanel game={game} onNavigate={setPanel} />}
          {panel === "runs" && <RunsPanel game={game} />}
          {panel === "compute" && <ComputePanel game={game} />}
          {panel === "talent" && <TalentPanel game={game} />}
          {panel === "race" && <RaceBoardPanel game={game} />}
          {panel === "finance" && <FinancePanel game={game} />}
          {panel === "compass" && <CompassPanel game={game} />}
        </main>
      </div>

      {!game.ended && (
        <button
          className="btn btn-primary fixed bottom-16 md:bottom-6 right-4 md:right-6 z-30 px-6 py-3 shadow-lg"
          data-testid="end-turn"
          disabled={dilemmaOpen}
          title={dilemmaOpen ? "Resolve the dilemma first" : undefined}
          onClick={() => setConfirming(true)}
        >
          {dilemmaOpen ? "Decision pending…" : "End turn ▸"}
        </button>
      )}

      <button
        className="btn fixed bottom-16 md:bottom-6 left-4 md:left-44 z-30 w-9 h-9 p-0 rounded-full"
        title="Codex — how this world works"
        aria-label="Open codex"
        onClick={() => setCodexOpen(true)}
      >
        ?
      </button>
      <button
        className="btn fixed bottom-16 md:bottom-6 left-16 md:left-56 z-30 w-9 h-9 p-0 rounded-full"
        title="Menu — saved games"
        aria-label="Open menu"
        onClick={toMenu}
      >
        ☰
      </button>
      {codexOpen && <CodexModal onClose={() => setCodexOpen(false)} />}

      <DilemmaModal game={game} />
      {!dilemmaOpen && <EraBriefingModal game={game} />}
      {!dilemmaOpen && game.pendingEraBriefing === null && <ReleaseDayModal game={game} />}
      {confirming && !dilemmaOpen && (
        <EndTurnSummary game={game} onConfirm={confirmEndTurn} onCancel={() => setConfirming(false)} />
      )}
      {debriefOpen && game.lastDebrief && !dilemmaOpen && (
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
