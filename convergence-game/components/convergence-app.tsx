"use client";

import {
  type PointerEvent,
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
  PanelRightClose,
  PanelRightOpen,
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
  SERVER_AI_KEY,
  fetchAIStatus,
  fetchCinematicResult,
  fetchCinematicStatus,
  fetchGeminiNarrative,
  generateGeminiSceneImage,
  submitCinematicVideo,
  synthesizeOpenAITts,
  validateGeminiKey,
  validateOpenAITtsKey,
  type AIProviderStatus,
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
  COMMERCIALIZATION_CONVERGENCES,
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
  getActiveCommercializationConvergences,
  getActiveCommercializationPrograms,
  getCommercializationExpenseBreakdown,
  getCommercializationOptions,
  getCommercializationReservedCompute,
  getFundingOffers,
  getResearchComputeCapacity,
  getResearchExpenseBreakdown,
  getTrackForecast,
  getTrackRevenueBreakdown,
  TRACK_POSTURES,
  tutorialNotes,
} from "@/lib/game/engine";
import { useConvergenceStore } from "@/lib/game/store";
import {
  CloudCredentials,
  CloudSaveSlotId,
  CloudSaveSummary,
  GameState,
  PanelId,
  Researcher,
  RivalId,
  SaveSlotId,
  StartPresetId,
  TrackId,
  TrackPostureId,
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

const NAV_PANELS: Array<{ id: PanelId; label: string; icon: typeof BrainCircuit }> = [
  { id: "briefing", label: "Brief", icon: Globe2 },
  { id: "track", label: "Research", icon: BrainCircuit },
  { id: "finance", label: "Finance", icon: BarChart3 },
  { id: "hiring", label: "Talent", icon: Users },
  { id: "facilities", label: "Build", icon: Building2 },
  { id: "settings", label: "AI", icon: Handshake },
];

const LAYOUT_PREFS_KEY = "convergence-layout-v3";
const TRACK_MAP_LAYOUT_KEY = "convergence-v4-track-map-layout";

const DEFAULT_SECTION_OPEN: Record<string, boolean> = {
  "briefing-feed": true,
  "briefing-pulse": true,
  "briefing-memory": false,
  "briefing-result": true,
  "briefing-revenue": true,
  "briefing-rivals": false,
  "briefing-race": false,
  "research-bottlenecks": true,
  "research-economics": true,
  "research-revenue": false,
  "research-market": true,
  "research-programs": false,
  "research-convergences": false,
  "research-team": true,
  "research-staffing": true,
  "research-arc": false,
  "finance-ledger": true,
  "finance-costs": true,
  "finance-capital": false,
  "finance-payroll": false,
  "finance-commitments": false,
  "hiring-pressure": true,
  "hiring-coverage": true,
  "hiring-queue": false,
  "facilities-supplier": true,
  "facilities-energy": true,
  "facilities-projects": true,
  "facilities-expansion": true,
  "settings-ai": true,
  "settings-cinematic": true,
  "settings-voice": true,
  "settings-audio": false,
  "settings-cloud": false,
  "settings-slots": false,
};

type LayoutPreferences = {
  intelCollapsed: boolean;
  detailCollapsed: boolean;
  sections: Record<string, boolean>;
};

const defaultLayoutPreferences = (): LayoutPreferences => ({
  intelCollapsed: false,
  detailCollapsed: false,
  sections: { ...DEFAULT_SECTION_OPEN },
});

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
    summary: "Talent does not just cost a signing bonus. Every hire permanently changes payroll and quarterly burn.",
    points: [
      "Research levels now create passive baseline revenue, but the bigger money comes from track-specific commercialization programs you choose to launch.",
      "Expenses are broken into payroll, compute, facilities, research overhead, commercialization opex, and expansion projects.",
      "A beautiful lab that cannot pay for its clusters still dies.",
    ],
  },
  {
    title: "Commercialize Deliberately",
    summary: "A breakthrough is capability. A business line is a separate branching decision tree.",
    points: [
      "Each track now has a commercialization graph with multiple entry plays, scale paths, and frontier plays instead of a single straight revenue ladder.",
      "Programs cost upfront capital, take time to launch, reserve compute after they go live, and can require specific staff coverage such as product, policy, orbital, or quantum roles.",
      "Some product choices combine across tracks to create market convergences with their own revenue, fear, trust, and geopolitical consequences.",
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
      "Finance now also tracks founder control and funding rounds, because raising money can save the lab while changing who really steers it. Different endings unlock new starting conditions back on the main menu.",
    ],
  },
  {
    title: "Dilemmas and Voice",
    summary: "Decisions are logged, can shift endings, and can now be narrated out loud.",
    points: [
      "The decision log in the briefing panel remembers your calls and impact lines.",
      "Production AI adds narrative flavor and scene art only. The deterministic simulation runs with or without it.",
      "OpenAI voice can read your quarterly summary using a high-quality narration voice if you activate it in Settings.",
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

function formatExpenseLabel(label: string) {
  if (label === "commercialization") return "Commercialization";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatLaneLabel(label: string) {
  return label === "public-sector"
    ? "Public Sector"
    : label.charAt(0).toUpperCase() + label.slice(1);
}

function formatFundingRoundLabel(round: string) {
  return round === "seed" ? "Seed" : round.replace("series-", "Series ").toUpperCase();
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
      data-active={active}
      onClick={onClick}
      className={`mission-nav-button inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
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

function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  actions,
  className = "",
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[24px] border border-white/8 bg-white/4 p-4 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs uppercase tracking-[0.22em] text-slate-400">{title}</span>
          {subtitle ? <span className="mt-1 block text-sm leading-5 text-slate-500">{subtitle}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {actions}
          <span className="rounded-full border border-white/10 bg-slate-950/65 p-1 text-slate-400">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function CommandMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: typeof BrainCircuit;
  tone?: "sky" | "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClasses =
    tone === "sky"
      ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
      : tone === "emerald"
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
        : tone === "amber"
          ? "border-amber-400/20 bg-amber-500/10 text-amber-50"
          : tone === "rose"
            ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
            : "border-white/8 bg-white/4 text-white";
  const iconTone =
    tone === "sky"
      ? "border-sky-300/25 bg-sky-400/12 text-sky-200"
      : tone === "emerald"
        ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-200"
        : tone === "amber"
          ? "border-amber-300/25 bg-amber-400/12 text-amber-100"
          : tone === "rose"
            ? "border-rose-300/25 bg-rose-400/12 text-rose-200"
            : "border-white/10 bg-white/5 text-slate-200";

  return (
    <div className={`mission-kpi rounded-[24px] border px-4 py-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold">{value}</p>
        </div>
        {Icon ? (
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${iconTone}`}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-3 text-xs leading-5 text-slate-400">{helper}</p> : null}
    </div>
  );
}

function SignalChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "bad" | "focus" | "warn";
}) {
  const classes =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : tone === "bad"
        ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
        : tone === "focus"
          ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
          : tone === "warn"
            ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-white/5 text-slate-300";

  return (
    <span className={`mission-signal-chip inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${classes}`}>
      {label}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StaffAvatar({
  researcher,
  size = "md",
}: {
  researcher: Pick<Researcher, "id" | "name" | "primaryTrack" | "role">;
  size?: "sm" | "md" | "lg";
}) {
  const track = TRACK_DEFINITIONS.find((entry) => entry.id === researcher.primaryTrack);
  const sizeClass = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-11 w-11" : "h-14 w-14";
  const textClass = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 ${sizeClass}`}
      style={{
        boxShadow: track ? `0 0 0 1px ${track.accent}33, 0 16px 42px ${track.accent}16` : undefined,
      }}
      title={`${researcher.name} - ${researcher.role}`}
    >
      <div
        className={`absolute inset-0 flex items-center justify-center font-semibold text-white ${textClass}`}
        style={{
          background: track
            ? `radial-gradient(circle at 30% 20%, ${track.accent}66, transparent 48%), linear-gradient(135deg, #0a1328, #030713)`
            : undefined,
        }}
      >
        {getInitials(researcher.name)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/staff/${researcher.id}.jpg`}
        alt={`${researcher.name} profile portrait`}
        className="relative z-10 h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

function getTrackLabel(trackId: TrackId | null | undefined) {
  if (!trackId) {
    return "Unassigned";
  }

  return TRACK_DEFINITIONS.find((track) => track.id === trackId)?.shortName ?? trackId;
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
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

function getTalentAssignmentStatus(
  employee: Pick<Researcher, "assignedTrack">,
  selectedTrack?: TrackId,
) {
  if (!employee.assignedTrack) {
    return {
      label: "Free",
      detail: "Unassigned this quarter. Assigning does not pull them off another lane.",
      tone: "good" as const,
    };
  }

  if (employee.assignedTrack === selectedTrack) {
    return {
      label: "On this research",
      detail: `Currently assigned to ${getTrackLabel(employee.assignedTrack)}.`,
      tone: "focus" as const,
    };
  }

  return {
    label: `On ${getTrackLabel(employee.assignedTrack)}`,
    detail: `Already working on ${getTrackLabel(employee.assignedTrack)}. Clicking will reassign them here.`,
    tone: "warn" as const,
  };
}

type TrackMapPositions = Record<TrackId, { x: number; y: number }>;

function getDefaultTrackMapPositions(): TrackMapPositions {
  return TRACK_DEFINITIONS.reduce((positions, track) => {
    positions[track.id] = { ...track.position };
    return positions;
  }, {} as TrackMapPositions);
}

function clampTrackMapPosition(value: number, edgePadding: number) {
  return Math.max(edgePadding, Math.min(100 - edgePadding, value));
}

function normalizeTrackMapPositions(positions: Partial<TrackMapPositions>): TrackMapPositions {
  const fallback = getDefaultTrackMapPositions();

  TRACK_DEFINITIONS.forEach((track) => {
    const position = positions[track.id];

    if (!position) {
      return;
    }

    fallback[track.id] = {
      x: clampTrackMapPosition(position.x, 7),
      y: clampTrackMapPosition(position.y, 9),
    };
  });

  return fallback;
}

function getCandidateFitScore(
  candidate: {
    generalist?: boolean;
    primaryTrack: TrackId;
    secondaryTrack?: TrackId;
    research: number;
    execution: number;
    leadership: number;
    ethics: number;
    contestedBy?: RivalId | null;
  },
  trackId: TrackId,
) {
  const laneFit = candidate.generalist
    ? 28
    : candidate.primaryTrack === trackId
      ? 38
      : candidate.secondaryTrack === trackId
        ? 28
        : 8;
  const capabilityFit =
    candidate.research * 3.2 + candidate.execution * 2.2 + candidate.leadership * 1.4 + candidate.ethics * 1.2;
  const contestModifier = candidate.contestedBy ? -6 : 0;

  return Math.max(0, Math.min(100, Math.round(laneFit + capabilityFit + contestModifier)));
}

function getCandidateFitLabel(score: number) {
  if (score >= 82) return "Prime fit";
  if (score >= 66) return "Strong fit";
  if (score >= 48) return "Viable fit";
  return "Stretch fit";
}

function getCandidateFitTone(score: number): "neutral" | "good" | "bad" | "focus" {
  if (score >= 82) return "good";
  if (score >= 66) return "focus";
  if (score >= 48) return "neutral";
  return "bad";
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

const dilemmaEffectOrder = [
  "capital",
  "compute",
  "trust",
  "fear",
  "board",
  "reputation",
  "governmentDependence",
  "ethicsDebt",
  "safetyCulture",
  "morale",
  "openness",
  "crisisCount",
] as const;

const dilemmaInverseEffects = new Set([
  "fear",
  "governmentDependence",
  "ethicsDebt",
  "crisisCount",
]);

function formatDilemmaEffectLabel(effect: (typeof dilemmaEffectOrder)[number], value: number) {
  switch (effect) {
    case "capital":
      return `${value > 0 ? "+" : ""}${formatCurrency(value)} capital`;
    case "compute":
      return `${formatSignedValue(value)} PFLOPS`;
    case "governmentDependence":
      return `${formatSignedValue(value)} dependence`;
    case "ethicsDebt":
      return `${formatSignedValue(value)} ethics debt`;
    case "safetyCulture":
      return `${formatSignedValue(value)} safety culture`;
    case "crisisCount":
      return `${formatSignedValue(value)} crises`;
    default:
      return `${formatSignedValue(value)} ${effect.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  }
}

function describeDilemmaEffectTone(effect: (typeof dilemmaEffectOrder)[number], value: number) {
  if (value === 0) {
    return "neutral";
  }

  const positiveDirection = dilemmaInverseEffects.has(effect) ? value < 0 : value > 0;
  return positiveDirection ? "good" : "bad";
}

function getDilemmaEffectEntries(effects: Record<string, number | undefined>) {
  return dilemmaEffectOrder.flatMap((effect) => {
    const value = effects[effect];
    return typeof value === "number" && value !== 0 ? [{ effect, value }] : [];
  });
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

function presetIdentityLabel(presetId: StartPresetId) {
  switch (presetId) {
    case "founder":
      return "Founder-CEO";
    case "government":
      return "Lab Director";
    case "open-source":
      return "Founding Steward";
    case "corporate":
      return "Division CEO";
    case "underground":
      return "Founder-Operator";
    case "second-chance":
      return "Recovery CEO";
    default:
      return "CEO";
  }
}

function formatRoleKeyword(keyword: string) {
  const lowered = keyword.toLowerCase();

  if (lowered.includes("biolog")) return "Biology coverage";
  if (lowered.includes("policy")) return "Policy coverage";
  if (lowered.includes("product")) return "Product coverage";
  if (lowered.includes("platform")) return "Platform coverage";
  if (lowered.includes("quantum")) return "Quantum coverage";
  if (lowered.includes("security")) return "Security coverage";
  if (lowered.includes("robot")) return "Robotics coverage";
  if (lowered.includes("orbit")) return "Orbital coverage";
  if (lowered.includes("satellite")) return "Satellite coverage";
  if (lowered.includes("autonomy")) return "Autonomy coverage";
  if (lowered.includes("trust")) return "Trust & safety coverage";
  if (lowered.includes("field")) return "Field-ops coverage";
  if (lowered.includes("climate")) return "Climate coverage";
  if (lowered.includes("econom")) return "Economics coverage";
  if (lowered.includes("energy")) return "Energy coverage";
  if (lowered.includes("align")) return "Alignment coverage";
  if (lowered.includes("material")) return "Materials coverage";

  return `${keyword} coverage`;
}

function commercializationNodeStatus(option: ReturnType<typeof getCommercializationOptions>[number]) {
  if (option.isLive) return "live";
  if (option.isLaunching) return "launching";
  if (option.available) return "ready";
  return "blocked";
}

function commercializationNodeClasses(
  status: "live" | "launching" | "ready" | "blocked",
  selected: boolean,
) {
  const tone =
    status === "live"
      ? "border-emerald-400/35 bg-emerald-500/12"
      : status === "launching"
        ? "border-amber-400/35 bg-amber-500/12"
        : status === "ready"
          ? "border-sky-400/35 bg-sky-500/10"
          : "border-white/10 bg-slate-950/82";

  return `${tone} ${selected ? "ring-1 ring-sky-300/60 shadow-[0_0_0_1px_rgba(125,211,252,0.2)]" : ""}`;
}

function commercializationStatusLabel(status: "live" | "launching" | "ready" | "blocked") {
  switch (status) {
    case "live":
      return "Live";
    case "launching":
      return "Launching";
    case "ready":
      return "Ready";
    default:
      return "Locked";
  }
}

function commercializationTierLabel(tier: 1 | 2 | 3) {
  if (tier === 1) return "Entry Market";
  if (tier === 2) return "Scale Path";
  return "Frontier Play";
}

function commercializationRowXPositions(count: number) {
  switch (count) {
    case 1:
      return [50];
    case 2:
      return [32, 68];
    case 3:
      return [18, 50, 82];
    case 4:
      return [12, 38, 62, 88];
    default:
      return Array.from({ length: count }, (_, index) => 12 + (76 / Math.max(count - 1, 1)) * index);
  }
}

const commercializationLaneOrder = {
  commercial: 0,
  "public-sector": 1,
  strategic: 2,
  frontier: 3,
} as const;

const commercializationLaneColumns = {
  commercial: 18,
  "public-sector": 40,
  strategic: 62,
  frontier: 84,
} as const;

function CommercializationGraph({
  options,
  selectedId,
  onSelect,
}: {
  options: Array<ReturnType<typeof getCommercializationOptions>[number]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tiers: Array<1 | 2 | 3> = [1, 2, 3];
  const tierY: Record<1 | 2 | 3, number> = {
    1: 82,
    2: 50,
    3: 18,
  };
  const positions = new Map<string, { x: number; y: number }>();

  tiers.forEach((tier) => {
    const row = options.filter((option) => option.tier === tier);
    const uniqueLanes = new Set(row.map((option) => option.lane));
    const laneAligned =
      row.length > 0 &&
      row.length <= 4 &&
      uniqueLanes.size === row.length &&
      !row.every((option) => option.lane === "frontier");
    const orderedRow = laneAligned
      ? [...row].sort(
          (left, right) =>
            commercializationLaneOrder[left.lane] - commercializationLaneOrder[right.lane],
        )
      : row;
    const xs = laneAligned
      ? orderedRow.map((option) => commercializationLaneColumns[option.lane])
      : commercializationRowXPositions(orderedRow.length);

    orderedRow.forEach((option, index) => {
      positions.set(option.id, { x: xs[index] ?? 50, y: tierY[tier] });
    });
  });

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Commercialization Graph</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Commercialization is a branching market map. Pick one lane, then unlock the scale and frontier plays that logically follow from it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">Live</span>
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">Launching</span>
          <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-100">Ready</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-400">Locked</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-hidden rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(8,14,28,0.94),rgba(6,10,22,0.98))]">
        <div className="border-b border-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 lg:hidden">
          Scroll to inspect the full commercialization graph.
        </div>
        <div className="relative h-[520px] min-w-[860px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {options.flatMap((option) =>
              (option.prerequisitePrograms ?? []).map((prerequisiteId) => {
                const from = positions.get(prerequisiteId);
                const to = positions.get(option.id);
                if (!from || !to) return null;

                return (
                  <line
                    key={`${prerequisiteId}-${option.id}`}
                    x1={from.x}
                    y1={from.y > to.y ? from.y - 6 : from.y + 6}
                    x2={to.x}
                    y2={from.y > to.y ? to.y + 6 : to.y - 6}
                    stroke={option.available || option.isLive || option.isLaunching ? "rgba(125,211,252,0.42)" : "rgba(120,140,180,0.18)"}
                    strokeDasharray={option.isLive || option.isLaunching ? "0" : "4 4"}
                    strokeWidth={option.isLive || option.isLaunching ? 1.2 : 0.8}
                  />
                );
              }),
            )}
          </svg>

          {tiers.map((tier) => (
            <div
              key={tier}
              className="absolute left-4 text-[11px] uppercase tracking-[0.24em] text-slate-500"
              style={{ top: `${tierY[tier] - 11}%` }}
            >
              {commercializationTierLabel(tier)}
            </div>
          ))}

          {options.map((option) => {
            const position = positions.get(option.id) ?? { x: 50, y: 50 };
            const status = commercializationNodeStatus(option);
            const selected = option.id === selectedId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[24px] border p-4 text-left shadow-[0_18px_60px_rgba(2,10,28,0.4)] transition hover:scale-[1.01] ${commercializationNodeClasses(status, selected)}`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: 220,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {formatLaneLabel(option.lane)}
                    </p>
                    <h3 className="mt-2 text-sm font-semibold leading-6 text-white">{option.name}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      status === "live"
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                        : status === "launching"
                          ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
                          : status === "ready"
                            ? "border-sky-400/25 bg-sky-500/10 text-sky-100"
                            : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    {commercializationStatusLabel(status)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{option.source}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <span>Upfront {formatCurrency(option.upfrontCost)}</span>
                  <span>Net {formatCurrency(option.netRevenue)}</span>
                  <span>{option.computeDemand} PFLOPS</span>
                  <span>{option.setupTurns}Q setup</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
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
    <div className="mission-menu-card rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_90px_rgba(2,10,28,0.45)]">
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
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
        Executive seat: {presetIdentityLabel(presetId)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <span>Capital {formatCurrency(preset.modifier.capital)}</span>
        <span>Trust {preset.modifier.trust}</span>
        <span>Fear {preset.modifier.fear}</span>
        <span>Board {preset.modifier.board}</span>
      </div>
      {!unlocked ? (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Finish runs to unlock advanced starts. Different endings open different organizations.
        </p>
      ) : null}
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
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    trackId: TrackId;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [nodePositions, setNodePositions] = useState<TrackMapPositions>(() => getDefaultTrackMapPositions());
  const [mapLayoutLoaded, setMapLayoutLoaded] = useState(false);
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
  const selectedDefinition = TRACK_DEFINITIONS.find((track) => track.id === state.selectedTrack)!;
  const selectedTrack = state.tracks[state.selectedTrack];
  const selectedForecast = getTrackForecast(state, state.selectedTrack);
  const committedCompute = Object.values(state.tracks).reduce((sum, track) => sum + track.compute, 0);
  const researchCapacity = getResearchComputeCapacity(state);
  const liveProgramsOnTrack = state.commercializationPrograms.filter(
    (program) => program.trackId === state.selectedTrack && program.status === "live",
  ).length;
  const selectedConvergenceReadiness = CONVERGENCES.filter((convergence) =>
    Object.keys(convergence.requirements).includes(state.selectedTrack),
  ).map((convergence) => {
    const requiredLevel = convergence.requirements[state.selectedTrack] ?? 0;
    const partnerRequirements = Object.entries(convergence.requirements).filter(
      ([trackId]) => trackId !== state.selectedTrack,
    ) as Array<[TrackId, number]>;
    const partnersReady = partnerRequirements.every(
      ([trackId, level]) => state.tracks[trackId].level >= level,
    );

    return {
      id: convergence.id,
      name: convergence.name,
      requiredLevel,
      ready: selectedTrack.level >= requiredLevel && partnersReady,
      near: selectedTrack.level + 1 >= requiredLevel,
      partnerLabel: partnerRequirements.length
        ? partnerRequirements
            .map(([trackId, level]) => `${getTrackLabel(trackId)} L${level}`)
            .join(" + ")
        : "No partner gate",
    };
  });
  const readyConvergenceCount = selectedConvergenceReadiness.filter((convergence) => convergence.ready).length;
  const nextConvergence = selectedConvergenceReadiness.find((convergence) => !convergence.ready && convergence.near);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRACK_MAP_LAYOUT_KEY);

      if (raw) {
        setNodePositions(normalizeTrackMapPositions(JSON.parse(raw) as Partial<TrackMapPositions>));
      }
    } catch {
      setNodePositions(getDefaultTrackMapPositions());
    } finally {
      setMapLayoutLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapLayoutLoaded) {
      return;
    }

    window.localStorage.setItem(TRACK_MAP_LAYOUT_KEY, JSON.stringify(nodePositions));
  }, [mapLayoutLoaded, nodePositions]);

  const updateDraggedNode = (trackId: TrackId, clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const nextPosition = {
      x: clampTrackMapPosition(((clientX - rect.left) / rect.width) * 100, 7),
      y: clampTrackMapPosition(((clientY - rect.top) / rect.height) * 100, 9),
    };

    setNodePositions((current) => ({
      ...current,
      [trackId]: nextPosition,
    }));
  };

  const handleNodePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    trackId: TrackId,
  ) => {
    if (event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      trackId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleNodePointerMove = (event: PointerEvent<HTMLButtonElement>, trackId: TrackId) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.trackId !== trackId || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);

    if (distance > 4) {
      dragState.moved = true;
      updateDraggedNode(trackId, event.clientX, event.clientY);
    }
  };

  const handleNodePointerUp = (event: PointerEvent<HTMLButtonElement>, trackId: TrackId) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.trackId !== trackId || dragState.pointerId !== event.pointerId) {
      return;
    }

    const wasDragging = dragState.moved;
    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!wasDragging) {
      onOpenTrack(trackId);
    }
  };

  const handleNodePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  };

  const resetTrackMapLayout = () => {
    const nextPositions = getDefaultTrackMapPositions();
    setNodePositions(nextPositions);
    window.localStorage.setItem(TRACK_MAP_LAYOUT_KEY, JSON.stringify(nextPositions));
  };

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.18),transparent_40%),linear-gradient(180deg,rgba(7,12,28,0.98),rgba(7,10,24,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lab Map</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Research Web</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Each node is an active research program. Assign staff, allocate compute, and watch ETA shrink.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-sky-200">
            {Math.round((committedCompute / Math.max(researchCapacity, 1)) * 100)}
            % research compute committed
          </div>
          <button
            type="button"
            onClick={resetTrackMapLayout}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-sky-300/30 hover:bg-sky-500/10"
          >
            Reset map
          </button>
        </div>
      </div>
      <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.6fr))]">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Selected Program</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{selectedDefinition.name}</h3>
            </div>
            <span
              className="inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
              style={{
                borderColor: `${selectedDefinition.accent}66`,
                backgroundColor: `${selectedDefinition.accent}18`,
                color: selectedDefinition.accent,
              }}
            >
              {selectedTrack.unlocked ? `L${selectedTrack.level}` : "Locked"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {selectedTrack.unlocked
              ? `${selectedForecast.projectName} is the active target.`
              : TRACK_UNLOCK_NOTES[state.selectedTrack]}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SignalChip
              label={selectedTrack.unlocked ? `ETA ${formatTurns(selectedForecast.turnsToLevel)}` : "Needs unlock hire"}
              tone={selectedTrack.unlocked ? "focus" : "bad"}
            />
            <SignalChip label={`${selectedForecast.assignedCount} staff`} tone="neutral" />
            <SignalChip label={`${selectedTrack.compute} PFLOPS allocated`} tone="neutral" />
            <SignalChip
              label={nextConvergence ? `Next combo: ${nextConvergence.partnerLabel}` : `${readyConvergenceCount} combos ready`}
              tone={readyConvergenceCount ? "good" : nextConvergence ? "focus" : "neutral"}
            />
          </div>
        </div>
        <CommandMetric
          label="Free Compute"
          value={`${Math.max(researchCapacity - committedCompute, 0)} PFLOPS`}
          helper="Uncommitted research capacity you can still place."
          icon={Cpu}
          tone="sky"
        />
        <CommandMetric
          label="Assigned Scientists"
          value={`${selectedForecast.assignedCount}`}
          helper="People currently pushing this program forward."
          icon={Users}
          tone="slate"
        />
        <CommandMetric
          label="Live Market Lines"
          value={`${liveProgramsOnTrack}`}
          helper="Commercial programs already drawing from this track."
          icon={BarChart3}
          tone="emerald"
        />
      </div>
      <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(12,18,38,0.88),rgba(8,12,24,0.92))]">
        <div className="border-b border-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Drag cards to clear overlaps. Click without dragging to select a research lane.
        </div>
        <div className="overflow-x-auto overflow-y-hidden">
          <div ref={mapRef} className="relative h-[680px] min-w-[980px] touch-none select-none md:min-w-[1120px] 2xl:h-[760px]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {links.map((link) => {
                const sourcePosition = nodePositions[link.source.id];
                const targetPosition = nodePositions[link.target.id];

                return (
                  <line
                    key={link.key}
                    x1={sourcePosition.x}
                    y1={sourcePosition.y}
                    x2={targetPosition.x}
                    y2={targetPosition.y}
                    stroke={link.active ? "rgba(132, 204, 255, 0.72)" : "rgba(120, 140, 180, 0.14)"}
                    strokeDasharray={link.active ? "0" : "3 4"}
                    strokeWidth={link.active ? 1.3 : 0.7}
                  />
                );
              })}
            </svg>
            {TRACK_DEFINITIONS.map((track) => {
              const stateTrack = state.tracks[track.id];
              const Icon = TRACK_ICONS[track.id];
              const selected = state.selectedTrack === track.id;
              const forecast = getTrackForecast(state, track.id);
              const position = nodePositions[track.id];

              return (
                <motion.button
                  key={track.id}
                  type="button"
                  onPointerDown={(event) => handleNodePointerDown(event, track.id)}
                  onPointerMove={(event) => handleNodePointerMove(event, track.id)}
                  onPointerUp={(event) => handleNodePointerUp(event, track.id)}
                  onPointerCancel={handleNodePointerCancel}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenTrack(track.id);
                    }
                  }}
                  whileHover={{ scale: 1.03 }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-[26px] border p-4 text-left shadow-[0_16px_60px_rgba(5,12,32,0.36)] transition active:cursor-grabbing ${
                    selected
                      ? "border-sky-300/70 bg-slate-900/96"
                      : "border-white/8 bg-slate-950/84 hover:border-white/16"
                  } ${stateTrack.unlocked ? "" : "opacity-70"}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: selected ? 248 : 222,
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
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SignalChip label={`${researchCapacity} PFLOPS research capacity`} tone="neutral" />
        <SignalChip label={`${committedCompute} PFLOPS committed`} tone="focus" />
        <SignalChip
          label={
            selectedTrack.unlocked && selectedForecast.blockedReason
              ? "Selected track blocked"
              : selectedTrack.unlocked
                ? "Selected track progressing"
                : "Selected track locked"
          }
          tone={
            selectedTrack.unlocked
              ? selectedForecast.blockedReason
                ? "bad"
                : "good"
              : "bad"
          }
        />
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
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_SECTION_OPEN,
  }));
  const [layoutPrefsLoaded, setLayoutPrefsLoaded] = useState(false);
  const [worldStateOpen, setWorldStateOpen] = useState(true);
  const [governmentsOpen, setGovernmentsOpen] = useState(true);
  const [rivalsOpen, setRivalsOpen] = useState(true);
  const [chiefMemo, setChiefMemo] = useState<string | null>(null);
  const [worldLead, setWorldLead] = useState<string | null>(null);
  const [dilemmaFlavor, setDilemmaFlavor] = useState<string | null>(null);
  const [rivalColor, setRivalColor] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null);
  const [openAiKeyDraft, setOpenAiKeyDraft] = useState<string | null>(null);
  const [serverAIStatus, setServerAIStatus] = useState<AIProviderStatus | null>(null);
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
    message: "Scene art will auto-generate for new briefings and dilemmas when production AI is connected.",
  });
  const [sceneArtUrl, setSceneArtUrl] = useState<string | null>(null);
  const [sceneArtScope, setSceneArtScope] = useState<"briefing" | "dilemma" | null>(null);
  const [cinematicStatus, setCinematicStatus] = useState<{
    tone: "idle" | "checking" | "success" | "error";
    message: string;
  }>({
    tone: "idle",
    message: "Cinematic Mode is optional. Generate video only for story moments you want to preserve.",
  });
  const [cinematicJob, setCinematicJob] = useState<{
    requestId: string;
    model: string;
    resultUrl?: string;
    scope: "briefing" | "dilemma";
  } | null>(null);
  const [cinematicVideoUrl, setCinematicVideoUrl] = useState<string | null>(null);
  const [cinematicGenerateAudio, setCinematicGenerateAudio] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isNarrating, setIsNarrating] = useState(false);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const deferredFeed = useDeferredValue(store.feed);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const sceneArtUrlRef = useRef<string | null>(null);
  const autoNarratedTurnRef = useRef<number | null>(null);
  const autoSceneArtKeyRef = useRef<string | null>(null);
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
  const [selectedCommercializationId, setSelectedCommercializationId] = useState<string | null>(null);
  const [candidateFocusFilter, setCandidateFocusFilter] = useState<TrackId | "all">("all");
  const [showContestedCandidatesOnly, setShowContestedCandidatesOnly] = useState(false);

  const serverNarrativeReady = Boolean(serverAIStatus?.narrative.available);
  const serverSceneArtReady = Boolean(serverAIStatus?.sceneArt.available);
  const serverVoiceReady = Boolean(serverAIStatus?.voice.available);
  const serverCinematicReady = Boolean(serverAIStatus?.cinematic?.available);
  const aiUsesServer = store.aiSettings.apiKey === SERVER_AI_KEY;
  const voiceUsesServer = store.openAISettings.apiKey === SERVER_AI_KEY;
  const productionAIModel = serverAIStatus?.narrative.model ?? serverAIStatus?.sceneArt.model;
  const productionVoiceModel = serverAIStatus?.voice.model;
  const productionCinematicModel = serverAIStatus?.cinematic?.model;

  const geminiStatus =
    geminiStatusOverride ??
    (store.aiSettings.enabled && store.aiSettings.apiKey
      ? {
          tone: "success" as const,
          message: aiUsesServer
            ? `Production AI narrative and scene art are active${productionAIModel ? ` (${productionAIModel})` : ""}.`
            : "Manual Gemini narrative and scene art are active.",
        }
      : serverNarrativeReady || serverSceneArtReady
        ? {
            tone: "idle" as const,
            message: "Production AI is configured. Activate it to use server-side narrative and scene art.",
          }
        : { tone: "idle" as const, message: "AI narrative and scene art are disabled." });

  const openAiStatus =
    openAiStatusOverride ??
    (store.openAISettings.enabled && store.openAISettings.apiKey
      ? {
          tone: "success" as const,
          message: voiceUsesServer
            ? `Production OpenAI voice is active${productionVoiceModel ? ` (${productionVoiceModel})` : ""}.`
            : "Manual OpenAI voice is active and ready to narrate turn summaries.",
        }
      : serverVoiceReady
        ? {
            tone: "idle" as const,
            message: "Production OpenAI voice is configured. Activate it to narrate briefings.",
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
  const researchCapacity = getResearchComputeCapacity(store);
  const reservedCommercialCompute = getCommercializationReservedCompute(store);
  const freeCompute = Math.max(researchCapacity - totalAllocated, 0);
  const buildOptions = availableBuildOptions(store);
  const postureOptions = Object.values(TRACK_POSTURES) as Array<(typeof TRACK_POSTURES)[TrackPostureId]>;
  const selectedPosture = TRACK_POSTURES[selectedTrack.posture ?? "balanced"];
  const queuedComputeDelta = store.projects.reduce((sum, project) => sum + project.computeDelta, 0);
  const queuedUpkeepDelta = store.projects.reduce((sum, project) => sum + project.upkeep, 0);
  const projectedComputeCapacity = store.resources.computeCapacity + queuedComputeDelta;
  const projectedResearchCapacity = Math.max(projectedComputeCapacity - reservedCommercialCompute, 0);
  const projectedUtilization =
    projectedResearchCapacity > 0 ? Math.min(100, (totalAllocated / projectedResearchCapacity) * 100) : 0;
  const selectedTrackCommercializationOptions = getCommercializationOptions(store, store.selectedTrack);
  const commercializationReadyCount = selectedTrackCommercializationOptions.filter((option) => option.available).length;
  const researchBottlenecks = [
    selectedForecast.blockedReason
      ? {
          label: "Specialist or unlock gate",
          detail: selectedForecast.blockedReason,
          tone: "bad" as const,
        }
      : null,
    selectedTrack.unlocked && selectedForecast.assignedCount === 0
      ? {
          label: "Missing staff assignment",
          detail: "Assign eligible researchers before the quarter clock advances.",
          tone: "bad" as const,
        }
      : null,
    selectedTrack.unlocked && selectedTrack.compute < selectedForecast.recommendedCompute
      ? {
          label: "Compute shortfall",
          detail: `${selectedTrack.compute}/${selectedForecast.recommendedCompute} PFLOPS committed to the active stage.`,
          tone: "focus" as const,
        }
      : null,
    store.resources.fear > store.resources.trust + 8
      ? {
          label: "Governance pressure",
          detail: "Fear is outpacing trust, which can slow frontier work and raise scrutiny.",
          tone: "bad" as const,
        }
      : null,
    commercializationReadyCount === 0 && selectedTrack.level > 0
      ? {
          label: "Commercialization readiness",
          detail: "No market path is ready on this lane yet. Check role gates, prerequisite programs, and cash.",
          tone: "neutral" as const,
        }
      : null,
    {
      label: `${selectedPosture.label} posture`,
      detail: selectedPosture.summary,
      tone: selectedPosture.id === "sprint" ? ("focus" as const) : selectedPosture.id === "safe" ? ("good" as const) : ("neutral" as const),
    },
  ].filter(Boolean) as Array<{ label: string; detail: string; tone: "bad" | "focus" | "good" | "neutral" }>;
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
  const playerRank = labLeaderboard.findIndex((entry) => entry.id === "player") + 1;
  const topRivalMove = topRivals[0]?.recentMove ?? "Rival status";
  const expenseEntries = Object.entries(store.resources.expenses).sort((left, right) => right[1] - left[1]);
  const researchExpenseBreakdown = getResearchExpenseBreakdown(store);
  const commercializationExpenseBreakdown = getCommercializationExpenseBreakdown(store);
  const allCommercializationOptions = getCommercializationOptions(store);
  const commercializationOptions = allCommercializationOptions.filter(
    (option) => option.trackId === store.selectedTrack,
  );
  const activeCommercialPrograms = getActiveCommercializationPrograms(store, store.selectedTrack);
  const activeCommercialConvergences = getActiveCommercializationConvergences(store);
  const fundingOffers = getFundingOffers(store);
  const quarterlyNet = Number((store.resources.revenue - store.resources.burn).toFixed(2));
  const assignedHeadcount = store.employees.filter((employee) => employee.assignedTrack !== null).length;
  const liveProgramsCount = store.commercializationPrograms.filter((program) => program.status === "live").length;
  const trackRevenueStream = store.revenueStreams.find(
    (stream) => stream.id === `track-passive-${store.selectedTrack}`,
  );
  const trackCommercialRevenueStreams = store.revenueStreams.filter(
    (stream) => stream.trackId === store.selectedTrack && Boolean(stream.programId),
  );
  const selectedTrackResearchExpense =
    researchExpenseBreakdown.find((entry) => entry.trackId === store.selectedTrack)?.amount ?? 0;
  const selectedTrackCommercialExpense = commercializationExpenseBreakdown
    .filter((entry) => entry.trackId === store.selectedTrack)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const commercializationOptionSignature = commercializationOptions
    .map((option) => `${option.id}:${option.available ? 1 : 0}:${option.isLive ? 1 : 0}:${option.isLaunching ? 1 : 0}`)
    .join("|");
  const firstCommercializationOptionId = commercializationOptions[0]?.id ?? null;
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
  const commercializationLookup = Object.fromEntries(
    allCommercializationOptions.map((option) => [option.id, option]),
  ) as Record<string, (typeof allCommercializationOptions)[number]>;
  const selectedCommercializationOption =
    commercializationOptions.find((option) => option.id === selectedCommercializationId) ??
    commercializationOptions[0] ??
    null;
  const selectedCommercializationProgram =
    activeCommercialPrograms.find((program) => program.definitionId === selectedCommercializationOption?.id) ?? null;
  const selectedCommercializationConvergencePreview = selectedCommercializationOption
    ? COMMERCIALIZATION_CONVERGENCES.filter((convergence) =>
        convergence.requiredPrograms.includes(selectedCommercializationOption.id),
      ).map((convergence) => {
        const readiness = convergence.requiredPrograms.map((programId) => {
          const program = store.commercializationPrograms.find((entry) => entry.definitionId === programId);
          const option = commercializationLookup[programId];

          return {
            id: programId,
            name: option?.name ?? programId,
            live: program?.status === "live",
          };
        });

        return {
          ...convergence,
          readiness,
          live: activeCommercialConvergences.some((entry) => entry.id === convergence.id),
        };
      })
    : [];
  const selectedCommercializationImpactSummary = selectedCommercializationOption
    ? [
        selectedCommercializationOption.effects.trust
          ? `${selectedCommercializationOption.effects.trust > 0 ? "+" : ""}${selectedCommercializationOption.effects.trust} trust`
          : null,
        selectedCommercializationOption.effects.fear
          ? `${selectedCommercializationOption.effects.fear > 0 ? "+" : ""}${selectedCommercializationOption.effects.fear} fear`
          : null,
        selectedCommercializationOption.effects.board
          ? `${selectedCommercializationOption.effects.board > 0 ? "+" : ""}${selectedCommercializationOption.effects.board} board`
          : null,
        selectedCommercializationOption.effects.reputation
          ? `${selectedCommercializationOption.effects.reputation > 0 ? "+" : ""}${selectedCommercializationOption.effects.reputation} reputation`
          : null,
        selectedCommercializationOption.effects.governmentDependence
          ? `${selectedCommercializationOption.effects.governmentDependence > 0 ? "+" : ""}${selectedCommercializationOption.effects.governmentDependence} government dependence`
          : null,
        selectedCommercializationOption.effects.ethicsDebt
          ? `${selectedCommercializationOption.effects.ethicsDebt > 0 ? "+" : ""}${selectedCommercializationOption.effects.ethicsDebt} ethics debt`
          : null,
      ]
        .filter(Boolean)
        .join(" / ")
    : "";
  const payrollEntries = [...store.employees].sort((left, right) => right.salary - left.salary);
  const assignedTalent = store.employees.filter((employee) => employee.assignedTrack !== null);
  const idleTalent = store.employees.filter((employee) => employee.assignedTrack === null);
  const talentAssignmentRows = TRACK_DEFINITIONS.map((track) => {
    const assigned = store.employees.filter((employee) => employee.assignedTrack === track.id);
    const forecast = getTrackForecast(store, track.id);

    return {
      track,
      assigned,
      forecast,
      open: store.tracks[track.id].unlocked,
    };
  });
  const matchingCandidateCount = store.candidates.filter((candidate) =>
    canResearcherSupportTrack(candidate, store.selectedTrack),
  ).length;
  const contestedCandidateCount = store.candidates.filter((candidate) => candidate.contestedBy).length;
  const candidateTrackFilters = TRACK_DEFINITIONS.filter((track) =>
    store.candidates.some(
      (candidate) =>
        candidate.generalist || candidate.primaryTrack === track.id || candidate.secondaryTrack === track.id,
    ),
  ).map((track) => track.id);
  const candidatePriorityTrack =
    candidateFocusFilter === "all" ? store.selectedTrack : candidateFocusFilter;
  const filteredCandidates = [...store.candidates]
    .filter((candidate) => {
      if (showContestedCandidatesOnly && !candidate.contestedBy) {
        return false;
      }

      if (candidateFocusFilter === "all") {
        return true;
      }

      return (
        candidate.generalist ||
        candidate.primaryTrack === candidateFocusFilter ||
        candidate.secondaryTrack === candidateFocusFilter
      );
    })
    .sort((left, right) => {
      const scoreCandidate = (candidate: (typeof store.candidates)[number]) =>
        (canResearcherSupportTrack(candidate, candidatePriorityTrack) ? 40 : 0) +
        (candidate.generalist ? 14 : 0) +
        (candidate.contestedBy ? 10 : 0) +
        candidate.research * 3 +
        candidate.execution * 2 +
        candidate.leadership +
        candidate.ethics;

      return scoreCandidate(right) - scoreCandidate(left);
    });
  const panelMeta: Record<
    PanelId,
    {
      eyebrow: string;
      title: string;
      description: string;
    }
  > = {
    briefing: {
      eyebrow: "Quarterly command",
      title: "Briefing, memory, and world signal",
      description:
        "Read the quarter, understand what moved, and decide what deserves focus before the next clock advance.",
    },
    finance: {
      eyebrow: "Capital markets",
      title: "Runway, burn, and control",
      description:
        "Judge whether this lab can keep sprinting, needs fresh capital, or should shift weight toward revenue.",
    },
    track: {
      eyebrow: "Research command",
      title: `${trackDefinition.name} operations`,
      description: selectedTrack.unlocked
        ? `Active target: ${selectedForecast.projectName}. Tune staffing, compute, and commercialization against the same cluster budget.`
        : TRACK_UNLOCK_NOTES[store.selectedTrack],
    },
    hiring: {
      eyebrow: "Talent command",
      title: "Roster, assignments, and recruiting",
      description:
        "See where your current talent is assigned first, then use the market only when the roster has a real gap.",
    },
    facilities: {
      eyebrow: "Infrastructure posture",
      title: "Compute supply and expansion timing",
      description:
        "Suppliers, energy, and builds decide how much frontier work this lab can actually sustain a few quarters from now.",
    },
    dilemmas: {
      eyebrow: "Decision theater",
      title: "Permanent strategic choices",
      description:
        "Crisis choices are part of the run history. They reshape endings, legitimacy, and how future pressure lands.",
    },
    settings: {
      eyebrow: "Systems and saves",
      title: "Narration, cloud sync, and run controls",
      description:
        "Voice, scene art, save portability, and runtime options all live here without changing the deterministic simulation.",
    },
  };
  const activePanelMeta = panelMeta[store.panel];
  const asideQuickStats =
    store.panel === "track"
      ? [
          { label: "ETA", value: formatTurns(selectedForecast.turnsToLevel) },
          { label: "Assigned", value: `${selectedForecast.assignedCount}` },
          { label: "Compute", value: `${selectedTrack.compute} PFLOPS` },
          {
            label: "Passive",
            value: trackRevenueStream ? formatCurrency(trackRevenueStream.amount) : "$0",
          },
        ]
      : store.panel === "finance"
        ? [
            { label: "Runway", value: `${store.resources.runwayMonths} months` },
            { label: "Net", value: `${quarterlyNet >= 0 ? "+" : ""}${formatCurrency(quarterlyNet)}` },
            { label: "Control", value: `${Math.round(store.flags.founderControl)}%` },
            { label: "Offers", value: `${fundingOffers.length}` },
          ]
        : store.panel === "hiring"
          ? [
              { label: "Assigned", value: `${assignedTalent.length}` },
              { label: "Idle", value: `${idleTalent.length}` },
              { label: "Market", value: `${store.candidates.length}` },
              { label: "Signed", value: `${store.pendingHires.length}` },
            ]
          : store.panel === "facilities"
            ? [
                { label: "Projects", value: `${store.projects.length}` },
                { label: "Build Options", value: `${buildOptions.length}` },
                { label: "Capacity", value: `${store.resources.computeCapacity} PFLOPS` },
                { label: "Reserve", value: `${reservedCommercialCompute} PFLOPS` },
              ]
            : store.panel === "settings"
              ? [
                  { label: "AI", value: store.aiSettings.enabled ? "On" : "Off" },
                  { label: "Voice", value: store.openAISettings.enabled ? "On" : "Off" },
                  { label: "Cloud", value: cloudCredentials ? "Connected" : "Offline" },
                  { label: "Sound", value: soundEnabled ? "On" : "Off" },
                ]
              : [
                  { label: "Rank", value: `#${playerRank}` },
                  { label: "Revenue", value: formatCurrency(store.resources.revenue) },
                  { label: "Decisions", value: `${store.decisionLog.length}` },
                  { label: "Rivals", value: `${topRivals.length}` },
                ];
  const commandPriority = (() => {
    if (store.activeDilemma) {
      return {
        label: "Decision required",
        message: "The quarter is paused until you choose a dilemma response.",
        tone: "rose" as const,
      };
    }

    if (store.resources.runwayMonths < 10) {
      return {
        label: "Runway risk",
        message: "Cash survival is now a strategic constraint. Stabilize burn or accept a funding trade.",
        tone: "rose" as const,
      };
    }

    if (quarterlyNet < 0) {
      return {
        label: "Negative net",
        message: "This quarter still burns cash. Decide whether research speed justifies the current ledger.",
        tone: "amber" as const,
      };
    }

    if (store.panel === "track" && selectedForecast.blockedReason) {
      return {
        label: "Research blocked",
        message: selectedForecast.blockedReason,
        tone: "amber" as const,
      };
    }

    if (store.panel === "track" && freeCompute >= 5) {
      return {
        label: "Idle compute",
        message: `${freeCompute} PFLOPS is uncommitted. Put it to work if you want the roadmap to move faster.`,
        tone: "sky" as const,
      };
    }

    if (store.panel === "hiring" && matchingCandidateCount > 0) {
      return {
        label: "Talent window",
        message: `${matchingCandidateCount} market candidate${matchingCandidateCount === 1 ? "" : "s"} can support ${getTrackLabel(store.selectedTrack)} if your current roster cannot cover it.`,
        tone: "sky" as const,
      };
    }

    if (fundingOffers.length > 0 && store.resources.runwayMonths < 18) {
      return {
        label: "Funding window",
        message: "The market is open. Decide whether extra buffer is worth the control dilution.",
        tone: "sky" as const,
      };
    }

    return {
      label: "World pressure",
      message: topRivalMove,
      tone: "slate" as const,
    };
  })();
  const runwayPercent = Math.max(5, Math.min(100, (store.resources.runwayMonths / 36) * 100));
  const runwayTone = store.resources.runwayMonths < 10 ? "bad" : store.resources.runwayMonths < 18 ? "neutral" : "good";
  const maxLedgerMagnitude = Math.max(store.resources.revenue, store.resources.burn, Math.abs(quarterlyNet), 1);
  const revenuePercent = Math.max(4, Math.min(100, (store.resources.revenue / maxLedgerMagnitude) * 100));
  const burnPercent = Math.max(4, Math.min(100, (store.resources.burn / maxLedgerMagnitude) * 100));
  const netPercent = Math.max(4, Math.min(100, (Math.abs(quarterlyNet) / maxLedgerMagnitude) * 100));
  const staffCoveragePercent = Math.round((assignedHeadcount / Math.max(store.employees.length, 1)) * 100);
  const researchCapacityPercent = Math.max(
    5,
    Math.min(100, (researchCapacity / Math.max(store.resources.computeCapacity, 1)) * 100),
  );
  const reservedComputePercent = Math.max(
    reservedCommercialCompute > 0 ? 5 : 0,
    Math.min(100, (reservedCommercialCompute / Math.max(store.resources.computeCapacity, 1)) * 100),
  );
  const nextProjectDue = store.projects.reduce<(typeof store.projects)[number] | null>(
    (soonest, project) => (!soonest || project.turnsRemaining < soonest.turnsRemaining ? project : soonest),
    null,
  );
  const missionActionCards = [
    {
      label: "What Changed",
      value: store.activeDilemma
        ? store.activeDilemma.title
        : store.resolution?.headline ?? `${store.year} Q${store.quarterIndex + 1} command state`,
      body:
        store.resolution?.breakthroughs[0] ??
        store.resolution?.worldEvents[0] ??
        "The lab is waiting on your next allocation decision.",
    },
    {
      label: "Why It Matters",
      value:
        store.resources.runwayMonths < 10
          ? "Runway is fragile"
          : quarterlyNet < 0
            ? "Speed is spending trust and cash"
            : `Rank #${playerRank} in the race board`,
      body:
        store.resources.runwayMonths < 10
          ? "Cash pressure can turn a good research quarter into a board crisis."
          : quarterlyNet < 0
            ? "The current burn rate is acceptable only if the roadmap is moving fast enough."
            : "You have room to shape the next quarter instead of merely reacting.",
    },
    {
      label: "Next Move",
      value: commandPriority.label,
      body: commandPriority.message,
    },
  ];
  const priorityObjectives = [
    store.activeDilemma
      ? {
          label: "Resolve the active dilemma",
          detail: "The simulation clock is paused until this crisis has a recorded answer.",
          panel: "dilemmas" as PanelId,
          tone: "bad" as const,
        }
      : null,
    selectedForecast.blockedReason
      ? {
          label: `Unblock ${getTrackLabel(store.selectedTrack)}`,
          detail: selectedForecast.blockedReason,
          panel: "track" as PanelId,
          tone: "bad" as const,
        }
      : null,
    freeCompute >= 5
      ? {
          label: "Put idle compute to work",
          detail: `${freeCompute} PFLOPS can still accelerate an active research lane.`,
          panel: "track" as PanelId,
          tone: "focus" as const,
        }
      : null,
    assignedHeadcount < store.employees.length
      ? {
          label: "Assign idle staff",
          detail: `${store.employees.length - assignedHeadcount} employee${store.employees.length - assignedHeadcount === 1 ? "" : "s"} can still contribute before ending the turn.`,
          panel: "track" as PanelId,
          tone: "focus" as const,
        }
      : null,
    store.resources.runwayMonths < 12
      ? {
          label: "Protect runway",
          detail: "Review burn, payroll, funding, and commercialization before the board loses patience.",
          panel: "finance" as PanelId,
          tone: "bad" as const,
        }
      : null,
    fundingOffers.length > 0 && store.resources.runwayMonths < 18
      ? {
          label: "Review live funding",
          detail: `${fundingOffers.length} capital window${fundingOffers.length === 1 ? " is" : "s are"} open, with control tradeoffs.`,
          panel: "finance" as PanelId,
          tone: "neutral" as const,
        }
      : null,
    selectedCommercializationOption?.available &&
    !selectedCommercializationOption.isLive &&
    !selectedCommercializationOption.isLaunching
      ? {
          label: "Consider a revenue program",
          detail: `${selectedCommercializationOption.name} can convert research progress into recurring cash.`,
          panel: "track" as PanelId,
          tone: "good" as const,
        }
      : null,
    matchingCandidateCount > 0
      ? {
          label: "Review Talent market",
          detail: `${matchingCandidateCount} candidate${matchingCandidateCount === 1 ? "" : "s"} fit the selected research lane.`,
          panel: "hiring" as PanelId,
          tone: "neutral" as const,
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as Array<{
    label: string;
    detail: string;
    panel: PanelId;
    tone: "bad" | "focus" | "good" | "neutral";
  }>;
  const oneMoreTurnReady = !store.activeDilemma && priorityObjectives.every((objective) => objective.tone !== "bad");
  const sceneArtModeSummary = serverSceneArtReady
    ? "Auto scenes use the fast image lane first; manual premium generation uses GPT Image 2 when available."
    : "Connect production AI to unlock automatic briefing and crisis art.";
  const latestFacilityBeat = store.resolution?.worldEvents.find((event) => event.includes("comes online"));
  const latestConvergenceBeat = store.resolution?.breakthroughs.find((breakthrough) =>
    store.convergences.some((convergence) => breakthrough.startsWith(convergence.name)),
  );
  const latestBreakthroughBeat = store.resolution?.breakthroughs[0];
  const sceneBeat = store.activeDilemma
    ? {
        label: "Active Dilemma",
        detail: store.activeDilemma.title,
        key: `dilemma:${store.activeDilemma.id}`,
        tone: "bad" as const,
      }
    : store.ending
      ? {
          label: "Ending",
          detail: store.ending.title,
          key: `ending:${store.ending.id}`,
          tone: "focus" as const,
        }
      : latestConvergenceBeat
        ? {
            label: "Major Convergence",
            detail: latestConvergenceBeat,
            key: `convergence:${store.resolution?.turn}:${latestConvergenceBeat}`,
            tone: "focus" as const,
          }
        : latestFacilityBeat
          ? {
              label: "Facility Online",
              detail: latestFacilityBeat,
              key: `facility:${store.resolution?.turn}:${latestFacilityBeat}`,
              tone: "good" as const,
            }
          : latestBreakthroughBeat
            ? {
                label: "Breakthrough",
                detail: latestBreakthroughBeat,
                key: `breakthrough:${store.resolution?.turn}:${latestBreakthroughBeat}`,
                tone: "good" as const,
              }
            : {
                label: "Quarter Briefing",
                detail: store.resolution?.headline ?? "The command room is waiting for the next quarter.",
                key: `briefing:${store.resolution?.turn ?? store.turn}`,
                tone: "neutral" as const,
              };
  const isSectionOpen = (sectionId: string) => sectionOpen[sectionId] ?? true;
  const toggleSection = (sectionId: string) =>
    setSectionOpen((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? true),
    }));
  const collapseDetailSections = () =>
    setSectionOpen((current) =>
      Object.fromEntries(
        Object.keys({ ...DEFAULT_SECTION_OPEN, ...current }).map((sectionId) => [sectionId, false]),
      ) as Record<string, boolean>,
    );
  const restoreDefaultLayout = () => {
    const defaults = defaultLayoutPreferences();
    setIntelCollapsed(defaults.intelCollapsed);
    setDetailCollapsed(defaults.detailCollapsed);
    setSectionOpen(defaults.sections);
    setWorldStateOpen(true);
    setGovernmentsOpen(true);
    setRivalsOpen(true);
  };
  const layoutClass = intelCollapsed
    ? "grid flex-1 gap-4 xl:grid-cols-[88px_minmax(0,1fr)]"
    : "grid flex-1 gap-4 xl:grid-cols-[minmax(250px,280px)_minmax(0,1fr)]";
  const detailRailInMainFlow = store.panel === "track" || store.panel === "finance" || store.panel === "facilities";
  const workspaceClass = detailCollapsed || detailRailInMainFlow
    ? "grid min-w-0 gap-4"
    : "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.92fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.88fr)]";
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

  useEffect(() => {
    if (!firstCommercializationOptionId) {
      setSelectedCommercializationId(null);
      return;
    }

    const optionIdSet = new Set(
      commercializationOptionSignature
        .split("|")
        .filter(Boolean)
        .map((entry) => entry.split(":")[0]),
    );
    setSelectedCommercializationId((current) =>
      current && optionIdSet.has(current)
        ? current
        : firstCommercializationOptionId,
    );
  }, [store.selectedTrack, commercializationOptionSignature, firstCommercializationOptionId]);

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
    setIsNarrationLoading(false);
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
    setIsNarrationLoading(false);
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

  const sceneArtToDataUri = async () => {
    if (!sceneArtUrl) {
      return null;
    }

    try {
      const response = await fetch(sceneArtUrl);
      const blob = await response.blob();

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read scene art image."));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const buildCinematicPrompt = (scope: "briefing" | "dilemma") => {
    const sharedDirection = [
      "Create a short cinematic video for the strategy game Convergence.",
      "Style: premium near-future AI lab mission-control drama, grounded, no visible text, no logos, no subtitles.",
      "Camera: slow dolly, subtle parallax, restrained cinematic lighting, realistic human motion, high-stakes but not melodramatic.",
    ];

    if (scope === "dilemma") {
      return [
        ...sharedDirection,
        `Scene beat: ${sceneBeat.label}. ${sceneBeat.detail}`,
        `Crisis: ${store.activeDilemma?.title ?? "Executive AI crisis"}.`,
        store.activeDilemma?.brief ?? "",
        dilemmaFlavor ? `Advisor context: ${dilemmaFlavor}` : "",
        "Show tense executives and researchers reacting to the decision pressure. If audio is enabled, use calm mission-control narration, not direct celebrity voices.",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return [
      ...sharedDirection,
      `Scene beat: ${sceneBeat.label}. ${sceneBeat.detail}`,
      `Quarter headline: ${store.resolution?.headline ?? "Quarterly command briefing"}.`,
      chiefMemo ?? store.resolution?.briefing ?? "",
      worldLead ?? "",
      "Show the command room, data wall, lab staff, and the strategic pressure of the quarter. If audio is enabled, use calm briefing narration.",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const generateCinematic = async (scope: "briefing" | "dilemma") => {
    if (!serverCinematicReady) {
      setCinematicStatus({
        tone: "error",
        message: "Cinematic Mode needs FAL_KEY configured in this Cloudflare environment.",
      });
      return;
    }

    setCinematicStatus({
      tone: "checking",
      message: sceneArtUrl
        ? "Submitting image-to-video cinematic render to fal.ai..."
        : "Submitting text-to-video cinematic render to fal.ai...",
    });
    setCinematicVideoUrl(null);

    const imageDataUri = await sceneArtToDataUri();
    const result = await submitCinematicVideo({
      prompt: buildCinematicPrompt(scope),
      imageDataUri,
      duration: "5",
      resolution: "720p",
      aspectRatio: "16:9",
      generateAudio: cinematicGenerateAudio,
    });

    if (!result.ok || !result.requestId || !result.model) {
      setCinematicStatus({
        tone: "error",
        message: result.message,
      });
      return;
    }

    setCinematicJob({
      requestId: result.requestId,
      model: result.model,
      resultUrl: result.resultUrl,
      scope,
    });
    setCinematicStatus({
      tone: "checking",
      message: result.message,
    });
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
        message: "Activate AI voice in Settings first.",
      });
      return;
    }

    setOpenAiStatusOverride({
      tone: "checking",
      message: loadingMessage,
    });
    setIsNarrationLoading(true);

    const result = await synthesizeOpenAITts({
      apiKey: store.openAISettings.apiKey,
      text,
      instructions,
    });

    if (!result.ok || !result.blob) {
      setIsNarrationLoading(false);
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

  const generateSceneArt = async (
    scope: "briefing" | "dilemma",
    mode: "fast" | "premium" = "premium",
  ) => {
    if (!store.aiSettings.enabled || !store.aiSettings.apiKey) {
      setSceneArtStatus({
        tone: "error",
        message: "Activate AI scene art in Settings first.",
      });
      return;
    }

    const prompt =
      scope === "dilemma"
        ? [
            "Create a cinematic strategy-game concept frame for this AI lab crisis.",
            `Scene beat: ${sceneBeat.label}. ${sceneBeat.detail}`,
            store.activeDilemma?.title ?? "AI crisis",
            store.activeDilemma?.brief ?? "",
            dilemmaFlavor ?? "",
            "Visual style: grounded near-future executive war room, dark navy palette, no text, no logos, widescreen 16:9.",
          ]
            .filter(Boolean)
            .join(" ")
        : [
            "Create a cinematic strategy-game concept frame for this AI lab quarterly briefing.",
            `Scene beat: ${sceneBeat.label}. ${sceneBeat.detail}`,
            store.resolution?.headline ?? "Quarterly briefing",
            chiefMemo ?? store.resolution?.briefing ?? "",
            worldLead ?? "",
            "Visual style: near-future research command center, dark navy palette, subtle data-light atmosphere, no text, no logos, widescreen 16:9.",
          ]
            .filter(Boolean)
            .join(" ");

    setSceneArtStatus({
      tone: "checking",
      message:
        scope === "dilemma"
          ? mode === "fast"
            ? "Generating fast crisis scene art..."
            : "Generating premium crisis scene art..."
          : mode === "fast"
            ? "Generating fast briefing scene art..."
            : "Generating premium briefing scene art...",
    });

    const result = await generateGeminiSceneImage({
      apiKey: store.aiSettings.apiKey,
      prompt,
      mode,
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

  const autoGenerateSceneArt = useEffectEvent(async () => {
    if (!store.aiSettings.enabled || !store.aiSettings.apiKey || store.mode === "menu") {
      return;
    }

    const scope = store.activeDilemma ? "dilemma" : store.resolution ? "briefing" : null;
    if (!scope || sceneArtStatus.tone === "checking") {
      return;
    }

    const waitingForNarrative =
      scope === "dilemma" ? Boolean(store.activeDilemma && !dilemmaFlavor) : Boolean(store.resolution && !chiefMemo && !worldLead);

    if (waitingForNarrative) {
      return;
    }

    const key =
      scope === "dilemma"
        ? `dilemma:${store.activeDilemma?.id}:${dilemmaFlavor ?? "base"}`
        : `briefing:${sceneBeat.key}:${chiefMemo ?? worldLead ?? "base"}`;

    if (autoSceneArtKeyRef.current === key) {
      return;
    }

    autoSceneArtKeyRef.current = key;
    await generateSceneArt(scope, "fast");
  });

  const connectProductionAI = useEffectEvent(async () => {
    const status = await fetchAIStatus();
    setServerAIStatus(status);

    if (!status?.ok) {
      if (store.aiSettings.apiKey === SERVER_AI_KEY) {
        store.updateAIConfig(false, "");
      }
      if (store.openAISettings.apiKey === SERVER_AI_KEY) {
        store.updateOpenAIConfig(false, "", store.openAISettings.autoPlay);
      }
      return;
    }

    if (status.narrative.available || status.sceneArt.available) {
      store.updateAIConfig(true, SERVER_AI_KEY);
      setGeminiStatusOverride({
        tone: "success",
        message: `Production AI is connected${status.narrative.model ? ` (${status.narrative.model})` : ""}.`,
      });
    } else if (store.aiSettings.apiKey === SERVER_AI_KEY) {
      store.updateAIConfig(false, "");
      setGeminiStatusOverride({
        tone: "idle",
        message: "Production AI secrets are not configured yet.",
      });
    }

    if (status.voice.available) {
      store.updateOpenAIConfig(true, SERVER_AI_KEY, store.openAISettings.autoPlay);
      setOpenAiStatusOverride({
        tone: "success",
        message: `Production OpenAI voice is connected${status.voice.model ? ` (${status.voice.model})` : ""}.`,
      });
    } else if (store.openAISettings.apiKey === SERVER_AI_KEY) {
      store.updateOpenAIConfig(false, "", store.openAISettings.autoPlay);
      setOpenAiStatusOverride({
        tone: "idle",
        message: "Production OpenAI voice is not configured yet.",
      });
    }

    setCinematicStatus({
      tone: status.cinematic?.available ? "success" : "idle",
      message: status.cinematic?.available
        ? `Cinematic Mode is connected through fal.ai${status.cinematic.model ? ` (${status.cinematic.model})` : ""}.`
        : "Cinematic Mode is optional and needs FAL_KEY in Cloudflare secrets.",
    });
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const defaults = defaultLayoutPreferences();
    const raw = window.localStorage.getItem(LAYOUT_PREFS_KEY);

    if (!raw) {
      setLayoutPrefsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<LayoutPreferences>;
      setIntelCollapsed(Boolean(parsed.intelCollapsed));
      setDetailCollapsed(Boolean(parsed.detailCollapsed));
      setSectionOpen({
        ...defaults.sections,
        ...(parsed.sections ?? {}),
      });
    } catch {
      setSectionOpen(defaults.sections);
    }

    setLayoutPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!layoutPrefsLoaded || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      LAYOUT_PREFS_KEY,
      JSON.stringify({
        intelCollapsed,
        detailCollapsed,
        sections: sectionOpen,
      } satisfies LayoutPreferences),
    );
  }, [detailCollapsed, intelCollapsed, layoutPrefsLoaded, sectionOpen]);

  useEffect(() => {
    void connectProductionAI();
  }, []);

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
    setCinematicJob(null);
    setCinematicVideoUrl(null);
    setSceneArtStatus({
      tone: "idle",
      message: "Scene art will auto-generate for this moment if AI scene art is active.",
    });
    setCinematicStatus({
      tone: "idle",
      message: "Cinematic Mode is optional. Generate video only for story moments you want to preserve.",
    });
  }, [store.resolution?.turn, store.activeDilemma?.id]);

  useEffect(() => {
    void autoGenerateSceneArt();
  }, [
    store.aiSettings.enabled,
    store.aiSettings.apiKey,
    store.mode,
    store.resolution?.turn,
    store.activeDilemma?.id,
    chiefMemo,
    worldLead,
    dilemmaFlavor,
  ]);

  useEffect(() => {
    if (store.resolution?.breakthroughs.length) {
      playSynthTone(soundEnabled, "breakthrough");
    } else if (store.activeDilemma) {
      playSynthTone(soundEnabled, "warning");
    }
  }, [store.activeDilemma, store.resolution, soundEnabled]);

  useEffect(() => {
    if (!cinematicJob || cinematicVideoUrl) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      const status = await fetchCinematicStatus({
        requestId: cinematicJob.requestId,
        model: cinematicJob.model,
      });

      if (cancelled) {
        return;
      }

      if (!status.ok) {
        setCinematicStatus({
          tone: "error",
          message: status.message,
        });
        setCinematicJob(null);
        return;
      }

      if (status.status === "COMPLETED") {
        const result = await fetchCinematicResult({
          requestId: cinematicJob.requestId,
          model: cinematicJob.model,
          resultUrl: status.responseUrl ?? cinematicJob.resultUrl,
        });

        if (cancelled) {
          return;
        }

        if (result.ok && result.videoUrl) {
          setCinematicVideoUrl(result.videoUrl);
          setCinematicStatus({
            tone: "success",
            message: result.message,
          });
        } else {
          setCinematicStatus({
            tone: "error",
            message: result.message,
          });
        }

        setCinematicJob(null);
        return;
      }

      setCinematicStatus({
        tone: "checking",
        message: status.queuePosition
          ? `${status.message} Queue position ${status.queuePosition}.`
          : status.message,
      });
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 7000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cinematicJob, cinematicVideoUrl]);

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

    if (trimmedKey === SERVER_AI_KEY) {
      store.updateAIConfig(true, SERVER_AI_KEY);
      setGeminiStatusOverride({
        tone: "success",
        message: `Production AI is active${productionAIModel ? ` (${productionAIModel})` : ""}.`,
      });
      return;
    }

    if (!trimmedKey && (serverNarrativeReady || serverSceneArtReady)) {
      store.updateAIConfig(true, SERVER_AI_KEY);
      setGeminiStatusOverride({
        tone: "success",
        message: `Production AI is active${productionAIModel ? ` (${productionAIModel})` : ""}.`,
      });
      return;
    }

    setGeminiStatusOverride({
      tone: "checking",
      message: "Checking manual Gemini fallback connection...",
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
    const trimmedKey = (apiKeyDraft ?? store.aiSettings.apiKey).trim();
    store.updateAIConfig(false, trimmedKey === SERVER_AI_KEY ? "" : trimmedKey);
    setGeminiStatusOverride({
      tone: "idle",
      message: "AI narrative and scene art are disabled.",
    });
  };

  const activateOpenAI = async () => {
    const trimmedKey = (openAiKeyDraft ?? store.openAISettings.apiKey).trim();

    if (trimmedKey === SERVER_AI_KEY) {
      store.updateOpenAIConfig(true, SERVER_AI_KEY, store.openAISettings.autoPlay);
      setOpenAiStatusOverride({
        tone: "success",
        message: `Production OpenAI voice is active${productionVoiceModel ? ` (${productionVoiceModel})` : ""}.`,
      });
      return;
    }

    if (!trimmedKey && serverVoiceReady) {
      store.updateOpenAIConfig(true, SERVER_AI_KEY, store.openAISettings.autoPlay);
      setOpenAiStatusOverride({
        tone: "success",
        message: `Production OpenAI voice is active${productionVoiceModel ? ` (${productionVoiceModel})` : ""}.`,
      });
      return;
    }

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
    const trimmedKey = (openAiKeyDraft ?? store.openAISettings.apiKey).trim();
    store.updateOpenAIConfig(false, trimmedKey === SERVER_AI_KEY ? "" : trimmedKey, false);
    setOpenAiStatusOverride({
      tone: "idle",
      message: "OpenAI voice is disabled.",
    });
  };

  const renderCinematicControls = (scope: "briefing" | "dilemma") => (
    <div className="mt-4 rounded-[24px] border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_35%),rgba(251,191,36,0.06)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-100">Cinematic Mode</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Optional fal.ai Seedance render</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Uses image-to-video when scene art is visible, otherwise text-to-video. It renders in the background and never blocks the turn.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SignalChip label={serverCinematicReady ? "fal.ai ready" : "FAL standby"} tone={serverCinematicReady ? "good" : "neutral"} />
          <SignalChip label={sceneArtUrl ? "image-to-video" : "text-to-video"} tone={sceneArtUrl ? "focus" : "neutral"} />
        </div>
      </div>

      {cinematicVideoUrl ? (
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/70">
          <video src={cinematicVideoUrl} controls playsInline className="aspect-video w-full bg-black object-cover" />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generateCinematic(scope)}
          disabled={!serverCinematicReady || cinematicStatus.tone === "checking"}
          className="rounded-2xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cinematicStatus.tone === "checking" ? "Rendering..." : "Generate Cinematic"}
        </button>
        <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={cinematicGenerateAudio}
            onChange={(event) => setCinematicGenerateAudio(event.target.checked)}
            className="h-4 w-4 rounded border-white/15 bg-slate-900"
          />
          Include Seedance audio/dialogue
        </label>
      </div>
      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(cinematicStatus.tone)}`}>
        {cinematicStatus.message}
      </div>
    </div>
  );

  const trackTalentAssignmentPanel = (
    <div className="rounded-[28px] border border-sky-400/18 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,rgba(9,16,32,0.9),rgba(6,12,25,0.72))] p-5 shadow-[0_24px_80px_rgba(8,20,40,0.26)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-sky-200">Assign Talent To This Research</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{trackDefinition.name}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Assigning staff is immediate. Green cards are free, amber cards are already working somewhere else and will move if clicked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SignalChip label={`${assignedResearchers.length} assigned`} tone={assignedResearchers.length ? "good" : "bad"} />
          <SignalChip label={`${availableResearchers.length} free`} tone={availableResearchers.length ? "good" : "neutral"} />
          <SignalChip label={`${committedResearchers.length} assigned elsewhere`} tone={committedResearchers.length ? "warn" : "neutral"} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[24px] border border-white/8 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Currently Assigned</p>
            <span className="text-xs text-slate-400">Click to unassign</span>
          </div>
          <div className="mt-3 space-y-2">
            {assignedResearchers.length ? (
              selectedForecast.contributors.map((contributor) => {
                const employee = assignedResearchers.find((entry) => entry.id === contributor.id)!;
                const status = getTalentAssignmentStatus(employee, store.selectedTrack);

                return (
                  <button
                    key={`quick-assigned-${employee.id}`}
                    type="button"
                    onClick={() => store.assignPerson(employee.id, null)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-left transition hover:border-rose-400/25 hover:bg-rose-500/8"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <StaffAvatar researcher={employee} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{employee.name}</span>
                        <span className="block truncate text-xs text-slate-400">{contributor.focus} · +{contributor.contribution} / quarter</span>
                        <span className="mt-1 block truncate text-[11px] text-sky-200">{status.detail}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <SignalChip label={status.label} tone={status.tone} />
                      <span className="text-xs uppercase tracking-[0.18em] text-rose-200">Remove</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-100">
                No scientist is assigned here yet. Choose a free match or reassign someone from another lane.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Available To Add</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Start with free talent. Reassigning amber talent is allowed, but it will slow the lane they leave behind.
              </p>
            </div>
            <button
              type="button"
              onClick={() => store.openPanel("hiring")}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300"
            >
              Need More Talent?
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[...availableResearchers, ...committedResearchers].slice(0, 8).map((employee) => {
              const status = getTalentAssignmentStatus(employee, store.selectedTrack);

              return (
                <button
                  key={`quick-available-${employee.id}`}
                  type="button"
                  onClick={() => store.assignPerson(employee.id, store.selectedTrack)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    employee.assignedTrack
                      ? "border-amber-400/18 bg-amber-500/8 hover:border-amber-300/30 hover:bg-amber-500/12"
                      : "border-emerald-400/18 bg-emerald-500/8 hover:border-emerald-300/30 hover:bg-emerald-500/12"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <StaffAvatar researcher={employee} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{employee.name}</span>
                        <span className="block truncate text-xs text-slate-400">{describeAssignmentScope(employee)}</span>
                      </span>
                    </span>
                    <SignalChip label={status.label} tone={status.tone} />
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs leading-5 text-slate-300">{status.detail}</span>
                    <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-sky-300">
                      {employee.assignedTrack ? "Reassign" : "Assign"}
                    </span>
                  </span>
                </button>
              );
            })}
            {availableResearchers.length + committedResearchers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-3 py-3 text-sm leading-6 text-slate-500 md:col-span-2">
                No eligible staff can move here right now. Open Talent to hire someone who covers {trackDefinition.shortName}.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (!store.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050916] text-slate-200">
        Booting simulation stack...
      </div>
    );
  }

  if (store.mode === "menu") {
    return (
      <main className="mission-shell mission-v4 relative min-h-screen overflow-x-clip text-white">
        <PixiBackground />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.16),transparent_28%),linear-gradient(180deg,rgba(4,10,22,0.78),rgba(4,8,20,0.96))]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="mission-eyebrow">Convergence Mission Control</p>
                <SignalChip label="Production command room" tone="good" />
              </div>
              <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-tight text-white lg:text-6xl">
                Run the AI lab that decides what the century becomes.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Turn-based strategy across 120 quarters of hiring, compute allocation, geopolitics,
                and moral tradeoffs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <SignalChip label="120 quarter campaign" tone="focus" />
                <SignalChip label="Deterministic simulation" tone="neutral" />
                <SignalChip label={serverSceneArtReady ? "Production AI online" : "AI optional"} tone={serverSceneArtReady ? "good" : "neutral"} />
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="mission-card rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Opening Read</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">You are not just racing. You are deciding which compromises become normal.</p>
                </div>
                <div className="mission-card rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Core Loop</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Assign people, allocate compute, manage burn, then survive the next quarter.</p>
                </div>
                <div className="mission-card rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">AI Layer</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{sceneArtModeSummary}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-50"
              >
                <BookOpen className="h-4 w-4" />
                How It Works
              </button>
            </div>
            <div className="mission-panel w-full max-w-sm rounded-[28px] p-5 xl:block">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session Controls</p>
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(geminiStatus.tone)}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>Production AI</span>
                  <span className="text-[11px] uppercase tracking-[0.18em]">
                    {serverAIStatus?.providers.openai || serverAIStatus?.providers.gemini ? "connected" : "standby"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5">{geminiStatus.message}</p>
              </div>
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
    <main className="mission-shell mission-v4 relative min-h-screen overflow-x-clip text-white">
      <PixiBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(83,166,255,0.12),transparent_34%),linear-gradient(180deg,rgba(5,10,22,0.85),rgba(4,8,20,0.96))]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1880px] flex-col px-4 py-4 pb-24 lg:px-6 lg:pb-6">
        <header className="mission-panel-strong mb-4 rounded-[32px] p-5 lg:p-6">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            <div className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="rounded-[24px] border border-sky-400/20 bg-sky-500/10 p-3 text-sky-200">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Convergence</p>
                      <SignalChip label="Mission Control" tone="focus" />
                    </div>
                    <h1 className="mt-1 text-2xl font-semibold text-white lg:text-3xl">
                      {store.year} Q{store.quarterIndex + 1} Turn {store.turn}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {store.ceo.title} {store.ceo.name}
                      {store.ceo.fired
                        ? " - Interim era"
                        : ` - Founder control ${Math.round(store.flags.founderControl)}%`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PanelButton active={store.panel === "briefing"} icon={Globe2} label="Briefing" onClick={() => store.openPanel("briefing")} />
                  <PanelButton active={store.panel === "finance"} icon={BarChart3} label="Finance" onClick={() => store.openPanel("finance")} />
                  <PanelButton active={store.panel === "track"} icon={BrainCircuit} label="Research" onClick={() => store.openPanel("track")} />
                  <PanelButton active={store.panel === "hiring"} icon={Users} label="Talent" onClick={() => store.openPanel("hiring")} />
                  <PanelButton active={store.panel === "facilities"} icon={Building2} label="Facilities" onClick={() => store.openPanel("facilities")} />
                  <PanelButton active={store.panel === "settings"} icon={Handshake} label="Settings" onClick={() => store.openPanel("settings")} />
                </div>
              </div>

              <div className="mission-panel rounded-[30px] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-200">{activePanelMeta.eyebrow}</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white">{activePanelMeta.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{activePanelMeta.description}</p>
                <div
                  className={`mt-5 rounded-[24px] border px-4 py-4 ${
                    commandPriority.tone === "rose"
                      ? "border-rose-400/20 bg-rose-500/10"
                      : commandPriority.tone === "amber"
                        ? "border-amber-400/20 bg-amber-500/10"
                        : commandPriority.tone === "sky"
                          ? "border-sky-400/20 bg-sky-500/10"
                          : "border-white/8 bg-white/4"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{commandPriority.label}</p>
                      <p className="mt-2 text-sm leading-6 text-white">{commandPriority.message}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SignalChip label={store.activeDilemma ? "Turn paused" : "Simulation live"} tone={store.activeDilemma ? "bad" : "good"} />
                      <SignalChip label={`${staffCoveragePercent}% staff assigned`} tone="neutral" />
                      <SignalChip label={`${liveProgramsCount} live programs`} tone="focus" />
                    </div>
                  </div>
                </div>
                <div className="mission-action-grid mt-5 grid gap-3 rounded-[26px] border border-white/8 p-3 md:grid-cols-3">
                  {missionActionCards.map((card) => (
                    <div key={card.label} className="rounded-[22px] border border-white/8 bg-slate-950/56 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{card.value}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{card.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <CommandMetric
                    label="Capital"
                    value={formatCurrency(store.resources.capital)}
                    helper="Cash on hand after current commitments."
                    icon={BarChart3}
                    tone="slate"
                  />
                  <CommandMetric
                    label="Quarterly Net"
                    value={`${quarterlyNet >= 0 ? "+" : ""}${formatCurrency(quarterlyNet)}`}
                    helper="Revenue minus burn for the current quarter."
                    icon={quarterlyNet >= 0 ? TrendingUp : TrendingDown}
                    tone={quarterlyNet >= 0 ? "emerald" : "rose"}
                  />
                  <CommandMetric
                    label="Runway"
                    value={`${store.resources.runwayMonths} months`}
                    helper="If the ledger holds, this is how long the lab survives."
                    icon={Globe2}
                    tone={store.resources.runwayMonths < 10 ? "rose" : "amber"}
                  />
                  <CommandMetric
                    label="Research Capacity"
                    value={`${researchCapacity} PFLOPS`}
                    helper={`${reservedCommercialCompute} PFLOPS is reserved for live products.`}
                    icon={Cpu}
                    tone="sky"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="mission-card rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Quarter Posture</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Race Leader</p>
                      <p className="mt-2 text-base font-medium text-white">#{playerRank} Convergence</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Trajectory: {labLeaderboard.find((entry) => entry.id === "player")?.trajectory}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Top Rival Move</p>
                    <p className="mt-2 text-sm leading-6 text-white">{topRivalMove}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Trust / Fear</p>
                    <p className="mt-2 text-base font-medium text-white">
                      {Math.round(store.resources.trust)} / {Math.round(store.resources.fear)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Public legitimacy versus backlash.</p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Board / Revenue</p>
                    <p className="mt-2 text-base font-medium text-white">
                      {Math.round(store.resources.boardConfidence)} / {formatCurrency(store.resources.revenue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Control durability and live quarterly inflow.</p>
                  </div>
                </div>
              </div>

              <div className="mission-card rounded-[28px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Command Guidance</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {oneMoreTurnReady
                        ? "No red blockers. You can tune choices or advance the quarter."
                        : "Clear the highest-pressure items before ending the turn."}
                    </p>
                  </div>
                  <SignalChip label={oneMoreTurnReady ? "Ready" : "Check first"} tone={oneMoreTurnReady ? "good" : "focus"} />
                </div>
                <div className="mt-4 space-y-2">
                  {priorityObjectives.length ? (
                    priorityObjectives.map((objective, index) => (
                      <button
                        key={`${objective.label}-${index}`}
                        type="button"
                        onClick={() => store.openPanel(objective.panel)}
                        className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/56 px-3 py-3 text-left transition hover:border-sky-400/25 hover:bg-sky-500/8"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-white">{objective.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-400">{objective.detail}</span>
                        </span>
                        <SignalChip label={`0${index + 1}`} tone={objective.tone} />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-3 text-sm leading-6 text-emerald-100">
                      The board is calm, the lab is staffed, and the clock can move when you are ready.
                    </div>
                  )}
                </div>
              </div>

              <div className="mission-card rounded-[28px] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Run Controls</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTutorialOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/8"
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
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/8"
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
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/8"
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
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/45 bg-sky-500/15 px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    <Play className="h-4 w-4" />
                    End Turn
                  </button>
                </div>
                <div className="mt-4 rounded-[22px] border border-white/8 bg-slate-950/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Layout Controls</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-600">Saved locally</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setIntelCollapsed((value) => !value)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/8"
                    >
                      {intelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                      {intelCollapsed ? "Open Intel" : "Compact Intel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailCollapsed((value) => !value)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/8"
                    >
                      {detailCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                      {detailCollapsed ? "Open Detail" : "Hide Detail"}
                    </button>
                    <button
                      type="button"
                      onClick={collapseDetailSections}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/8"
                    >
                      Collapse Sections
                    </button>
                    <button
                      type="button"
                      onClick={restoreDefaultLayout}
                      className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100 transition hover:bg-sky-500/15"
                    >
                      Restore Layout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className={layoutClass}>
          <aside
            className={`mission-panel min-w-0 rounded-[28px] ${
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

          <div className={workspaceClass}>
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

              {store.panel === "track" ? (
                <div className="space-y-4">
                  <TrackMap state={store} onOpenTrack={store.openTrack} />
                  {trackTalentAssignmentPanel}
                </div>
              ) : null}

              {store.panel === "briefing" ? (
                <div className="space-y-4">
                  <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(83,166,255,0.14),transparent_34%),linear-gradient(180deg,rgba(9,16,32,0.94),rgba(8,13,26,0.84))] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-sky-200">Quarterly Briefing</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">
                          {chiefMemo ? "Chief of Staff memo ready" : store.resolution?.headline ?? "Lab status update"}
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                          {store.resolution?.worldEvents[0] ??
                            "Read the quarter carefully before advancing the simulation clock."}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void narrateTurnSummary()} disabled={isNarrationLoading} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                          <AudioLines className="h-4 w-4" />
                          {isNarrationLoading ? "Generating Voice..." : "Read Summary"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void generateSceneArt("briefing", "premium")}
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

                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(320px,0.98fr)_minmax(0,1.02fr)]">
                      <div className="mission-art-frame min-h-[320px] rounded-[28px]">
                        {sceneArtScope === "briefing" && sceneArtUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sceneArtUrl} alt="AI-generated quarterly briefing scene art" className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/92 to-transparent p-5">
                              <SignalChip label="AI scene feed" tone="good" />
                              <p className="mt-3 text-sm leading-6 text-slate-200">A visual readout of the current briefing generated from the quarter state.</p>
                            </div>
                          </>
                        ) : (
                          <div className="relative z-10 flex h-full min-h-[320px] flex-col justify-between p-5">
                            <div>
                              <SignalChip label={serverSceneArtReady ? "Fast auto art ready" : "Scene art standby"} tone={serverSceneArtReady ? "focus" : "neutral"} />
                              <h3 className="mt-5 text-2xl font-semibold text-white">Command-room visual feed</h3>
                              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                                {sceneArtModeSummary} The frame stays text-free so it feels like a live intelligence wall instead of a poster.
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              <span className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2">World</span>
                              <span className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2">Lab</span>
                              <span className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2">Pressure</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3">
                        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Chief Memo</p>
                          <RichText text={chiefMemo ?? store.resolution?.briefing} className="mt-3" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                          <CommandMetric
                            label="Quarter Delta"
                            value={`${store.resolution?.financeDelta && store.resolution.financeDelta >= 0 ? "+" : ""}${formatCurrency(store.resolution?.financeDelta ?? 0)}`}
                            helper="Net swing recorded when the quarter resolved."
                            icon={store.resolution?.financeDelta && store.resolution.financeDelta >= 0 ? TrendingUp : TrendingDown}
                            tone={store.resolution?.financeDelta && store.resolution.financeDelta >= 0 ? "emerald" : "rose"}
                          />
                          <CommandMetric
                            label="Breakthroughs"
                            value={`${store.resolution?.breakthroughs.length ?? 0}`}
                            helper="Major discoveries or milestones from this quarter."
                            icon={Sparkles}
                            tone="sky"
                          />
                          <CommandMetric
                            label="Revenue Live"
                            value={formatCurrency(store.resources.revenue)}
                            helper="Current live quarterly revenue across all lines."
                            icon={BarChart3}
                            tone="emerald"
                          />
                        </div>
                      </div>
                    </div>

                    {(sceneArtScope === "briefing" || sceneArtStatus.tone !== "idle") ? (
                      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(sceneArtStatus.tone)}`}>
                        {sceneArtStatus.message}
                      </div>
                    ) : null}
                    <div className="mt-4 rounded-[24px] border border-sky-400/18 bg-sky-500/10 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.22em] text-sky-100">Scene Beat</p>
                          <h3 className="mt-2 text-lg font-semibold text-white">{sceneBeat.label}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{sceneBeat.detail}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <SignalChip label={sceneArtScope === "briefing" && sceneArtUrl ? "Visualized" : serverSceneArtReady ? "Auto eligible" : "AI standby"} tone={sceneArtScope === "briefing" && sceneArtUrl ? "good" : sceneBeat.tone} />
                          <button
                            type="button"
                            onClick={() => void generateSceneArt("briefing", "premium")}
                            disabled={sceneArtStatus.tone === "checking"}
                            className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Regenerate Premium
                          </button>
                        </div>
                      </div>
                    </div>
                    {renderCinematicControls("briefing")}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                    <CollapsibleSection
                      title="Event Feed"
                      subtitle="Quarter-by-quarter news, breakthroughs, and scandals."
                      open={isSectionOpen("briefing-feed")}
                      onToggle={() => toggleSection("briefing-feed")}
                      actions={<span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest {deferredFeed.length}</span>}
                      className="bg-slate-950/78"
                    >
                      <div className="grid gap-3">
                        {deferredFeed.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                              <span className={`h-2 w-2 rounded-full ${item.severity === "critical" ? "bg-rose-400" : item.severity === "warning" ? "bg-amber-400" : "bg-sky-400"}`} />
                              {item.kind}
                            </div>
                            <p className="mt-3 text-sm font-medium text-white">{item.title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleSection>

                    <div className="space-y-4">
                      <CollapsibleSection
                        title="World Pulse"
                        subtitle="External pressure and the strongest narrative signal this quarter."
                        open={isSectionOpen("briefing-pulse")}
                        onToggle={() => toggleSection("briefing-pulse")}
                        className="bg-slate-950/78"
                      >
                        <RichText text={worldLead ?? store.resolution?.worldEvents[0] ?? "No major event yet."} className="mt-3" />
                      </CollapsibleSection>
                      <CollapsibleSection
                        title="Decision Memory"
                        subtitle="Permanent calls that can alter future pressure and endings."
                        open={isSectionOpen("briefing-memory")}
                        onToggle={() => toggleSection("briefing-memory")}
                        className="bg-slate-950/78"
                      >
                        <div className="space-y-2">
                          {store.decisionLog.length ? (
                            store.decisionLog.slice(0, 3).map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-white/8 bg-slate-950/65 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-white">{entry.title}</p>
                                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Turn {entry.turn}</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-300">{entry.choice}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">{entry.outcome} · {entry.impact}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No major decisions are logged yet.</p>
                          )}
                        </div>
                      </CollapsibleSection>
                    </div>
                  </div>
                </div>
              ) : null}

              {store.panel === "hiring" ? (
                <div className="space-y-4">
                  <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(83,166,255,0.12),transparent_30%),linear-gradient(180deg,rgba(9,16,32,0.92),rgba(8,13,26,0.82))] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-sky-200">Talent Command</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">Current roster first, recruiting market second</h3>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                          See who is already on the team, where they are assigned, and which research lanes are starved before you spend runway on more people.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SignalChip label={`${assignedTalent.length}/${store.employees.length} assigned`} tone={idleTalent.length ? "focus" : "good"} />
                        <SignalChip label={`${store.pendingHires.length} arriving`} tone={store.pendingHires.length ? "focus" : "neutral"} />
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <CommandMetric
                        label="Assigned Talent"
                        value={`${assignedTalent.length}`}
                        helper="People actively contributing to research lanes."
                        icon={Users}
                        tone="sky"
                      />
                      <CommandMetric
                        label="Idle Talent"
                        value={`${idleTalent.length}`}
                        helper="Available to assign before ending the quarter."
                        icon={BrainCircuit}
                        tone={idleTalent.length ? "amber" : "emerald"}
                      />
                      <CommandMetric
                        label="Signed Queue"
                        value={`${store.pendingHires.length}`}
                        helper="Already committed and arriving next quarter."
                        icon={BookOpen}
                        tone="amber"
                      />
                      <CommandMetric
                        label="Market Fits"
                        value={`${matchingCandidateCount}`}
                        helper={`Candidates who can work on ${getTrackLabel(store.selectedTrack)} if you need coverage.`}
                        icon={TrendingUp}
                        tone="emerald"
                      />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/78 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current Talent Assignments</p>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                          Click a lane to focus it in Research. Click a person&apos;s assign/reassign controls in Research when you want to move them.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => store.openPanel("track")}
                        className="inline-flex items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-100"
                      >
                        Open Research Assignment
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                      {talentAssignmentRows.map(({ track, assigned, forecast, open }) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            store.openTrack(track.id);
                            store.openPanel("track");
                          }}
                          className={`rounded-[22px] border p-4 text-left transition ${
                            store.selectedTrack === track.id
                              ? "border-sky-400/35 bg-sky-500/10"
                              : open
                                ? "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/7"
                                : "border-white/6 bg-slate-950/45 opacity-70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">{track.shortName}</span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                {open ? `${forecast.projectName} · ETA ${formatTurns(forecast.turnsToLevel)}` : TRACK_UNLOCK_NOTES[track.id]}
                              </span>
                            </span>
                            <SignalChip label={open ? `${assigned.length} staff` : "Locked"} tone={open ? (assigned.length ? "good" : "focus") : "bad"} />
                          </div>
                          <div className="mt-3 space-y-2">
                            {assigned.length ? (
                              assigned.slice(0, 3).map((employee) => (
                                <div key={`${track.id}-${employee.id}`} className="flex items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/65 px-2 py-2">
                                  <StaffAvatar researcher={employee} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-medium text-white">{employee.name}</span>
                                    <span className="block truncate text-[11px] text-slate-500">{employee.role}</span>
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-3 py-3 text-xs leading-5 text-slate-500">
                                No one assigned. This lane will struggle unless compute and staffing are corrected.
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Idle Talent</p>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{idleTalent.length} unassigned</span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {idleTalent.length ? (
                          idleTalent.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => {
                                store.openTrack(employee.generalist ? store.selectedTrack : employee.primaryTrack);
                                store.openPanel("track");
                              }}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left transition hover:border-sky-400/25 hover:bg-sky-500/8"
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <StaffAvatar researcher={employee} size="sm" />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-white">{employee.name}</span>
                                  <span className="block truncate text-xs text-slate-400">{describeAssignmentScope(employee)}</span>
                                </span>
                              </span>
                              <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-sky-300">Assign</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Everyone is assigned somewhere right now.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_32%),linear-gradient(180deg,rgba(9,16,32,0.92),rgba(8,13,26,0.82))] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Talent Market</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">Hire more people only when the roster has a gap</h3>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                          Candidates arrive next quarter, change payroll permanently, and only work in lanes they can actually cover.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SignalChip label={`${matchingCandidateCount} can support ${getTrackLabel(store.selectedTrack)}`} tone="focus" />
                        <SignalChip label={`${contestedCandidateCount} contested`} tone={contestedCandidateCount ? "bad" : "neutral"} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/78 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Filter Market</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Narrow candidates by research lane or focus on those rivals are also trying to land.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContestedCandidatesOnly((value) => !value)}
                        className={`inline-flex rounded-full border px-4 py-2 text-sm ${
                          showContestedCandidatesOnly
                            ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
                            : "border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        {showContestedCandidatesOnly ? "Showing Contested Only" : "Show Contested Only"}
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCandidateFocusFilter("all")}
                        className={`rounded-full border px-3 py-2 text-sm ${
                          candidateFocusFilter === "all"
                            ? "border-sky-400/35 bg-sky-500/10 text-white"
                            : "border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        All Lanes
                      </button>
                      {candidateTrackFilters.map((trackId) => (
                        <button
                          key={trackId}
                          type="button"
                          onClick={() => setCandidateFocusFilter(trackId)}
                          className={`rounded-full border px-3 py-2 text-sm ${
                            candidateFocusFilter === trackId
                              ? "border-sky-400/35 bg-sky-500/10 text-white"
                              : "border-white/10 bg-white/5 text-slate-300"
                          }`}
                        >
                          {getTrackLabel(trackId)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredCandidates.length ? (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {filteredCandidates.map((candidate) => {
                        const fitScore = getCandidateFitScore(candidate, candidatePriorityTrack);
                        const fitTone = getCandidateFitTone(fitScore);

                        return (
                        <div key={candidate.id} className="rounded-[28px] border border-white/10 bg-slate-950/78 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <StaffAvatar researcher={candidate} size="lg" />
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                                <p className="mt-1 text-sm text-slate-400">{candidate.role}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{candidate.location}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playSynthTone(soundEnabled, "click");
                                store.hire(candidate.id);
                              }}
                              className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200"
                            >
                              Hire
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <SignalChip label={`${fitScore}% ${getCandidateFitLabel(fitScore)}`} tone={fitTone} />
                            <SignalChip label={getTrackLabel(candidate.primaryTrack)} tone="focus" />
                            {candidate.secondaryTrack ? <SignalChip label={getTrackLabel(candidate.secondaryTrack)} tone="neutral" /> : null}
                            {candidate.generalist ? <SignalChip label="Generalist" tone="good" /> : null}
                            <SignalChip
                              label={candidate.contestedBy ? `Contested by ${store.rivals[candidate.contestedBy].name}` : "Uncontested"}
                              tone={candidate.contestedBy ? "bad" : "neutral"}
                            />
                          </div>

                          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Lane Fit</span>
                              <span className="text-sm font-medium text-white">{getTrackLabel(candidatePriorityTrack)}</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                              <div
                                className={`h-full rounded-full ${
                                  fitTone === "good"
                                    ? "bg-emerald-300"
                                    : fitTone === "focus"
                                      ? "bg-sky-300"
                                      : fitTone === "bad"
                                        ? "bg-rose-300"
                                        : "bg-slate-300"
                                }`}
                                style={{ width: `${fitScore}%` }}
                              />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              Fit weighs eligible lanes, research strength, execution, ethics, leadership, and rival contest pressure.
                            </p>
                          </div>

                          <p className="mt-4 text-sm italic leading-6 text-slate-300">&ldquo;{candidate.ask}&rdquo;</p>
                          <p className="mt-3 text-sm leading-6 text-slate-400">{candidate.bio}</p>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Research</p>
                              <p className="mt-2 text-sm font-medium text-white">{candidate.research}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Execution</p>
                              <p className="mt-2 text-sm font-medium text-white">{candidate.execution}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Leadership</p>
                              <p className="mt-2 text-sm font-medium text-white">{candidate.leadership}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ethics</p>
                              <p className="mt-2 text-sm font-medium text-white">{candidate.ethics}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {candidate.traits.slice(0, 4).map((trait) => (
                              <span key={`${candidate.id}-${trait}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                {trait}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 p-4">
                            <div className="grid gap-2 text-sm text-slate-300">
                              <div className="flex items-center justify-between gap-3">
                                <span>Close Cost Today</span>
                                <span className="font-medium text-white">{formatCurrency(candidate.signingBonus + candidate.salary / 4)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Quarterly Payroll Next Turn</span>
                                <span className="font-medium text-white">{formatCurrency(candidate.salary / 4)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Location</span>
                                <span className="text-slate-400">{candidate.location}</span>
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-500">{describeAssignmentScope(candidate)}</p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/65 px-4 py-8 text-center text-sm text-slate-500">
                      No candidates match the current filter. Try widening the lane selection or turning off the contested-only view.
                    </div>
                  )}
                </div>
              ) : null}

              {store.panel !== "track" && store.panel !== "briefing" && store.panel !== "hiring" ? (
                <div className="rounded-[28px] border border-white/10 bg-slate-950/78 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operations Snapshot</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {store.panel === "finance"
                          ? "Capital markets and operating load"
                          : store.panel === "facilities"
                            ? "Compute posture and infrastructure load"
                            : "Narrative and systems controls"}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        {store.panel === "finance"
                          ? "Use this view to judge whether runway should go into research, commercialization, or a fresh raise."
                          : store.panel === "facilities"
                            ? "Suppliers, energy, and build projects set the ceiling for what the lab can support."
                            : "AI flavor systems stay optional. The deterministic simulation underneath keeps running either way."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SignalChip label={`Founder control ${Math.round(store.flags.founderControl)}%`} tone="focus" />
                      <SignalChip label={`${reservedCommercialCompute} PFLOPS reserved`} tone="neutral" />
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <CommandMetric
                      label="Founder Control"
                      value={`${Math.round(store.flags.founderControl)}%`}
                      helper="Lower control makes board pressure land faster."
                      icon={Handshake}
                      tone="slate"
                    />
                    <CommandMetric
                      label="Reserved Compute"
                      value={`${reservedCommercialCompute} PFLOPS`}
                      helper="Compute already spoken for by live products."
                      icon={Cpu}
                      tone="sky"
                    />
                    <CommandMetric
                      label="Funding Offers"
                      value={`${fundingOffers.length}`}
                      helper="Current live capital windows."
                      icon={BarChart3}
                      tone="amber"
                    />
                    <CommandMetric
                      label="Live Programs"
                      value={`${liveProgramsCount}`}
                      helper="Programs already contributing or reserving capacity."
                      icon={Sparkles}
                      tone="emerald"
                    />
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live Programs</p>
                      <div className="mt-3 space-y-2">
                        {store.commercializationPrograms.length ? (
                          store.commercializationPrograms.slice(0, 4).map((program) => (
                            <div key={program.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                              <p className="text-sm font-medium text-white">{program.name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {program.status === "live" ? "Live" : `Launching · ${program.turnsRemaining}Q`}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No commercialization lines are active yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Funding Window</p>
                      <div className="mt-3 space-y-2">
                        {fundingOffers.length ? (
                          fundingOffers.slice(0, 2).map((offer) => (
                            <div key={offer.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                              <p className="text-sm font-medium text-white">{offer.name}</p>
                              <p className="mt-1 text-xs text-slate-400">{offer.summary}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No fresh funding window right now.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest Feed</p>
                      <div className="mt-3 space-y-2">
                        {deferredFeed.slice(0, 3).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                            <p className="text-sm font-medium text-white">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{item.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {!detailCollapsed ? (
            <aside className={`mission-panel min-w-0 self-start space-y-4 rounded-[28px] p-5 ${detailRailInMainFlow ? "" : "xl:sticky xl:top-4"}`}>
              <div className="rounded-[26px] border border-white/8 bg-white/4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{activePanelMeta.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {store.panel === "track" ? trackDefinition.name : activePanelMeta.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{activePanelMeta.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {store.panel === "track" ? (
                      <SignalChip
                        label={selectedTrack.unlocked ? `${selectedForecast.projectName} / L${selectedTrack.level}` : "Locked track"}
                        tone={selectedTrack.unlocked ? "focus" : "bad"}
                      />
                    ) : (
                      <SignalChip label={commandPriority.label} tone={commandPriority.tone === "rose" ? "bad" : commandPriority.tone === "sky" ? "focus" : "neutral"} />
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {asideQuickStats.map((stat) => (
                    <div key={`${store.panel}-${stat.label}`} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                      <p className="mt-2 text-sm font-medium text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
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
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Passive baseline</span><span className="text-emerald-200">{trackRevenueStream ? formatCurrency(trackRevenueStream.amount) : "None yet"}</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-300"><span>Live commercial revenue</span><span className="text-emerald-200">{trackCommercialRevenueStreams.length ? formatCurrency(trackCommercialRevenueStreams.reduce((sum, stream) => sum + stream.amount, 0)) : "$0"}</span></div>
                    {selectedTrack.level < trackDefinition.levels.length ? (
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                        <span>Next passive lift</span>
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
                    <div className="mt-4 rounded-[20px] border border-white/8 bg-slate-950/55 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Research Posture</p>
                        <span className="text-xs text-slate-400">{selectedPosture.label}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {postureOptions.map((posture) => (
                          <button
                            key={posture.id}
                            type="button"
                            disabled={!selectedTrack.unlocked}
                            onClick={() => store.setTrackPosture(store.selectedTrack, posture.id)}
                            className={`rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              selectedPosture.id === posture.id
                                ? "border-sky-400/40 bg-sky-500/12 text-white"
                                : "border-white/8 bg-white/4 text-slate-300 hover:border-white/16 hover:bg-white/8"
                            }`}
                          >
                            <span className="block text-sm font-medium">{posture.label}</span>
                            <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                              {posture.progressMultiplier === 1
                                ? "Normal tempo"
                                : `${posture.progressMultiplier > 1 ? "+" : ""}${Math.round((posture.progressMultiplier - 1) * 100)}% speed`}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {selectedPosture.summary} Expense modifier x{selectedPosture.expenseMultiplier.toFixed(2)}.
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Research Capacity</p>
                        <p className="mt-2 text-sm font-medium text-white">{researchCapacity} PFLOPS</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Commercial Reserve</p>
                        <p className="mt-2 text-sm font-medium text-white">{reservedCommercialCompute} PFLOPS</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Supplier choice and energy policy modify how efficiently this compute turns into progress. Live products can also reserve compute, so revenue programs and frontier research now compete for the same cluster time.
                    </p>
                  </div>
                </div>

                <CollapsibleSection
                  title="Bottleneck Scan"
                  subtitle="Shows why this track is moving, stalling, or getting politically expensive."
                  open={isSectionOpen("research-bottlenecks")}
                  onToggle={() => toggleSection("research-bottlenecks")}
                  actions={<SignalChip label={`${researchBottlenecks.length} signals`} tone="focus" />}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {researchBottlenecks.map((bottleneck) => (
                      <div key={bottleneck.label} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{bottleneck.label}</p>
                          <SignalChip label={bottleneck.tone === "bad" ? "Risk" : bottleneck.tone === "good" ? "Stable" : "Watch"} tone={bottleneck.tone} />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{bottleneck.detail}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Research Economics</p>
                      <p className="mt-1 text-sm text-slate-500">
                        This is the recurring cost of keeping this program active before you even decide how to monetize it.
                      </p>
                    </div>
                    <span className="text-sm font-medium text-rose-200">
                      {formatCurrency(selectedTrackResearchExpense)}
                      <span className="ml-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">per quarter</span>
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recurring Research Cost</p>
                      <p className="mt-2 text-sm font-medium text-white">{formatCurrency(selectedTrackResearchExpense)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Commercial Opex</p>
                      <p className="mt-2 text-sm font-medium text-white">{formatCurrency(selectedTrackCommercialExpense)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recommended Compute</p>
                      <p className="mt-2 text-sm font-medium text-white">{selectedForecast.recommendedCompute} PFLOPS</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">ETA To Next Level</p>
                      <p className="mt-2 text-sm font-medium text-white">{formatTurns(selectedForecast.turnsToLevel)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Revenue Ladder</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Each completed stage adds passive quarterly revenue before you launch a full market path.
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

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
                  <CommercializationGraph
                    options={commercializationOptions}
                    selectedId={selectedCommercializationOption?.id ?? null}
                    onSelect={setSelectedCommercializationId}
                  />

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Selected Market Path</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Review the economics, role gates, and downstream convergences before you commit.
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {activeCommercialPrograms.length} active on this track
                      </span>
                    </div>

                    {selectedCommercializationOption ? (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                    {commercializationTierLabel(selectedCommercializationOption.tier)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                    {formatLaneLabel(selectedCommercializationOption.lane)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                    {selectedCommercializationOption.source}
                                  </span>
                                </div>
                                <h3 className="mt-3 text-xl font-semibold text-white">
                                  {selectedCommercializationOption.name}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                  {selectedCommercializationOption.summary}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={!selectedCommercializationOption.available}
                                onClick={() => store.launchCommercialization(selectedCommercializationOption.id)}
                                className="inline-flex min-w-[154px] items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                              >
                                {selectedCommercializationOption.isLive
                                  ? "Already Live"
                                  : selectedCommercializationOption.isLaunching
                                    ? "Launching"
                                    : selectedCommercializationOption.available
                                      ? "Launch Program"
                                      : "Locked"}
                              </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Upfront Cost</p>
                                <p className="mt-2 text-sm font-medium text-white">
                                  {formatCurrency(selectedCommercializationOption.upfrontCost)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quarterly Revenue</p>
                                <p className="mt-2 text-sm font-medium text-emerald-200">
                                  {formatCurrency(selectedCommercializationOption.quarterlyRevenue)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quarterly Expense</p>
                                <p className="mt-2 text-sm font-medium text-rose-100">
                                  {formatCurrency(selectedCommercializationOption.quarterlyExpense)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quarterly Net</p>
                                <p className="mt-2 text-sm font-medium text-emerald-200">
                                  {formatCurrency(selectedCommercializationOption.netRevenue)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Compute Reserve</p>
                                <p className="mt-2 text-sm font-medium text-white">
                                  {selectedCommercializationOption.computeDemand} PFLOPS
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Launch Time</p>
                                <p className="mt-2 text-sm font-medium text-white">
                                  {selectedCommercializationOption.setupTurns}Q
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3">
                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Prerequisites</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {selectedCommercializationOption.prerequisitePrograms?.length ? (
                                    selectedCommercializationOption.prerequisitePrograms.map((programId) => {
                                      const program = store.commercializationPrograms.find(
                                        (entry) => entry.definitionId === programId,
                                      );
                                      const prerequisite = commercializationLookup[programId];
                                      const live = program?.status === "live";

                                      return (
                                        <span
                                          key={programId}
                                          className={`rounded-full border px-3 py-1 text-xs ${
                                            live
                                              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                              : "border-white/10 bg-white/5 text-slate-400"
                                          }`}
                                        >
                                          {prerequisite?.name ?? programId}
                                          {live ? " - live" : ""}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-sm text-slate-500">No upstream commercialization program required.</span>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Gates</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                    {trackDefinition.shortName} L{selectedCommercializationOption.minLevel}+
                                  </span>
                                  {(selectedCommercializationOption.requiredRoleKeywords ?? []).map((keyword) => (
                                    <span
                                      key={keyword}
                                      className={`rounded-full border px-3 py-1 text-xs ${
                                        selectedCommercializationOption.missingRoleKeywords.includes(keyword)
                                          ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                                          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                      }`}
                                    >
                                      {formatRoleKeyword(keyword)}
                                    </span>
                                  ))}
                                  {Object.entries(selectedCommercializationOption.requiredTracks ?? {}).map(
                                    ([requiredTrackId, requiredLevel]) => {
                                      const ready =
                                        store.tracks[requiredTrackId as TrackId].level >= (requiredLevel ?? 0);
                                      return (
                                        <span
                                          key={`${selectedCommercializationOption.id}-${requiredTrackId}`}
                                          className={`rounded-full border px-3 py-1 text-xs ${
                                            ready
                                              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                              : "border-amber-400/20 bg-amber-500/10 text-amber-100"
                                          }`}
                                        >
                                          {getTrackLabel(requiredTrackId as TrackId)} L{requiredLevel}
                                        </span>
                                      );
                                    },
                                  )}
                                </div>
                              </div>

                              <div
                                className={`rounded-2xl border px-3 py-3 text-sm leading-6 ${
                                  selectedCommercializationOption.blockedReason
                                    ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                                    : "border-sky-400/20 bg-sky-500/10 text-sky-100"
                                }`}
                              >
                                {selectedCommercializationOption.blockedReason
                                  ? selectedCommercializationOption.blockedReason
                                  : selectedCommercializationImpactSummary || "No immediate trust, fear, or board swing beyond the economics."}
                              </div>

                              {selectedCommercializationProgram ? (
                                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                                  {selectedCommercializationProgram.status === "live"
                                    ? `${selectedCommercializationProgram.name} is already live and reserving ${selectedCommercializationProgram.computeDemand} PFLOPS each quarter.`
                                    : `${selectedCommercializationProgram.name} is in flight with ${selectedCommercializationProgram.turnsRemaining}Q remaining before revenue turns on.`}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-white/8 bg-slate-950/65 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Potential Market Convergences</p>
                              <p className="mt-1 text-sm text-slate-500">
                                These are the business-layer synergies this path can contribute to if the paired programs go live.
                              </p>
                            </div>
                            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              {selectedCommercializationConvergencePreview.length} linked
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            {selectedCommercializationConvergencePreview.length ? (
                              selectedCommercializationConvergencePreview.map((convergence) => (
                                <div
                                  key={convergence.id}
                                  className={`rounded-2xl border px-3 py-3 ${
                                    convergence.live
                                      ? "border-emerald-400/20 bg-emerald-500/8"
                                      : "border-white/8 bg-white/4"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-white">{convergence.name}</span>
                                    <span className="text-sm text-emerald-200">
                                      {formatCurrency(convergence.revenue)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-400">
                                    {convergence.description}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {convergence.readiness.map((requirement) => (
                                      <span
                                        key={`${convergence.id}-${requirement.id}`}
                                        className={`rounded-full border px-3 py-1 text-[11px] ${
                                          requirement.live
                                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                            : "border-white/10 bg-white/5 text-slate-400"
                                        }`}
                                      >
                                        {requirement.name}
                                        {requirement.live ? " - live" : " - pending"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">
                                This node does not currently anchor a cross-track market convergence.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        No commercialization paths are authored for this track yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Active Programs</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Programs transition from setup to live status and then reserve compute every quarter.
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {trackCommercialRevenueStreams.length ? formatCurrency(trackCommercialRevenueStreams.reduce((sum, stream) => sum + stream.amount, 0)) : "$0"} / quarter
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {activeCommercialPrograms.length ? (
                      activeCommercialPrograms.map((program) => (
                        <div key={program.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">{program.name}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {program.status === "live" ? "Live" : `${program.turnsRemaining}Q to live`}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                            <span>Revenue {formatCurrency(program.quarterlyRevenue)}</span>
                            <span>Expense {formatCurrency(program.quarterlyExpense)}</span>
                            <span>Compute {program.computeDemand} PFLOPS</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{program.summary}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No commercialization programs are active on this track yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Market Convergences</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Product choices can create new business-layer convergences before the research layer fully closes.
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {activeCommercialConvergences.length} live
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {activeCommercialConvergences.length ? (
                      activeCommercialConvergences.map((convergence) => (
                        <div key={convergence.id} className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">{convergence.name}</span>
                            <span className="text-sm text-emerald-200">{formatCurrency(convergence.revenue)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-300">{convergence.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No live market convergence yet. Launch track-specific products to create business-layer synergies.</p>
                    )}
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
                        const status = getTalentAssignmentStatus(employee, store.selectedTrack);

                        return (
                          <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, null)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                            <span className="flex min-w-0 items-center gap-3">
                              <StaffAvatar researcher={employee} size="sm" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-white">{employee.name}</span>
                                <span className="text-xs text-slate-400">{employee.role} / {contributor.focus} / +{contributor.contribution}</span>
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-2">
                              <SignalChip label={status.label} tone={status.tone} />
                              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Unassign</span>
                            </span>
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
                          availableResearchers.slice(0, 6).map((employee) => {
                            const status = getTalentAssignmentStatus(employee, store.selectedTrack);

                            return (
                              <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, store.selectedTrack)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-400/18 bg-emerald-500/8 px-3 py-3 text-left">
                                <span className="flex min-w-0 items-center gap-3">
                                  <StaffAvatar researcher={employee} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-white">{employee.name}</span>
                                    <span className="text-xs text-slate-400">{employee.role} / Salary {formatCurrency(employee.salary)}</span>
                                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">{status.detail}</span>
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-2">
                                  <SignalChip label={status.label} tone={status.tone} />
                                  <span className="text-xs uppercase tracking-[0.18em] text-sky-300">Assign</span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No eligible unassigned staff are idle right now.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Committed Elsewhere</p>
                      <div className="mt-2 space-y-2">
                        {committedResearchers.length ? (
                          committedResearchers.slice(0, 6).map((employee) => {
                            const status = getTalentAssignmentStatus(employee, store.selectedTrack);

                            return (
                              <button key={employee.id} type="button" onClick={() => store.assignPerson(employee.id, store.selectedTrack)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-400/18 bg-amber-500/8 px-3 py-3 text-left">
                                <span className="flex min-w-0 items-center gap-3">
                                  <StaffAvatar researcher={employee} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-white">{employee.name}</span>
                                    <span className="text-xs text-slate-400">
                                      {employee.role} / Currently on {getTrackLabel(employee.assignedTrack)}
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">{status.detail}</span>
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-2">
                                  <SignalChip label={status.label} tone={status.tone} />
                                  <span className="text-xs uppercase tracking-[0.18em] text-amber-300">Reassign</span>
                                </span>
                              </button>
                            );
                          })
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
                            <div key={employee.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                              <StaffAvatar researcher={employee} size="sm" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-white">{employee.name}</span>
                                <span className="block text-xs text-slate-400">{employee.role}</span>
                                <span className="mt-1 block text-[11px] leading-5 text-slate-500">{describeAssignmentScope(employee)}</span>
                              </span>
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
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Passive Lift</p>
                            <p className="mt-2 text-sm font-medium text-emerald-200">+{formatCurrency(stage.stageRevenue)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cumulative Passive</p>
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

                {rivalColor ? (
                  <div className="rounded-[24px] border border-violet-400/18 bg-violet-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-violet-200">Rival Assessment</p>
                    <RichText text={rivalColor} className="mt-3 text-violet-50" />
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
                <div className="mission-card rounded-[26px] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Runway Forecast</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{store.resources.runwayMonths} months of operating room</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Finance should read like a flight instrument: capital altitude, burn velocity, and the next dilution window.
                      </p>
                    </div>
                    <SignalChip label={runwayTone === "bad" ? "Cash warning" : runwayTone === "good" ? "Stable runway" : "Watch runway"} tone={runwayTone} />
                  </div>
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        <span>Runway buffer</span>
                        <span>{store.resources.runwayMonths}/36 months</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/6">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${
                            runwayTone === "bad"
                              ? "from-rose-400 to-amber-300"
                              : runwayTone === "good"
                                ? "from-emerald-300 to-sky-300"
                                : "from-amber-300 to-sky-300"
                          }`}
                          style={{ width: `${runwayPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Revenue</span>
                          <span className="font-medium text-emerald-100">{formatCurrency(store.resources.revenue)}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-emerald-300" style={{ width: `${revenuePercent}%` }} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-rose-200">Burn</span>
                          <span className="font-medium text-rose-100">{formatCurrency(store.resources.burn)}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-rose-300" style={{ width: `${burnPercent}%` }} />
                        </div>
                      </div>
                      <div className={`rounded-2xl border px-3 py-3 ${quarterlyNet >= 0 ? "border-sky-400/18 bg-sky-500/10" : "border-amber-400/18 bg-amber-500/10"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[11px] uppercase tracking-[0.18em] ${quarterlyNet >= 0 ? "text-sky-200" : "text-amber-100"}`}>Net</span>
                          <span className="font-medium text-white">{quarterlyNet >= 0 ? "+" : ""}{formatCurrency(quarterlyNet)}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                          <div className={`h-full rounded-full ${quarterlyNet >= 0 ? "bg-sky-300" : "bg-amber-300"}`} style={{ width: `${netPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                    <p className="mt-2 text-xs text-slate-500">Raw capacity {researchCapacity} research PFLOPS after {reservedCommercialCompute} PFLOPS reserved for live products.</p>
                  </div>
                </div>

                <CollapsibleSection
                  title="Ledger Waterfall"
                  subtitle="Revenue streams beside the burn stack so cash pressure is easier to diagnose."
                  open={isSectionOpen("finance-ledger")}
                  onToggle={() => toggleSection("finance-ledger")}
                >
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
                            <span className="text-sm font-medium text-white">{formatExpenseLabel(label)}</span>
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
                </CollapsibleSection>

                <CollapsibleSection
                  title="Research And Commercial Costs"
                  subtitle="Recurring research overhead, posture effects, and product operating load."
                  open={isSectionOpen("finance-costs")}
                  onToggle={() => toggleSection("finance-costs")}
                >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Research Cost By Track</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Total {formatCurrency(store.resources.expenses.research)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {researchExpenseBreakdown.map((entry) => (
                        <div key={entry.trackId} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">{entry.name}</span>
                            <span className="text-sm text-rose-200">{formatCurrency(entry.amount)}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            {entry.projectName} · {entry.postureLabel} posture · {entry.assignedCount} staff · {entry.compute} PFLOPS
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Commercial Programs</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Opex {formatCurrency(store.resources.expenses.commercialization)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {commercializationExpenseBreakdown.length ? (
                        commercializationExpenseBreakdown.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-white">{entry.name}</span>
                              <span className="text-sm text-rose-200">{formatCurrency(entry.amount)}</span>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              {TRACK_DEFINITIONS.find((track) => track.id === entry.trackId)?.name} · {entry.status === "live" ? "Live" : "Launching"} · {entry.computeDemand} PFLOPS
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No commercial operating load yet.</p>
                      )}
                    </div>
                  </div>
                </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Capital Markets"
                  subtitle="Founder control, board confidence, and available financing tradeoffs."
                  open={isSectionOpen("finance-capital")}
                  onToggle={() => toggleSection("finance-capital")}
                >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Founder Control</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {formatFundingRoundLabel(store.flags.fundingRound)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Control</p>
                        <p className="mt-2 text-sm font-medium text-white">{Math.round(store.flags.founderControl)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Board Confidence</p>
                        <p className="mt-2 text-sm font-medium text-white">{Math.round(store.resources.boardConfidence)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last Raise</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {store.flags.lastFundingTurn < 0 ? "Never" : `Turn ${store.flags.lastFundingTurn}`}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Lower founder control makes negative net quarters and fear spikes hurt board confidence faster.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Capital Market Offers</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {fundingOffers.length ? `${fundingOffers.length} live` : "No window"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {fundingOffers.length ? (
                        fundingOffers.map((offer) => (
                          <div key={offer.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-white">{offer.name}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-400">{offer.summary}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => store.takeFunding(offer.id)}
                                className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
                              >
                                Take
                              </button>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                              <span>Cash {formatCurrency(offer.capital)}</span>
                              <span>Control -{offer.founderControlLoss}</span>
                              <span>{offer.computeGrant ? `+${offer.computeGrant} PFLOPS` : "No compute grant"}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Runway is acceptable for now. Offers appear when the market window is open or the lab starts running hot on cash.</p>
                      )}
                    </div>
                  </div>
                </div>

                </CollapsibleSection>

                <CollapsibleSection
                  title="Payroll And Pending Hires"
                  subtitle="People are recurring burn, not just one-time signing bonuses."
                  open={isSectionOpen("finance-payroll")}
                  onToggle={() => toggleSection("finance-payroll")}
                >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Payroll</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current payroll {formatCurrency(store.resources.expenses.payroll)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {payrollEntries.map((employee) => (
                        <div key={employee.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <StaffAvatar researcher={employee} size="sm" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-white">{employee.name}</span>
                              <span className="text-xs text-slate-400">{employee.role} / {getTrackLabel(employee.assignedTrack)}</span>
                            </span>
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
                              <span className="flex min-w-0 items-center gap-3">
                                <StaffAvatar researcher={hire} size="sm" />
                                <span className="text-sm font-medium text-white">{hire.name}</span>
                              </span>
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
                </CollapsibleSection>

                <CollapsibleSection
                  title="Capital Commitments"
                  subtitle="Construction and expansion load that will change compute and upkeep."
                  open={isSectionOpen("finance-commitments")}
                  onToggle={() => toggleSection("finance-commitments")}
                >
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
                </CollapsibleSection>
              </div>
            ) : null}

            {store.panel === "hiring" ? (
              <div className="space-y-4">
                <CollapsibleSection
                  title="Talent Pressure"
                  subtitle="Why recruiting changes next quarter, not this one."
                  open={isSectionOpen("hiring-pressure")}
                  onToggle={() => toggleSection("hiring-pressure")}
                >
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Signed hires are locked in now, become assignable next quarter, and then start contributing to payroll and research throughput.
                    Recruiting changes the next turn, not the current one. Specialists only staff their primary or secondary lanes unless marked as generalists.
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Active Track Coverage"
                  subtitle="Free matches, committed specialists, and true lane gaps."
                  open={isSectionOpen("hiring-coverage")}
                  onToggle={() => toggleSection("hiring-coverage")}
                  actions={<span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{getTrackLabel(store.selectedTrack)}</span>}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Assigned Now</p>
                      <p className="mt-2 text-sm font-medium text-white">{assignedResearchers.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Free Matches</p>
                      <p className="mt-2 text-sm font-medium text-white">{availableResearchers.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Committed Elsewhere</p>
                      <p className="mt-2 text-sm font-medium text-white">{committedResearchers.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ineligible</p>
                      <p className="mt-2 text-sm font-medium text-white">{ineligibleResearchers.length}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Use this as the context for why a hire matters: coverage gaps, not just headcount, decide which lanes can actually move.
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Arrival Queue"
                  subtitle="Signed hires and payroll arriving next turn."
                  open={isSectionOpen("hiring-queue")}
                  onToggle={() => toggleSection("hiring-queue")}
                  actions={<span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{store.pendingHires.length} signed</span>}
                >
                  <div className="space-y-2">
                    {store.pendingHires.length ? (
                      store.pendingHires.map((hire) => (
                        <div key={hire.id} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-3">
                              <StaffAvatar researcher={hire} size="sm" />
                              <span className="text-sm font-medium text-white">{hire.name}</span>
                            </span>
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
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Close cost already committed this quarter: {formatCurrency(pendingHireCloseCost)}.
                  </p>
                </CollapsibleSection>
              </div>
            ) : null}

            {store.panel === "facilities" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="mission-card rounded-[26px] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Compute Supply</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {researchCapacity} research PFLOPS available from {store.resources.computeCapacity} total
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Facilities is the supply chain view: supplier throughput, energy politics, reserved product load, and build timing.
                      </p>
                    </div>
                    <SignalChip
                      label={nextProjectDue ? `${nextProjectDue.name} ${nextProjectDue.turnsRemaining}Q` : "No active build"}
                      tone={nextProjectDue ? "focus" : "neutral"}
                    />
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-sky-400/18 bg-sky-500/10 p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-sky-100">
                        <span>Research Capacity</span>
                        <span>{Math.round(researchCapacityPercent)}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-sky-300" style={{ width: `${researchCapacityPercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Capacity left after commercial programs reserve cluster time.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/18 bg-amber-500/10 p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-amber-100">
                        <span>Product Reserve</span>
                        <span>{reservedCommercialCompute} PFLOPS</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-amber-300" style={{ width: `${reservedComputePercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Revenue programs make money but compete with frontier research.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/56 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Build Queue</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {store.projects.length ? `${store.projects.length} active project${store.projects.length === 1 ? "" : "s"}` : "Idle"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {nextProjectDue
                          ? `${nextProjectDue.region} expansion lands in ${nextProjectDue.turnsRemaining}Q.`
                          : "No construction drag right now. Expansion decisions can be timed around cash pressure."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                        <span>Projected Capacity</span>
                        <span>{Math.round(projectedUtilization)}% used</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">{projectedComputeCapacity} PFLOPS total</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Queue adds {queuedComputeDelta} PFLOPS and {formatCurrency(queuedUpkeepDelta)} upkeep.
                      </p>
                    </div>
                  </div>
                </div>
                <CollapsibleSection
                  title="Supplier"
                  subtitle="Chips change throughput, cost, and track-level strengths."
                  open={isSectionOpen("facilities-supplier")}
                  onToggle={() => toggleSection("facilities-supplier")}
                >
                  <div className="grid gap-2">
                    {SUPPLIER_CONTRACTS.map((supplier) => (
                      <button key={supplier.vendor} type="button" onClick={() => store.chooseSupplier(supplier.vendor)} className={`rounded-2xl border px-3 py-3 text-left ${store.supplier.vendor === supplier.vendor ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{supplier.vendor}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{supplier.summary}</span>
                        <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">Throughput x{supplier.computeMultiplier.toFixed(2)} · Upkeep x{supplier.upkeepMultiplier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Energy Policy"
                  subtitle="Cost, trust, and utilization tradeoffs."
                  open={isSectionOpen("facilities-energy")}
                  onToggle={() => toggleSection("facilities-energy")}
                >
                  <div className="grid gap-2">
                    {ENERGY_POLICIES.map((energy) => (
                      <button key={energy.id} type="button" onClick={() => store.chooseEnergy(energy.id)} className={`rounded-2xl border px-3 py-3 text-left ${store.energyPolicy.id === energy.id ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/8 bg-slate-950/65"}`}>
                        <span className="block font-medium text-white">{energy.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{energy.summary}</span>
                        <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">Upkeep x{energy.upkeepMultiplier.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Active Projects"
                  subtitle="Construction queue and compute arriving soon."
                  open={isSectionOpen("facilities-projects")}
                  onToggle={() => toggleSection("facilities-projects")}
                  actions={<span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{store.projects.length} queued</span>}
                >
                  <div className="space-y-3">
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
                </CollapsibleSection>

                <CollapsibleSection
                  title="Expansion"
                  subtitle="Build the compute roadmap, but watch upkeep, trust, and regional risk."
                  open={isSectionOpen("facilities-expansion")}
                  onToggle={() => toggleSection("facilities-expansion")}
                >
                  <div className="grid gap-2">
                    {buildOptions.map((option) => {
                      const buildTime = getFacilityBuildTime(store, option.id);
                      const optionProjectedCapacity = store.resources.computeCapacity + queuedComputeDelta + option.computeDelta;

                      return (
                        <button key={option.id} type="button" onClick={() => store.startFacility(option.id)} className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3 text-left">
                          <span className="block font-medium text-white">{option.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-400">{option.region} / Cost {formatCurrency(option.buildCost)} / ETA {buildTime}Q / Upkeep {formatCurrency(option.upkeep)}</span>
                          <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500">+{option.computeDelta} PFLOPS / Trust {option.trustDelta >= 0 ? "+" : ""}{option.trustDelta} / Risk {option.riskDelta >= 0 ? "+" : ""}{option.riskDelta}</span>
                          <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-sky-200">Projected total after build queue: {optionProjectedCapacity} PFLOPS</span>
                          <span className="mt-2 block text-xs leading-5 text-slate-400">{describeFacilityOutcome(option)}</span>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              </div>
            ) : null}

            {store.panel === "settings" ? (
              <div className="space-y-4 text-sm text-slate-300">
                <CollapsibleSection
                  title="AI Narrative + Scene Art"
                  subtitle={`Production uses Cloudflare secrets first. ${sceneArtModeSummary}`}
                  open={isSectionOpen("settings-ai")}
                  onToggle={() => toggleSection("settings-ai")}
                  actions={<span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{aiUsesServer ? "server" : store.aiSettings.enabled ? "manual" : "off"}</span>}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.22em] text-slate-400">AI Narrative + Scene Art</label>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Production uses Cloudflare secrets first. {sceneArtModeSummary} Manual keys are only a local fallback for development.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {aiUsesServer ? "server" : store.aiSettings.enabled ? "manual" : "off"}
                    </span>
                  </div>
                  <input value={apiKeyDraft ?? (aiUsesServer ? "" : store.aiSettings.apiKey)} onChange={(event) => { setApiKeyDraft(event.target.value); setGeminiStatusOverride(null); }} placeholder={serverNarrativeReady || serverSceneArtReady ? "Production AI secret connected" : "Optional Gemini key for local fallback"} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(geminiStatus.tone)}`}>{geminiStatus.message}</div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Narrative</p>
                      <p className="mt-2 text-sm font-medium text-white">{serverAIStatus?.narrative.model ?? "Local fallback"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Fast Art</p>
                      <p className="mt-2 text-sm font-medium text-white">{serverAIStatus?.providers.gemini ? "Gemini image" : "Unavailable"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Premium Art</p>
                      <p className="mt-2 text-sm font-medium text-white">{serverAIStatus?.sceneArt.model ?? "Unavailable"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void activateGemini()} disabled={geminiStatus.tone === "checking"} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {geminiStatus.tone === "checking" ? "Checking..." : "Activate AI"}
                    </button>
                    <button type="button" onClick={disableGemini} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Disable</button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Cinematic Mode"
                  subtitle="Optional fal.ai Seedance video for major story beats."
                  open={isSectionOpen("settings-cinematic")}
                  onToggle={() => toggleSection("settings-cinematic")}
                  actions={<span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{serverCinematicReady ? "fal.ai" : "off"}</span>}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.22em] text-slate-400">fal.ai Seedance Video</label>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Video is never required to advance turns. It appears as a premium optional render on dilemmas, scene beats, breakthroughs, and endings.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {serverCinematicReady ? "server" : "needs FAL_KEY"}
                    </span>
                  </div>
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(cinematicStatus.tone)}`}>
                    {cinematicStatus.message}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Provider</p>
                      <p className="mt-2 text-sm font-medium text-white">{serverCinematicReady ? "fal.ai" : "Unavailable"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Model</p>
                      <p className="mt-2 text-sm font-medium text-white">{productionCinematicModel ?? "Seedance 2.0"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Default</p>
                      <p className="mt-2 text-sm font-medium text-white">720p / 5 sec</p>
                    </div>
                  </div>
                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={cinematicGenerateAudio}
                      onChange={(event) => setCinematicGenerateAudio(event.target.checked)}
                      className="h-4 w-4 rounded border-white/15 bg-slate-900"
                    />
                    Include Seedance audio/dialogue by default
                  </label>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Best default experience: leave audio off for clean ambience, then enable audio when you want an advisor-style crisis briefing.
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title="AI Voice"
                  subtitle="OpenAI text-to-speech for briefing narration."
                  open={isSectionOpen("settings-voice")}
                  onToggle={() => toggleSection("settings-voice")}
                  actions={<span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{voiceUsesServer ? "server" : store.openAISettings.enabled ? "manual" : "off"}</span>}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.22em] text-slate-400">AI Voice</label>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Uses OpenAI text-to-speech with a high-quality narration voice. Production secrets stay server-side.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {voiceUsesServer ? "server" : store.openAISettings.enabled ? "manual" : "off"}
                    </span>
                  </div>
                  <input value={openAiKeyDraft ?? (voiceUsesServer ? "" : store.openAISettings.apiKey)} onChange={(event) => { setOpenAiKeyDraft(event.target.value); setOpenAiStatusOverride(null); }} placeholder={serverVoiceReady ? "Production OpenAI secret connected" : "Optional OpenAI key for local fallback"} className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(openAiStatus.tone)}`}>{openAiStatus.message}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void activateOpenAI()} disabled={openAiStatus.tone === "checking"} className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {openAiStatus.tone === "checking" ? "Testing..." : "Activate Voice"}
                    </button>
                    <button type="button" onClick={() => void narrateTurnSummary()} disabled={isNarrationLoading} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60">{isNarrationLoading ? "Generating Voice..." : "Test Current Summary"}</button>
                    <button type="button" onClick={disableOpenAI} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Disable</button>
                  </div>
                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/65 px-4 py-3 text-sm">
                    <input type="checkbox" checked={store.openAISettings.autoPlay} onChange={(event) => store.updateOpenAIConfig(store.openAISettings.enabled, store.openAISettings.apiKey, event.target.checked)} className="h-4 w-4 rounded border-white/15 bg-slate-900" />
                    Auto-play quarterly briefing after each turn
                  </label>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Local Audio"
                  subtitle="Browser sound toggles and current narration stop controls."
                  open={isSectionOpen("settings-audio")}
                  onToggle={() => toggleSection("settings-audio")}
                >
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
                </CollapsibleSection>

                <CollapsibleSection
                  title="Cloud Saves"
                  subtitle="Cloudflare KV sync using commander ID and passphrase."
                  open={isSectionOpen("settings-cloud")}
                  onToggle={() => toggleSection("settings-cloud")}
                  actions={<Cloud className="h-4 w-4 text-violet-200" />}
                >
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
                      Production API keys stay in Cloudflare secrets. Manual fallback keys stay local only, and cloud saves upload game state without AI secrets. New saves can take a few seconds to appear on another browser.
                    </p>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Save Slots"
                  subtitle="Local and cloud slots stay separate so testing is safe."
                  open={isSectionOpen("settings-slots")}
                  onToggle={() => toggleSection("settings-slots")}
                >
                  <div className="space-y-3">
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
                </CollapsibleSection>
              </div>
            ) : null}
          </aside>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="mission-bottom-nav fixed inset-x-3 bottom-3 z-30 rounded-[26px] border border-white/10 bg-slate-950/92 p-2 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-6 gap-1">
          {NAV_PANELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => store.openPanel(id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] uppercase tracking-[0.12em] transition ${
                store.panel === id
                  ? "bg-sky-400/18 text-sky-50"
                  : "text-slate-400 hover:bg-white/6 hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {store.activeDilemma ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/78 p-4 py-6 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="w-full max-w-6xl rounded-[36px] border border-white/10 bg-[#0a1124]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-4">
                  <div className="rounded-[30px] border border-amber-400/18 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_38%),linear-gradient(180deg,rgba(24,16,10,0.18),rgba(255,255,255,0.02))] p-5">
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
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void narrateDilemmaSummary()} disabled={isNarrationLoading} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
                          <AudioLines className="h-4 w-4" />
                          {isNarrationLoading ? "Generating Voice..." : "Read Context"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void generateSceneArt("dilemma", "premium")}
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <SignalChip label="Permanent history" tone="bad" />
                      <SignalChip label={`${store.decisionLog.length} decisions already logged`} tone="neutral" />
                    </div>
                    <div className="mt-4 rounded-[22px] border border-amber-400/18 bg-amber-500/10 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-amber-100">Scene Beat</p>
                          <p className="mt-2 text-base font-semibold text-white">{sceneBeat.label}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{sceneBeat.detail}</p>
                        </div>
                        <SignalChip label={sceneArtScope === "dilemma" && sceneArtUrl ? "Visualized" : serverSceneArtReady ? "Auto eligible" : "AI standby"} tone={sceneArtScope === "dilemma" && sceneArtUrl ? "good" : "focus"} />
                      </div>
                    </div>
                  </div>

                  {dilemmaFlavor ? (
                    <div className="rounded-[24px] border border-violet-400/18 bg-violet-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-violet-200">AI Context Note</p>
                      <RichText text={dilemmaFlavor} className="mt-3 text-violet-50" />
                    </div>
                  ) : null}

                  {(sceneArtScope === "dilemma" || sceneArtStatus.tone !== "idle") ? (
                    <div className={`rounded-2xl border px-4 py-3 text-sm ${statusPanelClasses(sceneArtStatus.tone)}`}>
                      {sceneArtStatus.message}
                    </div>
                  ) : null}
                  <div className="mission-art-frame min-h-[260px] rounded-[28px]">
                    {sceneArtScope === "dilemma" && sceneArtUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sceneArtUrl} alt="AI-generated dilemma scene art" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/92 to-transparent p-5">
                          <SignalChip label="Crisis visualization" tone="bad" />
                          <p className="mt-3 text-sm leading-6 text-slate-200">Generated from this dilemma so the choice feels like a live incident, not a modal.</p>
                        </div>
                      </>
                    ) : (
                      <div className="relative z-10 flex min-h-[260px] flex-col justify-between p-5">
                        <div>
                          <SignalChip label={serverSceneArtReady ? "Fast crisis art ready" : "Art standby"} tone={serverSceneArtReady ? "focus" : "neutral"} />
                          <h3 className="mt-5 text-2xl font-semibold text-white">Crisis theater</h3>
                          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                            Generate a frame when you want this decision to feel like a boardroom emergency with consequences on the wall.
                          </p>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100">The turn clock is paused until you choose.</p>
                      </div>
                    )}
                  </div>
                  {renderCinematicControls("dilemma")}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-white/10 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current Stakes</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Trust</p>
                        <p className="mt-2 text-sm font-medium text-white">{Math.round(store.resources.trust)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Fear</p>
                        <p className="mt-2 text-sm font-medium text-white">{Math.round(store.resources.fear)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Board</p>
                        <p className="mt-2 text-sm font-medium text-white">{Math.round(store.resources.boardConfidence)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/65 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Gov Dependence</p>
                        <p className="mt-2 text-sm font-medium text-white">{store.flags.governmentDependence}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Decision Rule</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Choose one path. The game rolls one of that path&apos;s shown percentage outcomes, applies its effects immediately, and records the result in the lab&apos;s permanent memory.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {store.activeDilemma.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      playSynthTone(soundEnabled, "warning");
                      store.resolveDilemma(option);
                    }}
                    className="rounded-[28px] border border-white/10 bg-white/4 p-5 text-left transition hover:border-sky-400/35 hover:bg-sky-500/8"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white">{option.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{option.summary}</p>
                      </div>
                      <SignalChip label="Commit" tone="focus" />
                    </div>

                    <div className="mt-4 space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Outcome roll: one branch below will happen if you commit.
                      </p>
                      {option.outcomes.map((outcome) => {
                        const effectEntries = getDilemmaEffectEntries(outcome.effects);

                        return (
                          <div key={outcome.id} className="rounded-[22px] border border-white/8 bg-slate-950/65 p-3">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              <span>{outcome.label}</span>
                              <span>{Math.round(outcome.chance * 100)}% chance</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
                              <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-violet-400" style={{ width: `${outcome.chance * 100}%` }} />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-400">{outcome.narrative}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {effectEntries.length ? (
                                effectEntries.slice(0, 4).map(({ effect, value }) => (
                                  <SignalChip
                                    key={`${outcome.id}-${effect}`}
                                    label={formatDilemmaEffectLabel(effect, value)}
                                    tone={describeDilemmaEffectTone(effect, value)}
                                  />
                                ))
                              ) : (
                                <SignalChip label="Narrative swing only" tone="neutral" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-sky-100">Commit to this path</p>
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
              <div className="mt-5 rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Unlocked Starts</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {store.ending.unlocks.map((presetId) => (
                    <span
                      key={presetId}
                      className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                    >
                      {START_PRESETS[presetId].name}
                    </span>
                  ))}
                </div>
              </div>
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
