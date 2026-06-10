import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  BRAVE_WIDTH,
  BUFFALO_X,
  CANDY_METER_VALUE,
  EXTRA_HEART_COST,
  FLOOR_Y,
  STAMPEDE_METER_MAX,
  createInitialBraveState,
  createCollectible,
  createObstacle,
  purchaseBraveUpgrade,
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

  it("collects coins and candy during a run", () => {
    const coin = {
      ...createCollectible(0, BUFFALO_X + 34),
      y: FLOOR_Y - 34,
    };
    const candy = {
      ...createCollectible(1, BUFFALO_X + 34),
      y: FLOOR_Y - 34,
    };
    const state = startBrave(createInitialBraveState());
    const nextState = stepBrave(
      {
        ...state,
        buffaloY: FLOOR_Y - 54,
        collectibles: [coin, candy],
        obstacles: [],
      },
      16,
      false,
    );

    expect(nextState.runCoins).toBe(1);
    expect(nextState.coins).toBe(1);
    expect(nextState.stampedeMeter).toBe(CANDY_METER_VALUE);
  });

  it("activates stampede and smashes obstacles instead of ending the run", () => {
    const obstacle = createObstacle(0, BUFFALO_X + 16);
    const candy = {
      ...createCollectible(1, BUFFALO_X + 34),
      y: obstacle.y + 18,
    };
    const state = {
      ...startBrave(createInitialBraveState()),
      buffaloY: obstacle.y - 18,
      stampedeMeter: STAMPEDE_METER_MAX - CANDY_METER_VALUE,
      obstacles: [obstacle],
      collectibles: [candy],
    };

    const nextState = stepBrave(state, 16, false);

    expect(nextState.phase).toBe("playing");
    expect(nextState.stampedeMs).toBeGreaterThan(0);
    expect(nextState.obstacles[0].smashed).toBe(true);
    expect(nextState.smashedObstacles).toBe(1);
  });

  it("lets upgrades add heart buffers", () => {
    const state = {
      ...createInitialBraveState(0, EXTRA_HEART_COST),
    };
    const upgraded = purchaseBraveUpgrade(state, "extraHeart");

    expect(upgraded.coins).toBe(0);
    expect(upgraded.upgrades.extraHeart).toBe(true);
    expect(upgraded.maxHearts).toBe(2);
    expect(upgraded.hearts).toBe(2);
  });

  it("adds stampede bonus distance to scoring", () => {
    const state = {
      ...startBrave(createInitialBraveState()),
      stampedeMs: 1000,
    };
    const nextState = stepBrave(state, 500, false);

    expect(nextState.score).toBeGreaterThan(Math.floor(nextState.distance / 10));
  });
});
