import { describe, expect, it } from "vitest";
import {
  BALL_RADIUS,
  FOOT_SPOT,
  createPracticeRack,
  findContainingPocket,
  getBallKind,
  getPracticeSummary,
  isVelocityStopped,
} from "./billiardsEngine";

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
    expect(eight?.position.y).toBe(FOOT_SPOT.y);
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
});
