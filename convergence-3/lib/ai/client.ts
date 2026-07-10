"use client";

// AI narration client: cost-capped, response-cached, always-fallible.
// Every caller must handle `null` by showing authored fallback copy.

export type NarrationTier = "a" | "b" | "c";

const CAPS = { maxCallsPerSession: 120, maxCallsPerTurn: 6 };
const CACHE_PREFIX = "c3-ai-";
const TOGGLE_KEY = "c3-ai-enabled";

let sessionCalls = 0;
let turnCalls = 0;
let lastTurnKey = "";
let configured: boolean | null = null;

export function aiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TOGGLE_KEY) !== "off";
}

export function setAiEnabled(on: boolean): void {
  localStorage.setItem(TOGGLE_KEY, on ? "on" : "off");
}

export async function aiStatus(): Promise<boolean> {
  if (configured !== null) return configured;
  try {
    const res = await fetch("/api/narrative", { method: "GET" });
    const data = (await res.json()) as { configured?: boolean };
    configured = Boolean(data.configured);
  } catch {
    configured = false;
  }
  return configured;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/**
 * Generate a narration line. Returns null on ANY failure, cap, or disabled state —
 * callers render authored fallback text instead. Results cache per cacheKey forever.
 */
export async function narrate(
  tier: NarrationTier,
  cacheKey: string,
  system: string,
  prompt: string,
): Promise<string | null> {
  if (typeof window === "undefined" || !aiEnabled()) return null;
  const storageKey = CACHE_PREFIX + hash(cacheKey);
  const cached = localStorage.getItem(storageKey);
  if (cached) return cached;

  // per-turn cap resets when the cacheKey's turn segment changes
  const turnKey = cacheKey.split("|")[0];
  if (turnKey !== lastTurnKey) {
    lastTurnKey = turnKey;
    turnCalls = 0;
  }
  if (sessionCalls >= CAPS.maxCallsPerSession || turnCalls >= CAPS.maxCallsPerTurn) return null;
  if (!(await aiStatus())) return null;

  sessionCalls++;
  turnCalls++;
  try {
    const res = await fetch("/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, system, prompt }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    if (!data.text) return null;
    try {
      localStorage.setItem(storageKey, data.text);
    } catch {
      // storage full — fine, just don't cache
    }
    return data.text;
  } catch {
    return null;
  }
}
