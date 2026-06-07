import { describe, expect, it } from "vitest";
import {
  clampBet,
  createInitialState,
  isBlackjack,
  playDealerTurn,
  playerHit,
  playerStand,
  resolveRound,
  scoreHand,
  startRound,
} from "./blackjackEngine";
import type { Card } from "./blackjackTypes";

const card = (rank: Card["rank"], suit: Card["suit"] = "spades"): Card => ({ rank, suit });
const fillerDeck = (count: number): Card[] =>
  Array.from({ length: count }, (_, index) => card(String((index % 9) + 2) as Card["rank"], "clubs"));

describe("blackjack engine", () => {
  it("scores aces as soft or hard without busting", () => {
    expect(scoreHand([card("A"), card("7")])).toEqual({ total: 18, isSoft: true });
    expect(scoreHand([card("A"), card("7"), card("9")])).toEqual({ total: 17, isSoft: false });
    expect(scoreHand([card("A"), card("A"), card("9")])).toEqual({ total: 21, isSoft: true });
  });

  it("recognizes only two-card 21 as blackjack", () => {
    expect(isBlackjack([card("A"), card("K")])).toBe(true);
    expect(isBlackjack([card("A"), card("9"), card("A")])).toBe(false);
  });

  it("clamps bet size from 1 to 100 and no higher than chips", () => {
    expect(clampBet(0, 1000)).toBe(1);
    expect(clampBet(101, 1000)).toBe(100);
    expect(clampBet(90, 35)).toBe(35);
    expect(clampBet(Number.NaN, 1000)).toBe(1);
  });

  it("subtracts the wager when a round starts", () => {
    const state = {
      ...createInitialState(),
      deck: [
        card("10"),
        card("9"),
        card("7"),
        card("6"),
        ...fillerDeck(30),
      ],
      pendingBet: 75,
    };

    const next = startRound(state);

    expect(next.chips).toBe(925);
    expect(next.currentBet).toBe(75);
    expect(next.playerHand).toEqual([card("10"), card("7")]);
    expect(next.dealerHand).toEqual([card("9"), card("6")]);
  });

  it("pays 3:2 for player blackjack", () => {
    const resolution = resolveRound([card("A"), card("K")], [card("9"), card("7")], 100);

    expect(resolution.outcome).toBe("playerBlackjack");
    expect(resolution.payout).toBe(250);
  });

  it("keeps exact 3:2 blackjack payout on odd chip wagers", () => {
    const resolution = resolveRound([card("A"), card("K")], [card("9"), card("7")], 25);

    expect(resolution.payout).toBe(62.5);
  });

  it("returns only the wager on a push", () => {
    const resolution = resolveRound([card("10"), card("8")], [card("9"), card("9")], 40);

    expect(resolution.outcome).toBe("push");
    expect(resolution.payout).toBe(40);
  });

  it("pays even money for a normal player win", () => {
    const resolution = resolveRound([card("10"), card("9")], [card("10"), card("7")], 25);

    expect(resolution.outcome).toBe("playerWin");
    expect(resolution.payout).toBe(50);
  });

  it("pays nothing when the player loses", () => {
    const resolution = resolveRound([card("10"), card("6")], [card("10"), card("8")], 25);

    expect(resolution.outcome).toBe("dealerWin");
    expect(resolution.payout).toBe(0);
  });

  it("dealer stands on soft 17", () => {
    const result = playDealerTurn([card("5")], [card("A"), card("6")]);

    expect(result.dealerHand).toEqual([card("A"), card("6")]);
  });

  it("hit bust ends the round and keeps lost wager out of chips", () => {
    const state = {
      ...createInitialState(),
      deck: [card("9")],
      playerHand: [card("10"), card("8")],
      dealerHand: [card("7"), card("10")],
      phase: "playerTurn" as const,
      chips: 900,
      currentBet: 100,
    };

    const next = playerHit(state);

    expect(next.phase).toBe("roundOver");
    expect(next.outcome).toBe("dealerWin");
    expect(next.chips).toBe(900);
  });

  it("standing resolves the dealer turn and credits winnings", () => {
    const state = {
      ...createInitialState(),
      deck: [card("9")],
      playerHand: [card("10"), card("9")],
      dealerHand: [card("10"), card("6")],
      phase: "playerTurn" as const,
      chips: 950,
      currentBet: 50,
    };

    const next = playerStand(state);

    expect(next.phase).toBe("roundOver");
    expect(next.outcome).toBe("playerWin");
    expect(next.chips).toBe(1050);
    expect(next.dealerHand).toEqual([card("10"), card("6"), card("9")]);
  });
});
