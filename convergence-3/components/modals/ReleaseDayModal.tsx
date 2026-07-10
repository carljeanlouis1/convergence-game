"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { BENCHMARK_NAMES } from "@/lib/engine/content";
import { modelAvg } from "@/lib/engine/deploy";
import { categoryLeaders, leaderboard } from "@/lib/engine/rivals";
import { narrate } from "@/lib/ai/client";
import { Avatar } from "@/components/ui/Avatar";
import { DeployModal } from "./DeployModal";
import type { BenchCategory, GameState } from "@/lib/engine/types";

const RIVAL_VOICE: Record<string, string> = {
  scaler: "You are the swaggering CEO of Velocity Systems, an aggressive frontier AI lab. You respect only scale and speed. One or two sentences, quotable, a little too honest.",
  safety: "You are the measured director of the Prometheus Institute, a safety-first AI lab. You praise carefully and warn gently. One or two sentences.",
  state: "You are the composed head of Zhongguancun Frontier, a state-backed AI lab. Diplomatic on the surface, pointed underneath. One or two sentences.",
  open: "You are the cheerful voice of OpenCollective, an open-weights collective. Everything proprietary amuses you — it will be replicated. One or two sentences.",
  wildcard: "You lead a hungry new AI lab founded by defectors. You have something to prove. One or two sentences.",
};

const FALLBACK_REACTION: Record<string, string> = {
  scaler: "“Cute model. Wake me when they can train it twice as big.”",
  safety: "“Capable work. We hope the eval coverage matches the ambition.”",
  state: "“We congratulate our colleagues. The market will say the rest.”",
  open: "“Nice weights. Ours are free, and they'll do this by spring.”",
  wildcard: "“We left for a reason. Watch what we ship next.”",
};

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
  const [reaction, setReaction] = useState<{ text: string; rivalId: string; name: string; ai: boolean } | null>(null);
  const model = game.pendingRelease ? game.models.find(m => m.id === game.pendingRelease) : null;
  const modelId = model?.id ?? null;

  useEffect(() => {
    if (!modelId) return;
    const m = game.models.find(x => x.id === modelId);
    if (!m) return;
    // the top rival reacts to your release
    const top = leaderboard(game).find(e => !e.isPlayer);
    const rival = game.rivals.find(r => r.name === top?.name) ?? game.rivals.find(r => r.active);
    if (!rival) return;
    setReaction({ text: FALLBACK_REACTION[rival.archetype], rivalId: rival.id, name: rival.name, ai: false });
    const caps = `${BENCHMARK_NAMES.coding} ${m.capability.coding.toFixed(0)}, ${BENCHMARK_NAMES.reasoning} ${m.capability.reasoning.toFixed(0)}, ${BENCHMARK_NAMES.enterprise} ${m.capability.enterprise.toFixed(0)}, ${BENCHMARK_NAMES.consumer} ${m.capability.consumer.toFixed(0)}`;
    narrate(
      "c",
      `${game.seed}|reaction|${modelId}`,
      RIVAL_VOICE[rival.archetype],
      `A rival lab just released "${m.name}" (rank #${m.releaseRank} in the field; benchmarks: ${caps}). Your public one-liner reaction, in quotes:`,
    ).then(text => {
      if (text) setReaction({ text, rivalId: rival.id, name: rival.name, ai: true });
    });
  }, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {reaction && (
          <div className="panel-card p-3 flex items-center gap-3 text-left max-w-md mx-auto">
            <Avatar id={reaction.rivalId} name={reaction.name} size={36} />
            <p className="text-sm italic leading-relaxed" style={{ color: "var(--ink-dim)" }}>
              {reaction.ai && <span style={{ color: "var(--amber)" }}>✧ </span>}
              {reaction.text}
              <span className="micro-label block mt-1 not-italic">— {reaction.name}</span>
            </p>
          </div>
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
