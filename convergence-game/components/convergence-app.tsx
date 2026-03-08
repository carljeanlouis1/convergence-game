"use client";

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  AudioLines,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Building2,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudDownload,
  CloudUpload,
  Cpu,
  FlaskConical,
  Globe2,
  Handshake,
  KeyRound,
  Lock,
  Orbit,
  Pause,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Radar,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  fetchGeminiNarrative,
  generateGeminiSceneImage,
  synthesizeOpenAITts,
  validateGeminiKey,
  validateOpenAITtsKey,
} from "@/lib/game/ai";
import {
  clearStoredCloudCredentials,
  deriveCloudCredentials,
  listCloudSaves,
  loadCloudSave,
  loadStoredCloudCredentials,
  saveCloudSnapshot,
  saveStoredCloudCredentials,
} from "@/lib/game/cloud";
import {
  CONVERGENCES,
  ENERGY_POLICIES,
  START_PRESETS,
  SUPPLIER_CONTRACTS,
  TRACK_DEFINITIONS,
} from "@/lib/game/data";
import {
  availableBuildOptions,
  canResearcherSupportTrack,
  describeGovernmentRelation,
  formatCurrency,
  getFacilityBuildTime,
  getTrackForecast,
  getTrackRevenueBreakdown,
  tutorialNotes,
} from "@/lib/game/engine";
import { useConvergenceStore } from "@/lib/game/store";
import {
  CloudCredentials,
  CloudSaveSlotId,
  CloudSaveSummary,
  GameState,
  RivalId,
  SaveSlotId,
  StartPresetId,
  TrackId,
} from "@/lib/game/types";
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

const TRACK_UNLOCK_NOTES: Record<TrackId, string> = {
  foundation: "Foundation is online from day one.",
  alignment: "Alignment is online from day one.",
  simulation: "Simulation is online from day one.",
  robotics: "Hire a roboticist to light up embodied systems.",
  biology: "Hire a biologist or biosecurity lead to open biotech work.",
  materials: "Hire a materials scientist to unlock industrial R&D.",
  quantum: "Hire a quantum specialist to unlock cryptographic and simulation work.",
  space: "Hire an orbital systems lead to unlock aerospace projects.",
};

const slots: SaveSlotId[] = [1, 2, 3];

const tutorialSlides = [
  {
    title: "The Quarterly Loop",
    summary: "Every turn is one quarter. You survive by balancing research speed, credibility, and cash.",
    points: [
      "End Turn advances research, resolves construction, updates rivals, and rolls new world pressure.",
      "The briefing tells you what moved, what is threatening you, and what should matter next.",
      "Dilemmas are permanent history. They feed endings, trust, dependence, and ethics debt.",
    ],
  },
  {
    title: "Reading the Bars",
    summary: "The left rail is your command board. Those bars are not flavor.",
    points: [
      "Runway is months until cash-out if the current revenue and expense mix holds.",
      "Government relation bars show how cooperative each bloc is. Higher scores mean easier contracts, lower scores mean scrutiny or pressure.",
      "Rival cards track capability, safety, and goodwill so you can see who is fast, reckless, or politically dangerous.",
    ],
  },
  {
    title: "Research Like XCOM",
    summary: "Each track behaves like an active research program with scientists, throughput, and ETA.",
    points: [
      "Assign people to a track and give it compute. Specialists only work in their primary or secondary lanes unless they are marked as generalists.",
      "Each track panel shows the current project, stage technology, revenue programs, research load, and estimated turns to finish the next level.",
      "Unlocked levels create revenue streams, new dilemmas, and convergence paths with other tracks.",
    ],
  },
  {
    title: "Money and Burn",
    summary: "Hiring does not just cost a signing bonus. It permanently changes payroll and your quarterly burn.",
    points: [
      "Revenue streams come from discovered products, partnerships, and convergence events.",
      "Expenses are broken into payroll, compute, facilities, research overhead, and expansion projects.",
      "A beautiful lab that cannot pay for its clusters still dies.",
    ],
  },
  {
    title: "Suppliers and Facilities",
    summary: "Vendors and energy policy create real tradeoffs instead of flat upgrades.",
    points: [
      "Different chip suppliers favor different research styles: raw model scale, simulation throughput, or balanced deployment.",
      "Energy choices affect cost, reputation, and sustained high-utilization performance.",
      "Facility projects take quarters to finish, just like XCOM infrastructure. Commit only when the timing works.",
    ],
  },
  {
    title: "Winning the Race",
    summary: "The game ends through trajectories, not a single score target.",
    points: [
      "Beneficial ASI now means reaching Foundation L6: Artificial Superintelligence with strong alignment, trust, and enough public legitimacy to keep control.",
      "Other endings include catastrophic misalignment, regulatory capture, irrelevance, corporate dystopia, transcendence, simulation revelation, and open future.",
      "The race board compares labs on capability, trust, reliability, safety, and overall momentum so you can see who is closest to imposing their version of the future.",
    ],
  },
  {
    title: "Dilemmas and Voice",
    summary: "Decisions are logged, can shift endings, and can now be narrated out loud.",
    points: [
      "The decision log in the briefing panel remembers your calls and impact lines.",
      "Gemini adds narrative flavor only. The deterministic simulation runs with or without it.",
      "OpenAI voice can read your quarterly summary using the `nova` voice if you activate it in Settings.",
    ],
  },
];

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

function statusPanelClasses(tone: "idle" | "checking" | "success" | "error") {
  if (tone === "success") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (tone === "error") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (tone === "checking") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-slate-950/55 text-slate-300";
}

function formatTurns(turns: number | null) {
  if (turns === null) return "Awaiting staff";
  return `${turns}Q`;
}

function renderInlineFormatting(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return (
        <strong key={`${chunk}-${index}`} className="font-semibold text-white">
          {chunk.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${chunk}-${index}`}>{chunk}</span>;
  });
}

function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0);

  return (
    <div className={`space-y-3 break-words text-slate-300 ${className}`}>
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split("\n");

        return (
          <p key={`${paragraph}-${index}`} className="leading-7">
            {lines.map((line, lineIndex) => (
              <span key={`${line}-${lineIndex}`}>
                {renderInlineFormatting(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function MetricBar({
  label,
  value,
  max = 100,
  tone = "blue",
  helper,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "blue" | "amber" | "green" | "red";
  helper?: string;
}) {
  const width = `${Math.max(5, Math.min(100, (value / max) * 100))}%`;
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
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/6">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width }} />
      </div>
      {helper ? <p className="text-xs leading-5 text-slate-500">{helper}</p> : null}
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
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

function IntelSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/65 p-1 text-slate-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function getTrackLabel(trackId: TrackId | null | undefined) {
  if (!trackId) {
    return "Unassigned";
  }

  return TRACK_DEFINITIONS.find((track) => track.id === trackId)?.shortName ?? trackId;
}

function describeResearcherCoverage(trackIds: TrackId[]) {
  return trackIds.map((trackId) => getTrackLabel(trackId)).join(" + ");
}

function describeAssignmentScope(
  employee: { generalist?: boolean; primaryTrack: TrackId; secondaryTrack?: TrackId },
) {
  if (employee.generalist) {
    return "Generalist support across any unlocked track.";
  }

  return employee.secondaryTrack
    ? `Eligible for ${getTrackLabel(employee.primaryTrack)} and ${getTrackLabel(employee.secondaryTrack)}.`
    : `Eligible for ${getTrackLabel(employee.primaryTrack)} only.`;
}

function describeConvergenceReward(reward: {
  capital?: number;
  trust?: number;
  fear?: number;
  compute?: number;
  board?: number;
}) {
  const parts = [
    reward.capital ? `${formatCurrency(reward.capital)} capital` : null,
    reward.compute ? `+${reward.compute} PFLOPS` : null,
    reward.trust ? `${reward.trust >= 0 ? "+" : ""}${reward.trust} trust` : null,
    reward.fear ? `${reward.fear >= 0 ? "+" : ""}${reward.fear} fear` : null,
    reward.board ? `${reward.board >= 0 ? "+" : ""}${reward.board} board` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "Narrative payoff only";
}

function describeFacilityOutcome(project: {
  id: string;
  region: string;
  computeDelta: number;
  trustDelta: number;
  riskDelta: number;
}) {
  const baseline = `On completion: +${project.computeDelta} PFLOPS for research allocation.`;

  switch (project.id) {
    case "dc-virginia":
      return `${baseline} Improves U.S. trust and makes defense-facing expansion more politically stable.`;
    case "dc-doha":
      return `${baseline} Opens cheap Gulf compute with higher geopolitical exposure and trust drag.`;
    case "dc-helsinki":
      return `${baseline} Best public-trust profile, with low risk and clean-infrastructure signaling.`;
    case "dc-bengaluru":
      return `${baseline} Strengthens India ties and broadens your talent and deployment footprint.`;
    default:
      return `${baseline} Trust ${project.trustDelta >= 0 ? "+" : ""}${project.trustDelta}, risk ${
        project.riskDelta >= 0 ? "+" : ""
      }${project.riskDelta}.`;
  }
}

function clampMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stageStatusClasses(status: "completed" | "active" | "locked" | "future") {
  switch (status) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "active":
      return "border-sky-400/35 bg-sky-500/10 text-sky-100";
    case "locked":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-slate-400";
  }
}

function cloudSlotLabel(slot: CloudSaveSlotId) {
  return slot === "autosave" ? "Cloud Continue" : `Cloud Slot ${slot}`;
}

function describePlayerTrajectory(state: GameState) {
  if (state.tracks.foundation.level >= 6 && state.tracks.alignment.level >= 5 && state.resources.trust >= 58) {
    return "Beneficial ASI";
  }

  if (state.tracks.foundation.level >= 6 && state.tracks.alignment.level <= 1) {
    return "Catastrophic Misalignment";
  }

  if (state.flags.governmentDependence >= 10) {
    return "Regulatory Capture";
  }

  if (state.resources.revenue >= 22 && state.flags.ethicsDebt >= 8 && state.tracks.foundation.level >= 4) {
    return "Corporate Dystopia";
  }

  if (state.tracks.robotics.level >= 4 && state.tracks.space.level >= 4 && state.tracks.materials.level >= 4) {
    return "Transcendence";
  }

  if (state.tracks.simulation.level >= 5 && state.tracks.quantum.level >= 4 && state.tracks.foundation.level >= 4) {
    return "Simulation Revelation";
  }

  return state.tracks.foundation.level >= state.tracks.alignment.level + 2 ? "Capability Sprint" : "Open Future";
}

function describeRivalTrajectory(rivalId: RivalId) {
  switch (rivalId) {
    case "prometheus":
      return "Beneficial ASI Vector";
    case "velocity":
      return "Reckless Capability Sprint";
    case "zhongguancun":
      return "Sovereign Scale Push";
    case "opencollective":
      return "Open Future Vector";
    default:
      return "Strategic Drift";
  }
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

function TutorialOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  const slide = tutorialSlides[step];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-[#081021]/96 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
          >
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-white/10 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-200">How To Play</p>
                <div className="mt-4 space-y-2">
                  {tutorialSlides.map((entry, index) => (
                    <button
                      key={entry.title}
                      type="button"
                      onClick={() => setStep(index)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        index === step
                          ? "border-sky-400/40 bg-sky-500/12 text-white"
                          : "border-white/8 bg-slate-950/65 text-slate-300 hover:border-white/16"
                      }`}
                    >
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Step {index + 1}
                      </span>
                      <span className="mt-1 block font-medium">{entry.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.12),transparent_34%),linear-gradient(180deg,rgba(10,18,38,0.94),rgba(7,12,28,0.96))] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Tutorial {step + 1}/{tutorialSlides.length}
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">{slide.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">{slide.summary}</p>
                <div className="mt-6 grid gap-3">
                  {slide.points.map((point) => (
                    <div key={point} className="rounded-[22px] border border-white/8 bg-slate-950/55 px-4 py-4 text-sm leading-7 text-slate-300">
                      {point}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={step === 0}
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (step === tutorialSlides.length - 1) {
                        onClose();
                        return;
                      }
                      setStep((current) => Math.min(tutorialSlides.length - 1, current + 1));
                    }}
                    className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white"
                  >
                    {step === tutorialSlides.length - 1 ? "Enter Lab" : "Next"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function TrackMap({
  state,
  onOpenTrack,
}: {
  state: GameState;
  onOpenTrack: (trackId: TrackId) => void;
}) {
  const links = CONVERGENCES.flatMap((convergence) => {
    const ids = Object.keys(convergence.requirements) as TrackId[];

    return ids.flatMap((sourceId, index) =>
      ids.slice(index + 1).map((targetId) => ({
        key: `${convergence.id}-${sourceId}-${targetId}`,
        source: TRACK_DEFINITIONS.find((track) => track.id === sourceId)!,
        target: TRACK_DEFINITIONS.find((track) => track.id === targetId)!,
        active: ids.every((trackId) => state.tracks[trackId].level >= (convergence.requirements[trackId] ?? 0)),
      })),
    );
  });

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.16),transparent_38%),linear-gradient(180deg,rgba(7,12,28,0.96),rgba(7,10,24,0.88))] p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lab Map</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Research Web</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Each node is an active research program. Assign staff, allocate compute, and watch ETA shrink.
          </p>
        </div>
        <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-sky-200">
          {Math.round(
            (Object.values(state.tracks).reduce((sum, track) => sum + track.compute, 0) /
              Math.max(state.resources.computeCapacity, 1)) *
              100,
          )}
          % compute committed
        </div>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(12,18,38,0.88),rgba(8,12,24,0.92))]">
        <div className="border-b border-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 lg:hidden">
          Scroll to inspect the full research web.
        </div>
        <div className="overflow-auto">
          <div className="relative h-[620px] min-w-[920px] lg:h-[560px] lg:min-w-0 2xl:h-[660px]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {links.map((link) => (
                <line
                  key={link.key}
                  x1={link.source.position.x}
                  y1={link.source.position.y}
                  x2={link.target.position.x}
                  y2={link.target.position.y}
                  stroke={link.active ? "rgba(132, 204, 255, 0.72)" : "rgba(120, 140, 180, 0.14)"}
                  strokeDasharray={link.active ? "0" : "3 4"}
                  strokeWidth={link.active ? 1.3 : 0.7}
                />
              ))}
            </svg>
            {TRACK_DEFINITIONS.map((track) => {
              const stateTrack = state.tracks[track.id];
              const Icon = TRACK_ICONS[track.id];
              const selected = state.selectedTrack === track.id;
              const forecast = getTrackForecast(state, track.id);

              return (
                <motion.button
                  key={track.id}
                  type="button"
                  onClick={() => onOpenTrack(track.id)}
                  whileHover={{ scale: 1.03 }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[24px] border p-4 text-left shadow-[0_16px_60px_rgba(5,12,32,0.36)] transition ${
                    selected
                      ? "border-sky-300/70 bg-slate-900/95"
                      : "border-white/8 bg-slate-950/78 hover:border-white/16"
                  } ${stateTrack.unlocked ? "" : "opacity-70"}`}
                  style={{
                    left: `${track.position.x}%`,
                    top: `${track.position.y}%`,
                    width: selected ? 184 : 158,
                    boxShadow: selected ? `0 0 0 1px ${track.accent}55, 0 0 28px ${track.accent}33` : undefined,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ background: `${track.accent}22`, color: track.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                      {stateTrack.unlocked ? `L${stateTrack.level}` : "Locked"}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{track.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {stateTrack.unlocked ? forecast.projectName : TRACK_UNLOCK_NOTES[track.id]}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        width: stateTrack.unlocked ? `${forecast.progressPercent}%` : "0%",
                        background: track.accent,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <span>{stateTrack.compute} PFLOPS</span>
                    <span>{forecast.assignedCount} staff</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    <span>+{forecast.progressPerTurn}/Q</span>
                    <span>{stateTrack.unlocked ? formatTurns(forecast.turnsToLevel) : "Hire"}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConvergenceApp() {
  const store = useConvergenceStore();
  const initialize = store.initialize;
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [saveQuitOpen, setSaveQuitOpen] = useState(false);
  const [saveQuitBusy, setSaveQuitBusy] = useState(false);
  const [saveQuitStatus, setSaveQuitStatus] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  }>({
    tone: "idle",
    message: "Choose where to store this run before returning to the menu.",
  });
  const [intelCollapsed, setIntelCollapsed] = useState(false);
  const [worldStateOpen, setWorldStateOpen] = useState(true);
  const [governmentsOpen, setGovernmentsOpen] = useState(true);
  const [rivalsOpen, setRivalsOpen] = useState(true);
  const [chiefMemo, setChiefMemo] = useState<string | null>(null);
  const [worldLead, setWorldLead] = useState<string | null>(null);
  const [dilemmaFlavor, setDilemmaFlavor] = useState<string | null>(null);
  const [rivalColor, setRivalColor] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null);
  const [openAiKeyDraft, setOpenAiKeyDraft] = useState<string | null>(null);
  const [geminiStatusOverride, setGeminiStatusOverride] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  } | null>(null);
  const [openAiStatusOverride, setOpenAiStatusOverride] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  } | null>(null);
  const [sceneArtStatus, setSceneArtStatus] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  }>({
    tone: "idle",
    message: "Scene art is ready when you want extra flavor.",
  });
  const [sceneArtUrl, setSceneArtUrl] = useState<string | null>(null);
  const [sceneArtScope, setSceneArtScope] = useState<"briefing" | "dilemma" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNarrating, setIsNarrating] = useState(false);
  const deferredFeed = useDeferredValue(store.feed);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const sceneArtUrlRef = useRef<string | null>(null);
  const autoNarratedTurnRef = useRef<number | null>(null);
  const hasAutosave =
    typeof window !== "undefined" && Boolean(window.localStorage.getItem("convergence-autosave"));
  const [cloudCredentials, setCloudCredentials] = useState<CloudCredentials | null>(null);
  const [cloudCommanderIdDraft, setCloudCommanderIdDraft] = useState("");
  const [cloudPassphraseDraft, setCloudPassphraseDraft] = useState("");
  const [cloudSummaries, setCloudSummaries] = useState<CloudSaveSummary[]>([]);
  const [cloudStatus, setCloudStatus] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  }>({
    tone: "idle",
    message: "Cloud saves are disconnected.",
  });
  const [cloudBusyKey, setCloudBusyKey] = useState<string | null>(null);

  const geminiStatus =
    geminiStatusOverride ??
    (store.aiSettings.enabled && store.aiSettings.apiKey
      ? { tone: "success" as const, message: "Gemini narrative is active." }
      : { tone: "idle" as const, message: "Gemini narrative is disabled." });

  const openAiStatus =
    openAiStatusOverride ??
    (store.openAISettings.enabled && store.openAISettings.apiKey
      ? {
          tone: "success" as const,
          message: "OpenAI voice is active and ready to narrate turn summaries.",
        }
      : { tone: "idle" as const, message: "OpenAI voice is disabled." });
  const cloudAutosaveSummary = cloudSummaries.find((entry) => entry.slot === "autosave");
  const saveControlsLocked = saveQuitBusy || cloudBusyKey !== null;

  const selectedTrack = store.tracks[store.selectedTrack];
  const trackDefinition = TRACK_DEFINITIONS.find((track) => track.id === store.selectedTrack)!;
  const selectedForecast = getTrackForecast(store, store.selectedTrack);
  const assignedResearchers = store.employees.filter(
    (employee) => employee.assignedTrack === store.selectedTrack,
  );
  const availableResearchers = store.employees.filter(
    (employee) =>
      selectedTrack.unlocked &&
      employee.assignedTrack === null &&
      canResearcherSupportTrack(employee, store.selectedTrack),
  );
  const committedResearchers = store.employees.filter(
    (employee) =>
      selectedTrack.unlocked &&
      employee.assignedTrack !== null &&
      employee.assignedTrack !== store.selectedTrack &&
      canResearcherSupportTrack(employee, store.selectedTrack),
  );
  const ineligibleResearchers = store.employees.filter(
    (employee) =>
      employee.assignedTrack !== store.selectedTrack &&
      !canResearcherSupportTrack(employee, store.selectedTrack),
  );
  const totalAllocated = Object.values(store.tracks).reduce((sum, track) => sum + track.compute, 0);
  const freeCompute = store.resources.computeCapacity - totalAllocated;
  const buildOptions = availableBuildOptions(store);
  const convergencePreview = CONVERGENCES
    .filter((convergence) => Object.keys(convergence.requirements).includes(store.selectedTrack))
    .sort(
      (left, right) =>
        (left.requirements[store.selectedTrack] ?? 0) - (right.requirements[store.selectedTrack] ?? 0),
    );
  const topRivals = Object.values(store.rivals).sort((left, right) => right.capability - left.capability);
  const averageEthics =
    store.employees.reduce((sum, employee) => sum + employee.ethics, 0) /
    Math.max(store.employees.length, 1);
  const averageLeadership =
    store.employees.reduce((sum, employee) => sum + employee.leadership, 0) /
    Math.max(store.employees.length, 1);
  const playerCapability = clampMetric(
    store.tracks.foundation.level * 12 +
      store.tracks.alignment.level * 6 +
      store.tracks.simulation.level * 6 +
      store.tracks.quantum.level * 5 +
      store.tracks.robotics.level * 4 +
      store.tracks.biology.level * 4 +
      store.tracks.materials.level * 4 +
      store.tracks.space.level * 4 +
      Math.min(20, store.resources.computeCapacity / 10),
  );
  const playerTrust = clampMetric((store.resources.trust + store.resources.reputation) / 2 + averageEthics * 1.2);
  const playerSafety = clampMetric(
    store.tracks.alignment.level * 14 +
      store.flags.safetyCulture * 9 +
      store.resources.trust * 0.35 +
      averageEthics * 2.1,
  );
  const playerReliability = clampMetric(
    store.resources.boardConfidence * 0.25 +
      store.resources.trust * 0.35 +
      store.resources.reputation * 0.2 +
      store.flags.safetyCulture * 10 +
      store.tracks.alignment.level * 5 +
      averageLeadership * 1.7,
  );
  const labLeaderboard = [
    {
      id: "player",
      name: "Convergence",
      capability: playerCapability,
      trust: playerTrust,
      reliability: playerReliability,
      safety: playerSafety,
      raceScore: clampMetric(playerCapability * 0.5 + playerSafety * 0.15 + playerTrust * 0.15 + playerReliability * 0.2),
      trajectory: describePlayerTrajectory(store),
      isPlayer: true,
    },
    ...topRivals.map((rival) => ({
      id: rival.id,
      name: rival.name,
      capability: clampMetric(rival.capability),
      trust: clampMetric(rival.goodwill),
      reliability: clampMetric(rival.safety * 0.55 + rival.goodwill * 0.45),
      safety: clampMetric(rival.safety),
      raceScore: clampMetric(rival.capability * 0.55 + rival.safety * 0.2 + rival.goodwill * 0.1 + (rival.safety * 0.55 + rival.goodwill * 0.45) * 0.15),
      trajectory: describeRivalTrajectory(rival.id),
      isPlayer: false,
    })),
  ].sort((left, right) => right.raceScore - left.raceScore);
  const topRivalMove = topRivals[0]?.recentMove ?? "Rival status";
  const expenseEntries = Object.entries(store.resources.expenses).sort((left, right) => right[1] - left[1]);
  const quarterlyNet = Number((store.resources.revenue - store.resources.burn).toFixed(2));
  const trackRevenueStream = store.revenueStreams.find((stream) => stream.id === `track-${store.selectedTrack}`);
  const trackRevenueBreakdown = getTrackRevenueBreakdown(store.selectedTrack);
  const unlockedRevenueStages = trackRevenueBreakdown.filter((stage) => stage.level <= selectedTrack.level);
  const totalUnlockedStageRevenue = unlockedRevenueStages.reduce((sum, stage) => sum + stage.stageRevenue, 0);
  const selectedTrackRoadmap = trackRevenueBreakdown.map((stage) => {
    const isCompleted = selectedTrack.level >= stage.level;
    const isActive =
      selectedTrack.unlocked &&
      selectedTrack.level < trackDefinition.levels.length &&
      selectedTrack.level + 1 === stage.level;
    const status: "completed" | "active" | "locked" | "future" =
      !selectedTrack.unlocked && stage.level === 1
        ? "locked"
        : isCompleted
          ? "completed"
          : isActive
            ? "active"
            : "future";
    const stageConvergences = convergencePreview
      .filter((convergence) => (convergence.requirements[store.selectedTrack] ?? 0) === stage.level)
      .map((convergence) => {
        const partnerRequirements = Object.entries(convergence.requirements).filter(
          ([trackId]) => trackId !== store.selectedTrack,
        ) as Array<[string, number]>;
        const partnerSummary = partnerRequirements.length
          ? partnerRequirements
              .map(([trackId, level]) => {
                const partnerLabel =
                  TRACK_DEFINITIONS.find((track) => track.id === trackId)?.shortName ?? trackId;

                return `${partnerLabel} ${level}`;
              })
              .join(" + ")
          : "No partner requirement";
        const partnerReadiness = partnerRequirements.map(([trackId, level]) => ({
          id: trackId as TrackId,
          label: TRACK_DEFINITIONS.find((track) => track.id === trackId)?.shortName ?? trackId,
          currentLevel: store.tracks[trackId as TrackId].level,
          requiredLevel: level,
        }));
        const partnersReady = partnerReadiness.every(
          (requirement) => requirement.currentLevel >= requirement.requiredLevel,
        );
        const triggered = store.convergences.some((entry) => entry.id === convergence.id);

        return {
          ...convergence,
          partnerSummary,
          partnerReadiness,
          partnersReady,
          triggered,
        };
      });

    return {
      ...stage,
      status,
      isCompleted,
      isActive,
      progressPercent: isActive ? selectedForecast.progressPercent : isCompleted ? 100 : 0,
      turnsToLevel: isActive ? selectedForecast.turnsToLevel : null,
      stageConvergences,
      isBlocked: isActive && Boolean(selectedForecast.blockedReason),
    };
  });
  const pendingHirePayroll = store.pendingHires.reduce((sum, hire) => sum + hire.salary / 4, 0);
  const pendingHireCloseCost = store.pendingHires.reduce(
    (sum, hire) => sum + hire.salary / 4 + hire.signingBonus,
    0,
  );
  const payrollEntries = [...store.employees].sort((left, right) => right.salary - left.salary);
  const layoutClass = intelCollapsed
    ? "grid flex-1 gap-4 xl:grid-cols-[88px_minmax(0,1fr)] 2xl:grid-cols-[88px_minmax(0,1fr)_minmax(330px,380px)]"
    : "grid flex-1 gap-4 xl:grid-cols-[minmax(250px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(250px,280px)_minmax(0,1fr)_minmax(330px,380px)]";
  const currentNarrationText = [
    store.resolution?.headline,
    chiefMemo ?? store.resolution?.briefing,
    store.resolution?.worldEvents[0] ? `World pulse. ${store.resolution.worldEvents[0]}.` : null,
    store.decisionLog[0]
      ? `Latest decision. ${store.decisionLog[0].title}. You chose ${store.decisionLog[0].choice}. Result: ${store.decisionLog[0].outcome}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const currentDilemmaNarrationText = store.activeDilemma
    ? [
        store.activeDilemma.title,
        store.activeDilemma.brief,
        dilemmaFlavor ? `Context note. ${dilemmaFlavor}` : null,
        `Options: ${store.activeDilemma.options
          .map((option) => `${option.label}. ${option.summary}`)
          .join(" ")}`,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const refreshCloudSummaries = async (credentialsToUse: CloudCredentials | null = cloudCredentials) => {
    if (!credentialsToUse) {
      setCloudSummaries([]);
      return false;
    }

    const result = await listCloudSaves(credentialsToUse);
    if (!result.ok) {
      setCloudStatus({
        tone: "error",
        message: result.message,
      });
      return false;
    }

    setCloudSummaries(result.summaries);
    setCloudStatus({
      tone: "success",
      message: result.summaries.length
        ? `Cloud saves connected for ${credentialsToUse.commanderId}.`
        : `Cloud saves ready for ${credentialsToUse.commanderId}.`,
    });
    return true;
  };

  const connectCloudSaves = async () => {
    setCloudBusyKey("connect");
    setCloudStatus({
      tone: "checking",
      message: "Connecting to Cloudflare save storage...",
    });

    try {
      const credentials = await deriveCloudCredentials(cloudCommanderIdDraft, cloudPassphraseDraft);
      const result = await listCloudSaves(credentials);

      if (!result.ok) {
        setCloudStatus({
          tone: "error",
          message: result.message,
        });
        return;
      }

      saveStoredCloudCredentials(credentials);
      setCloudCredentials(credentials);
      setCloudCommanderIdDraft(credentials.commanderId);
      setCloudPassphraseDraft("");
      setCloudSummaries(result.summaries);
      setCloudStatus({
        tone: "success",
        message: result.summaries.length
          ? `Connected. ${result.summaries.length} cloud save${result.summaries.length === 1 ? "" : "s"} found.`
          : "Connected. Your cloud save space is ready.",
      });
    } catch (error) {
      setCloudStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to connect cloud saves.",
      });
    } finally {
      setCloudBusyKey(null);
    }
  };

  const disconnectCloudSaves = () => {
    clearStoredCloudCredentials();
    setCloudCredentials(null);
    setCloudSummaries([]);
    setCloudPassphraseDraft("");
    setCloudStatus({
      tone: "idle",
      message: "Cloud saves are disconnected.",
    });
  };

  const pushCloudSave = async (slot: CloudSaveSlotId) => {
    if (!cloudCredentials) {
      setCloudStatus({
        tone: "error",
        message: "Connect cloud saves first.",
      });
      return false;
    }

    setCloudBusyKey(`save-${slot}`);
    const result = await saveCloudSnapshot(cloudCredentials, slot, store.exportCloudSnapshot());

    if (!result.ok) {
      setCloudStatus({
        tone: "error",
        message: result.message,
      });
      setCloudBusyKey(null);
      return false;
    }

    await refreshCloudSummaries(cloudCredentials);
    setCloudStatus({
      tone: "success",
      message: `${cloudSlotLabel(slot)} updated in Cloudflare storage. Cross-browser sync can take a few seconds.`,
    });
    setCloudBusyKey(null);
    return true;
  };

  const pullCloudSave = async (slot: CloudSaveSlotId) => {
    if (!cloudCredentials) {
      setCloudStatus({
        tone: "error",
        message: "Connect cloud saves first.",
      });
      return;
    }

    setCloudBusyKey(`load-${slot}`);
    const result = await loadCloudSave(cloudCredentials, slot);

    if (!result.ok) {
      setCloudStatus({
        tone: "error",
        message: result.message,
      });
      setCloudBusyKey(null);
      return;
    }

    if (!result.record) {
      setCloudStatus({
        tone: "error",
        message: "Cloud save data was missing.",
      });
      setCloudBusyKey(null);
      return;
    }

    playSynthTone(soundEnabled, "click");
    store.loadSnapshot(result.record.snapshot);
    await refreshCloudSummaries(cloudCredentials);
    setCloudStatus({
      tone: "success",
      message: `${cloudSlotLabel(slot)} loaded from the cloud.`,
    });
    setCloudBusyKey(null);
  };

  const finalizeSaveAndQuit = () => {
    setSaveQuitBusy(false);
    setSaveQuitOpen(false);
    setSaveQuitStatus({
      tone: "idle",
      message: "Choose where to store this run before returning to the menu.",
    });
    store.saveAndQuit();
  };

  const openSaveAndQuitDialog = () => {
    setSaveQuitStatus({
      tone: "idle",
      message: cloudCredentials
        ? "Pick a local slot, a cloud slot, or use the autosave-only exit."
        : "Pick a local slot or use the autosave-only exit.",
    });
    setSaveQuitOpen(true);
  };

  const handleSaveAndQuit = async () => {
    setSaveQuitBusy(true);
    setSaveQuitStatus({
      tone: "checking",
      message: cloudCredentials
        ? "Saving local autosave and syncing cloud continue slot..."
        : "Saving local autosave and returning to menu...",
    });

    if (cloudCredentials) {
      await pushCloudSave("autosave");
    }

    finalizeSaveAndQuit();
  };

  const saveLocalSlotAndQuit = async (slot: SaveSlotId) => {
    setSaveQuitBusy(true);
    setSaveQuitStatus({
      tone: "checking",
      message: `Saving this run to local slot ${slot}...`,
    });
    store.saveSlot(slot);
    await handleSaveAndQuit();
  };

  const saveCloudSlotAndQuit = async (slot: SaveSlotId) => {
    setSaveQuitBusy(true);
    setSaveQuitStatus({
      tone: "checking",
      message: `Uploading this run to cloud slot ${slot}...`,
    });

    if (!cloudCredentials) {
      setSaveQuitBusy(false);
      setSaveQuitStatus({
        tone: "error",
        message: "Connect cloud saves first.",
      });
      return;
    }

    const saved = await pushCloudSave(slot);
    if (!saved) {
      setSaveQuitBusy(false);
      setSaveQuitStatus({
        tone: "error",
        message: `Cloud slot ${slot} could not be updated. Fix that first or use a local slot.`,
      });
      return;
    }

    finalizeSaveAndQuit();
  };

  const stopNarration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsNarrating(false);
  };

  const playBlob = async (blob: Blob) => {
    stopNarration();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioUrlRef.current = url;
    audioRef.current = audio;
    audio.onended = () => {
      stopNarration();
    };
    audio.onerror = () => {
      setOpenAiStatusOverride({
        tone: "error",
        message: "The browser could not play the generated narration.",
      });
      stopNarration();
    };
    setIsNarrating(true);

    try {
      await audio.play();
    } catch {
      setOpenAiStatusOverride({
        tone: "error",
        message: "The browser blocked audio playback. Interact with the page and try again.",
      });
      stopNarration();
    }
  };

  const clearSceneArt = () => {
    if (sceneArtUrlRef.current) {
      URL.revokeObjectURL(sceneArtUrlRef.current);
      sceneArtUrlRef.current = null;
    }

    setSceneArtUrl(null);
    setSceneArtScope(null);
  };

  const narrateText = async ({
    text,
    instructions,
    loadingMessage,
    successMessage,
  }: {
    text: string;
    instructions: string;
    loadingMessage: string;
    successMessage: string;
  }) => {
    if (!store.openAISettings.enabled || !store.openAISettings.apiKey) {
      setOpenAiStatusOverride({
        tone: "error",
        message: "Activate OpenAI voice in Settings first.",
      });
      return;
    }

    setOpenAiStatusOverride({
      tone: "checking",
      message: loadingMessage,
    });

    const result = await synthesizeOpenAITts({
      apiKey: store.openAISettings.apiKey,
      text,
      instructions,
    });

    if (!result.ok || !result.blob) {
      setOpenAiStatusOverride({
        tone: "error",
        message: result.message,
      });
      return;
    }

    setOpenAiStatusOverride({
      tone: "success",
      message: successMessage,
    });
    await playBlob(result.blob);
  };

  const generateSceneArt = async (scope: "briefing" | "dilemma") => {
    if (!store.aiSettings.enabled || !store.aiSettings.apiKey) {
      setSceneArtStatus({
        tone: "error",
        message: "Activate Gemini first to generate scene art.",
      });
      return;
    }

    const prompt =
      scope === "dilemma"
        ? [
            "Create a cinematic strategy-game concept frame for this AI lab crisis.",
            store.activeDilemma?.title ?? "AI crisis",
            store.activeDilemma?.brief ?? "",
            dilemmaFlavor ?? "",
            "Visual style: grounded near-future executive war room, dark navy palette, no text, no logos, widescreen 16:9.",
          ]
            .filter(Boolean)
            .join(" ")
        : [
            "Create a cinematic strategy-game concept frame for this AI lab quarterly briefing.",
            store.resolution?.headline ?? "Quarterly briefing",
            chiefMemo ?? store.resolution?.briefing ?? "",
            worldLead ?? "",
            "Visual style: near-future research command center, dark navy palette, subtle data-light atmosphere, no text, no logos, widescreen 16:9.",
          ]
            .filter(Boolean)
            .join(" ");

    setSceneArtStatus({
      tone: "checking",
      message: scope === "dilemma" ? "Generating crisis scene art..." : "Generating briefing scene art...",
    });

    const result = await generateGeminiSceneImage({
      apiKey: store.aiSettings.apiKey,
      prompt,
    });

    if (!result.ok || !result.blob) {
      setSceneArtStatus({
        tone: "error",
        message: result.message,
      });
      return;
    }

    clearSceneArt();
    const url = URL.createObjectURL(result.blob);
    sceneArtUrlRef.current = url;
    setSceneArtUrl(url);
    setSceneArtScope(scope);
    setSceneArtStatus({
      tone: "success",
      message: result.message,
    });
  };

  const narrateTurnSummary = async () => {
    await narrateText({
      text: currentNarrationText || "No quarterly summary is available yet.",
      instructions:
        "Read this like a calm strategic operations briefing. Crisp, serious, and slightly dramatic.",
      loadingMessage: "Generating narrated briefing...",
      successMessage: "Briefing narration ready.",
    });
  };

  const narrateDilemmaSummary = async () => {
    await narrateText({
      text: currentDilemmaNarrationText || "No dilemma context is available yet.",
      instructions:
        "Read this like a tense executive crisis briefing. Controlled, serious, and clear about the stakes.",
      loadingMessage: "Generating narrated dilemma context...",
      successMessage: "Dilemma narration ready.",
    });
  };

  const loadNarratives = async () => {
    if (!store.aiSettings.enabled || !store.aiSettings.apiKey || store.mode === "menu") {
      setChiefMemo(null);
      setWorldLead(null);
      setDilemmaFlavor(null);
      setRivalColor(null);
      return;
    }

    const [memo, news, dilemma, rival] = await Promise.all([
      fetchGeminiNarrative(
        store,
        "chief-of-staff",
        store.resolution?.briefing ?? "Quarterly status update.",
      ),
      fetchGeminiNarrative(
        store,
        "world-news",
        store.resolution?.worldEvents[0] ?? "World pulse update.",
      ),
      store.activeDilemma
        ? fetchGeminiNarrative(
            store,
            "dilemma-writer",
            [
              `Title: ${store.activeDilemma.title}`,
              `Source: ${store.activeDilemma.source}`,
              `Brief: ${store.activeDilemma.brief}`,
              "Available options:",
              ...store.activeDilemma.options.map(
                (option) =>
                  `- ${option.label}: ${option.summary}. Outcomes: ${option.outcomes
                    .map((outcome) => `${outcome.label} (${Math.round(outcome.chance * 100)}%)`)
                    .join(", ")}`,
              ),
            ].join("\n"),
          )
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
  };

  const loadNarrativesEffect = useEffectEvent(async () => {
    await loadNarratives();
  });

  const autoNarrateTurnSummary = useEffectEvent(async () => {
    await narrateTurnSummary();
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const storedCredentials = loadStoredCloudCredentials();
    if (!storedCredentials) {
      return;
    }

    setCloudCredentials(storedCredentials);
    setCloudCommanderIdDraft(storedCredentials.commanderId);
    setCloudStatus({
      tone: "checking",
      message: "Reconnecting cloud saves...",
    });

    void (async () => {
      const result = await listCloudSaves(storedCredentials);
      if (!result.ok) {
        setCloudStatus({
          tone: "error",
          message: result.message,
        });
        return;
      }

      setCloudSummaries(result.summaries);
      setCloudStatus({
        tone: "success",
        message: result.summaries.length
          ? `Cloud saves connected for ${storedCredentials.commanderId}.`
          : `Cloud saves ready for ${storedCredentials.commanderId}.`,
      });
    })();
  }, []);

  useEffect(() => {
    void loadNarrativesEffect();
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
    clearSceneArt();
    setSceneArtStatus({
      tone: "idle",
      message: "Scene art is ready when you want extra flavor.",
    });
  }, [store.resolution?.turn, store.activeDilemma?.id]);

  useEffect(() => {
    if (store.resolution?.breakthroughs.length) {
      playSynthTone(soundEnabled, "breakthrough");
    } else if (store.activeDilemma) {
      playSynthTone(soundEnabled, "warning");
    }
  }, [store.activeDilemma, store.resolution, soundEnabled]);

  useEffect(() => {
    if (
      !store.openAISettings.enabled ||
      !store.openAISettings.autoPlay ||
      !store.openAISettings.apiKey ||
      !store.resolution
    ) {
      return;
    }

    if (autoNarratedTurnRef.current === store.resolution.turn) {
      return;
    }

    autoNarratedTurnRef.current = store.resolution.turn;
    void autoNarrateTurnSummary();
  }, [
    store.openAISettings.apiKey,
    store.openAISettings.autoPlay,
    store.openAISettings.enabled,
    store.resolution,
  ]);

  useEffect(() => {
    return () => {
      stopNarration();
      clearSceneArt();
    };
  }, []);

  const activateGemini = async () => {
    const trimmedKey = (apiKeyDraft ?? store.aiSettings.apiKey).trim();
    setGeminiStatusOverride({
      tone: "checking",
      message: "Checking Gemini connection...",
    });

    const result = await validateGeminiKey(trimmedKey);

    if (!result.ok) {
      setGeminiStatusOverride({
        tone: "error",
        message: result.message,
      });
      return;
    }

    store.updateAIConfig(true, trimmedKey);
    setGeminiStatusOverride({
      tone: "success",
      message: result.message,
    });
  };

  const disableGemini = () => {
    store.updateAIConfig(false, (apiKeyDraft ?? store.aiSettings.apiKey).trim());
    setGeminiStatusOverride({
      tone: "idle",
      message: "Gemini narrative is disabled.",
    });
  };

  const activateOpenAI = async () => {
    const trimmedKey = (openAiKeyDraft ?? store.openAISettings.apiKey).trim();
    setOpenAiStatusOverride({
      tone: "checking",
      message: "Testing OpenAI voice with a live sample...",
    });

    const result = await validateOpenAITtsKey(trimmedKey);

    if (!result.ok || !result.blob) {
      setOpenAiStatusOverride({
        tone: "error",
        message: result.message,
      });
      return;
    }

    store.updateOpenAIConfig(true, trimmedKey, store.openAISettings.autoPlay);
    setOpenAiStatusOverride({
      tone: "success",
      message: result.message,
    });
    await playBlob(result.blob);
  };

  const disableOpenAI = () => {
    stopNarration();
    store.updateOpenAIConfig(false, (openAiKeyDraft ?? store.openAISettings.apiKey).trim(), false);
    setOpenAiStatusOverride({
      tone: "idle",
      message: "OpenAI voice is disabled.",
    });
  };

  if (!store.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050916] text-slate-200">
        Booting simulation stack...
      </div>
    );
  }

  if (store.mode === "menu") {
    return (
      <main className="relative min-h-screen overflow-x-clip bg-[#050916] text-white">
        <PixiBackground />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.16),transparent_28%),linear-gradient(180deg,rgba(4,10,22,0.78),rgba(4,8,20,0.96))]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Convergence</p>
              <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-tight text-white lg:text-6xl">
                Run the AI lab that decides what the century becomes.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Turn-based strategy across 120 quarters of hiring, compute allocation, geopolitics,
                and moral tradeoffs.
              </p>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <BookOpen className="h-4 w-4" />
                How It Works
              </button>
            </div>
            <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-slate-950/80 p-5 xl:block">
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
                <button
                  type="button"
                  disabled={!cloudCredentials || !cloudAutosaveSummary || cloudBusyKey !== null}
                  onClick={() => void pullCloudSave("autosave")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/35 bg-violet-500/12 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  <CloudDownload className="h-4 w-4" />
                  Continue Cloud Save
                </button>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(cloudStatus.tone)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cloud Save</span>
                    <span className="text-[11px] uppercase tracking-[0.18em]">
                      {cloudCredentials ? cloudCredentials.commanderId : "offline"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5">{cloudStatus.message}</p>
                  {cloudAutosaveSummary ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Autosave {cloudAutosaveSummary.subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="grid gap-3">
                    <input value={cloudCommanderIdDraft} onChange={(event) => setCloudCommanderIdDraft(event.target.value)} placeholder="Commander ID" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                    <input value={cloudPassphraseDraft} onChange={(event) => setCloudPassphraseDraft(event.target.value)} placeholder="Cloud passphrase" type="password" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => void connectCloudSaves()} disabled={cloudBusyKey === "connect"} className="rounded-2xl border border-violet-400/35 bg-violet-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                        {cloudBusyKey === "connect" ? "Connecting..." : "Connect Cloud"}
                      </button>
                      <button type="button" onClick={() => void refreshCloudSummaries()} disabled={!cloudCredentials || cloudBusyKey !== null} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60">
                        Refresh Cloud
                      </button>
                    </div>
                  </div>
                </div>
                {slots.map((slot) => {
                  const summary = store.slotSummaries.find((entry) => entry.slot === slot);
                  const cloudSummary = cloudSummaries.find((entry) => entry.slot === slot);
                  return (
                    <div key={slot} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                            Slot {slot}
                          </span>
                          <span className="mt-1 block text-sm text-slate-200">
                            {summary ? summary.subtitle : "Local empty"}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {cloudSummary ? `Cloud: ${cloudSummary.subtitle}` : "No cloud slot"}
                          </span>
                        </span>
                        <Save className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => store.saveSlot(slot)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          Save Local
                        </button>
                        <button
                          type="button"
                          disabled={!cloudCredentials || cloudBusyKey !== null}
                          onClick={() => void pushCloudSave(slot)}
                          className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                        >
                          Save Cloud
                        </button>
                        <button
                          type="button"
                          onClick={() => store.loadSlot(slot)}
                          className="rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 text-sm text-white"
                        >
                          Load Local
                        </button>
                        <button
                          type="button"
                          disabled={!cloudCredentials || !cloudSummary || cloudBusyKey !== null}
                          onClick={() => void pullCloudSave(slot)}
                          className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                        >
                          Load Cloud
                        </button>
                      </div>
                    </div>
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
        <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#040812] text-white">
      <PixiBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.12),transparent_34%),linear-gradient(180deg,rgba(5,10,22,0.85),rgba(4,8,20,0.96))]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/78 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-sky-200">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Convergence</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  {store.year} Q{store.quarterIndex + 1} Turn {store.turn}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  CEO {store.ceo.name}
                  {store.ceo.fired ? " · Interim era" : " · Founder control"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PanelButton active={store.panel === "briefing"} icon={Globe2} label="Briefing" onClick={() => store.openPanel("briefing")} />
              <PanelButton active={store.panel === "finance"} icon={BarChart3} label="Finance" onClick={() => store.openPanel("finance")} />
              <PanelButton active={store.panel === "track"} icon={BrainCircuit} label="Research" onClick={() => store.openPanel("track")} />
              <PanelButton active={store.panel === "hiring"} icon={Users} label="Hiring" onClick={() => store.openPanel("hiring")} />
              <PanelButton active={store.panel === "facilities"} icon={Building2} label="Facilities" onClick={() => store.openPanel("facilities")} />
              <PanelButton active={store.panel === "settings"} icon={Handshake} label="Settings" onClick={() => store.openPanel("settings")} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Capital</p>
                  <p className="mt-1 text-sm font-medium text-white">{formatCurrency(store.resources.capital)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/75">Quarterly Revenue</p>
                  <p className="mt-1 text-sm font-medium text-emerald-100">{formatCurrency(store.resources.revenue)}</p>
                </div>
                <div className={`rounded-2xl border px-3 py-2 ${quarterlyNet >= 0 ? "border-emerald-400/18 bg-emerald-500/8" : "border-rose-400/18 bg-rose-500/8"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Quarterly Net</p>
                  <p className={`mt-1 text-sm font-medium ${quarterlyNet >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
                    {quarterlyNet >= 0 ? "+" : ""}
                    {formatCurrency(quarterlyNet)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/8"
              >
                <BookOpen className="h-4 w-4" />
                How To Play
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Restart this run from turn 1 with the same opening preset?")) {
                    playSynthTone(soundEnabled, "click");
                    store.newGame(store.preset);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/8"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </button>
              <button
                type="button"
                onClick={() => {
                  playSynthTone(soundEnabled, "click");
                  openSaveAndQuitDialog();
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
          </div>
        </header>

        <div className={layoutClass}>
          <aside
            className={`min-w-0 rounded-[28px] border border-white/10 bg-slate-950/78 backdrop-blur ${
              intelCollapsed ? "p-3" : "p-5"
            }`}
          >
            <div
              className={`flex ${intelCollapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-3"}`}
            >
              {intelCollapsed ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Intel
                </span>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">World Intel</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Collapse this rail when you want a cleaner strategy view
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIntelCollapsed((value) => !value)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/8"
              >
                {intelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {intelCollapsed ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIntelCollapsed(false);
                    setWorldStateOpen(true);
                  }}
                  className="flex w-full items-center justify-center rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-300"
                >
                  World
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIntelCollapsed(false);
                    setGovernmentsOpen(true);
                  }}
                  className="flex w-full items-center justify-center rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-300"
                >
                  Gov
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIntelCollapsed(false);
                    setRivalsOpen(true);
                  }}
                  className="flex w-full items-center justify-center rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-300"
                >
                  Rivals
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <IntelSection
                  title="World State"
                  subtitle="Runway, trust, fear, and the compact ledger"
                  open={worldStateOpen}
                  onToggle={() => setWorldStateOpen((value) => !value)}
                >
                  <div className="space-y-4">
                    <MetricBar label="Runway (months)" value={Math.min(store.resources.runwayMonths, 36)} max={36} tone={store.resources.runwayMonths < 10 ? "red" : "green"} helper="Time before cash runs out if this quarter's ledger holds." />
                    <MetricBar label="Lab Trust" value={store.resources.trust} tone="green" helper="High trust buys tolerance with regulators, partners, and staff." />
                    <MetricBar label="AI Fear" value={store.resources.fear} tone="red" helper="Fear raises scrutiny, protests, and policy pressure." />
                    <MetricBar label="Board Confidence" value={store.resources.boardConfidence} tone="amber" helper="If this collapses, the board can replace you." />
                  </div>
                  <div className="mt-4 rounded-[20px] border border-white/8 bg-slate-950/65 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Quarterly Ledger</p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${quarterlyNet >= 0 ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-rose-400/25 bg-rose-500/10 text-rose-200"}`}>
                        {quarterlyNet >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {quarterlyNet >= 0 ? "Positive cashflow" : "Negative cashflow"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between"><span className="text-slate-400">Capital</span><span className="font-medium text-white">{formatCurrency(store.resources.capital)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-400">Revenue</span><span className="text-emerald-300">{formatCurrency(store.resources.revenue)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-400">Expenses</span><span className="text-rose-300">{formatCurrency(store.resources.burn)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-400">Net</span><span className={quarterlyNet >= 0 ? "text-emerald-200" : "text-rose-200"}>{quarterlyNet >= 0 ? "+" : ""}{formatCurrency(quarterlyNet)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-400">Compute Capacity</span><span className="text-white">{store.resources.computeCapacity} PFLOPS</span></div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Open the Finance tab for the full revenue, payroll, and commitment view.
                    </p>
                  </div>
                </IntelSection>

                <IntelSection
                  title="Governments"
                  subtitle="Relation drives contracts, pressure, and legitimacy"
                  open={governmentsOpen}
                  onToggle={() => setGovernmentsOpen((value) => !value)}
                >
                  <div className="space-y-3">
                    {Object.values(store.governments).map((government) => (
                      <div key={government.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>{government.name}</span>
                          <span className="text-slate-400">{Math.round(government.relation)}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-400" style={{ width: `${government.relation}%` }} />
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-300">{describeGovernmentRelation(government.relation)}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{government.agenda}</p>
                      </div>
                    ))}
                  </div>
                </IntelSection>

                <IntelSection
                  title="Rival Labs"
                  subtitle="Capability, safety, and goodwill"
                  open={rivalsOpen}
                  onToggle={() => setRivalsOpen((value) => !value)}
                >
                  <div className="space-y-3">
                    {topRivals.map((rival) => (
                      <div key={rival.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>{rival.name}</span>
                          <span className="text-slate-400">{Math.round(rival.capability)}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <MetricBar label="Capability" value={rival.capability} tone="blue" />
                          <MetricBar label="Safety" value={rival.safety} tone="amber" />
                          <MetricBar label="Goodwill" value={rival.goodwill} tone="green" />
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                          Focus: {TRACK_DEFINITIONS.find((track) => track.id === rival.focus)?.shortName}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{rival.recentMove}</p>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Race Board</p>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Closest trajectory</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {labLeaderboard.map((entry, index) => (
                          <div key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-[#081021] px-3 py-3">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-white">
                                #{index + 1} {entry.name}
                              </span>
                              <span className="text-xs text-slate-400">{entry.trajectory}</span>
                            </span>
                            <span className="shrink-0 text-sm text-sky-200">{entry.raceScore}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </IntelSection>
              </div>
            )}
          </aside>

          <section className="min-w-0 space-y-4">
            <AnimatePresence>
              {store.tutorialStep < tutorialNotes.length ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-3 rounded-[24px] border border-sky-400/20 bg-sky-500/10 px-4 py-4 text-sm text-sky-100 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <span className="mr-2 inline-flex rounded-full border border-sky-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-sky-200">Tutorial</span>
                    <span>{tutorialNotes[store.tutorialStep]}</span>
                  </div>
                  <button type="button" onClick={() => setTutorialOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-sky-300/30 bg-sky-500/10 px-4 py-2 text-sm text-white">
                    <BookOpen className="h-4 w-4" />
                    Full Guide
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <TrackMap state={store} onOpenTrack={store.openTrack} />

            <div className="rounded-[28px] border border-white/10 bg-slate-950/78 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Event Feed</p>
                  <p className="mt-2 text-sm text-slate-400">Quarter-by-quarter news, breakthroughs, and scandals. Scroll horizontally.</p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest {deferredFeed.length}</span>
              </div>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {deferredFeed.map((item) => (
                  <div key={item.id} className="min-w-[280px] rounded-[22px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <span className={`h-2 w-2 rounded-full ${item.severity === "critical" ? "bg-rose-400" : item.severity === "warning" ? "bg-amber-400" : "bg-sky-400"}`} />
                      {item.kind}
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-4 rounded-[28px] border border-white/10 bg-slate-950/78 p-5 backdrop-blur xl:col-span-2 2xl:col-span-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Detail Panel</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {store.panel === "track"
                    ? trackDefinition.name
                    : store.panel === "finance"
                      ? "Finance and Revenue"
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
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {selectedTrack.unlocked ? `${selectedForecast.projectName} / L${selectedTrack.level}` : "Locked track"}
                </div>
              ) : null}
            </div>

            {store.panel === "track" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-base leading-7 text-slate-200">{trackDefinition.description}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {selectedTrack.unlocked
                      ? `Current project: ${selectedForecast.projectName}. ${selectedForecast.activeTechnology ?? "Progress is deterministic and updates each quarter from assigned staff and compute."}`
                      : TRACK_UNLOCK_NOTES[store.selectedTrack]}
                  </p>
                  {selectedForecast.blockedReason ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                      {selectedForecast.blockedReason}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Project</span>
                      <span className="text-sm font-medium text-white">{selectedForecast.projectName}</span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full" style={{ width: `${selectedTrack.unlocked ? selectedForecast.progressPercent : 0}%`, background: trackDefinition.accent }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                      <span>{Math.round(selectedForecast.currentProgress)}/{selectedForecast.target}</span>
                      <span>ETA {formatTurns(selectedForecast.turnsToLevel)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-300"><span>Quarterly progress</span><span className="font-medium text-white">+{selectedForecast.progressPerTurn}</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Assigned scientists</span><span className="text-white">{selectedForecast.assignedCount}</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Recommended compute</span><span className="text-white">{selectedForecast.recommendedCompute} PFLOPS</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Compute readiness</span><span className="text-white">{Math.round((selectedForecast.computeReadiness ?? 1) * 100)}%</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Live track revenue</span><span className="text-emerald-200">{trackRevenueStream ? formatCurrency(trackRevenueStream.amount) : "None yet"}</span></div>
                    {selectedTrack.level < trackDefinition.levels.length ? (
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                        <span>Next stage lift</span>
                        <span className="text-sky-200">+{formatCurrency(trackRevenueBreakdown[selectedTrack.level].stageRevenue)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Compute Allocation</span>
                      <span className="font-medium text-white">{selectedTrack.compute} PFLOPS</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" onClick={() => store.adjustCompute(store.selectedTrack, -5)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">-5</button>
                      <button type="button" onClick={() => store.adjustCompute(store.selectedTrack, 5)} className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-white">+5</button>
                      <span className="ml-auto text-xs uppercase tracking-[0.18em] text-slate-500">{freeCompute} PFLOPS free</span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Supplier choice and energy policy modify how efficiently this compute turns into progress. Later-stage work now has a recommended compute floor, so underprovisioned projects slow down instead of scaling cleanly.
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Revenue Ladder</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Each completed stage adds durable quarterly revenue to this track.
                      </p>
                    </div>
                    <span className="text-sm font-medium text-emerald-200">
                      {trackRevenueStream ? formatCurrency(trackRevenueStream.amount) : "$0"}
                      <span className="ml-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">per quarter</span>
                    </span>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/6">
                    {unlockedRevenueStages.length ? (
                      <div className="flex h-full w-full">
                        {unlockedRevenueStages.map((stage, index) => (
                          <div
                            key={stage.level}
                            className={index === unlockedRevenueStages.length - 1 ? "rounded-r-full" : ""}
                            style={{
                              width: `${Math.max(12, (stage.stageRevenue / Math.max(totalUnlockedStageRevenue, 0.01)) * 100)}%`,
                              background: trackDefinition.accent,
                              opacity: 0.5 + index / Math.max(unlockedRevenueStages.length, 1) / 2,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-full w-full rounded-full bg-white/5" />
                    )}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {trackRevenueBreakdown.map((stage) => {
                      const unlocked = stage.level <= selectedTrack.level;

                      return (
                        <div
                          key={stage.level}
                          className={`rounded-2xl border px-3 py-3 ${
                            unlocked ? "border-emerald-400/20 bg-emerald-500/8" : "border-white/8 bg-slate-950/65"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">
                              L{stage.level} {stage.stageName}
                            </span>
                            <span className={unlocked ? "text-sm text-emerald-200" : "text-sm text-slate-500"}>
                              {unlocked ? `+${formatCurrency(stage.stageRevenue)}` : `Future +${formatCurrency(stage.stageRevenue)}`}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                            <span>Cumulative at this level {formatCurrency(stage.cumulativeRevenue)}</span>
                            <span>{unlocked ? "Live" : "Locked"}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {stage.revenuePrograms[0]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assigned Team</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Staff impact this quarter</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {assignedResearchers.length ? (
                      selectedForecast.contributors.map((contributor) => {
                        const employee = assignedResearchers.find((entry) => entry.id === contributor.id)!;

                        return (
                          <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, null)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-white">{employee.name}</span>
                              <span className="text-xs text-slate-400">{employee.role} / {contributor.focus} / +{contributor.contribution}</span>
                            </span>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Unassign</span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">No one is assigned yet. Like XCOM research, staffing is what turns plans into ETA.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Staffing Pool</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Specialists stay in-lane unless they are marked as generalists
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ready To Assign</p>
                      <div className="mt-2 space-y-2">
                        {availableResearchers.length ? (
                          availableResearchers.slice(0, 6).map((employee) => (
                            <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, store.selectedTrack)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-white">{employee.name}</span>
                                <span className="text-xs text-slate-400">{employee.role} / Salary {formatCurrency(employee.salary)}</span>
                                <span className="mt-1 block text-[11px] leading-5 text-slate-500">{describeAssignmentScope(employee)}</span>
                              </span>
                              <span className="text-xs uppercase tracking-[0.18em] text-sky-300">Assign</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No eligible unassigned staff are idle right now.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Committed Elsewhere</p>
                      <div className="mt-2 space-y-2">
                        {committedResearchers.length ? (
                          committedResearchers.slice(0, 6).map((employee) => (
                            <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, store.selectedTrack)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-white">{employee.name}</span>
                                <span className="text-xs text-slate-400">
                                  {employee.role} / Currently on {getTrackLabel(employee.assignedTrack)}
                                </span>
                                <span className="mt-1 block text-[11px] leading-5 text-slate-500">{describeAssignmentScope(employee)}</span>
                              </span>
                              <span className="text-xs uppercase tracking-[0.18em] text-amber-300">Reassign</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No one else is currently tied to another project.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Needs Different Specialist</p>
                      <div className="mt-2 space-y-2">
                        {ineligibleResearchers.length ? (
                          ineligibleResearchers.slice(0, 6).map((employee) => (
                            <div key={employee.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                              <span className="block text-sm font-medium text-white">{employee.name}</span>
                              <span className="block text-xs text-slate-400">{employee.role}</span>
                              <span className="mt-1 block text-[11px] leading-5 text-slate-500">{describeAssignmentScope(employee)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No ineligible specialists are blocking this staffing pool right now.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Research Arc</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Completed stages stay visible, future stages show their technology, revenue programs, research load, specialist gates, and the convergence events they unlock.
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {selectedTrack.level}/{trackDefinition.levels.length} completed
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedTrackRoadmap.map((stage) => (
                      <div
                        key={stage.level}
                        className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4"
                        style={{ boxShadow: `inset 3px 0 0 ${trackDefinition.accent}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Level {stage.level}</p>
                            <h3 className="mt-1 text-base font-medium text-white">{stage.stageName}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {stage.technology} {stage.summary}{" "}
                              {stage.isCompleted
                                ? "This stage is already contributing."
                                : stage.isActive
                                  ? "This is the active research target."
                                  : "This waits further down the roadmap."}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${stageStatusClasses(stage.status)}`}>
                            {stage.status === "completed"
                              ? "Operational"
                              : stage.status === "active"
                                ? "In Progress"
                                : stage.status === "locked"
                                  ? "Unlock Track"
                                  : "Future"}
                          </span>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${stage.progressPercent}%`,
                              background: trackDefinition.accent,
                              opacity: stage.isCompleted ? 0.95 : stage.isActive ? 0.85 : 0.3,
                            }}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Stage Lift</p>
                            <p className="mt-2 text-sm font-medium text-emerald-200">+{formatCurrency(stage.stageRevenue)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cumulative</p>
                            <p className="mt-2 text-sm font-medium text-white">{formatCurrency(stage.cumulativeRevenue)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">State</p>
                            <p className="mt-2 text-sm font-medium text-white">
                              {stage.isCompleted
                                ? "Already deployed"
                                : stage.isActive
                                  ? selectedForecast.blockedReason
                                    ? "Blocked"
                                    : `ETA ${formatTurns(stage.turnsToLevel)}`
                                  : selectedTrack.unlocked
                                    ? "Future target"
                                    : "Needs unlock hire"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Research Load</p>
                            <p className="mt-2 text-sm font-medium text-white">{stage.researchCost} points / {stage.recommendedCompute} PFLOPS target</p>
                          </div>
                        </div>

                        {stage.requiredSpecialists.length ? (
                          <div className="mt-4 rounded-2xl border border-amber-400/18 bg-amber-500/10 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100">Required Specialists</p>
                            <p className="mt-2 text-sm text-amber-50">
                              {describeResearcherCoverage(stage.requiredSpecialists)}
                            </p>
                          </div>
                        ) : null}
                        {stage.isActive && selectedForecast.blockedReason ? (
                          <div className="mt-4 rounded-2xl border border-amber-400/18 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-50">
                            {selectedForecast.blockedReason}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Revenue Programs</p>
                            <div className="mt-2 space-y-1">
                              {stage.revenuePrograms.map((program) => (
                                <p key={`${stage.level}-${program}`} className="text-sm leading-6 text-slate-300">
                                  {program}
                                </p>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Capability Unlocks</p>
                            <div className="mt-2 space-y-1">
                              {stage.unlocks.map((unlock) => (
                                <p key={`${stage.level}-${unlock}`} className="text-sm leading-6 text-slate-300">
                                  {unlock}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>

                        {stage.stageConvergences.length ? (
                          <div className="mt-4 space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Convergence Hooks</p>
                            {stage.stageConvergences.map((convergence) => (
                              <div key={convergence.id} className="rounded-2xl border border-white/8 bg-[#091224] px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white">{convergence.name}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-400">
                                      Pair with {convergence.partnerSummary}.
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                                      convergence.triggered
                                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                        : convergence.partnersReady
                                          ? "border-sky-400/35 bg-sky-500/10 text-sky-100"
                                          : "border-white/10 bg-white/5 text-slate-400"
                                    }`}
                                  >
                                    {convergence.triggered
                                      ? "Triggered"
                                      : convergence.partnersReady
                                        ? "Partner Ready"
                                        : "Needs Partners"}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-400">{convergence.description}</p>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                  Reward preview: {describeConvergenceReward(convergence.reward)}
                                </p>
                                {convergence.partnerReadiness.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {convergence.partnerReadiness.map((requirement) => (
                                      <span
                                        key={`${convergence.id}-${requirement.id}`}
                                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                                          requirement.currentLevel >= requirement.requiredLevel
                                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                            : "border-white/10 bg-white/5 text-slate-400"
                                        }`}
                                      >
                                        {requirement.label} {requirement.currentLevel}/{requirement.requiredLevel}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-white/8 bg-white/3 px-3 py-3 text-xs leading-5 text-slate-500">
                            No dedicated convergence fires exactly at this stage, but it still amplifies later combinations.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {store.panel === "briefing" ? (
              <div className="space-y-4 text-sm leading-6 text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Chief of Staff</p>
                      <p className="mt-3 text-base font-medium text-white">{chiefMemo ? "AI Memo" : store.resolution?.headline}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => void narrateTurnSummary()} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-2 text-sm text-white">
                        <AudioLines className="h-4 w-4" />
                        Read Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => void generateSceneArt("briefing")}
                        disabled={sceneArtStatus.tone === "checking"}
                        className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles className="h-4 w-4" />
                        {sceneArtStatus.tone === "checking" ? "Generating..." : "Generate Scene Art"}
                      </button>
                      {isNarrating ? (
                        <button type="button" onClick={stopNarration} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                          <Pause className="h-4 w-4" />
                          Stop
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <RichText text={chiefMemo ?? store.resolution?.briefing} className="mt-4" />
                  {(sceneArtScope === "briefing" || sceneArtStatus.tone !== "idle") ? (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(sceneArtStatus.tone)}`}>
                      {sceneArtStatus.message}
                    </div>
                  ) : null}
                  {sceneArtScope === "briefing" && sceneArtUrl ? (
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/65">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sceneArtUrl} alt="Gemini-generated quarterly briefing scene art" className="h-auto w-full object-cover" />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Quarterly Result</p>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${store.resolution?.financeDelta && store.resolution.financeDelta >= 0 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-rose-400/30 bg-rose-500/10 text-rose-200"}`}>
                      {store.resolution?.financeDelta && store.resolution.financeDelta >= 0 ? "+" : ""}
                      {formatCurrency(store.resolution?.financeDelta ?? 0)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(store.resolution?.breakthroughs.length ? store.resolution.breakthroughs : ["No major breakthrough this quarter."]).map((item) => (
                      <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">{item}</div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Revenue Streams</p>
                  <div className="mt-3 space-y-2">
                    {store.revenueStreams.slice(0, 5).map((stream) => (
                      <div key={stream.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-white">{stream.name}</span>
                          <span className="text-xs text-slate-400">{stream.summary}</span>
                        </span>
                        <span className="shrink-0 text-sm text-emerald-200">{formatCurrency(stream.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">World Pulse</p>
                  <RichText text={worldLead ?? store.resolution?.worldEvents[0] ?? "No major event yet."} className="mt-3" />
                </div>

                {rivalColor ? (
                  <div className="rounded-[24px] border border-violet-400/18 bg-violet-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-violet-200">Rival Assessment</p>
                    <RichText text={rivalColor} className="mt-3 text-violet-50" />
                  </div>
                ) : null}

                {store.decisionLog.length ? (
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Decision Memory</p>
                    <div className="mt-3 space-y-2">
                      {store.decisionLog.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-white">{entry.title}</p>
                            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Turn {entry.turn}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{entry.choice}</p>
                          <p className="mt-1 text-xs text-slate-400">{entry.outcome} · {entry.impact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Race Leaderboard</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Capability / Trust / Reliability / Safety
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {labLeaderboard.map((entry, index) => (
                      <div key={entry.id} className={`rounded-2xl border px-3 py-3 ${entry.isPlayer ? "border-sky-400/25 bg-sky-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-white">
                            #{index + 1} {entry.name}
                          </span>
                          <span className="text-sm text-sky-200">{entry.raceScore}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-4">
                          <span>Capability {entry.capability}</span>
                          <span>Trust {entry.trust}</span>
                          <span>Reliability {entry.reliability}</span>
                          <span>Safety {entry.safety}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Trajectory: {entry.trajectory}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {store.panel === "finance" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Capital</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(store.resources.capital)}</p>
                    <p className="mt-2 text-xs text-slate-500">Cash on hand after all current commitments.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Quarterly Net</p>
                    <p className={`mt-3 text-2xl font-semibold ${quarterlyNet >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{quarterlyNet >= 0 ? "+" : ""}{formatCurrency(quarterlyNet)}</p>
                    <p className="mt-2 text-xs text-slate-500">Revenue minus burn for the current quarter.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Runway</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{store.resources.runwayMonths} months</p>
                    <p className="mt-2 text-xs text-slate-500">If this ledger holds, this is how long the lab survives.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Compute Capacity</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{store.resources.computeCapacity} PFLOPS</p>
                    <p className="mt-2 text-xs text-slate-500">Total PFLOPS available to allocate across research tracks.</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Revenue Streams</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quarterly total {formatCurrency(store.resources.revenue)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {store.revenueStreams.map((stream) => (
                        <div key={stream.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-white">{stream.name}</span>
                            <span className="text-xs text-slate-400">{stream.source} / {stream.summary}</span>
                          </span>
                          <span className="shrink-0 text-sm text-emerald-200">{formatCurrency(stream.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expense Breakdown</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quarterly total {formatCurrency(store.resources.burn)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {expenseEntries.map(([label, amount]) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium capitalize text-white">{label}</span>
                            <span className="text-sm text-rose-200">{formatCurrency(amount)}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {store.resources.burn > 0 ? `${Math.round((amount / store.resources.burn) * 100)}% of quarterly burn.` : "No burn recorded."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Payroll</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current payroll {formatCurrency(store.resources.expenses.payroll)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {payrollEntries.map((employee) => (
                        <div key={employee.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-white">{employee.name}</span>
                            <span className="text-xs text-slate-400">{employee.role} / {getTrackLabel(employee.assignedTrack)}</span>
                          </span>
                          <span className="shrink-0 text-sm text-white">{formatCurrency(employee.salary / 4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Pending Hires</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payroll next turn +{formatCurrency(pendingHirePayroll)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {store.pendingHires.length ? (
                        store.pendingHires.map((hire) => (
                          <div key={hire.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-white">{hire.name}</span>
                              <span className="text-sm text-amber-200">Arrives next quarter</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">{hire.role} / Unlocks {getTrackLabel(hire.primaryTrack)}</p>
                            <p className="mt-2 text-xs text-slate-500">Close cost already committed: {formatCurrency(hire.signingBonus + hire.salary / 4)}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No signed hires are waiting in the queue.</p>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Signed-hire close costs already committed this quarter: {formatCurrency(pendingHireCloseCost)}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Capital Commitments</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Construction and expansion load</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {store.projects.length ? (
                      store.projects.map((project) => (
                        <div key={project.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">{project.name}</span>
                            <span className="text-sm text-white">{project.turnsRemaining}Q left</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{project.region} / Upkeep {formatCurrency(project.upkeep)}</p>
                          <p className="mt-2 text-xs text-slate-500">{describeFacilityOutcome(project)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No live build commitments right now.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {store.panel === "hiring" ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Hiring Pressure</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Signed hires are locked in now, become assignable next quarter, and then start contributing to payroll and research throughput.
                    Recruiting changes the next turn, not the current one. Specialists only staff their primary or secondary lanes unless marked as generalists.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Arrival Queue</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{store.pendingHires.length} signed</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {store.pendingHires.length ? (
                      store.pendingHires.map((hire) => (
                        <div key={hire.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">{hire.name}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-amber-300">Arrives next quarter</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{hire.role} / {getTrackLabel(hire.primaryTrack)}</p>
                          <p className="mt-2 text-[11px] leading-5 text-slate-500">{describeAssignmentScope(hire)}</p>
                          <p className="mt-2 text-xs text-slate-500">Payroll when active: {formatCurrency(hire.salary / 4)} per quarter.</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No one is currently signed and waiting to arrive.</p>
                    )}
                  </div>
                </div>

                {store.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
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
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                      <span>Salary {formatCurrency(candidate.salary)}</span>
                      <span>Signing bonus {formatCurrency(candidate.signingBonus)}</span>
                      <span>Unlocks {TRACK_DEFINITIONS.find((track) => track.id === candidate.primaryTrack)?.name} on arrival</span>
                      <span>{describeAssignmentScope(candidate)}</span>
                      <span>Quarterly payroll next turn +{formatCurrency(candidate.salary / 4)}</span>
                      <span>Close cost today {formatCurrency(candidate.signingBonus + candidate.salary / 4)}</span>
                      <span>{candidate.contestedBy ? `Contested by ${store.rivals[candidate.contestedBy].name}` : "Uncontested"}</span>
                      <span>{candidate.location}</span>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{candidate.ask}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {store.panel === "facilities" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Supplier</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Chips change throughput and cost</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {SUPPLIER_CONTRACTS.map((supplier) => (
                      <button key={supplier.vendor} type="button" onClick={() => store.chooseSupplier(supplier.vendor)} className={`rounded-2xl border px-3 py-3 text-left ${store.supplier.vendor === supplier.vendor ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{supplier.vendor}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{supplier.summary}</span>
                        <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">Throughput x{supplier.computeMultiplier.toFixed(2)} · Upkeep x{supplier.upkeepMultiplier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Energy Policy</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cost, trust, and utilization tradeoffs</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {ENERGY_POLICIES.map((energy) => (
                      <button key={energy.id} type="button" onClick={() => store.chooseEnergy(energy.id)} className={`rounded-2xl border px-3 py-3 text-left ${store.energyPolicy.id === energy.id ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{energy.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{energy.summary}</span>
                        <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">Upkeep x{energy.upkeepMultiplier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Active Projects</p>
                  <div className="mt-3 space-y-3">
                    {store.projects.length ? (
                      store.projects.map((project) => {
                        const progressPercent = ((project.totalTurns - project.turnsRemaining) / Math.max(project.totalTurns, 1)) * 100;

                        return (
                          <div key={project.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-white">{project.name}</p>
                              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{project.turnsRemaining}Q left</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                              <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-400" style={{ width: `${Math.max(4, progressPercent)}%` }} />
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">{project.region} / Upkeep {formatCurrency(project.upkeep)} / Build cost {formatCurrency(project.buildCost)}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">{describeFacilityOutcome(project)}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">No active construction projects.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expansion</p>
                  <div className="mt-3 grid gap-2">
                    {buildOptions.map((option) => {
                      const buildTime = getFacilityBuildTime(store, option.id);

                      return (
                        <button key={option.id} type="button" onClick={() => store.startFacility(option.id)} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                          <span className="block font-medium text-white">{option.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-400">{option.region} / Cost {formatCurrency(option.buildCost)} / ETA {buildTime}Q / Upkeep {formatCurrency(option.upkeep)}</span>
                          <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">+{option.computeDelta} PFLOPS / Trust {option.trustDelta >= 0 ? "+" : ""}{option.trustDelta} / Risk {option.riskDelta >= 0 ? "+" : ""}{option.riskDelta}</span>
                          <span className="mt-2 block text-xs leading-5 text-slate-400">{describeFacilityOutcome(option)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {store.panel === "settings" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Gemini API Key</label>
                  <input value={apiKeyDraft ?? store.aiSettings.apiKey} onChange={(event) => { setApiKeyDraft(event.target.value); setGeminiStatusOverride(null); }} placeholder="AIza..." className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                  <p className="mt-3 text-xs leading-5 text-slate-500">Stored locally only. Gemini writes flavor text and optional scene art; the simulation logic stays deterministic.</p>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(geminiStatus.tone)}`}>{geminiStatus.message}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void activateGemini()} disabled={geminiStatus.tone === "checking"} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {geminiStatus.tone === "checking" ? "Checking..." : "Activate Gemini"}
                    </button>
                    <button type="button" onClick={disableGemini} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Disable</button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <label className="text-xs uppercase tracking-[0.22em] text-slate-400">OpenAI API Key</label>
                  <input value={openAiKeyDraft ?? store.openAISettings.apiKey} onChange={(event) => { setOpenAiKeyDraft(event.target.value); setOpenAiStatusOverride(null); }} placeholder="sk-..." className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                  <p className="mt-3 text-xs leading-5 text-slate-500">Uses OpenAI text-to-speech with the `nova` voice to read quarterly summaries aloud.</p>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(openAiStatus.tone)}`}>{openAiStatus.message}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void activateOpenAI()} disabled={openAiStatus.tone === "checking"} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {openAiStatus.tone === "checking" ? "Testing..." : "Activate Voice"}
                    </button>
                    <button type="button" onClick={() => void narrateTurnSummary()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Test Current Summary</button>
                    <button type="button" onClick={disableOpenAI} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Disable</button>
                  </div>
                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-4 py-3 text-sm">
                    <input type="checkbox" checked={store.openAISettings.autoPlay} onChange={(event) => store.updateOpenAIConfig(store.openAISettings.enabled, store.openAISettings.apiKey, event.target.checked)} className="h-4 w-4 rounded border-white/15 bg-slate-900" />
                    Auto-play quarterly briefing after each turn
                  </label>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSoundEnabled((value) => !value)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white">
                      <AudioLines className="h-4 w-4" />
                      Sound {soundEnabled ? "On" : "Off"}
                    </button>
                    {isNarrating ? (
                      <button type="button" onClick={stopNarration} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white">
                        <Pause className="h-4 w-4" />
                        Stop Voice
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Cloud Saves</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Uses Cloudflare KV so the same commander ID and passphrase can load saves from another browser.
                      </p>
                    </div>
                    <Cloud className="h-4 w-4 text-violet-200" />
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Commander ID</span>
                      <input value={cloudCommanderIdDraft} onChange={(event) => setCloudCommanderIdDraft(event.target.value)} placeholder="alex-mercer" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cloud Passphrase</span>
                      <input value={cloudPassphraseDraft} onChange={(event) => setCloudPassphraseDraft(event.target.value)} placeholder="Use the same passphrase on every browser" type="password" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                    </label>
                    <div className={`rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(cloudStatus.tone)}`}>{cloudStatus.message}</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void connectCloudSaves()} disabled={cloudBusyKey === "connect"} className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/35 bg-violet-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                        <KeyRound className="h-4 w-4" />
                        {cloudBusyKey === "connect" ? "Connecting..." : "Connect Cloud Saves"}
                      </button>
                      <button type="button" onClick={() => void refreshCloudSummaries()} disabled={!cloudCredentials || cloudBusyKey !== null} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60">
                        Refresh Cloud Slots
                      </button>
                      <button type="button" onClick={disconnectCloudSaves} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        Disconnect
                      </button>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      API keys stay local only. Cloud saves upload game state, not your Gemini or OpenAI secrets. New saves can take a few seconds to appear on another browser.
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Save Slots</p>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-violet-400/18 bg-violet-500/10 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Cloud Continue Slot</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {cloudAutosaveSummary ? cloudAutosaveSummary.subtitle : "No cloud autosave yet."}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void pushCloudSave("autosave")} disabled={!cloudCredentials || cloudBusyKey !== null} className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                            <CloudUpload className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => void pullCloudSave("autosave")} disabled={!cloudCredentials || !cloudAutosaveSummary || cloudBusyKey !== null} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                            <CloudDownload className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {slots.map((slot) => {
                      const localSummary = store.slotSummaries.find((entry) => entry.slot === slot);
                      const cloudSummary = cloudSummaries.find((entry) => entry.slot === slot);

                      return (
                        <div key={slot} className="rounded-2xl border border-white/8 bg-slate-950/65 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">Slot {slot}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {localSummary ? `Local: ${localSummary.subtitle}` : "Local: empty"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {cloudSummary ? `Cloud: ${cloudSummary.subtitle}` : "Cloud: empty"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => store.saveSlot(slot)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                                Save Local
                              </button>
                              <button type="button" onClick={() => void pushCloudSave(slot)} disabled={!cloudCredentials || cloudBusyKey !== null} className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                                Save Cloud
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {store.activeDilemma ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-[#0a1124]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/12 p-3 text-amber-200">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-200">{store.activeDilemma.source}</p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">{store.activeDilemma.title}</h2>
                    <RichText text={store.activeDilemma.brief} className="mt-3" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => void narrateDilemmaSummary()} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-2 text-sm text-white">
                    <AudioLines className="h-4 w-4" />
                    Read Context
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateSceneArt("dilemma")}
                    disabled={sceneArtStatus.tone === "checking"}
                    className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    {sceneArtStatus.tone === "checking" ? "Generating..." : "Generate Scene Art"}
                  </button>
                  {isNarrating ? (
                    <button type="button" onClick={stopNarration} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                      <Pause className="h-4 w-4" />
                      Stop
                    </button>
                  ) : null}
                </div>
              </div>
              {dilemmaFlavor ? (
                <div className="mt-4 rounded-[24px] border border-violet-400/18 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-violet-200">AI Context Note</p>
                  <RichText text={dilemmaFlavor} className="mt-3 text-violet-50" />
                </div>
              ) : null}
              {(sceneArtScope === "dilemma" || sceneArtStatus.tone !== "idle") ? (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(sceneArtStatus.tone)}`}>
                  {sceneArtStatus.message}
                </div>
              ) : null}
              {sceneArtScope === "dilemma" && sceneArtUrl ? (
                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/65">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sceneArtUrl} alt="Gemini-generated dilemma scene art" className="h-auto w-full object-cover" />
                </div>
              ) : null}
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {store.activeDilemma.options.map((option) => (
                  <button key={option.id} type="button" onClick={() => { playSynthTone(soundEnabled, "warning"); store.resolveDilemma(option); }} className="rounded-[24px] border border-white/10 bg-white/4 p-4 text-left transition hover:border-sky-400/35 hover:bg-sky-500/8">
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
        {saveQuitOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/76 p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-[#081021]/96 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Save And Quit</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Store this run before returning to menu</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    Local autosave always updates when you quit. You can also pin the current run to a local slot or a cloud slot here.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saveControlsLocked}
                  onClick={() => setSaveQuitOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>

              <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(saveQuitStatus.tone)}`}>
                {saveQuitStatus.message}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {slots.map((slot) => {
                    const localSummary = store.slotSummaries.find((entry) => entry.slot === slot);
                    const cloudSummary = cloudSummaries.find((entry) => entry.slot === slot);

                    return (
                      <div key={`save-quit-slot-${slot}`} className="rounded-[24px] border border-white/8 bg-slate-950/70 px-4 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">Slot {slot}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {localSummary ? `Local: ${localSummary.subtitle}` : "Local: empty"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {cloudSummary ? `Cloud: ${cloudSummary.subtitle}` : "Cloud: empty"}
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={saveControlsLocked}
                              onClick={() => void saveLocalSlotAndQuit(slot)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save Local + Quit
                            </button>
                            <button
                              type="button"
                              disabled={!cloudCredentials || saveControlsLocked}
                              onClick={() => void saveCloudSlotAndQuit(slot)}
                              className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                            >
                              Save Cloud + Quit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="rounded-[24px] border border-sky-400/18 bg-sky-500/10 px-4 py-4">
                    <p className="text-sm font-medium text-white">Continue Slot</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      This is the fastest exit. It refreshes the local autosave and, if connected, the cloud continue slot.
                    </p>
                    <button
                      type="button"
                      disabled={saveControlsLocked}
                      onClick={() => void handleSaveAndQuit()}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Autosave + Quit
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
                    <p className="text-sm font-medium text-white">Cloud status</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {cloudCredentials
                        ? `Connected as ${cloudCredentials.commanderId}. Cloud sync can take a few seconds to appear on another browser.`
                        : "Cloud saves are not connected in this browser yet."}
                    </p>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {cloudAutosaveSummary ? `Cloud continue: ${cloudAutosaveSummary.subtitle}` : "No cloud continue save yet"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {store.mode === "ended" && store.ending ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/76 p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[#081021]/96 p-8">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Ending Reached</p>
              <h2 className="mt-3 text-4xl font-semibold text-white">{store.ending.title}</h2>
              <p className="mt-4 text-lg text-slate-200">{store.ending.summary}</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{store.ending.epilogue}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleSaveAndQuit()} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-white">Return to Menu</button>
                <button type="button" onClick={() => store.newGame("founder")} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200">Start Another Run</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </main>
  );
}

