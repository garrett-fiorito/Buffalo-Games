import type { BraveObstacle, BraveState, FuelSpark, ObstacleType } from "./braveTypes";

export const BRAVE_WIDTH = 900;
export const BRAVE_HEIGHT = 520;
export const FLOOR_Y = 430;
export const BUFFALO_X = 150;
export const BUFFALO_WIDTH = 72;
export const BUFFALO_HEIGHT = 54;
export const HITBOX_INSET = 12;
export const GRAVITY = 1680;
export const BOOST_ACCELERATION = -2300;
export const MAX_FALL_SPEED = 720;
export const MAX_RISE_SPEED = -620;
export const BASE_SPEED = 270;
export const MAX_SPEED = 525;
export const SPARK_SCORE = 50;
export const NEAR_MISS_SCORE = 25;

export const scriptedObstacleTypes: ObstacleType[] = [
  "crateStack",
  "warningTower",
  "ceilingDrone",
  "laserGate",
  "lowArch",
  "rollingBarrel",
];

const initialObstacleX = BRAVE_WIDTH + 240;
const obstacleSpacing = 260;
const initialSparkX = BRAVE_WIDTH + 380;
const sparkSpacing = 430;

export function createInitialBraveState(best = 0): BraveState {
  return {
    phase: "ready",
    buffaloY: FLOOR_Y - BUFFALO_HEIGHT,
    velocityY: 0,
    distance: 0,
    bonusScore: 0,
    score: 0,
    best,
    speed: BASE_SPEED,
    obstacles: [0, 1, 2, 3].map((index) =>
      createObstacle(index, initialObstacleX + index * obstacleSpacing),
    ),
    sparks: [0, 1].map((index) => createSpark(index, initialSparkX + index * sparkSpacing)),
    nextObstacleId: 4,
    nextSparkId: 2,
    lastEvent: null,
  };
}

export function startBrave(state: BraveState): BraveState {
  if (state.phase === "gameOver") {
    return {
      ...createInitialBraveState(state.best),
      phase: "playing",
    };
  }

  return {
    ...state,
    phase: "playing",
  };
}

export function stepBrave(
  state: BraveState,
  deltaMs: number,
  isBoosting: boolean,
): BraveState {
  if (state.phase !== "playing") {
    return state;
  }

  const deltaSeconds = Math.min(deltaMs, 48) / 1000;
  const speed = getSpeedForDistance(state.distance);
  const movement = speed * deltaSeconds;
  const acceleration = isBoosting ? BOOST_ACCELERATION : GRAVITY;
  let velocityY = clamp(
    state.velocityY + acceleration * deltaSeconds,
    MAX_RISE_SPEED,
    MAX_FALL_SPEED,
  );
  let buffaloY = state.buffaloY + velocityY * deltaSeconds;

  if (buffaloY + BUFFALO_HEIGHT >= FLOOR_Y) {
    buffaloY = FLOOR_Y - BUFFALO_HEIGHT;
    velocityY = isBoosting ? Math.min(velocityY, -220) : 0;
  }

  if (buffaloY < 18) {
    buffaloY = 18;
    velocityY = Math.max(velocityY, 0);
  }

  const movedObstacles = state.obstacles.map((obstacle) => ({
    ...obstacle,
    x: obstacle.x - movement,
  }));
  const recycledObstacles = recycleObstacles(movedObstacles, state.nextObstacleId);
  const movedSparks = state.sparks.map((spark) => ({
    ...spark,
    x: spark.x - movement,
  }));
  const sparkResult = collectAndRecycleSparks(
    movedSparks,
    state.nextSparkId,
    buffaloY,
    recycledObstacles.obstacles,
  );
  const nearMissResult = awardNearMisses(recycledObstacles.obstacles, buffaloY);
  const distance = state.distance + movement;
  const bonusScore =
    state.bonusScore +
    sparkResult.collected * SPARK_SCORE +
    nearMissResult.count * NEAR_MISS_SCORE;
  const score = Math.floor(distance / 10) + bonusScore;
  const nextState: BraveState = {
    ...state,
    buffaloY,
    velocityY,
    distance,
    bonusScore,
    score,
    best: Math.max(state.best, score),
    speed,
    obstacles: nearMissResult.obstacles,
    sparks: sparkResult.sparks,
    nextObstacleId: recycledObstacles.nextObstacleId,
    nextSparkId: sparkResult.nextSparkId,
    lastEvent:
      sparkResult.collected > 0 ? "spark" : nearMissResult.count > 0 ? "nearMiss" : null,
  };

  if (nextState.obstacles.some((obstacle) => collidesWithObstacle(obstacle, nextState.buffaloY))) {
    return {
      ...nextState,
      phase: "gameOver",
      best: Math.max(nextState.best, nextState.score),
    };
  }

  return nextState;
}

export function createObstacle(id: number, x: number): BraveObstacle {
  const type = scriptedObstacleTypes[id % scriptedObstacleTypes.length];

  switch (type) {
    case "crateStack":
      return { id, type, x, y: FLOOR_Y - 76, width: 58, height: 76, nearMissed: false };
    case "warningTower":
      return { id, type, x, y: FLOOR_Y - 128, width: 48, height: 128, nearMissed: false };
    case "ceilingDrone":
      return { id, type, x, y: 92, width: 84, height: 42, nearMissed: false };
    case "laserGate":
      return { id, type, x, y: 185, width: 48, height: 165, nearMissed: false };
    case "lowArch":
      return { id, type, x, y: 264, width: 122, height: 46, nearMissed: false };
    case "rollingBarrel":
      return { id, type, x, y: FLOOR_Y - 52, width: 54, height: 52, nearMissed: false };
    default:
      return { id, type, x, y: FLOOR_Y - 76, width: 58, height: 76, nearMissed: false };
  }
}

export function createSpark(id: number, x: number): FuelSpark {
  const yPattern = [138, 246, 334, 186, 292, 112];

  return {
    id,
    x,
    y: yPattern[id % yPattern.length],
    radius: 12,
  };
}

export function collidesWithObstacle(obstacle: BraveObstacle, buffaloY: number): boolean {
  const buffalo = getBuffaloHitbox(buffaloY);

  return (
    buffalo.x < obstacle.x + obstacle.width &&
    buffalo.x + buffalo.width > obstacle.x &&
    buffalo.y < obstacle.y + obstacle.height &&
    buffalo.y + buffalo.height > obstacle.y
  );
}

function collectAndRecycleSparks(
  sparks: FuelSpark[],
  nextSparkId: number,
  buffaloY: number,
  obstacles: BraveObstacle[],
): { sparks: FuelSpark[]; nextSparkId: number; collected: number } {
  let currentNextId = nextSparkId;
  let maxX = Math.max(...sparks.map((spark) => spark.x), BRAVE_WIDTH);
  let collected = 0;
  const nextSparks = sparks.map((spark) => {
    if (spark.x + spark.radius < -40 || collidesWithSpark(spark, buffaloY)) {
      if (collidesWithSpark(spark, buffaloY)) {
        collected += 1;
      }

      maxX += sparkSpacing;
      const nextSpark = createSpark(currentNextId, maxX + getSparkOffset(currentNextId, obstacles));
      currentNextId += 1;
      return nextSpark;
    }

    return spark;
  });

  return {
    sparks: nextSparks,
    nextSparkId: currentNextId,
    collected,
  };
}

function recycleObstacles(
  obstacles: BraveObstacle[],
  nextObstacleId: number,
): { obstacles: BraveObstacle[]; nextObstacleId: number } {
  let currentNextId = nextObstacleId;
  let maxX = Math.max(...obstacles.map((obstacle) => obstacle.x), BRAVE_WIDTH + 120);
  const nextObstacles = obstacles.map((obstacle) => {
    if (obstacle.x + obstacle.width >= -60) {
      return obstacle;
    }

    maxX += getObstacleGap(currentNextId);
    const nextObstacle = createObstacle(currentNextId, maxX);
    currentNextId += 1;
    return nextObstacle;
  });

  return {
    obstacles: nextObstacles,
    nextObstacleId: currentNextId,
  };
}

function awardNearMisses(
  obstacles: BraveObstacle[],
  buffaloY: number,
): { obstacles: BraveObstacle[]; count: number } {
  let count = 0;
  const buffalo = getBuffaloHitbox(buffaloY);
  const nextObstacles = obstacles.map((obstacle) => {
    if (obstacle.nearMissed || obstacle.x + obstacle.width >= buffalo.x) {
      return obstacle;
    }

    const verticalGap = getVerticalGap(buffalo, obstacle);

    if (verticalGap > 42) {
      return obstacle;
    }

    count += 1;
    return {
      ...obstacle,
      nearMissed: true,
    };
  });

  return {
    obstacles: nextObstacles,
    count,
  };
}

function collidesWithSpark(spark: FuelSpark, buffaloY: number): boolean {
  const buffalo = getBuffaloHitbox(buffaloY);
  const closestX = clamp(spark.x, buffalo.x, buffalo.x + buffalo.width);
  const closestY = clamp(spark.y, buffalo.y, buffalo.y + buffalo.height);

  return Math.hypot(spark.x - closestX, spark.y - closestY) <= spark.radius;
}

function getBuffaloHitbox(buffaloY: number) {
  return {
    x: BUFFALO_X + HITBOX_INSET,
    y: buffaloY + HITBOX_INSET,
    width: BUFFALO_WIDTH - HITBOX_INSET * 2,
    height: BUFFALO_HEIGHT - HITBOX_INSET * 2,
  };
}

function getVerticalGap(
  buffalo: { y: number; height: number },
  obstacle: Pick<BraveObstacle, "y" | "height">,
): number {
  if (buffalo.y + buffalo.height < obstacle.y) {
    return obstacle.y - (buffalo.y + buffalo.height);
  }

  if (obstacle.y + obstacle.height < buffalo.y) {
    return buffalo.y - (obstacle.y + obstacle.height);
  }

  return 0;
}

function getSpeedForDistance(distance: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + distance / 85);
}

function getObstacleGap(id: number): number {
  const gaps = [260, 310, 285, 335, 300, 360];
  return gaps[id % gaps.length];
}

function getSparkOffset(id: number, obstacles: BraveObstacle[]): number {
  const nearestObstacle = obstacles.find((obstacle) => obstacle.id % 3 === id % 3);
  return nearestObstacle ? 80 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
