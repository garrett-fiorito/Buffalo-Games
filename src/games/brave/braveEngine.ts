import type { BraveCollectible, BraveObstacle, BraveState, BraveUpgrades, ObstacleType } from "./braveTypes";

export const BRAVE_WIDTH = 1200;
export const BRAVE_HEIGHT = 520;
export const FLOOR_Y = 430;
export const BUFFALO_X = 180;
export const BUFFALO_WIDTH = 72;
export const BUFFALO_HEIGHT = 54;
export const HITBOX_INSET = 12;
export const GRAVITY = 1680;
export const BOOST_ACCELERATION = -2300;
export const MAX_FALL_SPEED = 720;
export const MAX_RISE_SPEED = -620;
export const BASE_SPEED = 270;
export const MAX_SPEED = 525;
export const STAMPEDE_METER_MAX = 100;
export const CANDY_METER_VALUE = 25;
export const STAMPEDE_DURATION_MS = 5600;
export const STAMPEDE_SCORE_MULTIPLIER = 2;
export const COIN_VALUE = 1;
export const EXTRA_HEART_COST = 120;
export const HELMET_COST = 180;

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
const initialCollectibleX = BRAVE_WIDTH + 150;
const collectibleSpacing = 190;

export function createInitialBraveState(
  best = 0,
  coins = 0,
  upgrades: BraveUpgrades = createDefaultUpgrades(),
): BraveState {
  const maxHearts = getMaxHearts(upgrades);

  return {
    phase: "ready",
    buffaloY: FLOOR_Y - BUFFALO_HEIGHT,
    velocityY: 0,
    distance: 0,
    score: 0,
    best,
    speed: BASE_SPEED,
    obstacles: [0, 1, 2, 3].map((index) =>
      createObstacle(index, initialObstacleX + index * obstacleSpacing),
    ),
    nextObstacleId: 4,
    collectibles: [0, 1, 2, 3, 4].map((index) =>
      createCollectible(index, initialCollectibleX + index * collectibleSpacing),
    ),
    nextCollectibleId: 5,
    stampedeMeter: 0,
    stampedeMs: 0,
    stampedeBonusDistance: 0,
    smashedObstacles: 0,
    runCoins: 0,
    coins,
    hearts: maxHearts,
    maxHearts,
    upgrades,
  };
}

export function startBrave(state: BraveState): BraveState {
  if (state.phase === "gameOver") {
    return {
      ...createInitialBraveState(state.best, state.coins, state.upgrades),
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
  const stampedeMs = Math.max(0, state.stampedeMs - deltaMs);
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
  const movedCollectibles = state.collectibles.map((collectible) => ({
    ...collectible,
    x: collectible.x - movement,
  }));
  const recycledObstacles = recycleObstacles(movedObstacles, state.nextObstacleId);
  const recycledCollectibles = recycleCollectibles(movedCollectibles, state.nextCollectibleId);
  const collectibleResult = collectItems(
    recycledCollectibles.collectibles,
    buffaloY,
    state.stampedeMeter,
    stampedeMs,
    state.runCoins,
    state.coins,
  );
  const stampedeActiveForCollisions = collectibleResult.stampedeMs > 0;
  const distance = state.distance + movement;
  const stampedeBonusDistance = state.stampedeBonusDistance + (stampedeActiveForCollisions ? movement : 0);
  const smashResult = smashOrCollideObstacles(
    recycledObstacles.obstacles,
    buffaloY,
    stampedeActiveForCollisions,
    state.hearts,
    state.smashedObstacles,
  );
  const score = Math.floor((distance + stampedeBonusDistance) / 10) + smashResult.smashedObstacles * 10;
  const nextState: BraveState = {
    ...state,
    buffaloY,
    velocityY,
    distance,
    score,
    best: Math.max(state.best, score),
    speed,
    obstacles: smashResult.obstacles,
    nextObstacleId: recycledObstacles.nextObstacleId,
    collectibles: collectibleResult.collectibles,
    nextCollectibleId: recycledCollectibles.nextCollectibleId,
    stampedeMeter: collectibleResult.stampedeMeter,
    stampedeMs: collectibleResult.stampedeMs,
    stampedeBonusDistance,
    smashedObstacles: smashResult.smashedObstacles,
    runCoins: collectibleResult.runCoins,
    coins: collectibleResult.coins,
    hearts: smashResult.hearts,
  };

  if (smashResult.crashed) {
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

export function createCollectible(id: number, x: number): BraveCollectible {
  const type = id % 4 === 1 ? "candy" : "coin";
  const lanes = [FLOOR_Y - 118, FLOOR_Y - 210, FLOOR_Y - 300, 118, 190];

  return {
    id,
    type,
    x,
    y: lanes[id % lanes.length],
    radius: type === "candy" ? 15 : 12,
    collected: false,
  };
}

export function collidesWithObstacle(obstacle: BraveObstacle, buffaloY: number): boolean {
  if (obstacle.smashed) {
    return false;
  }

  const buffalo = getBuffaloHitbox(buffaloY);

  return (
    buffalo.x < obstacle.x + obstacle.width &&
    buffalo.x + buffalo.width > obstacle.x &&
    buffalo.y < obstacle.y + obstacle.height &&
    buffalo.y + buffalo.height > obstacle.y
  );
}

export function collidesWithCollectible(collectible: BraveCollectible, buffaloY: number): boolean {
  if (collectible.collected) {
    return false;
  }

  const buffalo = getBuffaloHitbox(buffaloY);
  const nearestX = clamp(collectible.x, buffalo.x, buffalo.x + buffalo.width);
  const nearestY = clamp(collectible.y, buffalo.y, buffalo.y + buffalo.height);

  return Math.hypot(collectible.x - nearestX, collectible.y - nearestY) <= collectible.radius;
}

export function createDefaultUpgrades(): BraveUpgrades {
  return {
    extraHeart: false,
    helmet: false,
  };
}

export function getMaxHearts(upgrades: BraveUpgrades): number {
  return 1 + (upgrades.extraHeart ? 1 : 0) + (upgrades.helmet ? 1 : 0);
}

export function purchaseBraveUpgrade(
  state: BraveState,
  upgrade: keyof BraveUpgrades,
): BraveState {
  if (state.upgrades[upgrade]) {
    return state;
  }

  const cost = upgrade === "extraHeart" ? EXTRA_HEART_COST : HELMET_COST;

  if (state.coins < cost) {
    return state;
  }

  const upgrades = {
    ...state.upgrades,
    [upgrade]: true,
  };
  const maxHearts = getMaxHearts(upgrades);

  return {
    ...state,
    coins: state.coins - cost,
    upgrades,
    maxHearts,
    hearts: Math.max(state.hearts, maxHearts),
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

function recycleCollectibles(
  collectibles: BraveCollectible[],
  nextCollectibleId: number,
): { collectibles: BraveCollectible[]; nextCollectibleId: number } {
  let currentNextId = nextCollectibleId;
  let maxX = Math.max(...collectibles.map((collectible) => collectible.x), BRAVE_WIDTH + 120);
  const nextCollectibles = collectibles.map((collectible) => {
    if (collectible.x + collectible.radius >= -60) {
      return collectible;
    }

    maxX += getCollectibleGap(currentNextId);
    const nextCollectible = createCollectible(currentNextId, maxX);
    currentNextId += 1;
    return nextCollectible;
  });

  return {
    collectibles: nextCollectibles,
    nextCollectibleId: currentNextId,
  };
}

function collectItems(
  collectibles: BraveCollectible[],
  buffaloY: number,
  currentMeter: number,
  currentStampedeMs: number,
  currentRunCoins: number,
  currentCoins: number,
): {
  collectibles: BraveCollectible[];
  stampedeMeter: number;
  stampedeMs: number;
  runCoins: number;
  coins: number;
} {
  let stampedeMeter = currentMeter;
  let stampedeMs = currentStampedeMs;
  let runCoins = currentRunCoins;
  let coins = currentCoins;

  const nextCollectibles = collectibles.map((collectible) => {
    if (!collidesWithCollectible(collectible, buffaloY)) {
      return collectible;
    }

    if (collectible.type === "coin") {
      runCoins += COIN_VALUE;
      coins += COIN_VALUE;
    } else {
      stampedeMeter += CANDY_METER_VALUE;

      if (stampedeMeter >= STAMPEDE_METER_MAX) {
        stampedeMeter = 0;
        stampedeMs = STAMPEDE_DURATION_MS;
      }
    }

    return {
      ...collectible,
      collected: true,
    };
  });

  return {
    collectibles: nextCollectibles,
    stampedeMeter,
    stampedeMs,
    runCoins,
    coins,
  };
}

function smashOrCollideObstacles(
  obstacles: BraveObstacle[],
  buffaloY: number,
  isStampeding: boolean,
  currentHearts: number,
  currentSmashedObstacles: number,
): {
  obstacles: BraveObstacle[];
  hearts: number;
  smashedObstacles: number;
  crashed: boolean;
} {
  let hearts = currentHearts;
  let smashedObstacles = currentSmashedObstacles;
  let crashed = false;

  const nextObstacles = obstacles.map((obstacle) => {
    if (!collidesWithObstacle(obstacle, buffaloY)) {
      return obstacle;
    }

    if (isStampeding) {
      smashedObstacles += 1;
      return {
        ...obstacle,
        smashed: true,
      };
    }

    hearts -= 1;

    if (hearts <= 0) {
      crashed = true;
    }

    return {
      ...obstacle,
      smashed: true,
    };
  });

  return {
    obstacles: nextObstacles,
    hearts,
    smashedObstacles,
    crashed,
  };
}

function getBuffaloHitbox(buffaloY: number) {
  return {
    x: BUFFALO_X + HITBOX_INSET,
    y: buffaloY + HITBOX_INSET,
    width: BUFFALO_WIDTH - HITBOX_INSET * 2,
    height: BUFFALO_HEIGHT - HITBOX_INSET * 2,
  };
}

function getSpeedForDistance(distance: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + distance / 85);
}

function getObstacleGap(id: number): number {
  const gaps = [260, 310, 285, 335, 300, 360];
  return gaps[id % gaps.length];
}

function getCollectibleGap(id: number): number {
  const gaps = [145, 210, 170, 240, 185, 225];
  return gaps[id % gaps.length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
