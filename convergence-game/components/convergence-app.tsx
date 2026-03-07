"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  AudioLines,
  BrainCircuit,
  Building2,
  Cpu,
  FlaskConical,
  Globe2,
  Handshake,
  Lock,
  Orbit,
  Play,
  Radar,
  Save,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { fetchGeminiNarrative } from "@/lib/game/ai";
import { CONVERGENCES, ENERGY_POLICIES, START_PRESETS, SUPPLIER_CONTRACTS, TRACK_DEFINITIONS } from "@/lib/game/data";
import { availableBuildOptions, formatCurrency, tutorialNotes } from "@/lib/game/engine";
import { useConvergenceStore } from "@/lib/game/store";
import { GameState, SaveSlotId, StartPresetId, TrackId } from "@/lib/game/types";
import { PixiBackground } from "./pixi-background";

const TRACK_ICONS: Record<TrackId, typeof BrainCircuit> = {
  foundation: BrainCircuit,
  alignment: Shield,
  simulation: Radar,
  robotics: Cpu,
  biology: FlaskConical,
  materials: Sparkles,
  quantum: Zap,
  space: Orbit,
};

const slots: SaveSlotId[] = [1, 2, 3];

function playSynthTone(enabled: boolean, kind: "click" | "breakthrough" | "warning") {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const audioContext = new AudioContextCtor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.type = kind === "breakthrough" ? "triangle" : "sine";
  oscillator.frequency.value = kind === "click" ? 240 : kind === "warning" ? 180 : 420;
  gain.gain.value = 0.0001;
  oscillator.start();
  const now = audioContext.currentTime;
  gain.gain.exponentialRampToValueAtTime(kind === "breakthrough" ? 0.04 : 0.025, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "breakthrough" ? 0.35 : 0.18));
  oscillator.stop(now + (kind === "breakthrough" ? 0.35 : 0.18));
  window.setTimeout(() => {
    void audioContext.close();
  }, 450);
}

function MetricBar({
  label,
  value,
  max = 100,
  tone = "blue",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "blue" | "amber" | "green" | "red";
}) {
  const width = `${Math.max(6, (value / max) * 100)}%`;
  const color =
    tone === "amber"
      ? "from-amber-300 to-amber-500"
      : tone === "green"
        ? "from-emerald-300 to-emerald-500"
        : tone === "red"
          ? "from-rose-400 to-rose-500"
          : "from-sky-300 to-sky-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-400">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/6">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

function PanelButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BrainCircuit;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
        active
          ? "border-sky-400/60 bg-sky-400/14 text-white"
          : "border-white/8 bg-white/4 text-slate-300 hover:border-white/16 hover:bg-white/8"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MenuCard({
  presetId,
  unlocked,
  onStart,
}: {
  presetId: StartPresetId;
  unlocked: boolean;
  onStart: () => void;
}) {
  const preset = START_PRESETS[presetId];

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_90px_rgba(2,10,28,0.45)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Start Condition</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{preset.name}</h3>
        </div>
        {!unlocked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        ) : null}
      </div>
      <p className="min-h-14 text-sm leading-6 text-slate-300">{preset.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <span>Capital {formatCurrency(preset.modifier.capital)}</span>
        <span>Trust {preset.modifier.trust}</span>
        <span>Fear {preset.modifier.fear}</span>
        <span>Board {preset.modifier.board}</span>
      </div>
      <button
        type="button"
        disabled={!unlocked}
        onClick={onStart}
        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-sky-400/50 bg-sky-500/15 px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
      >
        Launch Run
      </button>
    </div>
  );
}

function TrackMap({
  state,
  onOpenTrack,
}: {
  state: GameState;
  onOpenTrack: (trackId: TrackId) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.16),transparent_38%),linear-gradient(180deg,rgba(7,12,28,0.96),rgba(7,10,24,0.88))] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lab Map</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Research Web</h2>
        </div>
        <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-sky-200">
          {Math.round(
            (Object.values(state.tracks).reduce((sum, track) => sum + track.compute, 0) /
              state.resources.computeCapacity) *
              100,
          )}
          % compute committed
        </div>
      </div>
      <div className="relative h-[520px] rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(12,18,38,0.88),rgba(8,12,24,0.92))]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {CONVERGENCES.map((convergence) => {
            const trackIds = Object.keys(convergence.requirements) as TrackId[];
            if (trackIds.length < 2) return null;
            const source = TRACK_DEFINITIONS.find((track) => track.id === trackIds[0])!;
            const target = TRACK_DEFINITIONS.find((track) => track.id === trackIds[1])!;
            const active = trackIds.every(
              (trackId) => state.tracks[trackId].level >= (convergence.requirements[trackId] ?? 0),
            );

            return (
              <line
                key={convergence.id}
                x1={source.position.x}
                y1={source.position.y}
                x2={target.position.x}
                y2={target.position.y}
                stroke={active ? "rgba(132, 204, 255, 0.8)" : "rgba(120, 140, 180, 0.18)"}
                strokeDasharray={active ? "0" : "3 4"}
                strokeWidth={active ? 1.4 : 0.7}
              />
            );
          })}
        </svg>
        {TRACK_DEFINITIONS.map((track) => {
          const stateTrack = state.tracks[track.id];
          const Icon = TRACK_ICONS[track.id];
          const selected = state.selectedTrack === track.id;

          return (
            <motion.button
              key={track.id}
              type="button"
              onClick={() => onOpenTrack(track.id)}
              whileHover={{ scale: 1.03 }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[26px] border p-4 text-left shadow-[0_16px_60px_rgba(5,12,32,0.36)] transition ${
                selected
                  ? "border-sky-300/70 bg-slate-900/95"
                  : "border-white/8 bg-slate-950/78 hover:border-white/16"
              } ${stateTrack.unlocked ? "" : "opacity-60"}`}
              style={{
                left: `${track.position.x}%`,
                top: `${track.position.y}%`,
                width: selected ? 196 : 170,
                boxShadow: selected ? `0 0 0 1px ${track.accent}55, 0 0 28px ${track.accent}33` : undefined,
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: `${track.accent}22`, color: track.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                  L{stateTrack.level}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">{track.name}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {stateTrack.unlocked ? track.levels[Math.max(0, stateTrack.level - 1)] || "Dormant" : "Locked"}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (stateTrack.progress / 170) * 100)}%`,
                    background: track.accent,
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <span>{stateTrack.compute} PFLOPS</span>
                <span>{state.employees.filter((employee) => employee.assignedTrack === track.id).length} staff</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function ConvergenceApp() {
  const store = useConvergenceStore();
  const initialize = store.initialize;
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chiefMemo, setChiefMemo] = useState<string | null>(null);
  const [worldLead, setWorldLead] = useState<string | null>(null);
  const [dilemmaFlavor, setDilemmaFlavor] = useState<string | null>(null);
  const [rivalColor, setRivalColor] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState(
    typeof window === "undefined" ? "" : store.aiSettings.apiKey,
  );
  const [isPending, startTransition] = useTransition();
  const deferredFeed = useDeferredValue(store.feed);
  const hasAutosave =
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem("convergence-autosave"));

  const selectedTrack = store.tracks[store.selectedTrack];
  const trackDefinition = TRACK_DEFINITIONS.find((track) => track.id === store.selectedTrack)!;
  const assignedResearchers = store.employees.filter(
    (employee) => employee.assignedTrack === store.selectedTrack,
  );
  const unassignedResearchers = store.employees.filter(
    (employee) => employee.assignedTrack !== store.selectedTrack,
  );
  const totalAllocated = Object.values(store.tracks).reduce((sum, track) => sum + track.compute, 0);
  const freeCompute = store.resources.computeCapacity - totalAllocated;
  const buildOptions = availableBuildOptions(store);
  const convergencePreview = CONVERGENCES.filter((convergence) =>
    Object.keys(convergence.requirements).includes(store.selectedTrack),
  );
  const topRivals = Object.values(store.rivals).sort((left, right) => right.capability - left.capability);
  const topRivalMove = topRivals[0]?.recentMove ?? "Rival status";

  const loadNarratives = useEffectEvent(async () => {
    if (!store.aiSettings.enabled || !store.aiSettings.apiKey || store.mode === "menu") {
      setChiefMemo(null);
      setWorldLead(null);
      setDilemmaFlavor(null);
      setRivalColor(null);
      return;
    }

    const [memo, news, dilemma, rival] = await Promise.all([
      fetchGeminiNarrative(store, "chief-of-staff", store.resolution?.briefing ?? "Quarterly status update."),
      fetchGeminiNarrative(store, "world-news", store.resolution?.worldEvents[0] ?? "World pulse update."),
      store.activeDilemma
        ? fetchGeminiNarrative(store, "dilemma-writer", store.activeDilemma.brief)
        : Promise.resolve(null),
      fetchGeminiNarrative(store, "rival-labs", topRivalMove),
    ]);

    if (memo?.cacheKey) {
      store.cacheNarrative(memo.cacheKey, memo.text);
      setChiefMemo(memo.text);
    }
    if (news?.cacheKey) {
      store.cacheNarrative(news.cacheKey, news.text);
      setWorldLead(news.text);
    }
    if (dilemma?.cacheKey) {
      store.cacheNarrative(dilemma.cacheKey, dilemma.text);
      setDilemmaFlavor(dilemma.text);
    }
    if (rival?.cacheKey) {
      store.cacheNarrative(rival.cacheKey, rival.text);
      setRivalColor(rival.text);
    }
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    void loadNarratives();
  }, [
    store.turn,
    store.activeDilemma?.id,
    store.resolution?.headline,
    store.aiSettings.enabled,
    store.aiSettings.apiKey,
    store.mode,
    topRivalMove,
  ]);

  useEffect(() => {
    if (store.resolution?.breakthroughs.length) {
      playSynthTone(soundEnabled, "breakthrough");
    } else if (store.activeDilemma) {
      playSynthTone(soundEnabled, "warning");
    }
  }, [store.resolution, store.activeDilemma, soundEnabled]);

  if (!store.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050916] text-slate-200">
        Booting simulation stack...
      </div>
    );
  }

  if (store.mode === "menu") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#050916] text-white">
        <PixiBackground />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.16),transparent_28%),linear-gradient(180deg,rgba(4,10,22,0.78),rgba(4,8,20,0.96))]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Convergence</p>
              <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-tight text-white lg:text-6xl">
                Run the AI lab that decides what the century becomes.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Turn-based strategy across 120 quarters of hiring, compute allocation, geopolitics, and moral tradeoffs.
              </p>
            </div>
            <div className="hidden min-w-72 rounded-[28px] border border-white/10 bg-slate-950/80 p-5 lg:block">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session Controls</p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  disabled={!hasAutosave}
                  onClick={() => store.continueAutosave()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/45 bg-sky-500/15 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  <Play className="h-4 w-4" />
                  Continue
                </button>
                {slots.map((slot) => {
                  const summary = store.slotSummaries.find((entry) => entry.slot === slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => store.loadSlot(slot)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition hover:bg-white/8"
                    >
                      <span>
                        <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">Slot {slot}</span>
                        <span className="mt-1 block text-sm text-slate-200">
                          {summary ? summary.subtitle : "Empty"}
                        </span>
                      </span>
                      <Save className="h-4 w-4 text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(START_PRESETS) as StartPresetId[]).map((presetId) => (
              <MenuCard
                key={presetId}
                presetId={presetId}
                unlocked={store.meta.unlockedStarts.includes(presetId)}
                onStart={() => {
                  playSynthTone(soundEnabled, "click");
                  store.newGame(presetId);
                }}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040812] text-white">
      <PixiBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.12),transparent_34%),linear-gradient(180deg,rgba(5,10,22,0.85),rgba(4,8,20,0.96))]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/78 px-5 py-4 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-sky-200">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Convergence</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                {store.year} Q{store.quarterIndex + 1}  Turn {store.turn}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PanelButton active={store.panel === "briefing"} icon={Globe2} label="Briefing" onClick={() => store.openPanel("briefing")} />
            <PanelButton active={store.panel === "track"} icon={BrainCircuit} label="Research" onClick={() => store.openPanel("track")} />
            <PanelButton active={store.panel === "hiring"} icon={Users} label="Hiring" onClick={() => store.openPanel("hiring")} />
            <PanelButton active={store.panel === "facilities"} icon={Building2} label="Facilities" onClick={() => store.openPanel("facilities")} />
            <PanelButton active={store.panel === "settings"} icon={Handshake} label="Settings" onClick={() => store.openPanel("settings")} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              CEO: <span className="font-medium text-white">{store.ceo.name}</span>
              {store.ceo.fired ? " (Interim era)" : ""}
            </div>
            <button
              type="button"
              onClick={() => {
                playSynthTone(soundEnabled, "click");
                store.saveAndQuit();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/8"
            >
              <Save className="h-4 w-4" />
              Save & Quit
            </button>
            <button
              type="button"
              disabled={isPending || Boolean(store.activeDilemma)}
              onClick={() =>
                startTransition(() => {
                  playSynthTone(soundEnabled, "click");
                  store.nextTurn();
                })
              }
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/45 bg-sky-500/15 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
            >
              <Play className="h-4 w-4" />
              End Turn
            </button>
          </div>
        </header>
        <div className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/78 p-5 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">World State</p>
              <div className="mt-4 space-y-4">
                <MetricBar label="Runway (months)" value={Math.min(store.resources.runwayMonths, 36)} max={36} tone={store.resources.runwayMonths < 10 ? "red" : "green"} />
                <MetricBar label="Lab Trust" value={store.resources.trust} tone="green" />
                <MetricBar label="AI Fear" value={store.resources.fear} tone="red" />
                <MetricBar label="Board Confidence" value={store.resources.boardConfidence} tone="amber" />
              </div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Capital</span>
                <span className="font-medium text-white">{formatCurrency(store.resources.capital)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Quarterly Revenue</span>
                <span className="text-emerald-300">{formatCurrency(store.resources.revenue)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Quarterly Burn</span>
                <span className="text-rose-300">{formatCurrency(store.resources.burn)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Compute Capacity</span>
                <span className="text-white">{store.resources.computeCapacity} PFLOPS</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Governments</p>
              <div className="mt-3 space-y-3">
                {Object.values(store.governments).map((government) => (
                  <div key={government.id} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                    <div className="flex items-center justify-between text-sm text-white">
                      <span>{government.name}</span>
                      <span className="text-slate-400">{government.relation}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-400" style={{ width: `${government.relation}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Rival Labs</p>
              <div className="mt-3 space-y-3">
                {topRivals.map((rival) => (
                  <div key={rival.id} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                    <div className="flex items-center justify-between text-sm text-white">
                      <span>{rival.name}</span>
                      <span className="text-slate-400">{Math.round(rival.capability)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-300 to-fuchsia-400" style={{ width: `${rival.capability}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <section className="space-y-4">
            <AnimatePresence>
              {store.tutorialStep < tutorialNotes.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-[24px] border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100"
                >
                  <span className="mr-2 inline-flex rounded-full border border-sky-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-sky-200">
                    Tutorial
                  </span>
                  {tutorialNotes[store.tutorialStep]}
                </motion.div>
              ) : null}
            </AnimatePresence>
            <TrackMap state={store} onOpenTrack={store.openTrack} />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/78 px-4 py-3">
              <div className="ticker-track flex min-w-max gap-6 text-sm text-slate-300">
                {deferredFeed.map((item) => (
                  <div key={item.id} className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.severity === "critical"
                          ? "bg-rose-400"
                          : item.severity === "warning"
                            ? "bg-amber-400"
                            : "bg-sky-400"
                      }`}
                    />
                    <span className="text-slate-100">{item.title}</span>
                    <span className="text-slate-500">{item.body}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <aside className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/78 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Detail Panel</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {store.panel === "track"
                    ? trackDefinition.name
                    : store.panel === "hiring"
                      ? "Talent Market"
                      : store.panel === "facilities"
                        ? "Compute and Facilities"
                        : store.panel === "settings"
                          ? "Settings"
                          : "Quarterly Briefing"}
                </h2>
              </div>
              {store.panel === "track" ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {selectedTrack.unlocked ? `L${selectedTrack.level}` : "Locked"}
                </span>
              ) : null}
            </div>
            {store.panel === "track" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <p className="leading-6 text-slate-300">{trackDefinition.description}</p>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between">
                    <span>Compute Allocation</span>
                    <span className="font-medium text-white">{selectedTrack.compute} PFLOPS</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => store.adjustCompute(store.selectedTrack, -5)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">-5</button>
                    <button type="button" onClick={() => store.adjustCompute(store.selectedTrack, 5)} className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-white">+5</button>
                    <span className="ml-auto text-xs uppercase tracking-[0.18em] text-slate-500">{freeCompute} PFLOPS free</span>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assigned Team</p>
                  <div className="mt-3 space-y-2">
                    {assignedResearchers.length ? assignedResearchers.map((employee) => (
                      <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, null)} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                        <span>
                          <span className="block text-sm font-medium text-white">{employee.name}</span>
                          <span className="text-xs text-slate-400">{employee.role}</span>
                        </span>
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Unassign</span>
                      </button>
                    )) : <p className="text-sm text-slate-500">No one is assigned yet.</p>}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Available Staff</p>
                  <div className="mt-3 space-y-2">
                    {unassignedResearchers.slice(0, 5).map((employee) => (
                      <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, store.selectedTrack)} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                        <span>
                          <span className="block text-sm font-medium text-white">{employee.name}</span>
                          <span className="text-xs text-slate-400">{employee.role}</span>
                        </span>
                        <span className="text-xs uppercase tracking-[0.18em] text-sky-300">Assign</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Convergence Paths</p>
                  <div className="mt-3 space-y-3">
                    {convergencePreview.map((convergence) => (
                      <div key={convergence.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                        <p className="text-sm font-medium text-white">{convergence.name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{convergence.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {store.panel === "briefing" ? (
              <div className="space-y-4 text-sm leading-6 text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Chief of Staff</p>
                  <p className="mt-3 text-base text-white">{chiefMemo ?? store.resolution?.headline}</p>
                  <p className="mt-3 text-slate-300">{store.resolution?.briefing}</p>
                </div>
                {rivalColor ? (
                  <div className="rounded-[24px] border border-violet-400/18 bg-violet-500/10 p-4 text-violet-100">{rivalColor}</div>
                ) : null}
                <div className="grid gap-3">
                  {(store.resolution?.breakthroughs.length ? store.resolution.breakthroughs : ["No major breakthrough this quarter."]).map((item) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">{item}</div>
                  ))}
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">World Pulse</p>
                  <p className="mt-3 text-slate-200">{worldLead ?? store.resolution?.worldEvents[0] ?? "No major event yet."}</p>
                </div>
              </div>
            ) : null}
            {store.panel === "hiring" ? (
              <div className="space-y-3">
                {store.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-medium text-white">{candidate.name}</h3>
                        <p className="text-sm text-slate-400">{candidate.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playSynthTone(soundEnabled, "click");
                          store.hire(candidate.id);
                        }}
                        className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
                      >
                        Hire
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{candidate.bio}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                      <span>Salary {formatCurrency(candidate.salary)}</span>
                      <span>Bonus {formatCurrency(candidate.signingBonus)}</span>
                      <span>Specialty {TRACK_DEFINITIONS.find((track) => track.id === candidate.primaryTrack)?.shortName}</span>
                      <span>{candidate.contestedBy ? `Contested by ${store.rivals[candidate.contestedBy].name}` : "Uncontested"}</span>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{candidate.ask}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {store.panel === "facilities" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Supplier</p>
                  <div className="mt-3 grid gap-2">
                    {SUPPLIER_CONTRACTS.map((supplier) => (
                      <button key={supplier.vendor} type="button" onClick={() => store.chooseSupplier(supplier.vendor)} className={`rounded-2xl border px-3 py-3 text-left ${store.supplier.vendor === supplier.vendor ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{supplier.vendor}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{supplier.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Energy Policy</p>
                  <div className="mt-3 grid gap-2">
                    {ENERGY_POLICIES.map((energy) => (
                      <button key={energy.id} type="button" onClick={() => store.chooseEnergy(energy.id)} className={`rounded-2xl border px-3 py-3 text-left ${store.energyPolicy.id === energy.id ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{energy.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{energy.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expansion</p>
                  <div className="mt-3 grid gap-2">
                    {buildOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => store.startFacility(option.id)} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                        <span className="block font-medium text-white">{option.name}</span>
                        <span className="mt-1 block text-xs text-slate-400">{option.region}  Cost {formatCurrency(option.buildCost)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {store.panel === "settings" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Gemini API Key</label>
                  <input
                    value={apiKeyDraft}
                    onChange={(event) => setApiKeyDraft(event.target.value)}
                    placeholder="AIza..."
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Stored locally only. The simulation stays fully playable without it; AI is narrative flavor.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => store.updateAIConfig(true, apiKeyDraft.trim())} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white">Enable AI Narrative</button>
                    <button type="button" onClick={() => store.updateAIConfig(false, apiKeyDraft.trim())} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Disable</button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <button type="button" onClick={() => setSoundEnabled((value) => !value)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white">
                    <AudioLines className="h-4 w-4" />
                    Sound {soundEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Manual Saves</p>
                  <div className="mt-3 grid gap-2">
                    {slots.map((slot) => (
                      <button key={slot} type="button" onClick={() => store.saveSlot(slot)} className="rounded-2xl border border-white/8 bg-slate-950/65 px-4 py-3 text-left text-sm text-white">
                        Save to Slot {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
      <AnimatePresence>
        {store.activeDilemma ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-[#0a1124]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/12 p-3 text-amber-200">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-200">{store.activeDilemma.source}</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">{store.activeDilemma.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{dilemmaFlavor ?? store.activeDilemma.brief}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {store.activeDilemma.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      playSynthTone(soundEnabled, "warning");
                      store.resolveDilemma(option);
                    }}
                    className="rounded-[24px] border border-white/10 bg-white/4 p-4 text-left transition hover:border-sky-400/35 hover:bg-sky-500/8"
                  >
                    <h3 className="text-base font-medium text-white">{option.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{option.summary}</p>
                    <div className="mt-4 space-y-2">
                      {option.outcomes.map((outcome) => (
                        <div key={outcome.id}>
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            <span>{outcome.label}</span>
                            <span>{Math.round(outcome.chance * 100)}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/6">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-violet-400" style={{ width: `${outcome.chance * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {store.mode === "ended" && store.ending ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-slate-950/76 p-4 backdrop-blur-sm"
          >
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[#081021]/96 p-8">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Ending Reached</p>
              <h2 className="mt-3 text-4xl font-semibold text-white">{store.ending.title}</h2>
              <p className="mt-4 text-lg text-slate-200">{store.ending.summary}</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{store.ending.epilogue}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => store.saveAndQuit()} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-white">Return to Menu</button>
                <button type="button" onClick={() => store.newGame("founder")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200">Start Another Run</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
