import { describe, expect, it } from "vitest";
import {
  BALL_RADIUS,
  FOOT_SPOT,
  createInitialAssignments,
  createPracticeRack,
  evaluateShot,
  findContainingPocket,
  getBallKind,
  getGroupLabel,
  getOpponent,
  getPracticeSummary,
  getRulesSummary,
  isVelocityStopped,
} from "./billiardsEngine";
import type { PocketedBall } from "./billiardsTypes";

describe("billiards setup", () => {
  it("creates a cue ball plus a complete 15-ball rack", () => {
    const rack = createPracticeRack();

    expect(rack).toHaveLength(16);
    expect(rack[0]).toMatchObject({ id: "cue", kind: "cue", number: null });
    expect(new Set(rack.map((ball) => ball.id)).size).toBe(16);
  });

  it("places the 8 ball in the middle of the rack", () => {
    const rack = createPracticeRack();
    const eight = rack.find((ball) => ball.number === 8);

    expect(eight?.position.x).toBeGreaterThan(FOOT_SPOT.x);
    expect(eight?.position.y).toBeCloseTo(FOOT_SPOT.y, 5);
  });

  it("adds a subtle deterministic looseness to the rack for livelier breaks", () => {
    const rack = createPracticeRack();
    const apex = rack.find((ball) => ball.number === 1);

    expect(apex?.position.x).toBe(FOOT_SPOT.x);
    expect(apex?.position.y).not.toBe(FOOT_SPOT.y);
  });

  it("classifies solids, stripes, and the 8 ball", () => {
    expect(getBallKind(3)).toBe("solid");
    expect(getBallKind(8)).toBe("eight");
    expect(getBallKind(12)).toBe("stripe");
  });

  it("detects balls inside pockets", () => {
    expect(findContainingPocket({ x: 30, y: 30 })?.id).toBe("top-left");
    expect(findContainingPocket({ x: 30 + BALL_RADIUS, y: 30 + BALL_RADIUS })?.id).toBe("top-left");
    expect(findContainingPocket({ x: 200, y: 200 })).toBeNull();
  });

  it("detects stopped velocities", () => {
    expect(isVelocityStopped({ x: 0.03, y: 0.04 })).toBe(true);
    expect(isVelocityStopped({ x: 0.5, y: 0 })).toBe(false);
  });

  it("summarizes pocketed practice balls", () => {
    const rack = createPracticeRack();
    const pocketed = rack.filter((ball) => ball.number === 1 || ball.number === 11 || ball.number === 8);

    expect(getPracticeSummary(pocketed)).toBe("3 pocketed: 1 solid, 1 stripe, 8 ball down.");
  });

  it("assigns groups when the first player pockets a solid or stripe", () => {
    const result = evaluateShot({
      currentPlayer: 1,
      assignments: createInitialAssignments(),
      pocketedBefore: [],
      newlyPocketed: [pocketed(3, "solid")],
      scratch: false,
      firstContact: "solid",
    });

    expect(result.assignments).toEqual({ 1: "solid", 2: "stripe" });
    expect(result.currentPlayer).toBe(1);
    expect(result.playerContinues).toBe(true);
  });

  it("switches turns when no legal group ball drops", () => {
    const result = evaluateShot({
      currentPlayer: 1,
      assignments: { 1: "solid", 2: "stripe" },
      pocketedBefore: [],
      newlyPocketed: [],
      scratch: false,
      firstContact: "solid",
    });

    expect(result.currentPlayer).toBe(2);
    expect(result.playerContinues).toBe(false);
  });

  it("switches turns on scratch", () => {
    const result = evaluateShot({
      currentPlayer: 2,
      assignments: { 1: "solid", 2: "stripe" },
      pocketedBefore: [],
      newlyPocketed: [pocketed(12, "stripe")],
      scratch: true,
      firstContact: "stripe",
    });

    expect(result.currentPlayer).toBe(1);
    expect(result.foul).toBe(true);
    expect(result.playerContinues).toBe(false);
  });

  it("awards the opponent when the 8 ball drops early", () => {
    const result = evaluateShot({
      currentPlayer: 1,
      assignments: { 1: "solid", 2: "stripe" },
      pocketedBefore: [pocketed(1, "solid"), pocketed(2, "solid")],
      newlyPocketed: [pocketed(8, "eight")],
      scratch: false,
      firstContact: "eight",
    });

    expect(result.winner).toBe(2);
  });

  it("wins when a player pockets the 8 after clearing their group", () => {
    const result = evaluateShot({
      currentPlayer: 1,
      assignments: { 1: "solid", 2: "stripe" },
      pocketedBefore: [1, 2, 3, 4, 5, 6, 7].map((number) => pocketed(number, "solid")),
      newlyPocketed: [pocketed(8, "eight")],
      scratch: false,
      firstContact: "eight",
    });

    expect(result.winner).toBe(1);
  });

  it("formats player and rules labels", () => {
    expect(getOpponent(1)).toBe(2);
    expect(getGroupLabel("solid")).toBe("Solids");
    expect(getRulesSummary(1, createInitialAssignments(), [])).toContain("Open table");
  });
});

function pocketed(number: number, kind: PocketedBall["kind"]): PocketedBall {
  return {
    id: `ball-${number}`,
    number,
    kind,
  };
}
