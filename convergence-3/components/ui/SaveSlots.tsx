"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { listSlots, saveToSlot, loadSlot, deleteSlot, type SlotId } from "@/lib/store/saveSlots";

/** Three named save slots: save the active game, load, delete. Used on the main menu and in-game. */
export function SaveSlots({ onLoaded }: { onLoaded?: () => void }) {
  const game = useGameStore(s => s.game);
  const setActiveGame = useGameStore(s => s.setActiveGame);
  const [slots, setSlots] = useState(listSlots);
  const [confirmDelete, setConfirmDelete] = useState<SlotId | null>(null);
  const refresh = () => setSlots(listSlots());

  return (
    <div className="space-y-2 w-full max-w-md">
      <span className="micro-label block text-center">saved games</span>
      {slots.map(({ slot, meta }) => (
        <div key={slot} className="panel-card p-3 flex items-center gap-3 text-left">
          <span className="micro-label w-10 shrink-0">slot {slot}</span>
          <div className="flex-1 min-w-0">
            {meta ? (
              <>
                <div className="text-sm font-bold truncate">
                  {meta.turnText} · era {meta.era} · ${meta.capital.toFixed(0)}M
                  {meta.ended && <span style={{ color: "var(--red)" }}> · ended</span>}
                </div>
                <div className="micro-label truncate">
                  {meta.seed} · saved {new Date(meta.savedAt).toLocaleDateString()}
                </div>
              </>
            ) : (
              <span className="micro-label">empty</span>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {game && (
              <button
                className="btn text-[10px] px-2 py-1"
                title={meta ? "overwrite this slot with the current game" : "save the current game here"}
                onClick={() => {
                  saveToSlot(slot, game);
                  refresh();
                }}
              >
                Save
              </button>
            )}
            {meta && (
              <button
                className="btn text-[10px] px-2 py-1"
                onClick={() => {
                  const loaded = loadSlot(slot);
                  if (loaded) {
                    setActiveGame(loaded);
                    onLoaded?.();
                  }
                }}
              >
                Load
              </button>
            )}
            {meta &&
              (confirmDelete === slot ? (
                <button
                  className="btn btn-danger text-[10px] px-2 py-1"
                  onClick={() => {
                    deleteSlot(slot);
                    setConfirmDelete(null);
                    refresh();
                  }}
                >
                  Sure?
                </button>
              ) : (
                <button className="btn text-[10px] px-2 py-1" onClick={() => setConfirmDelete(slot)}>
                  Delete
                </button>
              ))}
          </div>
        </div>
      ))}
      <p className="micro-label text-center">the active game autosaves on its own — slots are your library</p>
    </div>
  );
}
