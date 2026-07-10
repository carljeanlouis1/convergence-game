"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { BENCHMARK_NAMES } from "@/lib/engine/content";
import { modelAvg } from "@/lib/engine/deploy";
import { categoryLeaders } from "@/lib/engine/rivals";
import { DeployModal } from "./DeployModal";
import type { BenchCategory, GameState } from "@/lib/engine/types";

const CATEGORIES: BenchCategory[] = ["coding", "reasoning", "enterprise", "consumer"];

function CountUp({ value, delay }: { value: number; delay: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 900));
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return <span className="stat-num font-display font-black text-2xl">{shown.toFixed(1)}</span>;
}

export function ReleaseDayModal({ game }: { game: GameState }) {
  const dismissRelease = useGameStore(s => s.dismissRelease);
  const [deploying, setDeploying] = useState(false);
  const model = game.pendingRelease ? game.models.find(m => m.id === game.pendingRelease) : null;
  if (!model) return null;

  if (deploying) {
    return <DeployModal game={game} model={model} onClose={() => setDeploying(false)} />;
  }

  const avg = modelAvg(model.capability);
  const leaders = categoryLeaders(game);
  const wouldLead = CATEGORIES.filter(c => model.capability[c] >= leaders[c].value && leaders[c].value > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,9,6,0.92)" }}
    >
      <div className="w-full max-w-lg text-center space-y-6 rise-in">
        <div>
          <p className="micro-label" style={{ color: "var(--amber)" }}>
            release day
          </p>
          <h1 className="font-display font-black text-4xl tracking-tight mt-1 title-in">{model.name}</h1>
          <p className="micro-label mt-2">
            enters the field at <span style={{ color: "var(--amber)" }}>#{model.releaseRank ?? "?"}</span> overall ·
            composite {avg.toFixed(0)}
          </p>
        </div>

        <div className="panel-card p-5 grid grid-cols-2 gap-x-8 gap-y-4 text-left">
          {CATEGORIES.map((c, i) => (
            <div key={c}>
              <p className="micro-label">{BENCHMARK_NAMES[c]}</p>
              <CountUp value={model.capability[c]} delay={i * 220} />
              {wouldLead.includes(c) && (
                <span className="micro-label ml-2" style={{ color: "var(--amber)" }}>
                  ♛ would lead the field
                </span>
              )}
            </div>
          ))}
        </div>

        {wouldLead.length > 0 && (
          <p className="text-sm" style={{ color: "var(--amber)" }}>
            Deploy it and the {wouldLead.map(c => BENCHMARK_NAMES[c]).join(" and ")} crown
            {wouldLead.length > 1 ? "s are" : " is"} yours.
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button className="btn" onClick={dismissRelease}>
            Shelve for now
          </button>
          <button className="btn btn-primary px-8" onClick={() => setDeploying(true)}>
            Position it
          </button>
        </div>
      </div>
    </div>
  );
}
