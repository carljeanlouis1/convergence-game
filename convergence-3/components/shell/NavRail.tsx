"use client";

export type PanelId = "briefing" | "runs" | "compute" | "talent" | "race" | "finance" | "compass";

const PANELS: Array<{ id: PanelId; label: string; short: string; glyph: string }> = [
  { id: "briefing", label: "Briefing", short: "Brief", glyph: "◈" },
  { id: "runs", label: "Runs", short: "Runs", glyph: "▶" },
  { id: "compute", label: "Compute", short: "Comp", glyph: "▦" },
  { id: "talent", label: "Talent", short: "Team", glyph: "◉" },
  { id: "race", label: "Race", short: "Race", glyph: "⇅" },
  { id: "finance", label: "Finance", short: "Fin", glyph: "$" },
  { id: "compass", label: "Compass", short: "Goal", glyph: "◎" },
];

export function NavRail({
  active,
  onChange,
  badges,
}: {
  active: PanelId;
  onChange: (p: PanelId) => void;
  badges?: Partial<Record<PanelId, boolean>>;
}) {
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
            className="relative flex-1 md:flex-none flex md:w-full items-center justify-center md:justify-start gap-2 px-2 md:px-4 py-3 md:py-2.5 text-[10px] md:text-xs uppercase tracking-widest transition-colors"
            style={{
              color: isActive ? "var(--amber)" : "var(--ink-dim)",
              background: isActive ? "var(--amber-dim)" : "transparent",
              borderLeft: isActive ? "2px solid var(--amber)" : "2px solid transparent",
            }}
          >
            <span aria-hidden className="hidden md:inline">{p.glyph}</span>
            <span className="md:hidden">{p.short}</span>
            <span className="hidden md:inline">{p.label}</span>
            {badges?.[p.id] && (
              <span
                aria-label="needs attention"
                className="absolute top-1.5 right-1.5 md:static md:ml-auto w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--amber)" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
