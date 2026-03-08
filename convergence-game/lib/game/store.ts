"use client";

import { create } from "zustand";
import {
  advanceTurn,
  assignResearcher,
  buildFacility,
  createNewGame,
  dismissResolution,
  hireCandidate,
  loadAutosave,
  loadFromSlot,
  loadSaveSummaries,
  normalizeGameState,
  resolveDilemmaOption,
  saveAutosave,
  saveToSlot,
  selectTrack,
  setAICacheEntry,
  setAISettings,
  setOpenAISettings,
  setEnergyPolicy,
  setPanel,
  setSupplier,
  updateTrackCompute,
} from "./engine";
import { DilemmaOption, GameState, SaveSlotId, StartPresetId, TrackId } from "./types";

interface ConvergenceStore extends GameState {
  hydrated: boolean;
  initialize: () => void;
  newGame: (preset: StartPresetId) => void;
  continueAutosave: () => void;
  loadSlot: (slot: SaveSlotId) => void;
  saveSlot: (slot: SaveSlotId) => void;
  saveAndQuit: () => void;
  nextTurn: () => void;
  resolveDilemma: (option: DilemmaOption) => void;
  adjustCompute: (trackId: TrackId, delta: number) => void;
  assignPerson: (researcherId: string, trackId: TrackId | null) => void;
  hire: (candidateId: string) => void;
  startFacility: (facilityId: string) => void;
  chooseSupplier: (vendor: string) => void;
  chooseEnergy: (energyId: string) => void;
  openTrack: (trackId: TrackId) => void;
  openPanel: (panel: GameState["panel"]) => void;
  clearResolution: () => void;
  updateAIConfig: (enabled: boolean, apiKey: string) => void;
  updateOpenAIConfig: (enabled: boolean, apiKey: string, autoPlay: boolean) => void;
  cacheNarrative: (key: string, value: string) => void;
}

const cloneGameState = (state: ConvergenceStore): GameState => {
  const {
    hydrated,
    initialize,
    newGame,
    continueAutosave,
    loadSlot,
    saveSlot,
    saveAndQuit,
    nextTurn,
    resolveDilemma,
    adjustCompute,
    assignPerson,
    hire,
    startFacility,
    chooseSupplier,
    chooseEnergy,
    openTrack,
    openPanel,
    clearResolution,
    updateAIConfig,
    updateOpenAIConfig,
    cacheNarrative,
    ...game
  } = state;

  void hydrated;
  void initialize;
  void newGame;
  void continueAutosave;
  void loadSlot;
  void saveSlot;
  void saveAndQuit;
  void nextTurn;
  void resolveDilemma;
  void adjustCompute;
  void assignPerson;
  void hire;
  void startFacility;
  void chooseSupplier;
  void chooseEnergy;
  void openTrack;
  void openPanel;
  void clearResolution;
  void updateAIConfig;
  void updateOpenAIConfig;
  void cacheNarrative;

  return structuredClone(game);
};

const persistIfPlaying = (state: GameState) => {
  if (state.mode === "playing" || state.mode === "ended") {
    saveAutosave(state);
  }
};

export const useConvergenceStore = create<ConvergenceStore>((set, get) => ({
  ...createNewGame("founder"),
  hydrated: false,
  initialize: () => {
    const autosave = loadAutosave();
    const slotSummaries = loadSaveSummaries();

    if (autosave?.state) {
      const next = normalizeGameState(autosave.state);
      set({ ...next, slotSummaries, hydrated: true, mode: "menu" });
      return;
    }

    set((state) => ({
      ...state,
      slotSummaries,
      hydrated: true,
      mode: "menu",
    }));
  },
  newGame: (preset) => {
    const next = createNewGame(preset);
    next.mode = "playing";
    next.slotSummaries = loadSaveSummaries();
    persistIfPlaying(next);
    set({ ...next, hydrated: true });
  },
  continueAutosave: () => {
    const snapshot = loadAutosave();
    if (!snapshot?.state) {
      return;
    }

    const next = normalizeGameState(snapshot.state);

    set({
      ...next,
      slotSummaries: loadSaveSummaries(),
      hydrated: true,
    });
  },
  loadSlot: (slot) => {
    const snapshot = loadFromSlot(slot);
    if (!snapshot?.state) {
      return;
    }

    const next = normalizeGameState(snapshot.state);
    persistIfPlaying(next);
    set({
      ...next,
      slotSummaries: loadSaveSummaries(),
      hydrated: true,
    });
  },
  saveSlot: (slot) => {
    const state = get();
    saveToSlot(state, slot);
    set({ slotSummaries: loadSaveSummaries() });
  },
  saveAndQuit: () => {
    const state = get();
    persistIfPlaying(state);
    set({
      mode: "menu",
      slotSummaries: loadSaveSummaries(),
    });
  },
  nextTurn: () => {
    const state = cloneGameState(get());
    if (state.activeDilemma) {
      return;
    }

    const next = advanceTurn(state);
    persistIfPlaying(next);
    set({ ...next, slotSummaries: loadSaveSummaries() });
  },
  resolveDilemma: (option) => {
    const state = cloneGameState(get());
    resolveDilemmaOption(state, option);
    persistIfPlaying(state);
    set({ ...state, slotSummaries: loadSaveSummaries() });
  },
  adjustCompute: (trackId, delta) => {
    const state = cloneGameState(get());
    updateTrackCompute(state, trackId, delta);
    persistIfPlaying(state);
    set({ ...state });
  },
  assignPerson: (researcherId, trackId) => {
    const state = cloneGameState(get());
    assignResearcher(state, researcherId, trackId);
    persistIfPlaying(state);
    set({ ...state });
  },
  hire: (candidateId) => {
    const state = cloneGameState(get());
    hireCandidate(state, candidateId);
    persistIfPlaying(state);
    set({ ...state });
  },
  startFacility: (facilityId) => {
    const state = cloneGameState(get());
    buildFacility(state, facilityId);
    persistIfPlaying(state);
    set({ ...state });
  },
  chooseSupplier: (vendor) => {
    const state = cloneGameState(get());
    setSupplier(state, vendor);
    persistIfPlaying(state);
    set({ ...state });
  },
  chooseEnergy: (energyId) => {
    const state = cloneGameState(get());
    setEnergyPolicy(state, energyId);
    persistIfPlaying(state);
    set({ ...state });
  },
  openTrack: (trackId) => {
    const state = cloneGameState(get());
    selectTrack(state, trackId);
    set({ ...state });
  },
  openPanel: (panel) => {
    const state = cloneGameState(get());
    setPanel(state, panel);
    set({ ...state });
  },
  clearResolution: () => {
    const state = cloneGameState(get());
    dismissResolution(state);
    set({ ...state });
  },
  updateAIConfig: (enabled, apiKey) => {
    const state = cloneGameState(get());
    setAISettings(state, enabled, apiKey);
    persistIfPlaying(state);
    set({ ...state });
  },
  updateOpenAIConfig: (enabled, apiKey, autoPlay) => {
    const state = cloneGameState(get());
    setOpenAISettings(state, enabled, apiKey, autoPlay);
    persistIfPlaying(state);
    set({ ...state });
  },
  cacheNarrative: (key, value) => {
    const state = cloneGameState(get());
    setAICacheEntry(state, key, value);
    persistIfPlaying(state);
    set({ ...state });
  },
}));
