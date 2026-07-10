"use client";

import type { GameState, DebriefLine } from "@/lib/engine/types";
import { turnLabel } from "@/lib/engine/turn";

const KIND_COLOR: Record<DebriefLine["kind"], string> = {
  finance: "var(--amber)",
  run: "var(--green)",
  compute: "var(--ink-dim)",
  world: "var(--ink-dim)",
};

export function BriefingPanel({ game }: { game: GameState }) {
  const d = game.lastDebrief;
  return (
    <div className="rise-in space-y-4">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">{turnLabel(game.turn)}</h1>
        <p className="micro-label mt-1">morning briefing</p>
      </div>

      {!d ? (
        <div className="panel-card p-5 space-y-3 max-w-xl">
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            The seed round closed yesterday. ${"120"}M in the account, one cluster humming downstairs, and four
            researchers who believed the pitch.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            Design a training run in <span style={{ color: "var(--amber)" }}>Runs</span>. Point some compute at it.
            Everything else follows from what comes out of the oven.
          </p>
        </div>
      ) : (
        <div className="panel-card divide-y max-w-xl">
          <div className="px-5 py-3">
            <span className="micro-label">last quarter — {d.headline}</span>
          </div>
          {d.lines.map((l, i) => (
            <div key={i} className="px-5 py-3 flex gap-3 items-baseline">
              <span className="micro-label shrink-0 w-14" style={{ color: KIND_COLOR[l.kind] }}>
                {l.kind}
              </span>
              <span className="text-sm leading-relaxed">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
