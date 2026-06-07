import type {
  BlackjackState,
  Card,
  Hand,
  Rank,
  RoundResolution,
  Suit,
} from "./blackjackTypes";

export const STARTING_CHIPS = 1000;
export const MIN_BET = 1;
export const MAX_BET = 100;

const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
}

export function shuffleDeck(deck: Card[], random = Math.random): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildShoe(random = Math.random): Card[] {
  return shuffleDeck(createDeck(), random);
}

export function drawCard(deck: Card[]): { card: Card; deck: Card[] } {
  const [card, ...remainingDeck] = deck;

  if (!card) {
    throw new Error("Cannot draw from an empty deck.");
  }

  return { card, deck: remainingDeck };
}

export function dealFromDeck(deck: Card[], count: number): { cards: Card[]; deck: Card[] } {
  let nextDeck = deck;
  const cards: Card[] = [];

  for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
    const draw = drawCard(nextDeck);
    cards.push(draw.card);
    nextDeck = draw.deck;
  }

  return { cards, deck: nextDeck };
}

export function cardValue(card: Card): number {
  if (card.rank === "A") {
    return 11;
  }

  if (["K", "Q", "J"].includes(card.rank)) {
    return 10;
  }

  return Number(card.rank);
}

export function scoreHand(hand: Hand): { total: number; isSoft: boolean } {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let acesAsEleven = hand.filter((card) => card.rank === "A").length;

  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven -= 1;
  }

  return {
    total,
    isSoft: acesAsEleven > 0,
  };
}

export function isBlackjack(hand: Hand): boolean {
  return hand.length === 2 && scoreHand(hand).total === 21;
}

export function isBust(hand: Hand): boolean {
  return scoreHand(hand).total > 21;
}

export function clampBet(value: number, chips: number): number {
  const maxAvailableBet = Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(chips)));
  const wholeValue = Math.trunc(Number.isFinite(value) ? value : MIN_BET);
  return Math.min(Math.max(wholeValue, MIN_BET), maxAvailableBet);
}

export function createInitialState(random = Math.random): BlackjackState {
  return {
    deck: buildShoe(random),
    playerHand: [],
    dealerHand: [],
    phase: "betting",
    chips: STARTING_CHIPS,
    currentBet: 0,
    pendingBet: 25,
    outcome: null,
    message: "Set your wager and deal the first hand.",
    revealDealerHoleCard: false,
    lastPayout: 0,
  };
}

export function startRound(state: BlackjackState, random = Math.random): BlackjackState {
  if (state.phase !== "betting" && state.phase !== "roundOver") {
    return state;
  }

  if (state.chips < MIN_BET) {
    return {
      ...state,
      message: "You need at least 1 chip to start a hand.",
    };
  }

  const wager = clampBet(state.pendingBet, state.chips);
  const preparedDeck = state.deck.length < 26 ? buildShoe(random) : state.deck;
  let deck = preparedDeck;
  const playerHand: Hand = [];
  const dealerHand: Hand = [];

  for (let dealIndex = 0; dealIndex < 2; dealIndex += 1) {
    const playerDraw = drawCard(deck);
    playerHand.push(playerDraw.card);
    deck = playerDraw.deck;

    const dealerDraw = drawCard(deck);
    dealerHand.push(dealerDraw.card);
    deck = dealerDraw.deck;
  }

  const baseState: BlackjackState = {
    ...state,
    deck,
    playerHand,
    dealerHand,
    phase: "playerTurn",
    chips: state.chips - wager,
    currentBet: wager,
    pendingBet: wager,
    outcome: null,
    revealDealerHoleCard: false,
    lastPayout: 0,
    message: "Choose hit or stand.",
  };

  const playerHasBlackjack = isBlackjack(playerHand);
  const dealerHasBlackjack = isBlackjack(dealerHand);

  if (playerHasBlackjack || dealerHasBlackjack) {
    return finishRound(baseState, resolveRound(playerHand, dealerHand, wager));
  }

  return baseState;
}

export function playerHit(state: BlackjackState): BlackjackState {
  if (state.phase !== "playerTurn") {
    return state;
  }

  const draw = drawCard(state.deck);
  const playerHand = [...state.playerHand, draw.card];

  if (isBust(playerHand)) {
    return finishRound(
      {
        ...state,
        deck: draw.deck,
        playerHand,
      },
      {
        outcome: "dealerWin",
        payout: 0,
        message: "Bust. The wager stays with the house.",
      },
    );
  }

  return {
    ...state,
    deck: draw.deck,
    playerHand,
    message: scoreHand(playerHand).total === 21 ? "Twenty-one. Stand to finish it." : "Hit or stand.",
  };
}

export function playerStand(state: BlackjackState): BlackjackState {
  if (state.phase !== "playerTurn") {
    return state;
  }

  const dealerResult = playDealerTurn(state.deck, state.dealerHand);
  const resolution = resolveRound(state.playerHand, dealerResult.dealerHand, state.currentBet);

  return finishRound(
    {
      ...state,
      deck: dealerResult.deck,
      dealerHand: dealerResult.dealerHand,
      phase: "dealerTurn",
    },
    resolution,
  );
}

export function resetGame(random = Math.random): BlackjackState {
  return createInitialState(random);
}

export function playDealerTurn(deck: Card[], dealerHand: Hand): { deck: Card[]; dealerHand: Hand } {
  let nextDeck = deck;
  let nextDealerHand = [...dealerHand];

  while (shouldDealerHit(nextDealerHand)) {
    const draw = drawCard(nextDeck);
    nextDealerHand = [...nextDealerHand, draw.card];
    nextDeck = draw.deck;
  }

  return {
    deck: nextDeck,
    dealerHand: nextDealerHand,
  };
}

export function shouldDealerHit(hand: Hand): boolean {
  const score = scoreHand(hand);
  return score.total < 17;
}

export function resolveRound(playerHand: Hand, dealerHand: Hand, wager: number): RoundResolution {
  const playerScore = scoreHand(playerHand).total;
  const dealerScore = scoreHand(dealerHand).total;
  const playerNatural = isBlackjack(playerHand);
  const dealerNatural = isBlackjack(dealerHand);

  if (playerNatural && dealerNatural) {
    return {
      outcome: "push",
      payout: wager,
      message: "Both hands have blackjack. Push.",
    };
  }

  if (playerNatural) {
    return {
      outcome: "playerBlackjack",
      payout: wager * 2.5,
      message: "Blackjack pays 3:2.",
    };
  }

  if (dealerNatural) {
    return {
      outcome: "dealerWin",
      payout: 0,
      message: "Dealer blackjack. The wager stays with the house.",
    };
  }

  if (playerScore > 21) {
    return {
      outcome: "dealerWin",
      payout: 0,
      message: "Bust. The wager stays with the house.",
    };
  }

  if (dealerScore > 21) {
    return {
      outcome: "playerWin",
      payout: wager * 2,
      message: "Dealer busts. You win even money.",
    };
  }

  if (playerScore > dealerScore) {
    return {
      outcome: "playerWin",
      payout: wager * 2,
      message: "Your hand beats the dealer.",
    };
  }

  if (dealerScore > playerScore) {
    return {
      outcome: "dealerWin",
      payout: 0,
      message: "Dealer wins the hand.",
    };
  }

  return {
    outcome: "push",
    payout: wager,
    message: "Push. Your wager returns.",
  };
}

export function finishRound(state: BlackjackState, resolution: RoundResolution): BlackjackState {
  return {
    ...state,
    phase: "roundOver",
    chips: state.chips + resolution.payout,
    outcome: resolution.outcome,
    message: resolution.message,
    revealDealerHoleCard: true,
    lastPayout: resolution.payout,
  };
}
