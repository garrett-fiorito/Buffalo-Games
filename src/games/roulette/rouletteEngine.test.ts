import { describe, expect, it } from "vitest";
import {
  STARTING_ROULETTE_CHIPS,
  americanWheelSequence,
  beginSpin,
  clearBets,
  createInitialRouletteState,
  finishSpin,
  getGoldenBallCandidates,
  getGoldenBallPocket,
  getPocketColor,
  getTotalBet,
  placeBet,
  rouletteWheel,
  settleBets,
} from "./rouletteEngine";
import type { RouletteBet, RoulettePocket } from "./rouletteTypes";

describe("rouletteEngine", () => {
  it("uses the complete American double-zero wheel sequence", () => {
    expect(americanWheelSequence).toHaveLength(38);
    expect(new Set(americanWheelSequence).size).toBe(38);
    expect(americanWheelSequence.slice(0, 6)).toEqual(["0", "28", "9", "26", "30", "11"]);
    expect(americanWheelSequence[19]).toBe("00");
  });

  it("maps pocket colors correctly", () => {
    expect(getPocketColor("0")).toBe("green");
    expect(getPocketColor("00")).toBe("green");
    expect(getPocketColor("1")).toBe("red");
    expect(getPocketColor("2")).toBe("black");
    expect(rouletteWheel.filter((pocket) => pocket.color === "red")).toHaveLength(18);
    expect(rouletteWheel.filter((pocket) => pocket.color === "black")).toHaveLength(18);
  });

  it("subtracts chips when placing and combines matching bets", () => {
    const initial = createInitialRouletteState();
    const once = placeBet(initial, "red", "Red");
    const twice = placeBet(once, "red", "Red");

    expect(twice.chips).toBe(STARTING_ROULETTE_CHIPS - 50);
    expect(twice.bets).toHaveLength(1);
    expect(twice.bets[0].amount).toBe(50);
  });

  it("does not allow a bet above the chip balance", () => {
    const state = {
      ...createInitialRouletteState(),
      chips: 4,
    };

    expect(placeBet(state, "red", "Red")).toBe(state);
  });

  it("refunds clearable bets", () => {
    const withBet = placeBet(createInitialRouletteState(), "black", "Black");
    const cleared = clearBets(withBet);

    expect(cleared.chips).toBe(STARTING_ROULETTE_CHIPS);
    expect(cleared.bets).toHaveLength(0);
  });

  it("settles straight-up bets at 35:1 plus stake return", () => {
    const bets: RouletteBet[] = [
      { id: "straight-17", kind: "straight", label: "17", amount: 10, number: "17" },
    ];
    const pocket: RoulettePocket = { value: "17", color: "black" };

    expect(settleBets(bets, pocket).totalReturn).toBe(360);
  });

  it("settles golden straight-up hits at 50:1 plus stake return", () => {
    const goldenPocket = getGoldenBallPocket(0);
    const bets: RouletteBet[] = [
      {
        id: `straight-${goldenPocket.value}`,
        kind: "straight",
        label: goldenPocket.value,
        amount: 10,
        number: goldenPocket.value,
      },
    ];
    const result = settleBets(bets, goldenPocket, goldenPocket);

    expect(getGoldenBallCandidates(0)).toContainEqual(goldenPocket);
    expect(result.goldenHit).toBe(true);
    expect(result.totalReturn).toBe(510);
  });

  it("settles outside, dozen, and column bets with correct returns", () => {
    const pocket: RoulettePocket = { value: "23", color: "red" };
    const bets: RouletteBet[] = [
      { id: "red", kind: "red", label: "Red", amount: 20 },
      { id: "high", kind: "high", label: "19-36", amount: 20 },
      { id: "dozen2", kind: "dozen2", label: "13-24", amount: 20 },
      { id: "column2", kind: "column2", label: "Column 2", amount: 20 },
      { id: "even", kind: "even", label: "Even", amount: 20 },
    ];
    const result = settleBets(bets, pocket);

    expect(result.totalReturn).toBe(40 + 40 + 60 + 60);
    expect(result.net).toBe(100);
    expect(result.winningBets.map((bet) => bet.kind)).toEqual([
      "red",
      "high",
      "dozen2",
      "column2",
    ]);
  });

  it("finishes a spin, pays winnings, clears bets, and records history", () => {
    const betting = placeBet(createInitialRouletteState(), "red", "Red");
    const spinning = beginSpin(betting);
    const finished = finishSpin(spinning, { value: "1", color: "red" });

    expect(finished.phase).toBe("result");
    expect(finished.chips).toBe(STARTING_ROULETTE_CHIPS + 25);
    expect(finished.bets).toHaveLength(0);
    expect(finished.history[0].value).toBe("1");
  });

  it("totals active bets", () => {
    expect(
      getTotalBet([
        { id: "red", kind: "red", label: "Red", amount: 10 },
        { id: "black", kind: "black", label: "Black", amount: 15 },
      ]),
    ).toBe(25);
  });
});
