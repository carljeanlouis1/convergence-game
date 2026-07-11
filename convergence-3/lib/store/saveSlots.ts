"use client";

import { migrateSnapshot } from "./gameStore";
import { turnLabel } from "@/lib/engine/turn";
import type { GameState } from "@/lib/engine/types";

export const SLOT_IDS = [1, 2, 3] as const;
export type SlotId = (typeof SLOT_IDS)[number];

const slotKey = (slot: SlotId) => `convergence3-save-slot-${slot}`;

export interface SlotMeta {
  seed: string;
  turnText: string;
  era: number;
  capital: number;
  ended: boolean;
  savedAt: string; // ISO — UI layer, allowed to touch the clock
}

interface SlotPayload {
  meta: SlotMeta;
  game: GameState;
}

export function listSlots(): Array<{ slot: SlotId; meta: SlotMeta | null }> {
  if (typeof window === "undefined") return SLOT_IDS.map(slot => ({ slot, meta: null }));
  return SLOT_IDS.map(slot => {
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return { slot, meta: null };
      const payload = JSON.parse(raw) as SlotPayload;
      return { slot, meta: payload.meta ?? null };
    } catch {
      return { slot, meta: null };
    }
  });
}

export function saveToSlot(slot: SlotId, game: GameState): SlotMeta {
  const meta: SlotMeta = {
    seed: game.seed,
    turnText: turnLabel(game.turn),
    era: game.era,
    capital: game.capital,
    ended: game.ended,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(slotKey(slot), JSON.stringify({ meta, game } satisfies SlotPayload));
  return meta;
}

/** Load a slot's game, run through the migration chain so old saves stay playable. */
export function loadSlot(slot: SlotId): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const payload = JSON.parse(raw) as SlotPayload;
    return migrateSnapshot({ game: payload.game }).game;
  } catch {
    return null;
  }
}

export function deleteSlot(slot: SlotId): void {
  localStorage.removeItem(slotKey(slot));
}
