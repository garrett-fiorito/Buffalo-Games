export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type Hand = Card[];

export type Phase = "betting" | "playerTurn" | "dealerTurn" | "roundOver";

export type Outcome = "playerBlackjack" | "playerWin" | "dealerWin" | "push" | null;

export type BlackjackState = {
  deck: Card[];
  playerHand: Hand;
  dealerHand: Hand;
  phase: Phase;
  chips: number;
  currentBet: number;
  pendingBet: number;
  outcome: Outcome;
  message: string;
  revealDealerHoleCard: boolean;
  lastPayout: number;
};

export type RoundResolution = {
  outcome: Exclude<Outcome, null>;
  payout: number;
  message: string;
};
