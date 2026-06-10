import type {
  HorseBet,
  HorseBetKind,
  HorseDefinition,
  HorseId,
  HorseRaceResult,
  HorseRaceState,
  RacePlanEntry,
} from "./horseRacingTypes";

export const STARTING_HORSE_CHIPS = 1000;
export const MIN_HORSE_BET = 5;
export const MAX_HORSE_BET = 100;
export const RACE_DURATION_MS = 31000;

export const horses: HorseDefinition[] = [
  { id: 1, name: "Lucky Comet", color: "#d83b3b", rating: 91 },
  { id: 2, name: "Silver Rail", color: "#d7dce4", rating: 87 },
  { id: 3, name: "Desert Ace", color: "#d7a448", rating: 82 },
  { id: 4, name: "Neon Moon", color: "#35ff84", rating: 78 },
  { id: 5, name: "Blue Ticket", color: "#46a3ff", rating: 73 },
  { id: 6, name: "Velvet Six", color: "#c46cff", rating: 69 },
];

export function createInitialHorseRaceState(raceSeed = createHorseRaceSeed()): HorseRaceState {
  return {
    chips: STARTING_HORSE_CHIPS,
    phase: "betting",
    selectedKind: "winner",
    selectedFirst: 1,
    selectedSecond: undefined,
    betAmount: 10,
    bets: [],
    raceNumber: 0,
    raceSeed,
    lastResult: null,
  };
}

export function createHorseRaceSeed(): number {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1_000_000);
}

export function setHorseBetAmount(state: HorseRaceState, amount: number): HorseRaceState {
  return {
    ...state,
    betAmount: clamp(Math.round(amount), MIN_HORSE_BET, MAX_HORSE_BET),
  };
}

export function selectHorseBet(
  state: HorseRaceState,
  kind: HorseBetKind,
  first: HorseId,
  second?: HorseId,
): HorseRaceState {
  return {
    ...state,
    selectedKind: kind,
    selectedFirst: first,
    selectedSecond: kind === "exacta" ? second : undefined,
  };
}

export function placeHorseBet(state: HorseRaceState): HorseRaceState {
  if (
    state.phase === "racing" ||
    (state.selectedKind === "exacta" && (!state.selectedSecond || state.selectedFirst === state.selectedSecond)) ||
    state.betAmount > state.chips
  ) {
    return state;
  }

  const odds =
    state.selectedKind === "winner"
      ? getWinnerOdds(state.selectedFirst, state.raceNumber, state.raceSeed)
      : getExactaOdds(state.selectedFirst, state.selectedSecond as HorseId, state.raceNumber, state.raceSeed);
  const id = `${state.raceNumber}-${state.selectedKind}-${state.selectedFirst}-${state.selectedSecond ?? "win"}-${state.bets.length}`;

  return {
    ...state,
    chips: state.chips - state.betAmount,
    phase: "betting",
    lastResult: state.phase === "result" ? null : state.lastResult,
    bets: [
      ...state.bets,
      {
        id,
        kind: state.selectedKind,
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

export function settleHorseRace(bets: HorseBet[], finishOrder: HorseId[]): HorseRaceResult {
  const [first, second] = finishOrder;
  const winningBets = bets.filter((bet) =>
    bet.kind === "winner" ? bet.first === first : bet.first === first && bet.second === second,
  );
  const totalReturn = winningBets.reduce((sum, bet) => sum + bet.amount * bet.odds, 0);
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);

  return {
    finishOrder,
    winningBetIds: winningBets.map((bet) => bet.id),
    totalReturn,
    net: totalReturn - totalBet,
  };
}

export function createRacePlan(raceNumber: number, raceSeed = 0): RacePlanEntry[] {
  const scored = horses.map((horse, index) => {
    const variance = seededNoise(raceNumber, horse.id, raceSeed) * 104;
    const tripChaos = seededNoise(raceNumber + horse.id * 13, horse.id + 7, raceSeed) * 34;
    const fatigue = ((raceNumber + horse.id * 3) % 5) * 4.2;
    const score = horse.rating * 0.16 + variance + tripChaos - fatigue;

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
      finishTimeMs: 22600 + rank * 920 + seededNoise(raceNumber + 11, horse.id, raceSeed) * 1350,
      surge: seededNoise(raceNumber + 23, horse.id, raceSeed),
    };
  });
}

export function getFinishOrder(plan: RacePlanEntry[]): HorseId[] {
  return [...plan].sort((a, b) => a.finishTimeMs - b.finishTimeMs).map((entry) => entry.horseId);
}

export function getExactaOdds(first: HorseId, second: HorseId, raceNumber: number, raceSeed = 0): number {
  if (first === second) {
    return 0;
  }

  const firstHorse = getHorse(first);
  const secondHorse = getHorse(second);
  const favoritePressure = (firstHorse.rating + secondHorse.rating) / 2;
  const longshotBonus = Math.max(0, 92 - favoritePressure) / 2.2;
  const boardWobble = Math.floor(seededNoise(raceNumber + first * 5, second, raceSeed) * 8);

  return clamp(Math.round(9 + longshotBonus + boardWobble + Math.abs(first - second) * 1.1), 8, 45);
}

export function getWinnerOdds(horseId: HorseId, raceNumber: number, raceSeed = 0): number {
  const horse = getHorse(horseId);
  const longshotBonus = Math.max(0, 94 - horse.rating) / 7.5;
  const boardWobble = Math.floor(seededNoise(raceNumber + 19, horseId, raceSeed) * 4);

  return clamp(Math.round(4 + longshotBonus + boardWobble), 3, 12);
}

export function getBettingBoard(raceNumber: number, raceSeed = 0): HorseBet[] {
  const board: HorseBet[] = horses.map((horse) => ({
    id: `board-winner-${horse.id}`,
    kind: "winner",
    first: horse.id,
    amount: 0,
    odds: getWinnerOdds(horse.id, raceNumber, raceSeed),
  }));

  horses.forEach((first) => {
    horses.forEach((second) => {
      if (first.id === second.id) {
        return;
      }

      board.push({
        id: `board-exacta-${first.id}-${second.id}`,
        kind: "exacta",
        first: first.id,
        second: second.id,
        amount: 0,
        odds: getExactaOdds(first.id, second.id, raceNumber, raceSeed),
      });
    });
  });

  return board;
}

export function getOddsBoard(raceNumber: number, raceSeed = 0): HorseBet[] {
  return getBettingBoard(raceNumber, raceSeed);
}

export function getHorse(id: HorseId): HorseDefinition {
  const horse = horses.find((entry) => entry.id === id);

  if (!horse) {
    throw new Error(`Unknown horse ${id}`);
  }

  return horse;
}

function seededNoise(raceNumber: number, horseId: number, raceSeed: number): number {
  const raw = Math.sin((raceNumber + 1) * 127.1 + horseId * 311.7 + raceSeed * 0.0137) * 43758.5453;
  return raw - Math.floor(raw);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
