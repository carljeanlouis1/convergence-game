"use client";

import { useState } from "react";
import { aiEnabled, setAiEnabled } from "@/lib/ai/client";

const ENTRIES: Array<{ title: string; body: string }> = [
  {
    title: "Training runs",
    body: "A run commits compute for several quarters against a hidden quality roll shaped by your lead, team, and techniques. Checkpoints leak noisy signals — the bands, not the truth. Bigger tiers cost far more and can fail outright, eating everything you spent.",
  },
  {
    title: "Checkpoints & scrapping",
    body: "Wobbly or troubled checkpoints offer a call: push through (hope), boost (pay extra compute for quality), or scrap (eat the sunk cost, free the team). Real labs have burned half a billion learning this choice exists.",
  },
  {
    title: "Pricing & fast-follow",
    body: "Every deployed model's revenue erodes as rivals catch up — faster in later eras. Premium pricing earns ~45% more but erodes ~50% faster; aggressive pricing earns less but holds share. Open weights never decay and never pay.",
  },
  {
    title: "Benchmark crowns",
    body: "Lead the whole field in a category and you hold its crown: +12% yield on that model's revenue and the board's affection. Rivals take crowns back by shipping. Leads are rented, never owned.",
  },
  {
    title: "Safety tiers & incidents",
    body: "Capability tiers demand eval capacity, built by allocating compute to safety. Ship past your coverage and incident risk accrues quietly until it doesn't. Three incidents is a catastrophe ending.",
  },
  {
    title: "Funding & control",
    body: "Raises trade control for capital; strategic money adds partner compute with strings. Control below 35 turns any victory pyrrhic — you won the race and lost the company.",
  },
  {
    title: "Coups",
    body: "Board confidence at 20 or below triggers the overnight call. High morale saves you — the team threatens to walk. Low morale and you're reading about your own lab in the press.",
  },
  {
    title: "Eras",
    body: "Four eras, each meaner: rivals jump harder, fast-follow bites faster, poaching escalates. New techniques and facilities unlock as they open. Era 4 is the Convergence — where AGI and the strange endings live.",
  },
  {
    title: "Applied Frontiers",
    body: "Cross the AGI threshold in Era 4 and five mega-projects unlock: point your models at labor, cures, materials, space, or world-modeling. Complete three and you're not competing with labs anymore.",
  },
  {
    title: "Endings",
    body: "The Compass shows every trajectory and what's binding it. Seven victories, four defeats, one timeout — and one entry that just says ???. Steer on purpose.",
  },
];

export function CodexModal({ onClose }: { onClose: () => void }) {
  const [ai, setAi] = useState(aiEnabled());
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,9,6,0.88)" }}
      onClick={onClose}
    >
      <div
        className="panel-card p-5 w-full max-w-xl space-y-4 rise-in max-h-[88dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-xl tracking-tight">Codex</h2>
            <p className="micro-label mt-0.5">how this world works</p>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer panel-card px-3 py-2">
          <input
            type="checkbox"
            checked={ai}
            onChange={e => {
              setAi(e.target.checked);
              setAiEnabled(e.target.checked);
            }}
          />
          <span>
            AI narration <span className="micro-label">(✧ lines — chief of staff reads, rival reactions; needs a configured server key)</span>
          </span>
        </label>
        <div className="space-y-3">
          {ENTRIES.map(e => (
            <div key={e.title} className="panel-card p-3">
              <h3 className="font-display font-bold text-sm">{e.title}</h3>
              <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--ink-dim)" }}>
                {e.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
