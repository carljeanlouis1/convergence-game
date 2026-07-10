import { BALANCE } from "./balance";
import { burnPerTurn, revenuePerTurn, runwayMonths } from "./finance";
import { leaderboard } from "./rivals";
import type { FundingKind, FundingOffer, GameState } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function valuation(state: GameState): number {
  const best = state.models
    .filter(m => m.positioning !== null)
    .map(m => m.capability.coding + m.capability.reasoning + m.capability.enterprise + m.capability.consumer);
  const totalCapability = best.length ? Math.max(...best) : 0;
  const F = BALANCE.funding;
  return (
    totalCapability * F.valuationCapWeight +
    revenuePerTurn(state) * F.valuationRevenueWeight +
    state.trust * F.valuationTrustWeight
  );
}

function generateOffers(state: GameState): FundingOffer[] {
  const F = BALANCE.funding;
  const v = valuation(state) * (state.fireSaleCount > 0 ? 0.75 : 1);
  const kinds: FundingKind[] = ["vc", "strategic", "mission"];
  return kinds.map(kind => {
    const terms = F[kind];
    return {
      id: `offer-${state.turn}-${kind}`,
      kind,
      amountM: Math.max(5, v * terms.amountFactor),
      controlCost: terms.controlCost,
      boardDelta: terms.boardDelta,
      trustDelta: terms.trustDelta,
      computeGrantPF: terms.computeGrantPF,
      expiresTurn: state.turn + F.offerExpiry,
    };
  });
}

/** Player-initiated raise: call a round on your own timing (with a cooldown). */
export function openRound(state: GameState): GameState {
  if (state.fundingOffers.length > 0) throw new Error("a round is already open");
  if (state.turn - state.lastRaiseTurn < BALANCE.funding.playerRaiseCooldown) {
    throw new Error("too soon since the last raise — investors want a story arc, not a sequel");
  }
  return {
    ...state,
    fundingOffers: generateOffers(state),
    chronicle: [
      ...state.chronicle,
      { turn: state.turn, kind: "funding", text: "You called a round. The term sheets arrived by dinner." },
    ],
  };
}

export function acceptFunding(state: GameState, offerId: string): GameState {
  const offer = state.fundingOffers.find(o => o.id === offerId);
  if (!offer) throw new Error("no such offer");
  const facilities =
    offer.computeGrantPF > 0
      ? [
          ...state.facilities,
          {
            id: `fac-grant-${state.turn}`,
            name: "Partner compute grant",
            capacityPF: offer.computeGrantPF,
            upkeepPerTurn: 0,
            onlineTurn: state.turn + 1,
          },
        ]
      : state.facilities;
  return {
    ...state,
    capital: state.capital + offer.amountM,
    control: clamp(state.control - offer.controlCost),
    boardConfidence: clamp(state.boardConfidence + offer.boardDelta),
    trust: clamp(state.trust + offer.trustDelta),
    facilities,
    fundingOffers: [],
    lastRaiseTurn: state.turn,
    fundingRound: state.fundingRound + 1,
    chronicle: [
      ...state.chronicle,
      {
        turn: state.turn,
        kind: "funding",
        text: `Closed a ${offer.kind} round: +$${offer.amountM.toFixed(0)}M for ${offer.controlCost} points of control.`,
      },
    ],
  };
}

export function fundingTurn(state: GameState): { state: GameState; lines: string[] } {
  const F = BALANCE.funding;
  const lines: string[] = [];
  let s = state;

  // 1. expire offers
  const before = s.fundingOffers.length;
  s = { ...s, fundingOffers: s.fundingOffers.filter(o => o.expiresTurn >= s.turn) };
  if (before > 0 && s.fundingOffers.length === 0) lines.push("The term sheets expired unsigned.");

  // 2. generate offers
  const runway = runwayMonths(s);
  if (
    s.fundingOffers.length === 0 &&
    (runway < F.offerRunwayTrigger || s.turn - s.lastRaiseTurn >= F.offerCadence)
  ) {
    s = { ...s, fundingOffers: generateOffers(s) };
    lines.push("Term sheets are on the table — three ways to raise, three different leashes.");
  }

  // 3. board drift
  let board = s.boardConfidence;
  if (revenuePerTurn(s) - burnPerTurn(s) >= 0) board += F.boardNetPositive;
  if (leaderboard(s).findIndex(e => e.isPlayer) < 2) board += F.boardTop2Bonus;
  if (runway < 9) board += F.boardLowRunway;
  if (runway < 6) board += F.boardVeryLowRunway;
  s = { ...s, boardConfidence: clamp(board) };

  // 4. coup check
  if (s.boardConfidence <= F.coupThreshold && s.ending === null) {
    if (s.morale >= F.coupSurviveMorale) {
      s = {
        ...s,
        boardConfidence: F.coupSurviveBoardReset,
        control: clamp(s.control - F.coupSurviveControlCost),
        chronicle: [
          ...s.chronicle,
          { turn: s.turn, kind: "funding", text: "The board moved to remove you. The team threatened to walk. You stay." },
        ],
      };
      lines.push("Coup attempt survived — the team threatened to walk, and the board blinked.");
    } else if (s.morale >= F.coupInterimMorale) {
      s = {
        ...s,
        boardConfidence: 40,
        interimUntilTurn: s.turn + F.interimTurns,
        chronicle: [
          ...s.chronicle,
          { turn: s.turn, kind: "funding", text: "You survived the coup — barely. The interim board now co-signs everything." },
        ],
      };
      lines.push("You kept the building but lost the room: interim oversight for the next 6 quarters.");
    } else {
      s = {
        ...s,
        ending: "ousted",
        ended: true,
        chronicle: [...s.chronicle, { turn: s.turn, kind: "funding", text: "Fired overnight by a Google Meet call. It's over." }],
      };
      lines.push("The board fired you. Nobody walked.");
      return { state: s, lines };
    }
  }

  // 5. fire-sale chain
  if (s.capital < 0 && s.ending === null) {
    const count = s.fireSaleCount + 1;
    if (count === 1) {
      const biggest = [...s.facilities].sort((a, b) => b.capacityPF - a.capacityPF)[0];
      const soldPF = biggest.capacityPF * F.fireSaleFacilityFraction;
      s = {
        ...s,
        fireSaleCount: count,
        capital: s.capital + soldPF * F.fireSaleCapitalRecovery,
        facilities: s.facilities.map(f =>
          f.id === biggest.id ? { ...f, capacityPF: f.capacityPF - soldPF } : f,
        ),
        chronicle: [...s.chronicle, { turn: s.turn, kind: "funding", text: "Fire sale: a quarter of the cluster, gone." }],
      };
      lines.push(`Emergency: sold ${soldPF.toFixed(0)} PF of compute to make payroll.`);
    } else if (count === 2) {
      s = {
        ...s,
        fireSaleCount: count,
        capital: s.capital + valuation(s) * 0.1,
        control: clamp(s.control - F.fireSaleDownRoundControl),
        chronicle: [...s.chronicle, { turn: s.turn, kind: "funding", text: "A brutal down round. The board owns you now." }],
      };
      lines.push("Forced down round — vulture terms, 20 points of control gone.");
    } else {
      s = {
        ...s,
        fireSaleCount: count,
        ending: "absorbed",
        ended: true,
        chronicle: [...s.chronicle, { turn: s.turn, kind: "funding", text: "Acquihired. Your lab is now someone's AI division." }],
      };
      lines.push("Out of money, out of credibility. The acquihire is the only offer left.");
    }
  }

  return { state: s, lines };
}
