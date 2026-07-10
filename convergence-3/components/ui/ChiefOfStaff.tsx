"use client";

import { useEffect, useState } from "react";
import { narrate } from "@/lib/ai/client";
import { runwayMonths } from "@/lib/engine/finance";
import { freePF, totalCapacityPF } from "@/lib/engine/compute";
import { Avatar } from "./Avatar";
import type { GameState } from "@/lib/engine/types";
import type { PanelId } from "@/components/shell/NavRail";

const CHIEF_SYSTEM = `You are Adaeze Nwosu, chief of staff at a frontier AI lab, briefing your CEO each quarter.
You have been with this lab since founding and remember its history — reference recent events naturally when relevant.
Voice: dry, precise, loyal, quietly funny. You compress what happened into exactly 2-3 sentences a busy CEO needs.
Never invent numbers or events not in the notes. Never use markdown. Money is $X.XM format.`;

interface Attention {
  label: string;
  panel: PanelId;
}

export function attentionChips(game: GameState): Attention[] {
  const chips: Attention[] = [];
  if (game.models.some(m => m.positioning === null)) chips.push({ label: "undeployed model", panel: "finance" });
  if (game.poachOffers.some(o => o.expiresTurn !== -1)) chips.push({ label: "poaching raid", panel: "talent" });
  if (game.fundingOffers.length > 0) chips.push({ label: "term sheets open", panel: "finance" });
  const runway = runwayMonths(game);
  if (runway !== Infinity && runway < 9) chips.push({ label: `runway ${runway.toFixed(0)}mo`, panel: "finance" });
  if (totalCapacityPF(game) > 0 && freePF(game) / totalCapacityPF(game) > 0.3 && game.turn > 2) {
    chips.push({ label: "idle compute", panel: "compute" });
  }
  if (game.frontierProjects.some(p => p.status === "available")) chips.push({ label: "frontiers open", panel: "runs" });
  const cap = totalCapacityPF(game);
  if (cap > 0 && freePF(game) / cap < 0.15 && game.turn > 3) chips.push({ label: "compute crunch — expand", panel: "compute" });
  return chips.slice(0, 4);
}

const TIPS: Record<number, string> = {
  1: "First quarter. Design a training run in Runs — small is fine, shipped is better. Allocate leftover compute to inference once you have a model to serve.",
  2: "Watch the checkpoint chips on your run. Green means push on; orange means decide something. And keep an eye on runway — the board certainly is.",
  3: "When the model lands you'll pick a market and a price. Premium earns fast and erodes fast. Whatever you ship, rivals will copy — leads are rented here.",
};

export function ChiefOfStaff({ game, onNavigate }: { game: GameState; onNavigate: (p: PanelId) => void }) {
  const [aiRead, setAiRead] = useState<string | null>(null);
  const d = game.lastDebrief;

  useEffect(() => {
    let cancelled = false;
    setAiRead(null);
    if (!d || d.lines.length === 0) return;
    const notes = d.lines.map(l => `${l.kind}: ${l.text}`).join("\n");
    const stats = `era ${game.era}, capital $${game.capital.toFixed(1)}M, trust ${Math.round(game.trust)}, morale ${Math.round(game.morale)}, board ${Math.round(game.boardConfidence)}, control ${Math.round(game.control)}%, crowns ${game.stats.crowns.length}`;
    const history = game.chronicle.slice(-6).map(c => `T${c.turn} ${c.kind}: ${c.text}`).join("\n");
    narrate(
      "b",
      `${game.seed}|chief|${game.turn}`,
      CHIEF_SYSTEM,
      `Quarter notes:\n${notes}\n\nRecent history:\n${history}\n\nCurrent stats: ${stats}\n\nGive the CEO your 2-3 sentence morning read.`,
    ).then(text => {
      if (!cancelled && text) setAiRead(text);
    });
    return () => {
      cancelled = true;
    };
  }, [game.seed, game.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = attentionChips(game);
  const tip = game.turn <= 3 ? TIPS[game.turn] : null;

  return (
    <div className="panel-card p-4 max-w-xl space-y-3">
      <div className="flex items-start gap-3">
        <Avatar id="chief" name="Adaeze Nwosu" size={44} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-sm">Adaeze Nwosu</span>
            <span className="micro-label">chief of staff</span>
          </div>
          <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--ink-dim)" }}>
            {aiRead ? (
              <>
                <span style={{ color: "var(--amber)" }}>✧ </span>
                {aiRead}
              </>
            ) : tip ? (
              tip
            ) : chips.length > 0 ? (
              "Here's what actually needs you this quarter:"
            ) : (
              "Quiet quarter on the desk. Use it — they don't stay quiet."
            )}
          </p>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-14">
          {chips.map(c => (
            <button
              key={c.label}
              className="btn text-[10px] px-2.5 py-1"
              style={{ color: "var(--amber)", borderColor: "var(--amber-dim)" }}
              onClick={() => onNavigate(c.panel)}
            >
              {c.label} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
