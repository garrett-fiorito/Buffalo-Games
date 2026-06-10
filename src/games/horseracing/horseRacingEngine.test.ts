import { describe, expect, it } from "vitest";
import {
  MAX_HORSE_BET,
  MIN_HORSE_BET,
  STARTING_HORSE_CHIPS,
  beginHorseRace,
  clearHorseBets,
  createInitialHorseRaceState,
  createRacePlan,
  finishHorseRace,
  getExactaOdds,
  getFinishOrder,
  getOddsBoard,
  horses,
  placeExactaBet,
  selectExactaHorse,
  setHorseBetAmount,
  settleHorseRace,
} from "./horseRacingEngine";
import type { ExactaBet } from "./horseRacingTypes";

describe("horseRacingEngine", () => {
  it("starts with six table horses and a chip bankroll", () => {
    const state = createInitialHorseRaceState();

    expect(horses).toHaveLength(6);
    expect(state.chips).toBe(STARTING_HORSE_CHIPS);
    expect(state.phase).toBe("betting");
  });

  it("keeps bet amounts inside table limits", () => {
    expect(setHorseBetAmount(createInitialHorseRaceState(), 1).betAmount).toBe(MIN_HORSE_BET);
    expect(setHorseBetAmount(createInitialHorseRaceState(), 999).betAmount).toBe(MAX_HORSE_BET);
  });

  it("prevents the same horse from being selected first and second", () => {
    const selected = selectExactaHorse(createInitialHorseRaceState(), "first", 2);

    expect(selected.selectedFirst).toBe(2);
    expect(selected.selectedSecond).not.toBe(2);
  });

  it("places and clears exacta tickets", () => {
    const withBet = placeExactaBet(createInitialHorseRaceState());

    expect(withBet.bets).toHaveLength(1);
    expect(withBet.chips).toBe(STARTING_HORSE_CHIPS - 10);
    expect(clearHorseBets(withBet).chips).toBe(STARTING_HORSE_CHIPS);
  });

  it("generates a complete deterministic race plan", () => {
    const plan = createRacePlan(0);

    expect(plan).toHaveLength(6);
    expect(new Set(plan.map((entry) => entry.horseId)).size).toBe(6);
    expect(getFinishOrder(plan)).toHaveLength(6);
    expect(createRacePlan(0)).toEqual(plan);
  });

  it("settles winning exacta bets by odds", () => {
    const bets: ExactaBet[] = [
      { id: "winner", first: 3, second: 5, amount: 10, odds: 14 },
      { id: "loser", first: 5, second: 3, amount: 10, odds: 14 },
    ];
    const result = settleHorseRace(bets, [3, 5, 1, 2, 4, 6]);

    expect(result.winningBetIds).toEqual(["winner"]);
    expect(result.totalReturn).toBe(140);
    expect(result.net).toBe(120);
  });

  it("finishes a race, pays tickets, clears bets, and advances the race number", () => {
    const betting = placeExactaBet(createInitialHorseRaceState());
    const racing = beginHorseRace(betting);
    const finished = finishHorseRace(racing, [1, 2, 3, 4, 5, 6]);

    expect(finished.phase).toBe("result");
    expect(finished.bets).toHaveLength(0);
    expect(finished.raceNumber).toBe(1);
    expect(finished.lastResult?.finishOrder.slice(0, 2)).toEqual([1, 2]);
  });

  it("creates a compact odds board with valid exacta prices", () => {
    const board = getOddsBoard(2);

    expect(board).toHaveLength(10);
    expect(board.every((bet) => bet.first !== bet.second)).toBe(true);
    expect(board.every((bet) => bet.odds === getExactaOdds(bet.first, bet.second, 2))).toBe(true);
  });
});
