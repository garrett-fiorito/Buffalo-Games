import type { FlappyState, PipePair } from "./flappyTypes";

export const FLAPPY_WIDTH = 420;
export const FLAPPY_HEIGHT = 640;
export const BUFFALO_X = 94;
export const BUFFALO_RADIUS = 22;
export const GRAVITY = 1400;
export const FLAP_VELOCITY = -440;
export const PIPE_WIDTH = 70;
export const PIPE_GAP = 168;
export const PIPE_SPACING = 236;
export const PIPE_SPEED = 172;
export const FLOOR_HEIGHT = 54;
export const PLAYABLE_BOTTOM = FLAPPY_HEIGHT - FLOOR_HEIGHT;

const initialPipeX = FLAPPY_WIDTH + 80;

export function createInitialFlappyState(best = 0): FlappyState {
  return {
    phase: "ready",
    buffaloY: FLAPPY_HEIGHT * 0.45,
    velocityY: 0,
    pipes: [0, 1, 2].map((index) => createPipe(index, initialPipeX + index * PIPE_SPACING)),
    score: 0,
    best,
    nextPipeId: 3,
  };
}

export function flap(state: FlappyState): FlappyState {
  if (state.phase === "gameOver") {
    return {
      ...createInitialFlappyState(state.best),
      phase: "playing",
      velocityY: FLAP_VELOCITY,
    };
  }

  return {
    ...state,
    phase: "playing",
    velocityY: FLAP_VELOCITY,
  };
}

export function stepFlappy(state: FlappyState, deltaMs: number): FlappyState {
  if (state.phase !== "playing") {
    return state;
  }

  const deltaSeconds = Math.min(deltaMs, 48) / 1000;
  const velocityY = state.velocityY + GRAVITY * deltaSeconds;
  const buffaloY = state.buffaloY + velocityY * deltaSeconds;
  const movedPipes = state.pipes.map((pipe) => ({
    ...pipe,
    x: pipe.x - PIPE_SPEED * deltaSeconds,
  }));
  const recycled = recyclePipes(movedPipes, state.nextPipeId);
  const scoredPipes = scorePipes(recycled.pipes);
  const score = state.score + scoredPipes.points;
  const nextState: FlappyState = {
    ...state,
    buffaloY,
    velocityY,
    pipes: scoredPipes.pipes,
    score,
    best: Math.max(state.best, score),
    nextPipeId: recycled.nextPipeId,
  };

  if (hasCollision(nextState)) {
    return {
      ...nextState,
      phase: "gameOver",
      best: Math.max(nextState.best, nextState.score),
    };
  }

  return nextState;
}

export function hasCollision(state: Pick<FlappyState, "buffaloY" | "pipes">): boolean {
  if (state.buffaloY - BUFFALO_RADIUS <= 0 || state.buffaloY + BUFFALO_RADIUS >= PLAYABLE_BOTTOM) {
    return true;
  }

  return state.pipes.some((pipe) => collidesWithPipe(pipe, state.buffaloY));
}

export function createPipe(id: number, x: number): PipePair {
  return {
    id,
    x,
    gapY: getGapY(id),
    scored: false,
  };
}

function recyclePipes(pipes: PipePair[], nextPipeId: number): { pipes: PipePair[]; nextPipeId: number } {
  let currentNextId = nextPipeId;
  let maxX = Math.max(...pipes.map((pipe) => pipe.x));
  const nextPipes = pipes.map((pipe) => {
    if (pipe.x + PIPE_WIDTH >= -20) {
      return pipe;
    }

    maxX += PIPE_SPACING;
    const nextPipe = createPipe(currentNextId, maxX);
    currentNextId += 1;
    return nextPipe;
  });

  return {
    pipes: nextPipes,
    nextPipeId: currentNextId,
  };
}

function scorePipes(pipes: PipePair[]): { pipes: PipePair[]; points: number } {
  let points = 0;
  const nextPipes = pipes.map((pipe) => {
    if (!pipe.scored && pipe.x + PIPE_WIDTH < BUFFALO_X - BUFFALO_RADIUS) {
      points += 1;
      return {
        ...pipe,
        scored: true,
      };
    }

    return pipe;
  });

  return {
    pipes: nextPipes,
    points,
  };
}

function collidesWithPipe(pipe: PipePair, buffaloY: number): boolean {
  const horizontalOverlap =
    BUFFALO_X + BUFFALO_RADIUS > pipe.x && BUFFALO_X - BUFFALO_RADIUS < pipe.x + PIPE_WIDTH;

  if (!horizontalOverlap) {
    return false;
  }

  const gapTop = pipe.gapY - PIPE_GAP / 2;
  const gapBottom = pipe.gapY + PIPE_GAP / 2;
  return buffaloY - BUFFALO_RADIUS < gapTop || buffaloY + BUFFALO_RADIUS > gapBottom;
}

function getGapY(id: number): number {
  const gapPattern = [224, 292, 250, 334, 214, 306, 266, 356];
  return gapPattern[id % gapPattern.length];
}
