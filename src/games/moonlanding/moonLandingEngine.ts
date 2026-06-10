import type { MoonAsteroid, MoonControls, MoonGasStation, MoonLandingState, MoonShip } from "./moonLandingTypes";

export const MOON_WIDTH = 1200;
export const MOON_HEIGHT = 620;
export const MOON_GROUND_Y = 540;
export const SHIP_WIDTH = 44;
export const SHIP_HEIGHT = 58;
export const MAX_FUEL = 100;
export const MAX_HEALTH = 100;
export const PLANET_DISTANCE = 6000;
export const GAS_STATION_SPACING = 1450;
export const GRAVITY = 360;
export const THRUST_ACCELERATION = 760;
export const SIDE_ACCELERATION = 620;
export const DRAG = 0.992;
export const MAX_HORIZONTAL_SPEED = 520;
export const MAX_VERTICAL_SPEED = 520;
export const FUEL_DRAIN_PER_SECOND = 13;
export const SAFE_LANDING_SPEED = 115;
export const SAFE_HORIZONTAL_SPEED = 105;
export const LANDING_DAMAGE = 18;
export const ASTEROID_DAMAGE = 22;

const startingShip: MoonShip = {
  position: { x: 130, y: 250 },
  velocity: { x: 0, y: 0 },
};

export function createInitialMoonLandingState(best = 0): MoonLandingState {
  return {
    phase: "ready",
    ship: cloneShip(startingShip),
    cameraX: 0,
    distance: 0,
    best,
    fuel: MAX_FUEL,
    health: MAX_HEALTH,
    planetIndex: 1,
    nextPlanetDistance: PLANET_DISTANCE,
    asteroids: createAsteroids(0),
    gasStations: createGasStations(0),
    message: "Use arrows to fly. Land gently on gas stations.",
    checkpointFlashMs: 0,
  };
}

export function startMoonLanding(state: MoonLandingState): MoonLandingState {
  if (state.phase === "gameOver") {
    return {
      ...createInitialMoonLandingState(state.best),
      phase: "playing",
    };
  }

  return {
    ...state,
    phase: "playing",
    message: "Fuel matters. Touch down gently.",
  };
}

export function stepMoonLanding(
  state: MoonLandingState,
  deltaMs: number,
  controls: MoonControls,
): MoonLandingState {
  if (state.phase !== "playing") {
    return state;
  }

  const deltaSeconds = Math.min(deltaMs, 50) / 1000;
  const thrusting = controls.up && state.fuel > 0;
  const horizontalThrust = state.fuel > 0 && (controls.left || controls.right);
  let fuel = Math.max(
    0,
    state.fuel -
      (thrusting ? FUEL_DRAIN_PER_SECOND * deltaSeconds : 0) -
      (horizontalThrust ? FUEL_DRAIN_PER_SECOND * 0.52 * deltaSeconds : 0),
  );
  let velocityX = state.ship.velocity.x;
  let velocityY = state.ship.velocity.y + GRAVITY * deltaSeconds;

  if (thrusting) {
    velocityY -= THRUST_ACCELERATION * deltaSeconds;
  }

  if (horizontalThrust && controls.right) {
    velocityX += SIDE_ACCELERATION * deltaSeconds;
  }

  if (horizontalThrust && controls.left) {
    velocityX -= SIDE_ACCELERATION * deltaSeconds;
  }

  velocityX = clamp(velocityX * DRAG, -MAX_HORIZONTAL_SPEED, MAX_HORIZONTAL_SPEED);
  velocityY = clamp(velocityY, -MAX_VERTICAL_SPEED, MAX_VERTICAL_SPEED);

  let x = state.ship.position.x + velocityX * deltaSeconds;
  let y = state.ship.position.y + velocityY * deltaSeconds;
  const leftBoundary = state.cameraX + SHIP_WIDTH / 2;

  if (x < leftBoundary) {
    x = leftBoundary;
    velocityX = Math.max(0, velocityX);
  }

  const rightWorldEdge = state.nextPlanetDistance + MOON_WIDTH * 0.65;
  if (x > rightWorldEdge) {
    x = rightWorldEdge;
    velocityX = Math.min(0, velocityX);
  }

  if (y < 24) {
    y = 24;
    velocityY = Math.max(0, velocityY);
  }

  let health = state.health;
  let message = state.message;
  let gasStations = state.gasStations;
  let ship = { position: { x, y }, velocity: { x: velocityX, y: velocityY } };

  const landingStation = gasStations.find((station) => isShipOnGasStation(ship, station));
  if (landingStation) {
    const safeLanding = isSafeLanding(ship);
    const roughLanding = Math.abs(velocityY) > SAFE_LANDING_SPEED || Math.abs(velocityX) > SAFE_HORIZONTAL_SPEED;
    const takingOff = thrusting && velocityY < 0;

    if (!takingOff) {
      y = landingStation.y - SHIP_HEIGHT / 2;
      velocityY = 0;
      velocityX *= 0.45;
      ship = { position: { x, y }, velocity: { x: velocityX, y: velocityY } };

      if (safeLanding) {
        fuel = MAX_FUEL;
        health = Math.max(health, MAX_HEALTH / 2);
        gasStations = gasStations.map((station) =>
          station.id === landingStation.id ? { ...station, used: true } : station,
        );
        message = "Refueled. Hold thrust to lift off.";
      } else if (roughLanding) {
        health = Math.max(0, health - LANDING_DAMAGE);
        message = "Rough landing. Slow down before touching pads.";
      }
    }
  } else if (y + SHIP_HEIGHT / 2 >= MOON_GROUND_Y) {
    const hardImpact = Math.abs(velocityY) > SAFE_LANDING_SPEED || Math.abs(velocityX) > SAFE_HORIZONTAL_SPEED * 1.35;
    y = MOON_GROUND_Y - SHIP_HEIGHT / 2;
    velocityY = 0;
    velocityX *= 0.35;
    ship = { position: { x, y }, velocity: { x: velocityX, y: velocityY } };
    if (hardImpact) {
      health = Math.max(0, health - LANDING_DAMAGE);
      message = "Hard ground impact. Find a gas station.";
    }
  }

  const asteroidResult = collideAsteroids(state.asteroids, ship, health);
  health = asteroidResult.health;
  const asteroids = recycleAsteroids(asteroidResult.asteroids, x);
  gasStations = recycleGasStations(gasStations, x);
  let cameraX = Math.max(state.cameraX, x - MOON_WIDTH * 0.34);
  let planetIndex = state.planetIndex;
  let nextPlanetDistance = state.nextPlanetDistance;
  let checkpointFlashMs = Math.max(0, state.checkpointFlashMs - deltaMs);

  if (x >= nextPlanetDistance) {
    planetIndex += 1;
    nextPlanetDistance += PLANET_DISTANCE;
    fuel = MAX_FUEL;
    health = MAX_HEALTH;
    message = `Planet ${planetIndex} reached. Systems restored.`;
    checkpointFlashMs = 2400;
    cameraX = Math.max(cameraX, x - MOON_WIDTH * 0.2);
  }

  const distance = Math.max(state.distance, Math.floor(x));
  const best = Math.max(state.best, distance);

  if (health <= 0) {
    return {
      ...state,
      phase: "gameOver",
      ship,
      cameraX,
      distance,
      best,
      fuel,
      health: 0,
      asteroids,
      gasStations,
      message: "Mission failed. Hull integrity lost.",
      checkpointFlashMs,
    };
  }

  if (fuel <= 0 && Math.abs(ship.velocity.x) < 6 && Math.abs(ship.velocity.y) < 6) {
    return {
      ...state,
      phase: "gameOver",
      ship,
      cameraX,
      distance,
      best,
      fuel,
      health,
      asteroids,
      gasStations,
      message: "Out of fuel and stranded.",
      checkpointFlashMs,
    };
  }

  return {
    ...state,
    ship,
    cameraX,
    distance,
    best,
    fuel,
    health,
    planetIndex,
    nextPlanetDistance,
    asteroids,
    gasStations,
    message,
    checkpointFlashMs,
  };
}

export function isSafeLanding(ship: MoonShip): boolean {
  return Math.abs(ship.velocity.y) <= SAFE_LANDING_SPEED && Math.abs(ship.velocity.x) <= SAFE_HORIZONTAL_SPEED;
}

export function isShipOnGasStation(ship: MoonShip, station: MoonGasStation): boolean {
  const shipBottom = ship.position.y + SHIP_HEIGHT / 2;
  const shipLeft = ship.position.x - SHIP_WIDTH / 2;
  const shipRight = ship.position.x + SHIP_WIDTH / 2;

  return (
    shipBottom >= station.y - 8 &&
    shipBottom <= station.y + 18 &&
    shipRight > station.x &&
    shipLeft < station.x + station.width
  );
}

export function createAsteroids(seedOffset: number): MoonAsteroid[] {
  return Array.from({ length: 9 }, (_, index) => createAsteroid(index, 620 + seedOffset + index * 330));
}

export function createGasStations(seedOffset: number): MoonGasStation[] {
  return Array.from({ length: 5 }, (_, index) =>
    createGasStation(index, 1180 + seedOffset + index * GAS_STATION_SPACING),
  );
}

function createAsteroid(id: number, x: number): MoonAsteroid {
  const wave = seededNoise(id + Math.floor(x / 211));
  return {
    id,
    x,
    y: 95 + ((id * 83 + Math.floor(wave * 190)) % 330),
    radius: 24 + (id % 4) * 6,
    driftX: -18 + (id % 5) * 9,
    driftY: -16 + (id % 3) * 16,
    hit: false,
  };
}

function createGasStation(id: number, x: number): MoonGasStation {
  return {
    id,
    x,
    y: MOON_GROUND_Y - 22,
    width: 132,
    height: 24,
    used: false,
  };
}

function recycleAsteroids(asteroids: MoonAsteroid[], shipX: number): MoonAsteroid[] {
  const farthest = Math.max(...asteroids.map((asteroid) => asteroid.x));

  return asteroids.map((asteroid, index) => {
    if (asteroid.x > shipX - 520) {
      return asteroid;
    }

    return createAsteroid(asteroid.id + asteroids.length, farthest + 280 + index * 46);
  });
}

function recycleGasStations(stations: MoonGasStation[], shipX: number): MoonGasStation[] {
  const farthest = Math.max(...stations.map((station) => station.x));

  return stations.map((station, index) => {
    if (station.x + station.width > shipX - 650) {
      return station;
    }

    return createGasStation(station.id + stations.length, farthest + GAS_STATION_SPACING + index * 46);
  });
}

function collideAsteroids(
  asteroids: MoonAsteroid[],
  ship: MoonShip,
  health: number,
): { asteroids: MoonAsteroid[]; health: number } {
  let nextHealth = health;

  const nextAsteroids = asteroids.map((asteroid) => {
    const nextAsteroid = {
      ...asteroid,
      x: asteroid.x + asteroid.driftX / 60,
      y: asteroid.y + asteroid.driftY / 60,
    };

    if (nextAsteroid.y < 70 || nextAsteroid.y > MOON_GROUND_Y - 120) {
      nextAsteroid.driftY *= -1;
    }

    if (nextAsteroid.hit || !shipAsteroidCollision(ship, nextAsteroid)) {
      return nextAsteroid;
    }

    nextHealth = Math.max(0, nextHealth - ASTEROID_DAMAGE);
    return { ...nextAsteroid, hit: true };
  });

  return { asteroids: nextAsteroids, health: nextHealth };
}

function shipAsteroidCollision(ship: MoonShip, asteroid: MoonAsteroid): boolean {
  const nearestX = clamp(asteroid.x, ship.position.x - SHIP_WIDTH / 2, ship.position.x + SHIP_WIDTH / 2);
  const nearestY = clamp(asteroid.y, ship.position.y - SHIP_HEIGHT / 2, ship.position.y + SHIP_HEIGHT / 2);

  return Math.hypot(asteroid.x - nearestX, asteroid.y - nearestY) <= asteroid.radius;
}

function cloneShip(ship: MoonShip): MoonShip {
  return {
    position: { ...ship.position },
    velocity: { ...ship.velocity },
  };
}

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 999.133) * 10000;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
