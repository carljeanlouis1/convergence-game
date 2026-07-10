"use client";

export type PanelId = "briefing" | "runs" | "compute" | "finance";

const PANELS: Array<{ id: PanelId; label: string; glyph: string }> = [
  { id: "briefing", label: "Briefing", glyph: "◈" },
  { id: "runs", label: "Runs", glyph: "▶" },
  { id: "compute", label: "Compute", glyph: "▦" },
  { id: "finance", label: "Finance", glyph: "$" },
];

export function NavRail({ active, onChange }: { active: PanelId; onChange: (p: PanelId) => void }) {
  return (
    <nav
      className="flex md:flex-col md:w-40 md:border-r md:py-3 border-t md:border-t-0
                 fixed bottom-0 left-0 right-0 md:static z-30 bg-[var(--bg-sunken)] md:bg-transparent"
    >
      {PANELS.map(p => {
        const isActive = p.id === active;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            data-testid={`nav-${p.id}`}
            className="flex-1 md:flex-none flex md:w-full items-center justify-center md:justify-start gap-2 px-4 py-3 md:py-2.5 text-xs uppercase tracking-widest transition-colors"
            style={{
              color: isActive ? "var(--amber)" : "var(--ink-dim)",
              background: isActive ? "var(--amber-dim)" : "transparent",
              borderLeft: isActive ? "2px solid var(--amber)" : "2px solid transparent",
            }}
          >
            <span aria-hidden>{p.glyph}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
