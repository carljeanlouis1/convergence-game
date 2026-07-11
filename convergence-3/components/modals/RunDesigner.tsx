"use client";

import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useGameStore } from "@/lib/store/gameStore";
import { expectedQuality, riskBand } from "@/lib/engine/runs";
import { freePF } from "@/lib/engine/compute";
import { TECHNIQUES, BENCHMARK_NAMES } from "@/lib/engine/content";
import { BALANCE } from "@/lib/engine/balance";
import type { GameState, RunDesign } from "@/lib/engine/types";

const TIERS = [1, 2, 3, 4] as const;

function capabilityBand(q: number): string {
  if (q < 35) return "modest";
  if (q < 55) return "competitive";
  if (q < 75) return "frontier";
  return "landmark";
}

export function RunDesigner({ game, onClose }: { game: GameState; onClose: () => void }) {
  const launch = useGameStore(s => s.launch);
  const [name, setName] = useState(`Model ${game.models.length + game.runs.length + 1}`);
  const [tier, setTier] = useState<1 | 2 | 3 | 4>(1);
  const [techniqueIds, setTechniqueIds] = useState<string[]>(["rlhf"]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [baseModelId, setBaseModelId] = useState<string | undefined>(undefined);

  const design: RunDesign = { name, scaleTier: tier, techniqueIds, leadId, baseModelId };
  const baseModel = baseModelId ? game.models.find(m => m.id === baseModelId) : null;
  const tierDef = BALANCE.runTiers[tier];
  const free = freePF(game);
  const availableStars = game.stars.filter(s => s.onRunId === null);

  const projection = useMemo(() => {
    try {
      return { q: expectedQuality(design, game), risk: riskBand(design), error: null as string | null };
    } catch (e) {
      return { q: 0, risk: "low" as const, error: e instanceof Error ? e.message : String(e) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tier, techniqueIds, leadId, game]);

  const blocker =
    projection.error ??
    (free < tierDef.computePerTurn ? `needs ${tierDef.computePerTurn} PF free — you have ${free.toFixed(0)}` : null) ??
    (techniqueIds.length === 0 ? "pick at least one technique" : null) ??
    (name.trim().length === 0 ? "name the model" : null);

  const totalCost = tierDef.computePerTurn * tierDef.costPerPFTurn * tierDef.turns;

  return (
    <Modal title="Design training run" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="micro-label block mb-1.5" htmlFor="run-name">codename</label>
          <input
            id="run-name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[var(--bg-sunken)] border rounded px-3 py-2 text-sm outline-none focus:border-[var(--amber)]"
          />
        </div>

        <div>
          <span className="micro-label block mb-1.5">scale tier</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {TIERS.map(t => {
              const d = BALANCE.runTiers[t];
              const selected = tier === t;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="panel-card p-3 text-left transition-colors"
                  style={selected ? { borderColor: "var(--amber)", background: "var(--amber-dim)" } : undefined}
                >
                  <div className="font-display font-bold">Tier {t}</div>
                  <div className="micro-label mt-1 space-y-0.5">
                    <div>{d.computePerTurn} PF/qtr · {d.turns} qtrs</div>
                    <div>${(d.computePerTurn * d.costPerPFTurn * d.turns).toFixed(0)}M total</div>
                    <div>ceiling {d.cap}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {game.models.length > 0 && (
          <div>
            <span className="micro-label block mb-1.5">
              build on <span style={{ color: "var(--ink-faint)" }}>· a v2 inherits ≥{Math.round(BALANCE.run.familyInheritFloor * 100)}% of the base&apos;s benchmarks, +{BALANCE.run.familyQualityBonus} quality</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                onClick={() => setBaseModelId(undefined)}
                style={!baseModelId ? { borderColor: "var(--amber)", color: "var(--amber)" } : undefined}
              >
                From scratch
              </button>
              {[...game.models].reverse().slice(0, 6).map(m => (
                <button
                  key={m.id}
                  className="btn"
                  onClick={() => {
                    setBaseModelId(m.id);
                    setName(`${m.name.replace(/\s\d+$/, "")} ${(parseInt(m.name.match(/\s(\d+)$/)?.[1] ?? "1") || 1) + 1}`);
                  }}
                  style={baseModelId === m.id ? { borderColor: "var(--amber)", color: "var(--amber)", background: "var(--amber-dim)" } : undefined}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {baseModel && (
              <p className="micro-label mt-1" style={{ color: "var(--amber)" }}>
                inheriting from {baseModel.name} — a floor of{" "}
                {Math.round(Math.max(baseModel.capability.coding, baseModel.capability.reasoning, baseModel.capability.enterprise, baseModel.capability.consumer) * BALANCE.run.familyInheritFloor)}{" "}
                in its strongest benchmark
              </p>
            )}
          </div>
        )}

        <div>
          <span className="micro-label block mb-1.5">techniques</span>
          <div className="flex flex-wrap gap-2">
            {TECHNIQUES.map(t => {
              const locked = t.era > game.era;
              const on = techniqueIds.includes(t.id);
              const boosts = (Object.entries(t.categoryWeights) as Array<[string, number]>)
                .filter(([, w]) => w >= 1.1)
                .map(([c]) => BENCHMARK_NAMES[c as keyof typeof BENCHMARK_NAMES]);
              if (locked) {
                return (
                  <span key={t.id} className="btn opacity-40 cursor-not-allowed" title={`unlocks in era ${t.era}`}>
                    {t.name}
                    <span className="ml-2 micro-label" style={{ color: "var(--orange)" }}>era {t.era}</span>
                  </span>
                );
              }
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    setTechniqueIds(on ? techniqueIds.filter(x => x !== t.id) : [...techniqueIds, t.id])
                  }
                  className="btn"
                  title={boosts.length ? `boosts ${boosts.join(", ")}` : undefined}
                  style={on ? { borderColor: "var(--amber)", color: "var(--amber)", background: "var(--amber-dim)" } : undefined}
                >
                  {t.name}
                  <span className="ml-2 opacity-60">+{t.qualityBonus}q {t.variance > 0 ? `±${t.variance}` : ""}</span>
                  {boosts.length > 0 && (
                    <span className="block micro-label mt-0.5" style={{ color: "var(--green)" }}>
                      ▲ {boosts.join(" · ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="micro-label block mb-1.5">
            run lead <span style={{ color: "var(--ink-faint)" }}>· their specialty leaves +{BALANCE.talent.specialtyCapabilityBonus} on that benchmark</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              onClick={() => setLeadId(null)}
              style={leadId === null ? { borderColor: "var(--amber)", color: "var(--amber)" } : undefined}
            >
              No lead
            </button>
            {availableStars.map(s => (
              <button
                key={s.id}
                className="btn text-left normal-case tracking-normal"
                onClick={() => setLeadId(s.id)}
                style={leadId === s.id ? { borderColor: "var(--amber)", color: "var(--amber)", background: "var(--amber-dim)" } : undefined}
              >
                <span className="font-bold">{s.name}</span> <span className="opacity-60">skill {s.skill}</span>
                <span className="block micro-label mt-0.5" style={{ color: "var(--green)" }}>
                  ▲ +{BALANCE.talent.specialtyCapabilityBonus} {BENCHMARK_NAMES[s.specialty]}
                </span>
                {s.affinity && (
                  <span
                    className="block micro-label"
                    style={{ color: techniqueIds.includes(s.affinity) ? "var(--amber)" : "var(--ink-faint)" }}
                  >
                    ◇ {TECHNIQUES.find(t => t.id === s.affinity)?.name ?? s.affinity} affinity
                    {techniqueIds.includes(s.affinity) ? ` (+${BALANCE.talent.affinityBonus} active)` : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {game.researchMomentum >= 1 && (
          <p className="micro-label" style={{ color: "var(--amber)" }}>
            research momentum is contributing +{(game.researchMomentum * BALANCE.experiments.momentumQualityWeight).toFixed(0)} quality to this design
          </p>
        )}

        <div className="panel-card p-4 flex flex-wrap gap-x-8 gap-y-2" style={{ background: "var(--bg-sunken)" }}>
          <div>
            <span className="micro-label block">projected capability</span>
            <span className="font-display font-bold" style={{ color: "var(--amber)" }}>
              {capabilityBand(projection.q)}
            </span>
          </div>
          <div>
            <span className="micro-label block">volatility</span>
            <span className={`font-display font-bold band-${projection.risk === "low" ? "ahead" : projection.risk === "medium" ? "wobbly" : "troubled"}`}>
              {projection.risk}
            </span>
          </div>
          <div>
            <span className="micro-label block">committed spend</span>
            <span className="font-display font-bold stat-num">${totalCost.toFixed(0)}M over {tierDef.turns} qtrs</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: "var(--red)" }}>{blocker}</span>
          <button
            className="btn btn-primary"
            data-testid="launch-run"
            disabled={!!blocker}
            onClick={() => {
              launch(design);
              onClose();
            }}
          >
            Commit the run
          </button>
        </div>
      </div>
    </Modal>
  );
}
