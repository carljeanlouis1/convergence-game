"use client";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-start justify-center p-0 md:px-8 md:pt-20 md:pb-6"
      style={{ background: "rgba(13, 12, 11, 0.82)" }}
      onClick={onClose}
    >
      <div
        className="panel-card rise-in w-full md:max-w-3xl max-h-[85dvh] md:max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-b-none md:rounded-b-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3 sticky top-0 bg-[var(--bg-raised)]">
          <h2 className="font-display font-700 text-sm uppercase tracking-widest" style={{ color: "var(--amber)" }}>
            {title}
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-lg leading-none px-1" style={{ color: "var(--ink-faint)" }} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
