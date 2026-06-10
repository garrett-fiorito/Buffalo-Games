import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  BRAVE_WIDTH,
  BUFFALO_X,
  FLOOR_Y,
  NEAR_MISS_SCORE,
  SPARK_SCORE,
  createInitialBraveState,
  createObstacle,
  scriptedObstacleTypes,
  startBrave,
  stepBrave,
} from "./braveEngine";

describe("braveEngine", () => {
  it("starts ready with six scripted obstacle types available", () => {
    const state = createInitialBraveState();

    expect(state.phase).toBe("ready");
    expect(new Set(scriptedObstacleTypes).size).toBe(6);
    expect(state.obstacles).toHaveLength(4);
  });

  it("starts playing from the ready state", () => {
    expect(startBrave(createInitialBraveState()).phase).toBe("playing");
  });

  it("falls when boost is not held", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: 220,
      velocityY: 0,
    };

    const nextState = stepBrave(state, 120, false);

    expect(nextState.buffaloY).toBeGreaterThan(state.buffaloY);
    expect(nextState.velocityY).toBeGreaterThan(0);
  });

  it("rises when boost is held", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: 260,
      velocityY: 0,
    };

    const nextState = stepBrave(state, 120, true);

    expect(nextState.buffaloY).toBeLessThan(state.buffaloY);
    expect(nextState.velocityY).toBeLessThan(0);
  });

  it("can run on the floor without falling through it", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: FLOOR_Y,
      velocityY: 500,
    };

    const nextState = stepBrave(state, 120, false);

    expect(nextState.buffaloY).toBeLessThan(FLOOR_Y);
    expect(nextState.velocityY).toBe(0);
  });

  it("increases score with distance", () => {
    const state = startBrave(createInitialBraveState());
    const nextState = stepBrave(state, 1000, false);

    expect(nextState.distance).toBeGreaterThan(0);
    expect(nextState.score).toBeGreaterThan(0);
    expect(nextState.speed).toBeGreaterThanOrEqual(BASE_SPEED);
  });

  it("recycles obstacles that leave the screen", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      obstacles: [createObstacle(0, -180)],
      nextObstacleId: 6,
    };

    const nextState = stepBrave(state, 16, false);

    expect(nextState.obstacles[0].x).toBeGreaterThan(BRAVE_WIDTH);
    expect(nextState.nextObstacleId).toBe(7);
  });

  it("ends on obstacle collision with a forgiving hitbox", () => {
    const obstacle = createObstacle(0, BUFFALO_X + 16);
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: obstacle.y - 18,
      obstacles: [obstacle],
    };

    expect(stepBrave(state, 16, false).phase).toBe("gameOver");
  });

  it("awards spark bonus and recycles the spark", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: 200,
      sparks: [{ id: 0, x: BUFFALO_X + 24, y: 228, radius: 14 }],
    };

    const nextState = stepBrave(state, 16, false);

    expect(nextState.bonusScore).toBe(SPARK_SCORE);
    expect(nextState.lastEvent).toBe("spark");
  });

  it("awards near miss bonus once when narrowly clearing an obstacle", () => {
    const obstacle = {
      ...createObstacle(2, BUFFALO_X - 96),
      y: 188,
      height: 42,
      nearMissed: false,
    };
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: 230,
      obstacles: [obstacle],
    };

    const nextState = stepBrave(state, 16, false);

    expect(nextState.bonusScore).toBe(NEAR_MISS_SCORE);
    expect(nextState.lastEvent).toBe("nearMiss");
    expect(nextState.obstacles[0].nearMissed).toBe(true);
  });
});
