"use client";

import { BENCHMARK_NAMES } from "@/lib/engine/content";
import { crownsOf } from "@/lib/engine/finance";
import { isEclipsed } from "@/lib/engine/rivals";
import { deployRiskBand } from "@/lib/engine/safety";
import { modelAvg } from "@/lib/engine/deploy";
import type { BenchCategory, GameState, Model } from "@/lib/engine/types";

const CATEGORIES: BenchCategory[] = ["coding", "reasoning", "enterprise", "consumer"];
const RISK_COLOR: Record<string, string> = { clear: "var(--green)", elevated: "var(--orange)", severe: "var(--red)" };

function BenchBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="micro-label w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, value)}%`,
            background: value >= 70 ? "var(--amber)" : value >= 45 ? "var(--green)" : "var(--ink-faint)",
          }}
        />
      </div>
      <span className="stat-num text-xs w-8 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export function ModelCard({
  game,
  model,
  action,
}: {
  game: GameState;
  model: Model;
  action?: React.ReactNode; // e.g. a "Position this model" button
}) {
  const avg = modelAvg(model.capability);
  const crowns = model.positioning ? crownsOf(game, model.id) : 0;
  const eclipsed = isEclipsed(game, model.id);
  const risk = model.positioning ? null : deployRiskBand(game, model.id);
  return (
    <div className="panel-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            {model.name}
            {crowns > 0 && (
              <span title={`${crowns} benchmark crown(s)`} style={{ color: "var(--amber)" }}>
                {"♛".repeat(crowns)}
              </span>
            )}
          </h3>
          <div className="micro-label mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {model.releaseRank !== null && <span>#{model.releaseRank} at launch</span>}
            <span style={{ color: eclipsed ? "var(--ink-faint)" : "var(--green)" }}>
              {eclipsed ? "eclipsed" : "frontier"}
            </span>
            {model.pricing && model.positioning && (
              <span>
                {model.positioning} · {model.pricing}
              </span>
            )}
            {model.lifetimeRevenue > 0 && (
              <span className="stat-num" style={{ color: "var(--green)" }}>
                ${model.lifetimeRevenue.toFixed(1)}M lifetime
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {risk && (
            <span
              className="micro-label border rounded px-2 py-0.5"
              style={{ color: RISK_COLOR[risk], borderColor: "currentcolor" }}
            >
              safety: {risk}
            </span>
          )}
          <span className="stat-num font-display font-black text-lg">{avg.toFixed(0)}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {CATEGORIES.map(c => (
          <BenchBar key={c} label={BENCHMARK_NAMES[c]} value={model.capability[c]} />
        ))}
      </div>
      {action}
    </div>
  );
}
