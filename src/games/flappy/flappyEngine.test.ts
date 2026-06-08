import { describe, expect, it } from "vitest";
import {
  BUFFALO_X,
  FLAP_VELOCITY,
  PIPE_WIDTH,
  createInitialFlappyState,
  createPipe,
  flap,
  hasCollision,
  stepFlappy,
} from "./flappyEngine";

describe("flappyEngine", () => {
  it("starts in ready state", () => {
    const state = createInitialFlappyState();

    expect(state.phase).toBe("ready");
    expect(state.score).toBe(0);
    expect(state.pipes).toHaveLength(3);
  });

  it("starts play and applies upward velocity on flap", () => {
    const state = flap(createInitialFlappyState());

    expect(state.phase).toBe("playing");
    expect(state.velocityY).toBe(FLAP_VELOCITY);
  });

  it("moves the buffalo and pipes while playing", () => {
    const state = stepFlappy(flap(createInitialFlappyState()), 120);

    expect(state.buffaloY).toBeLessThan(createInitialFlappyState().buffaloY);
    expect(state.pipes[0].x).toBeLessThan(createInitialFlappyState().pipes[0].x);
  });

  it("scores when the buffalo passes a pipe", () => {
    const state = {
      ...flap(createInitialFlappyState()),
      pipes: [createPipe(0, BUFFALO_X - PIPE_WIDTH - 30)],
    };

    const nextState = stepFlappy(state, 16);

    expect(nextState.score).toBe(1);
    expect(nextState.pipes[0].scored).toBe(true);
  });

  it("detects floor collisions", () => {
    const state = {
      ...createInitialFlappyState(),
      buffaloY: 620,
    };

    expect(hasCollision(state)).toBe(true);
  });

  it("ends the game on pipe collision", () => {
    const state = {
      ...flap(createInitialFlappyState()),
      buffaloY: 80,
      pipes: [createPipe(0, BUFFALO_X)],
    };

    expect(stepFlappy(state, 16).phase).toBe("gameOver");
  });
});
