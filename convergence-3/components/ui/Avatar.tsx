"use client";

import { useState } from "react";

/** ids with a real painted portrait in /public/portraits */
const PORTRAIT_IDS = new Set(["velocity", "prometheus", "zhongguancun", "opencollective", "chief"]);

const PALETTE = ["#f5a524", "#8fda45", "#e07ab8", "#7ab8f5", "#f08c3a", "#c9b458"];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic geometric identicon — themed fallback for characters without painted art. */
function Identicon({ id, name, size }: { id: string; name: string; size: number }) {
  const h = hashCode(id);
  const color = PALETTE[h % PALETTE.length];
  const initials = name
    .split(" ")
    .filter(w => w[0] && /[A-Z]/i.test(w[0]))
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
  const angle = (h % 8) * 45;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="rounded shrink-0" aria-hidden>
      <rect width="48" height="48" fill="var(--bg-sunken)" />
      <g transform={`rotate(${angle} 24 24)`} opacity="0.5">
        <circle cx={12 + (h % 24)} cy={10 + (h % 12)} r={10 + (h % 8)} fill="none" stroke={color} strokeWidth="1.5" />
        <rect x={20 - (h % 10)} y={26} width={22} height={22} fill="none" stroke={color} strokeWidth="1" transform="rotate(24 24 24)" />
      </g>
      <text x="24" y="29" textAnchor="middle" fontSize="15" fontFamily="var(--font-mono)" fontWeight="700" fill={color}>
        {initials}
      </text>
    </svg>
  );
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (PORTRAIT_IDS.has(id) && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/portraits/${id}.jpg`}
        alt={name}
        width={size}
        height={size}
        className="rounded shrink-0 object-cover"
        style={{ border: "1px solid var(--line-strong)" }}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Identicon id={id} name={name} size={size} />;
}
