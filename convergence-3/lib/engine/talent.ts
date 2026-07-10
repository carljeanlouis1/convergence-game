import { BALANCE } from "./balance";
import { CANDIDATE_POOL } from "./content";
import { eraScalar } from "./eras";
import { makeRng, pick } from "./rng";
import { spawnWildcard } from "./rivals";
import type { GameState, PoachOffer, Star } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function hireCandidate(state: GameState, candidateId: string): GameState {
  const c = state.market.find(m => m.id === candidateId);
  if (!c) throw new Error("candidate gone");
  if (state.capital < c.signingBonus) throw new Error("insufficient capital");
  const star: Star = {
    id: c.id,
    name: c.name,
    specialty: c.specialty,
    skill: c.skill,
    salaryPerQuarter: c.salaryPerQuarter,
    onRunId: null,
    burnout: 0,
  };
  return {
    ...state,
    capital: state.capital - c.signingBonus,
    stars: [...state.stars, star],
    market: state.market.filter(m => m.id !== candidateId),
    teamStrength: clamp(state.teamStrength + BALANCE.talent.hireTeamStrength),
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "talent", text: `${c.name} signs on (${c.specialty}, skill ${c.skill}).` },
    ],
  };
}

export function respondToPoach(
  state: GameState,
  starId: string,
  response: "match" | "equity" | "decline",
): GameState {
  const offer = state.poachOffers.find(o => o.starId === starId && o.expiresTurn !== -1);
  if (!offer) throw new Error("no active offer");
  const star = state.stars.find(s => s.id === starId);
  if (!star) throw new Error("no active offer");
  const others = state.poachOffers.filter(o => o !== offer);
  if (response === "match") {
    const cost = offer.packageM * BALANCE.talent.matchCostFactor;
    if (state.capital < cost) throw new Error("insufficient capital");
    return {
      ...state,
      capital: state.capital - cost,
      stars: state.stars.map(s => (s.id === starId ? { ...s, salaryPerQuarter: s.salaryPerQuarter * 1.2 } : s)),
      poachOffers: others,
      chronicle: [
        ...state.chronicle,
        { turn: state.turn, kind: "talent", text: `You matched the offer for ${star.name} — $${cost.toFixed(1)}M and a raise.` },
      ],
    };
  }
  if (response === "equity") {
    return {
      ...state,
      control: clamp(state.control - BALANCE.talent.equityControlCost),
      poachOffers: others,
      chronicle: [
        ...state.chronicle,
        { turn: state.turn, kind: "talent", text: `${star.name} stays for founder equity. Your grip loosens a little.` },
      ],
    };
  }
  // decline: star accepts the rival's offer; departs on the next talentTurn
  return {
    ...state,
    poachOffers: [...others, { ...offer, expiresTurn: -1 }],
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "talent", text: `You let ${star.name} take the call. They took the offer.` },
    ],
  };
}

function departStar(state: GameState, star: Star, rivalId: string | null, lines: string[]): GameState {
  const rivals = rivalId
    ? state.rivals.map(r =>
        r.id === rivalId
          ? {
              ...r,
              capability: {
                ...r.capability,
                [star.specialty]: clamp(r.capability[star.specialty] + BALANCE.talent.departRivalCapGain),
              },
            }
          : r,
      )
    : state.rivals;
  lines.push(`${star.name} is gone.`);
  return {
    ...state,
    stars: state.stars.filter(s => s.id !== star.id),
    runs: state.runs.map(r => (r.leadId === star.id ? { ...r, leadId: null } : r)),
    rivals,
    teamStrength: clamp(state.teamStrength - BALANCE.talent.departTeamStrength),
    morale: clamp(state.morale - BALANCE.talent.declineMoraleHit),
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "talent", text: `${star.name} departs${rivalId ? " for a rival" : ""}.` },
    ],
  };
}

export function talentTurn(state: GameState): { state: GameState; lines: string[] } {
  const B = BALANCE.talent;
  const rng = makeRng(state.seed, state.turn, "talent");
  const lines: string[] = [];
  let s = state;

  // 1. departures from declined poaches
  for (const offer of s.poachOffers.filter(o => o.expiresTurn === -1)) {
    const star = s.stars.find(st => st.id === offer.starId);
    if (star) s = departStar(s, star, offer.rivalId, lines);
  }
  s = { ...s, poachOffers: s.poachOffers.filter(o => o.expiresTurn !== -1) };

  // 2. burnout drift + exodus
  s = {
    ...s,
    stars: s.stars.map(st => ({
      ...st,
      burnout: clamp(st.burnout + (st.onRunId ? B.burnoutPerRunTurn : -B.burnoutRecovery)),
    })),
  };
  for (const st of [...s.stars]) {
    if (st.burnout > B.burnoutExodusThreshold && rng() < B.exodusChance) {
      lines.push(`${st.name} burned out and walked.`);
      s = departStar(s, st, null, lines);
    }
  }

  // wildcard spawn: cumulative departures recorded in chronicle
  const departures = s.chronicle.filter(c => c.kind === "talent" && /departs|walked/.test(c.text));
  if (departures.length >= B.wildcardSpawnDepartures && s.rivals.some(r => r.archetype === "wildcard" && !r.active)) {
    const lastName = departures[departures.length - 1].text.split(" departs")[0].split(" burned")[0];
    s = spawnWildcard(s, lastName);
    lines.push(`Your alumni just founded a competitor.`);
  }

  // 3. expire stale poach offers
  s = { ...s, poachOffers: s.poachOffers.filter(o => o.expiresTurn >= s.turn) };

  // 4. maybe generate one new poach offer
  const topRival = [...s.rivals].filter(r => r.active).sort((a, b) => b.aggression - a.aggression)[0];
  const poachable = s.stars.filter(st => !s.poachOffers.some(o => o.starId === st.id));
  if (
    topRival &&
    poachable.length > 0 &&
    rng() < (B.poachBaseChance + topRival.aggression * B.poachAggressionWeight) * eraScalar("poachChance", s.era)
  ) {
    const target = pick(rng, poachable);
    const rival = pick(rng, s.rivals.filter(r => r.active));
    const offer: PoachOffer = {
      starId: target.id,
      rivalId: rival.id,
      packageM: B.poachPackageBase + target.skill * B.poachPackageSkillWeight,
      expiresTurn: s.turn + B.poachExpiry,
    };
    s = { ...s, poachOffers: [...s.poachOffers, offer] };
    lines.push(`${rival.name} is courting ${target.name} — $${offer.packageM.toFixed(0)}M package on the table.`);
  }

  // 5. market churn
  let market = s.market.filter(c => c.exitTurn > s.turn);
  const usedIds = new Set([...s.stars.map(st => st.id), ...market.map(c => c.id)]);
  while (market.length < B.marketSize && rng() < B.marketChurnChance) {
    const next = CANDIDATE_POOL.find(c => !usedIds.has(c.id));
    if (!next) break;
    usedIds.add(next.id);
    market = [...market, { ...next, exitTurn: s.turn + B.candidateExitAfter }];
    lines.push(`${next.name} (${next.specialty}) is taking meetings.`);
  }
  s = { ...s, market };

  return { state: s, lines };
}
