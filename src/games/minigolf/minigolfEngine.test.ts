import { describe, expect, it } from "vitest";
import {
  COURSE_HEIGHT,
  COURSE_WIDTH,
  CUP_CAPTURE_SPEED,
  findHazard,
  getAimPower,
  getScoreLabel,
  getScoreRelativeToPar,
  getShotVector,
  getTotalPar,
  getTotalStrokes,
  isBallInCup,
  isInsideCourse,
  isVelocityStopped,
  miniGolfHoles,
} from "./minigolfEngine";

describe("mini golf course", () => {
  it("defines three playable holes with starts and cups inside the course", () => {
    expect(miniGolfHoles).toHaveLength(3);

    miniGolfHoles.forEach((hole) => {
      expect(hole.par).toBeGreaterThan(0);
      expect(isInsideCourse(hole.start)).toBe(true);
      expect(isInsideCourse(hole.cup)).toBe(true);
      expect(hole.walls.length).toBeGreaterThan(0);
      expect(hole.hazards.length).toBeGreaterThan(0);
      expect(hole.start.x).toBeGreaterThanOrEqual(0);
      expect(hole.cup.x).toBeLessThanOrEqual(COURSE_WIDTH);
      expect(hole.start.y).toBeGreaterThanOrEqual(0);
      expect(hole.cup.y).toBeLessThanOrEqual(COURSE_HEIGHT);
    });
  });

  it("adds total strokes and relative par correctly", () => {
    expect(getTotalPar()).toBe(8);
    expect(getTotalStrokes([2, 4, 3])).toBe(9);
    expect(getScoreRelativeToPar([2, 4, 3])).toBe(1);
    expect(getScoreLabel(0)).toBe("E");
    expect(getScoreLabel(2)).toBe("+2");
    expect(getScoreLabel(-1)).toBe("-1");
  });
});

describe("mini golf rules helpers", () => {
  it("captures the ball only when it is close enough and slow enough", () => {
    const cup = { x: 500, y: 300 };

    expect(isBallInCup({ x: 508, y: 300 }, cup, { x: CUP_CAPTURE_SPEED - 0.1, y: 0 })).toBe(true);
    expect(isBallInCup({ x: 508, y: 300 }, cup, { x: CUP_CAPTURE_SPEED + 0.2, y: 0 })).toBe(false);
    expect(isBallInCup({ x: 540, y: 300 }, cup, { x: 0, y: 0 })).toBe(false);
  });

  it("finds water and sand hazards by position", () => {
    const hazards = miniGolfHoles[0].hazards;

    expect(findHazard({ x: 300, y: 290 }, hazards)?.kind).toBe("water");
    expect(findHazard({ x: 790, y: 100 }, hazards)?.kind).toBe("sand");
    expect(findHazard({ x: 100, y: 100 }, hazards)).toBeNull();
  });

  it("normalizes aiming and clamps power", () => {
    const shot = getShotVector({ x: 100, y: 100 }, { x: 0, y: 100 });

    expect(shot.direction).toEqual({ x: 1, y: 0 });
    expect(shot.power).toBeGreaterThan(0);
    expect(getAimPower({ x: 100, y: 100 }, { x: -300, y: 100 })).toBe(1);
  });

  it("treats tiny velocity as stopped", () => {
    expect(isVelocityStopped({ x: 0.02, y: 0.02 })).toBe(true);
    expect(isVelocityStopped({ x: 0.12, y: 0 })).toBe(false);
  });
});
