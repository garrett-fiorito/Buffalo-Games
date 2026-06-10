import type {
  RouletteBet,
  RouletteBetKind,
  RoulettePocket,
  RoulettePocketValue,
  RouletteSpinResult,
  RouletteState,
} from "./rouletteTypes";

export const STARTING_ROULETTE_CHIPS = 1000;
export const CHIP_VALUES = [5, 10, 25, 50, 100] as const;

export const americanWheelSequence: RoulettePocketValue[] = [
  "0",
  "28",
  "9",
  "26",
  "30",
  "11",
  "7",
  "20",
  "32",
  "17",
  "5",
  "22",
  "34",
  "15",
  "3",
  "24",
  "36",
  "13",
  "1",
  "00",
  "27",
  "10",
  "25",
  "29",
  "12",
  "8",
  "19",
  "31",
  "18",
  "6",
  "21",
  "33",
  "16",
  "4",
  "23",
  "35",
  "14",
  "2",
];

const redNumbers = new Set([
  "1",
  "3",
  "5",
  "7",
  "9",
  "12",
  "14",
  "16",
  "18",
  "19",
  "21",
  "23",
  "25",
  "27",
  "30",
  "32",
  "34",
  "36",
]);

export const rouletteWheel: RoulettePocket[] = americanWheelSequence.map((value) => ({
  value,
  color: getPocketColor(value),
}));

export function createInitialRouletteState(): RouletteState {
  return {
    chips: STARTING_ROULETTE_CHIPS,
    phase: "betting",
    selectedChip: 25,
    bets: [],
    lastResult: null,
    history: [],
    spinIndex: 0,
  };
}

export function getPocketColor(value: RoulettePocketValue) {
  if (value === "0" || value === "00") {
    return "green";
  }

  return redNumbers.has(value) ? "red" : "black";
}

export function placeBet(
  state: RouletteState,
  kind: RouletteBetKind,
  label: string,
  number?: RoulettePocketValue,
): RouletteState {
  if (state.phase === "spinning" || state.chips < state.selectedChip) {
    return state;
  }

  const id = getBetId(kind, number);
  const existingBet = state.bets.find((bet) => bet.id === id);
  const nextBets = existingBet
    ? state.bets.map((bet) =>
        bet.id === id ? { ...bet, amount: bet.amount + state.selectedChip } : bet,
      )
    : [
        ...state.bets,
        {
          id,
          kind,
          label,
          amount: state.selectedChip,
          number,
        },
      ];

  return {
    ...state,
    chips: state.chips - state.selectedChip,
    bets: nextBets,
    lastResult: state.phase === "result" ? null : state.lastResult,
    phase: "betting",
  };
}

export function clearBets(state: RouletteState): RouletteState {
  if (state.phase === "spinning") {
    return state;
  }

  return {
    ...state,
    chips: state.chips + getTotalBet(state.bets),
    bets: [],
  };
}

export function setSelectedChip(state: RouletteState, selectedChip: number): RouletteState {
  if (!CHIP_VALUES.includes(selectedChip as (typeof CHIP_VALUES)[number])) {
    return state;
  }

  return {
    ...state,
    selectedChip,
  };
}

export function beginSpin(state: RouletteState): RouletteState {
  if (state.phase === "spinning" || state.bets.length === 0) {
    return state;
  }

  return {
    ...state,
    phase: "spinning",
    lastResult: null,
  };
}

export function finishSpin(state: RouletteState, pocket: RoulettePocket): RouletteState {
  const result = settleBets(state.bets, pocket);

  return {
    ...state,
    phase: "result",
    chips: state.chips + result.totalReturn,
    bets: [],
    lastResult: result,
    history: [pocket, ...state.history].slice(0, 10),
    spinIndex: state.spinIndex + 1,
  };
}

export function settleBets(
  bets: RouletteBet[],
  pocket: RoulettePocket,
): RouletteSpinResult {
  const winningBets = bets.filter((bet) => isWinningBet(bet, pocket));
  const totalReturn = winningBets.reduce(
    (sum, bet) => sum + bet.amount * (getPayoutMultiplier(bet.kind) + 1),
    0,
  );
  const totalBet = getTotalBet(bets);

  return {
    pocket,
    totalReturn,
    net: totalReturn - totalBet,
    winningBets,
  };
}

export function isWinningBet(bet: RouletteBet, pocket: RoulettePocket): boolean {
  const numericValue = getNumericPocketValue(pocket.value);

  switch (bet.kind) {
    case "straight":
      return bet.number === pocket.value;
    case "red":
    case "black":
      return pocket.color === bet.kind;
    case "odd":
      return numericValue !== null && numericValue % 2 === 1;
    case "even":
      return numericValue !== null && numericValue % 2 === 0;
    case "low":
      return numericValue !== null && numericValue >= 1 && numericValue <= 18;
    case "high":
      return numericValue !== null && numericValue >= 19 && numericValue <= 36;
    case "dozen1":
      return numericValue !== null && numericValue >= 1 && numericValue <= 12;
    case "dozen2":
      return numericValue !== null && numericValue >= 13 && numericValue <= 24;
    case "dozen3":
      return numericValue !== null && numericValue >= 25 && numericValue <= 36;
    case "column1":
      return numericValue !== null && numericValue % 3 === 1;
    case "column2":
      return numericValue !== null && numericValue % 3 === 2;
    case "column3":
      return numericValue !== null && numericValue % 3 === 0;
    default:
      return false;
  }
}

export function getPayoutMultiplier(kind: RouletteBetKind): number {
  if (kind === "straight") {
    return 35;
  }

  if (kind.startsWith("dozen") || kind.startsWith("column")) {
    return 2;
  }

  return 1;
}

export function getTotalBet(bets: RouletteBet[]): number {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

export function getNumericPocketValue(value: RoulettePocketValue): number | null {
  if (value === "0" || value === "00") {
    return null;
  }

  return Number(value);
}

export function getBetId(kind: RouletteBetKind, number?: RoulettePocketValue): string {
  return kind === "straight" ? `straight-${number}` : kind;
}
