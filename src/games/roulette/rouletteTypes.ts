export type RoulettePocketValue =
  | "0"
  | "00"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "30"
  | "31"
  | "32"
  | "33"
  | "34"
  | "35"
  | "36";

export type RouletteColor = "green" | "red" | "black";

export type RoulettePocket = {
  value: RoulettePocketValue;
  color: RouletteColor;
};

export type RouletteBetKind =
  | "straight"
  | "split"
  | "corner"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "row1"
  | "row2"
  | "row3"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "column1"
  | "column2"
  | "column3";

export type RouletteBet = {
  id: string;
  kind: RouletteBetKind;
  label: string;
  amount: number;
  number?: RoulettePocketValue;
  numbers?: RoulettePocketValue[];
};

export type RoulettePhase = "betting" | "spinning" | "result";

export type RouletteSpinResult = {
  pocket: RoulettePocket;
  totalReturn: number;
  net: number;
  winningBets: RouletteBet[];
  goldenPocket?: RoulettePocket;
  goldenHit: boolean;
};

export type RouletteState = {
  chips: number;
  phase: RoulettePhase;
  selectedChip: number;
  bets: RouletteBet[];
  lastResult: RouletteSpinResult | null;
  history: RoulettePocket[];
  spinIndex: number;
};
