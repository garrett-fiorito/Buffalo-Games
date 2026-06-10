import { describe, expect, it } from "vitest";
import {
  MAX_HORSE_BET,
  MIN_HORSE_BET,
  RACE_DURATION_MS,
  STARTING_HORSE_CHIPS,
  beginHorseRace,
  clearHorseBets,
  createInitialHorseRaceState,
  createRacePlan,
  finishHorseRace,
  getBettingBoard,
  getExactaOdds,
  getFinishOrder,
  getWinnerOdds,
  horses,
  placeHorseBet,
  selectHorseBet,
  setHorseBetAmount,
  settleHorseRace,
} from "./horseRacingEngine";
import type { HorseBet } from "./horseRacingTypes";

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

  it("selects winner and exacta bets from the board", () => {
    const winner = selectHorseBet(createInitialHorseRaceState(), "winner", 4);
    const exacta = selectHorseBet(winner, "exacta", 2, 6);

    expect(winner.selectedKind).toBe("winner");
    expect(winner.selectedFirst).toBe(4);
    expect(winner.selectedSecond).toBeUndefined();
    expect(exacta.selectedKind).toBe("exacta");
    expect(exacta.selectedFirst).toBe(2);
    expect(exacta.selectedSecond).toBe(6);
  });

  it("places and clears winner tickets", () => {
    const withBet = placeHorseBet(createInitialHorseRaceState());

    expect(withBet.bets).toHaveLength(1);
    expect(withBet.bets[0].kind).toBe("winner");
    expect(withBet.chips).toBe(STARTING_HORSE_CHIPS - 10);
    expect(clearHorseBets(withBet).chips).toBe(STARTING_HORSE_CHIPS);
  });

  it("places exacta tickets from the board selection", () => {
    const exacta = selectHorseBet(createInitialHorseRaceState(), "exacta", 3, 5);
    const withBet = placeHorseBet(exacta);

    expect(withBet.bets[0].kind).toBe("exacta");
    expect(withBet.bets[0].first).toBe(3);
    expect(withBet.bets[0].second).toBe(5);
  });

  it("generates a complete deterministic race plan", () => {
    const plan = createRacePlan(0);

    expect(plan).toHaveLength(6);
    expect(new Set(plan.map((entry) => entry.horseId)).size).toBe(6);
    expect(getFinishOrder(plan)).toHaveLength(6);
    expect(createRacePlan(0)).toEqual(plan);
    expect(RACE_DURATION_MS).toBe(31000);
    expect(Math.max(...plan.map((entry) => entry.finishTimeMs))).toBeGreaterThan(24000);
  });

  it("settles winning exacta and winner bets by odds", () => {
    const bets: HorseBet[] = [
      { id: "winner-pick", kind: "winner", first: 3, amount: 10, odds: 5 },
      { id: "exacta-winner", kind: "exacta", first: 3, second: 5, amount: 10, odds: 14 },
      { id: "loser", kind: "exacta", first: 5, second: 3, amount: 10, odds: 14 },
    ];
    const result = settleHorseRace(bets, [3, 5, 1, 2, 4, 6]);

    expect(result.winningBetIds).toEqual(["winner-pick", "exacta-winner"]);
    expect(result.totalReturn).toBe(190);
    expect(result.net).toBe(160);
  });

  it("finishes a race, pays tickets, clears bets, and advances the race number", () => {
    const betting = placeHorseBet(createInitialHorseRaceState());
    const racing = beginHorseRace(betting);
    const finished = finishHorseRace(racing, [1, 2, 3, 4, 5, 6]);

    expect(finished.phase).toBe("result");
    expect(finished.bets).toHaveLength(0);
    expect(finished.raceNumber).toBe(1);
    expect(finished.lastResult?.finishOrder.slice(0, 2)).toEqual([1, 2]);
  });

  it("creates a full betting board with winner and exacta prices", () => {
    const board = getBettingBoard(2);

    expect(board).toHaveLength(36);
    expect(board.filter((bet) => bet.kind === "winner")).toHaveLength(6);
    expect(board.filter((bet) => bet.kind === "exacta")).toHaveLength(30);
    expect(
      board.every((bet) =>
        bet.kind === "winner"
          ? bet.odds === getWinnerOdds(bet.first, 2)
          : bet.first !== bet.second && bet.odds === getExactaOdds(bet.first, bet.second!, 2),
      ),
    ).toBe(true);
  });
});
