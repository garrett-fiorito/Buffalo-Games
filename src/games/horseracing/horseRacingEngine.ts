import type {
  ExactaBet,
  HorseDefinition,
  HorseId,
  HorseRaceResult,
  HorseRaceState,
  RacePlanEntry,
} from "./horseRacingTypes";

export const STARTING_HORSE_CHIPS = 1000;
export const MIN_HORSE_BET = 5;
export const MAX_HORSE_BET = 100;
export const RACE_DURATION_MS = 6200;

export const horses: HorseDefinition[] = [
  { id: 1, name: "Lucky Comet", color: "#d83b3b", rating: 91 },
  { id: 2, name: "Silver Rail", color: "#d7dce4", rating: 87 },
  { id: 3, name: "Desert Ace", color: "#d7a448", rating: 82 },
  { id: 4, name: "Neon Moon", color: "#35ff84", rating: 78 },
  { id: 5, name: "Blue Ticket", color: "#46a3ff", rating: 73 },
  { id: 6, name: "Velvet Six", color: "#c46cff", rating: 69 },
];

export function createInitialHorseRaceState(): HorseRaceState {
  return {
    chips: STARTING_HORSE_CHIPS,
    phase: "betting",
    selectedFirst: 1,
    selectedSecond: 2,
    betAmount: 10,
    bets: [],
    raceNumber: 0,
    lastResult: null,
  };
}

export function setHorseBetAmount(state: HorseRaceState, amount: number): HorseRaceState {
  return {
    ...state,
    betAmount: clamp(Math.round(amount), MIN_HORSE_BET, MAX_HORSE_BET),
  };
}

export function selectExactaHorse(
  state: HorseRaceState,
  position: "first" | "second",
  horseId: HorseId,
): HorseRaceState {
  if (position === "first") {
    return {
      ...state,
      selectedFirst: horseId,
      selectedSecond: state.selectedSecond === horseId ? getNextHorse(horseId) : state.selectedSecond,
    };
  }

  return {
    ...state,
    selectedSecond: horseId,
    selectedFirst: state.selectedFirst === horseId ? getNextHorse(horseId) : state.selectedFirst,
  };
}

export function placeExactaBet(state: HorseRaceState): HorseRaceState {
  if (
    state.phase === "racing" ||
    state.selectedFirst === state.selectedSecond ||
    state.betAmount > state.chips
  ) {
    return state;
  }

  const odds = getExactaOdds(state.selectedFirst, state.selectedSecond, state.raceNumber);
  const id = `${state.raceNumber}-${state.selectedFirst}-${state.selectedSecond}-${state.bets.length}`;

  return {
    ...state,
    chips: state.chips - state.betAmount,
    phase: "betting",
    lastResult: state.phase === "result" ? null : state.lastResult,
    bets: [
      ...state.bets,
      {
        id,
        first: state.selectedFirst,
        second: state.selectedSecond,
        amount: state.betAmount,
        odds,
      },
    ],
  };
}

export function clearHorseBets(state: HorseRaceState): HorseRaceState {
  if (state.phase === "racing") {
    return state;
  }

  return {
    ...state,
    chips: state.chips + state.bets.reduce((sum, bet) => sum + bet.amount, 0),
    bets: [],
  };
}

export function beginHorseRace(state: HorseRaceState): HorseRaceState {
  if (state.phase === "racing" || state.bets.length === 0) {
    return state;
  }

  return {
    ...state,
    phase: "racing",
    lastResult: null,
  };
}

export function finishHorseRace(state: HorseRaceState, finishOrder: HorseId[]): HorseRaceState {
  const result = settleHorseRace(state.bets, finishOrder);

  return {
    ...state,
    chips: state.chips + result.totalReturn,
    phase: "result",
    bets: [],
    raceNumber: state.raceNumber + 1,
    lastResult: result,
  };
}

export function settleHorseRace(bets: ExactaBet[], finishOrder: HorseId[]): HorseRaceResult {
  const [first, second] = finishOrder;
  const winningBets = bets.filter((bet) => bet.first === first && bet.second === second);
  const totalReturn = winningBets.reduce((sum, bet) => sum + bet.amount * bet.odds, 0);
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);

  return {
    finishOrder,
    winningBetIds: winningBets.map((bet) => bet.id),
    totalReturn,
    net: totalReturn - totalBet,
  };
}

export function createRacePlan(raceNumber: number): RacePlanEntry[] {
  const scored = horses.map((horse, index) => {
    const variance = seededNoise(raceNumber, horse.id) * 26;
    const fatigue = ((raceNumber + horse.id * 3) % 5) * 2.8;
    const score = horse.rating + variance - fatigue;

    return {
      horse,
      score,
      index,
    };
  });
  const ordered = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = new Map(ordered.map((entry, rank) => [entry.horse.id, rank]));

  return horses.map((horse, index) => {
    const rank = rankMap.get(horse.id) ?? index;
    return {
      horseId: horse.id,
      lane: index,
      finishTimeMs: 4300 + rank * 245 + seededNoise(raceNumber + 11, horse.id) * 180,
      surge: seededNoise(raceNumber + 23, horse.id),
    };
  });
}

export function getFinishOrder(plan: RacePlanEntry[]): HorseId[] {
  return [...plan].sort((a, b) => a.finishTimeMs - b.finishTimeMs).map((entry) => entry.horseId);
}

export function getExactaOdds(first: HorseId, second: HorseId, raceNumber: number): number {
  if (first === second) {
    return 0;
  }

  const firstHorse = getHorse(first);
  const secondHorse = getHorse(second);
  const favoritePressure = (firstHorse.rating + secondHorse.rating) / 2;
  const longshotBonus = Math.max(0, 90 - favoritePressure) / 3.2;
  const boardWobble = Math.floor(seededNoise(raceNumber + first * 5, second) * 5);

  return clamp(Math.round(5 + longshotBonus + boardWobble + Math.abs(first - second) * 0.7), 4, 28);
}

export function getOddsBoard(raceNumber: number): ExactaBet[] {
  const board: ExactaBet[] = [];

  horses.forEach((first) => {
    horses.forEach((second) => {
      if (first.id === second.id) {
        return;
      }

      board.push({
        id: `board-${first.id}-${second.id}`,
        first: first.id,
        second: second.id,
        amount: 0,
        odds: getExactaOdds(first.id, second.id, raceNumber),
      });
    });
  });

  return board.sort((a, b) => a.odds - b.odds).slice(0, 10);
}

export function getHorse(id: HorseId): HorseDefinition {
  const horse = horses.find((entry) => entry.id === id);

  if (!horse) {
    throw new Error(`Unknown horse ${id}`);
  }

  return horse;
}

function getNextHorse(horseId: HorseId): HorseId {
  return (((horseId % horses.length) + 1) as HorseId);
}

function seededNoise(raceNumber: number, horseId: number): number {
  const raw = Math.sin((raceNumber + 1) * 127.1 + horseId * 311.7) * 43758.5453;
  return raw - Math.floor(raw);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
