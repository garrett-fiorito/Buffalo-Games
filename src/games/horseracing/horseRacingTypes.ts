export type HorseRacePhase = "betting" | "racing" | "result";

export type HorseId = 1 | 2 | 3 | 4 | 5 | 6;

export type HorseDefinition = {
  id: HorseId;
  name: string;
  color: string;
  rating: number;
};

export type ExactaBet = {
  id: string;
  first: HorseId;
  second: HorseId;
  amount: number;
  odds: number;
};

export type RacePlanEntry = {
  horseId: HorseId;
  finishTimeMs: number;
  lane: number;
  surge: number;
};

export type HorseRaceResult = {
  finishOrder: HorseId[];
  winningBetIds: string[];
  totalReturn: number;
  net: number;
};

export type HorseRaceState = {
  chips: number;
  phase: HorseRacePhase;
  selectedFirst: HorseId;
  selectedSecond: HorseId;
  betAmount: number;
  bets: ExactaBet[];
  raceNumber: number;
  lastResult: HorseRaceResult | null;
};
