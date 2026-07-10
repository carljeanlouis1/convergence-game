"use client";

import { Modal } from "./Modal";
import type { TurnDebrief } from "@/lib/engine/types";

export function DebriefModal({ debrief, onClose }: { debrief: TurnDebrief; onClose: () => void }) {
  return (
    <Modal title={debrief.headline} onClose={onClose}>
      <div className="space-y-3">
        {debrief.lines.map((l, i) => (
          <div key={i} className="flex gap-3 items-baseline rise-in" style={{ animationDelay: `${i * 90}ms` }}>
            <span
              className="micro-label shrink-0 w-14"
              style={{ color: l.kind === "run" ? "var(--green)" : l.kind === "finance" ? "var(--amber)" : "var(--ink-dim)" }}
            >
              {l.kind}
            </span>
            <span className="text-sm leading-relaxed">{l.text}</span>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <button className="btn btn-primary" onClick={onClose} data-testid="debrief-continue">
            To the briefing
          </button>
        </div>
      </div>
    </Modal>
  );
}
