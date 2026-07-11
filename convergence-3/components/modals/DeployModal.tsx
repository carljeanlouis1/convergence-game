"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { projectedRevenue, bestFitPositioning } from "@/lib/engine/deploy";
import { deployRiskBand } from "@/lib/engine/safety";
import type { GameState, Model, Positioning, Pricing } from "@/lib/engine/types";

const POSITIONINGS: Array<{ id: Positioning; label: string; note: string }> = [
  { id: "api", label: "API", note: "the default market" },
  { id: "enterprise", label: "Enterprise", note: "the biggest checks" },
  { id: "consumer", label: "Consumer", note: "broad but modest" },
  { id: "open-weights", label: "Open weights", note: "tiny, permanent, reputational" },
];

const PRICINGS: Array<{ id: Pricing; label: string; note: string }> = [
  { id: "aggressive", label: "Aggressive", note: "underprice the field — sticky share, erodes ~40% slower" },
  { id: "standard", label: "Standard", note: "market rate" },
  { id: "premium", label: "Premium", note: "charge the frontier tax — erodes ~50% faster under pressure" },
];

export function DeployModal({
  game,
  model,
  onClose,
}: {
  game: GameState;
  model: Model;
  onClose: () => void;
}) {
  const deploy = useGameStore(s => s.deploy);
  const bestFit = bestFitPositioning(model.capability);
  const [positioning, setPositioning] = useState<Positioning>(bestFit);
  const [pricing, setPricing] = useState<Pricing>("standard");
  const projected = projectedRevenue(model.capability, positioning, pricing);
  const risk = deployRiskBand(game, model.id);
  const openWeights = positioning === "open-weights";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,9,6,0.85)" }}>
      <div className="panel-card p-5 w-full max-w-lg space-y-4 rise-in max-h-[90dvh] overflow-y-auto">
        <div>
          <p className="micro-label">position the model</p>
          <h2 className="font-display font-black text-xl tracking-tight">{model.name}</h2>
          {risk !== "clear" && (
            <p className="micro-label mt-1" style={{ color: risk === "severe" ? "var(--red)" : "var(--orange)" }}>
              shipping under-evaluated — incident risk will rise ({risk})
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="micro-label">market — this model fits <span style={{ color: "var(--amber)" }}>{bestFit}</span> best</p>
          <div className="grid grid-cols-2 gap-2">
            {POSITIONINGS.map(p => (
              <button
                key={p.id}
                className="btn text-left normal-case tracking-normal p-2.5"
                style={positioning === p.id ? { borderColor: "var(--amber)", color: "var(--amber)" } : undefined}
                onClick={() => setPositioning(p.id)}
              >
                <span className="block font-bold uppercase text-xs tracking-widest">
                  {p.label}
                  {p.id === bestFit && <span style={{ color: "var(--amber)" }}> ★</span>}
                </span>
                <span className="block stat-num mt-0.5" style={{ color: "var(--green)" }}>
                  +${projectedRevenue(model.capability, p.id, pricing).toFixed(1)}M/qtr
                </span>
                <span className="block micro-label mt-0.5">{p.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2" style={openWeights ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
          <p className="micro-label">pricing {openWeights && "(open weights have no price)"}</p>
          <div className="grid grid-cols-3 gap-2">
            {PRICINGS.map(p => (
              <button
                key={p.id}
                className="btn text-left normal-case tracking-normal p-2.5"
                style={pricing === p.id ? { borderColor: "var(--amber)", color: "var(--amber)" } : undefined}
                onClick={() => setPricing(p.id)}
              >
                <span className="block font-bold uppercase text-xs tracking-widest">{p.label}</span>
                <span className="block micro-label mt-0.5">{p.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="stat-num" style={{ color: "var(--green)" }}>
            projected +${projected.toFixed(1)}M/qtr
          </span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>
              Not yet
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                deploy(model.id, positioning, pricing);
                onClose();
              }}
            >
              Ship it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
