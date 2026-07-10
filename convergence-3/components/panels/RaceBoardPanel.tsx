"use client";

import { categoryLeaders, leaderboard } from "@/lib/engine/rivals";
import { BENCHMARK_NAMES } from "@/lib/engine/content";
import type { BenchCategory, GameState, Rival } from "@/lib/engine/types";

const ARCHETYPE_LABEL: Record<Rival["archetype"], string> = {
  scaler: "aggressive scaler",
  safety: "safety-first lab",
  state: "state-backed giant",
  open: "open-weights collective",
  wildcard: "the new one",
};

const CATEGORIES: BenchCategory[] = ["coding", "reasoning", "enterprise", "consumer"];

function band(v: number): { label: string; color: string } {
  if (v >= 70) return { label: "dominant", color: "var(--red)" };
  if (v >= 55) return { label: "strong", color: "var(--orange)" };
  if (v >= 40) return { label: "credible", color: "var(--amber)" };
  return { label: "trailing", color: "var(--ink-faint)" };
}

const CHRONICLE_COLOR: Record<string, string> = {
  rival: "#e07ab8",
  talent: "#7ab8f5",
  funding: "var(--amber)",
  safety: "var(--orange)",
  dilemma: "var(--green)",
  world: "var(--ink-dim)",
};

function BenchmarkTable({ game }: { game: GameState }) {
  const rivals = game.rivals.filter(r => r.active);
  const leaders = categoryLeaders(game);
  const deployed = game.models.filter(m => m.positioning !== null);
  const playerBest = (c: BenchCategory) =>
    deployed.length ? Math.max(...deployed.map(m => m.capability[c])) : 0;
  const crownCount = Object.values(leaders).filter(l => l.isPlayer).length;
  return (
    <div className="space-y-2">
      <h2 className="micro-label" style={{ color: "var(--amber)" }}>
        the benchmarks — {crownCount} crown{crownCount === 1 ? "" : "s"} held
      </h2>
      <div className="panel-card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="micro-label text-left">
              <th className="px-4 py-2.5 font-normal">benchmark</th>
              <th className="px-3 py-2.5 font-normal" style={{ color: "var(--amber)" }}>
                you
              </th>
              {rivals.map(r => (
                <th key={r.id} className="px-3 py-2.5 font-normal">
                  {r.name.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(BENCHMARK_NAMES) as BenchCategory[]).map(c => {
              const you = playerBest(c);
              return (
                <tr key={c} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5 micro-label">{BENCHMARK_NAMES[c]}</td>
                  <td
                    className="px-3 py-2.5 stat-num"
                    style={leaders[c].isPlayer ? { color: "var(--amber)", fontWeight: 700 } : undefined}
                  >
                    {leaders[c].isPlayer && "♛ "}
                    {you > 0 ? you.toFixed(0) : "—"}
                  </td>
                  {rivals.map(r => {
                    const isLeader = !leaders[c].isPlayer && leaders[c].name === r.name;
                    return (
                      <td
                        key={r.id}
                        className="px-3 py-2.5 stat-num"
                        style={isLeader ? { color: "var(--red)", fontWeight: 700 } : { color: "var(--ink-dim)" }}
                      >
                        {isLeader && "♛ "}
                        {r.capability[c].toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RaceBoardPanel({ game }: { game: GameState }) {
  const lb = leaderboard(game);
  const rivals = game.rivals.filter(r => r.active);
  const chronicle = [...game.chronicle].slice(-12).reverse();
  return (
    <div className="rise-in space-y-5">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight">The Race</h1>
        <p className="micro-label mt-1">benchmarks · leaderboard · rival intel · the record</p>
      </div>

      <BenchmarkTable game={game} />

      <div className="panel-card divide-y max-w-xl">
        {lb.map((e, i) => (
          <div
            key={e.id}
            className="px-4 py-2.5 flex items-center gap-3 text-sm"
            style={e.isPlayer ? { background: "var(--amber-dim)" } : undefined}
          >
            <span className="stat-num w-6" style={{ color: "var(--ink-faint)" }}>{i + 1}</span>
            <span className="flex-1" style={e.isPlayer ? { color: "var(--amber)", fontWeight: 700 } : undefined}>
              {e.name}
            </span>
            <span className="stat-num">{e.overall.toFixed(0)}</span>
          </div>
        ))}
        {lb.find(e => e.isPlayer)!.overall === 0 && (
          <p className="px-4 py-2 micro-label">your score is 0 until you deploy a model</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rivals.map(r => (
          <div key={r.id} className="panel-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-bold">{r.name}</h3>
                <p className="micro-label mt-0.5">{ARCHETYPE_LABEL[r.archetype]}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {CATEGORIES.map(c => {
                const b = band(r.capability[c]);
                return (
                  <span key={c} className="micro-label">
                    {c}: <span style={{ color: b.color }}>{b.label}</span>
                  </span>
                );
              })}
            </div>
            <p className="text-xs italic" style={{ color: "var(--ink-dim)" }}>
              {r.lastRelease ?? "Quiet lately. That's rarely good news."}
            </p>
          </div>
        ))}
      </div>

      {chronicle.length > 0 && (
        <div className="space-y-2 max-w-xl">
          <h2 className="micro-label">the record</h2>
          <div className="panel-card divide-y">
            {chronicle.map((c, i) => (
              <div key={i} className="px-4 py-2 flex gap-3 items-baseline text-sm">
                <span className="micro-label shrink-0 w-12" style={{ color: CHRONICLE_COLOR[c.kind] }}>
                  {c.kind}
                </span>
                <span style={{ color: "var(--ink-dim)" }}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
